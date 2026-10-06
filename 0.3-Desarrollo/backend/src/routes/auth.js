const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'cambia-este-secreto';
const JWT_EXPIRA = process.env.JWT_EXPIRES_IN || '2h';
const REFRESH_DIAS = Number(process.env.REFRESH_EXPIRES_DIAS || 7);

// Genera un refresh token aleatorio, guarda su HASH en la base de datos
// (nunca el valor real) y devuelve el token en texto plano para el cliente.
async function generarRefreshToken(usuarioId, connection = pool, mfaVerificadoEn = new Date()) {
  const tokenPlano = crypto.randomBytes(40).toString('hex');
  const hash = crypto.createHash('sha256').update(tokenPlano).digest('hex');
  const expiracion = new Date(Date.now() + REFRESH_DIAS * 24 * 60 * 60 * 1000);

  await connection.query(
    'INSERT INTO refresh_tokens (usuario_id, token_hash, fecha_expiracion, mfa_verificado_en) VALUES (?, ?, ?, ?)',
    [usuarioId, hash, expiracion, mfaVerificadoEn]
  );

  return tokenPlano;
}

function firmarAccessToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRA });
}

// jwt.decode().exp viene en segundos desde epoch; el frontend necesita ms
function expiraEnMs(accessToken) {
  return jwt.decode(accessToken).exp * 1000;
}

const MFA_CODIGO_VIGENCIA_MINUTOS = 5;
const MFA_INTENTOS_MAXIMOS = 5;
const MFA_REENVIO_ESPERA_SEGUNDOS = 60;
const MFA_REENVIO_MAXIMOS = 5;
const MFA_REINTENTOS_LOGIN_VENTANA_MINUTOS = 15;
const MFA_REINTENTOS_LOGIN_MAXIMOS = 5;

function hashCodigoMfa(retoId, usuarioId, codigo) {
  const pepper = process.env.MFA_TOKEN_PEPPER || '';
  if (pepper.length < 32 || pepper.startsWith('replace_')) {
    throw new Error('MFA_TOKEN_PEPPER debe configurarse con al menos 32 caracteres aleatorios');
  }
  return crypto.createHmac('sha256', pepper)
    .update(`${retoId}:${usuarioId}:${codigo}`)
    .digest('hex');
}

function compararHashesMfa(hashA, hashB) {
  const bufferA = Buffer.from(hashA, 'hex');
  const bufferB = Buffer.from(hashB, 'hex');
  return bufferA.length === bufferB.length && crypto.timingSafeEqual(bufferA, bufferB);
}

function generarCodigoMfa() {
  return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
}

function enmascararCorreo(correo) {
  const [nombre, dominio] = String(correo).split('@');
  if (!dominio) return 'tu correo registrado';
  const prefijo = nombre.length < 3 ? nombre[0] : nombre.slice(0, 2);
  return `${prefijo}${'*'.repeat(Math.max(2, nombre.length - prefijo.length))}@${dominio}`;
}

function obtenerWebhookMfa() {
  const webhook = process.env.N8N_MFA_WEBHOOK_URL;
  const secreto = process.env.N8N_MFA_WEBHOOK_SECRET;
  if (!webhook || !secreto || secreto.startsWith('replace_')) {
    throw new Error('La entrega MFA requiere N8N_MFA_WEBHOOK_URL y N8N_MFA_WEBHOOK_SECRET');
  }

  let url;
  try {
    url = new URL(webhook);
  } catch {
    throw new Error('N8N_MFA_WEBHOOK_URL no es una URL válida');
  }
  const localhost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(localhost && url.protocol === 'http:')) {
    throw new Error('El webhook MFA debe usar HTTPS');
  }
  if (url.username || url.password) {
    throw new Error('No incluyas credenciales dentro de la URL del webhook MFA');
  }
  return { url: url.toString(), secreto };
}

async function enviarCodigoMfa({ usuarioId, correo, retoId, codigo }) {
  const { url, secreto } = obtenerWebhookMfa();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secreto}`
      },
      signal: controller.signal,
      body: JSON.stringify({
        event: 'mfa.login.code',
        email: correo,
        token_mfa: codigo,
        timestamp: new Date().toISOString(),
        user_id: usuarioId,
        challenge_id: retoId,
        expires_in_seconds: MFA_CODIGO_VIGENCIA_MINUTOS * 60
      })
    });
    if (!response.ok) {
      throw new Error(`Webhook MFA respondió HTTP ${response.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function crearRetoMfa(usuario) {
  const [intentos] = await pool.query(
    `SELECT COUNT(*) AS cantidad
     FROM retos_mfa
     WHERE usuario_id = ? AND creado_en >= DATE_SUB(NOW(), INTERVAL ? MINUTE)`,
    [usuario.id, MFA_REINTENTOS_LOGIN_VENTANA_MINUTOS]
  );
  if (Number(intentos[0].cantidad) >= MFA_REINTENTOS_LOGIN_MAXIMOS) {
    const error = new Error('Demasiados intentos de acceso. Espera unos minutos antes de volver a intentarlo.');
    error.status = 429;
    throw error;
  }

  const retoId = crypto.randomBytes(32).toString('hex');
  const codigo = generarCodigoMfa();
  const codigoHash = hashCodigoMfa(retoId, usuario.id, codigo);

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('SELECT id FROM usuarios WHERE id = ? FOR UPDATE', [usuario.id]);
    await connection.query(
      "UPDATE retos_mfa SET estado = 'cancelado' WHERE usuario_id = ? AND estado = 'pendiente'",
      [usuario.id]
    );
    await connection.query(
      `INSERT INTO retos_mfa (reto_id, usuario_id, codigo_hash, expira_en)
       VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
      [retoId, usuario.id, codigoHash, MFA_CODIGO_VIGENCIA_MINUTOS]
    );
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }

  try {
    await enviarCodigoMfa({ usuarioId: usuario.id, correo: usuario.correo, retoId, codigo });
  } catch (err) {
    await pool.query(
      "UPDATE retos_mfa SET estado = 'cancelado' WHERE reto_id = ? AND estado = 'pendiente'",
      [retoId]
    );
    console.error('[auth] No se pudo enviar el código MFA:', err.message);
    const error = new Error('No fue posible enviar el código de seguridad. Intenta iniciar sesión nuevamente más tarde.');
    error.status = 503;
    throw error;
  }

  return { retoId, correoEnmascarado: enmascararCorreo(usuario.correo) };
}

// POST /api/auth/registro -> crea las credenciales de acceso (correo + contraseña)
// Nota: el correo aquí se guarda en texto plano porque se usa como identificador
// único de login (índice UNIQUE). Es distinto del correo cifrado que se guarda
// en la tabla "clientes" como dato privado del funcionario.
router.post('/registro', async (req, res) => {
  try {
    const correo = String(req.body?.correo || '').trim().toLowerCase();
    const { password, clienteId } = req.body || {};

    if (!correo || typeof password !== 'string' || !password) {
      return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const [existente] = await pool.query('SELECT id FROM usuarios WHERE correo = ?', [correo]);
    if (existente.length) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });
    }

    const hash = await bcrypt.hash(password, 10);
    const [resultado] = await pool.query(
      'INSERT INTO usuarios (correo, password_hash, cliente_id) VALUES (?, ?, ?)',
      [correo, hash, clienteId || null]
    );

    res.status(201).json({
      ok: true,
      correo,
      id: resultado.insertId,
      clienteId: clienteId || null,
      rol: 'cliente'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creando la cuenta' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const correo = String(req.body?.correo || '').trim().toLowerCase();
    const { password } = req.body || {};
    if (!correo || typeof password !== 'string' || !password) {
      return res.status(400).json({ error: 'Correo y contraseña son obligatorios' });
    }

    const [filas] = await pool.query('SELECT * FROM usuarios WHERE correo = ?', [correo]);
    if (!filas.length) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    const usuario = filas[0];
    const coincide = await bcrypt.compare(password, usuario.password_hash);
    if (!coincide) {
      return res.status(401).json({ error: 'Correo o contraseña incorrectos' });
    }

    const reto = await crearRetoMfa(usuario);
    res.status(202).json({
      mfaRequired: true,
      challengeId: reto.retoId,
      expiresIn: MFA_CODIGO_VIGENCIA_MINUTOS * 60,
      correoEnmascarado: reto.correoEnmascarado
    });
  } catch (err) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('[auth] Error iniciando el desafío MFA:', err.message);
    res.status(503).json({ error: 'No fue posible iniciar la verificación de seguridad. Intenta de nuevo más tarde.' });
  }
});

router.post('/mfa/verificar', async (req, res) => {
  const retoId = String(req.body?.challengeId || '');
  const codigo = String(req.body?.code || '');
  if (!/^[a-f0-9]{64}$/.test(retoId) || !/^\d{6}$/.test(codigo)) {
    return res.status(400).json({ error: 'El código de seguridad debe contener seis dígitos.' });
  }

  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [retos] = await connection.query(
      `SELECT r.usuario_id, r.codigo_hash, r.estado, r.intentos,
              (r.expira_en > NOW()) AS vigente,
              u.correo, u.rol, u.cliente_id
       FROM retos_mfa r
       JOIN usuarios u ON u.id = r.usuario_id
       WHERE r.reto_id = ?
       FOR UPDATE`,
      [retoId]
    );
    if (!retos.length || retos[0].estado !== 'pendiente') {
      await connection.rollback();
      return res.status(401).json({ error: 'El código no es válido o ya no está disponible. Inicia sesión nuevamente.' });
    }

    const reto = retos[0];
    if (!reto.vigente) {
      await connection.query("UPDATE retos_mfa SET estado = 'expirado' WHERE reto_id = ?", [retoId]);
      await connection.commit();
      return res.status(410).json({ error: 'El código expiró. Inicia sesión nuevamente para recibir otro.' });
    }

    if (Number(reto.intentos) >= MFA_INTENTOS_MAXIMOS) {
      await connection.query("UPDATE retos_mfa SET estado = 'bloqueado' WHERE reto_id = ?", [retoId]);
      await connection.commit();
      return res.status(429).json({ error: 'Se agotaron los intentos. Inicia sesión nuevamente para solicitar otro código.' });
    }

    let codigoCorrecto = false;
    try {
      codigoCorrecto = compararHashesMfa(
        reto.codigo_hash,
        hashCodigoMfa(retoId, reto.usuario_id, codigo)
      );
    } catch (err) {
      await connection.rollback();
      console.error('[auth] La clave de MFA no está configurada correctamente:', err.message);
      return res.status(503).json({ error: 'La verificación de seguridad no está disponible temporalmente.' });
    }

    if (!codigoCorrecto) {
      const intentosRestantes = MFA_INTENTOS_MAXIMOS - Number(reto.intentos) - 1;
      await connection.query(
        `UPDATE retos_mfa
         SET intentos = intentos + 1,
             estado = IF(intentos >= ?, 'bloqueado', 'pendiente')
         WHERE reto_id = ?`,
        [MFA_INTENTOS_MAXIMOS, retoId]
      );
      await connection.commit();
      return res.status(401).json({
        error: intentosRestantes > 0
          ? `El código no coincide. Te quedan ${intentosRestantes} intento(s).`
          : 'Se agotaron los intentos. Inicia sesión nuevamente para solicitar otro código.'
      });
    }

    const ahora = new Date();
    const token = firmarAccessToken({
      uid: reto.usuario_id,
      correo: reto.correo,
      rol: reto.rol,
      clienteId: reto.cliente_id,
      mfa: true
    });
    const refreshToken = await generarRefreshToken(reto.usuario_id, connection, ahora);
    await connection.query(
      "UPDATE retos_mfa SET estado = 'verificado' WHERE reto_id = ? AND estado = 'pendiente'",
      [retoId]
    );
    await connection.commit();

    res.json({
      token,
      refreshToken,
      expiraEn: expiraEnMs(token),
      correo: reto.correo,
      id: reto.usuario_id,
      clienteId: reto.cliente_id,
      rol: reto.rol,
      mfaVerified: true
    });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('[auth] Error verificando MFA:', err.message);
    res.status(500).json({ error: 'No fue posible completar la verificación de seguridad.' });
  } finally {
    if (connection) connection.release();
  }
});

router.post('/mfa/reenviar', async (req, res) => {
  const retoId = String(req.body?.challengeId || '');
  if (!/^[a-f0-9]{64}$/.test(retoId)) {
    return res.status(400).json({ error: 'La solicitud de reenvío no es válida.' });
  }

  try {
    const [retos] = await pool.query(
      `SELECT r.usuario_id, r.estado,
              (r.expira_en > NOW()) AS vigente,
              (TIMESTAMPDIFF(SECOND, r.enviado_en, NOW()) >= ?) AS puede_reenviar,
              (r.reenvios < ?) AS quedan_reenvios,
              u.correo
       FROM retos_mfa r
       JOIN usuarios u ON u.id = r.usuario_id
       WHERE r.reto_id = ?`,
      [MFA_REENVIO_ESPERA_SEGUNDOS, MFA_REENVIO_MAXIMOS, retoId]
    );
    if (!retos.length || retos[0].estado !== 'pendiente' || !retos[0].vigente) {
      return res.status(410).json({ error: 'El desafío expiró. Inicia sesión nuevamente.' });
    }
    if (!retos[0].puede_reenviar) {
      return res.status(429).json({ error: 'Espera un minuto antes de solicitar otro código.' });
    }
    if (!retos[0].quedan_reenvios) {
      return res.status(429).json({ error: 'Se agotaron los reenvíos disponibles. Inicia sesión nuevamente.' });
    }

    const codigo = generarCodigoMfa();
    const codigoHash = hashCodigoMfa(retoId, retos[0].usuario_id, codigo);
    const [actualizacion] = await pool.query(
      `UPDATE retos_mfa
       SET codigo_hash = ?, enviado_en = NOW(),
           expira_en = DATE_ADD(NOW(), INTERVAL ? MINUTE),
           reenvios = reenvios + 1
       WHERE reto_id = ? AND estado = 'pendiente'
         AND TIMESTAMPDIFF(SECOND, enviado_en, NOW()) >= ? AND expira_en > NOW()
         AND reenvios < ?`,
      [codigoHash, MFA_CODIGO_VIGENCIA_MINUTOS, retoId, MFA_REENVIO_ESPERA_SEGUNDOS, MFA_REENVIO_MAXIMOS]
    );
    if (!actualizacion.affectedRows) {
      return res.status(429).json({ error: 'No se pudo reenviar todavía. Intenta de nuevo en un minuto.' });
    }

    try {
      await enviarCodigoMfa({
        usuarioId: retos[0].usuario_id,
        correo: retos[0].correo,
        retoId,
        codigo
      });
    } catch (err) {
      await pool.query("UPDATE retos_mfa SET estado = 'cancelado' WHERE reto_id = ? AND estado = 'pendiente'", [retoId]);
      console.error('[auth] No se pudo reenviar el código MFA:', err.message);
      return res.status(503).json({ error: 'No fue posible reenviar el código. Inicia sesión nuevamente más tarde.' });
    }

    res.json({
      ok: true,
      expiresIn: MFA_CODIGO_VIGENCIA_MINUTOS * 60,
      correoEnmascarado: enmascararCorreo(retos[0].correo)
    });
  } catch (err) {
    console.error('[auth] Error reenviando MFA:', err.message);
    res.status(503).json({ error: 'No fue posible reenviar el código temporalmente.' });
  }
});

router.post('/mfa/cancelar', async (req, res) => {
  const retoId = String(req.body?.challengeId || '');
  if (!/^[a-f0-9]{64}$/.test(retoId)) {
    return res.status(400).json({ error: 'La solicitud de cancelación no es válida.' });
  }
  try {
    await pool.query(
      "UPDATE retos_mfa SET estado = 'cancelado' WHERE reto_id = ? AND estado = 'pendiente'",
      [retoId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('[auth] Error cancelando MFA:', err.message);
    res.status(500).json({ error: 'No fue posible cancelar el desafío temporalmente.' });
  }
});

// POST /api/auth/refresh -> canjea un refresh token válido por un access token nuevo
// Rota el refresh token en cada uso: revoca el usado y entrega uno nuevo,
// así uno robado tiene una sola oportunidad de usarse antes de invalidarse.
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Falta el refresh token' });
    }

    const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const [filas] = await pool.query(
      `SELECT rt.id, rt.usuario_id, rt.fecha_expiracion, rt.mfa_verificado_en,
              u.correo, u.rol, u.cliente_id
       FROM refresh_tokens rt
       JOIN usuarios u ON u.id = rt.usuario_id
       WHERE rt.token_hash = ? AND rt.revocado = FALSE`,
      [hash]
    );

    if (!filas.length) {
      return res.status(401).json({ error: 'Refresh token inválido' });
    }

    const registro = filas[0];
    if (!registro.mfa_verificado_en) {
      await pool.query('UPDATE refresh_tokens SET revocado = TRUE WHERE id = ?', [registro.id]);
      return res.status(401).json({ error: 'Inicia sesión nuevamente para completar la verificación de seguridad.' });
    }
    if (new Date(registro.fecha_expiracion) < new Date()) {
      return res.status(401).json({ error: 'Sesión expirada, inicia sesión de nuevo' });
    }

    // Rotación: invalida el token usado y emite uno nuevo
    await pool.query('UPDATE refresh_tokens SET revocado = TRUE WHERE id = ?', [registro.id]);
    const nuevoRefresh = await generarRefreshToken(registro.usuario_id, pool, registro.mfa_verificado_en);

    const nuevoAccess = firmarAccessToken({
      uid: registro.usuario_id,
      correo: registro.correo,
      rol: registro.rol,
      clienteId: registro.cliente_id,
      mfa: true
    });

    res.json({
      token: nuevoAccess,
      refreshToken: nuevoRefresh,
      expiraEn: expiraEnMs(nuevoAccess),
      correo: registro.correo,
      clienteId: registro.cliente_id,
      rol: registro.rol,
      mfaVerified: true
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error renovando la sesión' });
  }
});

// POST /api/auth/logout -> revoca el refresh token para que no se pueda reutilizar
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      const hash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await pool.query('UPDATE refresh_tokens SET revocado = TRUE WHERE token_hash = ?', [hash]);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error cerrando sesión' });
  }
});

// Middleware exportado para proteger otras rutas
function requiereAutenticacion(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    req.usuario = jwt.verify(token, JWT_SECRET);
    if (req.usuario.mfa !== true) {
      return res.status(401).json({ error: 'Inicia sesión nuevamente para completar la verificación de seguridad.' });
    }
    next();
  } catch {
    res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}

function requiereAdmin(req, res, next) {
  if (req.usuario?.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso restringido: solo administradores' });
  }
  next();
}

module.exports = { router, requiereAutenticacion, requiereAdmin };
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
async function generarRefreshToken(usuarioId) {
  const tokenPlano = crypto.randomBytes(40).toString('hex');
  const hash = crypto.createHash('sha256').update(tokenPlano).digest('hex');
  const expiracion = new Date(Date.now() + REFRESH_DIAS * 24 * 60 * 60 * 1000);

  await pool.query(
    'INSERT INTO refresh_tokens (usuario_id, token_hash, fecha_expiracion) VALUES (?, ?, ?)',
    [usuarioId, hash, expiracion]
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

// POST /api/auth/registro -> crea las credenciales de acceso (correo + contraseña)
// Nota: el correo aquí se guarda en texto plano porque se usa como identificador
// único de login (índice UNIQUE). Es distinto del correo cifrado que se guarda
// en la tabla "clientes" como dato privado del funcionario.
router.post('/registro', async (req, res) => {
  try {
    const { correo, password, clienteId } = req.body;

    if (!correo || !password) {
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

    // rol y clienteId van DENTRO del token: sin esto, requiereAdmin() nunca
    // puede autorizar a nadie y /api/pedidos no sabe a qué cliente asociar el pedido.
    const token = firmarAccessToken(
      { uid: resultado.insertId, correo, rol: 'cliente', clienteId: clienteId || null }
    );
    const refreshToken = await generarRefreshToken(resultado.insertId);

    res.status(201).json({
      token,
      refreshToken,
      expiraEn: expiraEnMs(token),
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
    const { correo, password } = req.body;
    if (!correo || !password) {
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

    const token = firmarAccessToken(
      { uid: usuario.id, correo: usuario.correo, rol: usuario.rol, clienteId: usuario.cliente_id }
    );
    const refreshToken = await generarRefreshToken(usuario.id);

    res.json({
      token,
      refreshToken,
      expiraEn: expiraEnMs(token),
      correo: usuario.correo,
      id: usuario.id,
      clienteId: usuario.cliente_id,
      rol: usuario.rol
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error iniciando sesión' });
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
      `SELECT rt.id, rt.usuario_id, rt.fecha_expiracion, u.correo, u.rol, u.cliente_id
       FROM refresh_tokens rt
       JOIN usuarios u ON u.id = rt.usuario_id
       WHERE rt.token_hash = ? AND rt.revocado = FALSE`,
      [hash]
    );

    if (!filas.length) {
      return res.status(401).json({ error: 'Refresh token inválido' });
    }

    const registro = filas[0];
    if (new Date(registro.fecha_expiracion) < new Date()) {
      return res.status(401).json({ error: 'Sesión expirada, inicia sesión de nuevo' });
    }

    // Rotación: invalida el token usado y emite uno nuevo
    await pool.query('UPDATE refresh_tokens SET revocado = TRUE WHERE id = ?', [registro.id]);
    const nuevoRefresh = await generarRefreshToken(registro.usuario_id);

    const nuevoAccess = firmarAccessToken({
      uid: registro.usuario_id,
      correo: registro.correo,
      rol: registro.rol,
      clienteId: registro.cliente_id
    });

    res.json({
      token: nuevoAccess,
      refreshToken: nuevoRefresh,
      expiraEn: expiraEnMs(nuevoAccess),
      correo: registro.correo,
      clienteId: registro.cliente_id,
      rol: registro.rol
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
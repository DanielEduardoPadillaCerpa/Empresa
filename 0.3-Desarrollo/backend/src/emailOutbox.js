const { pool } = require('./db');
const { descifrar } = require('./crypto');
const { crearTokenComprobante } = require('./receiptTokens');
const {
  enviarEnlaceComprobanteCliente,
  enviarAvisoComprobanteAdmin
} = require('./email');

const MAX_INTENTOS = 5;
const INTERVALO_MS = 5000;
let timer;
let procesando = false;

function codigoError(err) {
  const codigo = String(err?.code || 'EMAIL_DELIVERY_FAILED').toUpperCase();
  return codigo.replace(/[^A-Z0-9_]/g, '').slice(0, 64) || 'EMAIL_DELIVERY_FAILED';
}

async function reclamarCorreo() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `UPDATE correo_outbox
       SET estado = 'pendiente', disponible_en = NOW()
       WHERE estado = 'procesando' AND actualizado_en < DATE_SUB(NOW(), INTERVAL 10 MINUTE)`
    );
    const [filas] = await connection.query(
      `SELECT j.id AS correo_id, j.tipo, j.intentos,
              c.id AS comprobante_id, c.pedido_id, c.numero, c.enviar_correo,
              p.fecha_pedido, p.items, p.datos_comprador_cifrados,
              pa.monto_centavos, pa.moneda
       FROM correo_outbox j
       JOIN comprobantes c ON c.id = j.comprobante_id
       JOIN pedidos p ON p.id = c.pedido_id
       JOIN pagos pa ON pa.pedido_id = p.id AND pa.estado = 'aprobado'
       WHERE j.estado = 'pendiente' AND j.disponible_en <= NOW()
       ORDER BY j.id
       LIMIT 1
       FOR UPDATE`
    );
    if (!filas.length) {
      await connection.commit();
      return null;
    }

    const correo = filas[0];
    const [actualizacion] = await connection.query(
      `UPDATE correo_outbox
       SET estado = 'procesando', intentos = intentos + 1, actualizado_en = NOW()
       WHERE id = ? AND estado = 'pendiente'`,
      [correo.correo_id]
    );
    if (actualizacion.affectedRows !== 1) {
      await connection.rollback();
      return null;
    }
    correo.intentos = Number(correo.intentos) + 1;
    await connection.commit();
    return correo;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function prepararTokenCliente(correo) {
  const token = crearTokenComprobante(correo.pedido_id);
  await pool.query(
    'UPDATE comprobantes SET token_hash = ?, expira_en = ? WHERE id = ? AND enviar_correo = TRUE',
    [token.hash, token.expiraEn, correo.comprobante_id]
  );
  return token.token;
}

async function enviarCorreo(correo) {
  if (correo.tipo === 'admin') {
    await enviarAvisoComprobanteAdmin({
      pedidoId: correo.pedido_id,
      numero: correo.numero,
      totalCentavos: correo.monto_centavos,
      moneda: correo.moneda,
      fecha: new Date(correo.fecha_pedido).toISOString()
    });
    return;
  }

  if (correo.tipo !== 'cliente' || !correo.enviar_correo) {
    const error = new Error('CUSTOMER_RECEIPT_CONSENT_REQUIRED');
    error.code = 'CUSTOMER_RECEIPT_CONSENT_REQUIRED';
    throw error;
  }

  let comprador;
  try {
    comprador = JSON.parse(descifrar(correo.datos_comprador_cifrados));
  } catch {
    const error = new Error('CUSTOMER_EMAIL_UNAVAILABLE');
    error.code = 'CUSTOMER_EMAIL_UNAVAILABLE';
    throw error;
  }
  if (typeof comprador?.correo !== 'string' || !comprador.correo.trim()) {
    const error = new Error('CUSTOMER_EMAIL_UNAVAILABLE');
    error.code = 'CUSTOMER_EMAIL_UNAVAILABLE';
    throw error;
  }

  const token = await prepararTokenCliente(correo);
  await enviarEnlaceComprobanteCliente({
    correo: comprador.correo,
    pedidoId: correo.pedido_id,
    numero: correo.numero,
    token
  });
}

async function marcarEnviado(correo) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `UPDATE correo_outbox
       SET estado = 'enviado', enviado_en = NOW(), ultimo_error_code = NULL
       WHERE id = ? AND estado = 'procesando'`,
      [correo.correo_id]
    );
    const columna = correo.tipo === 'cliente' ? 'enviado_cliente_en' : 'enviado_admin_en';
    await connection.query(
      `UPDATE comprobantes SET ${columna} = NOW() WHERE id = ?`,
      [correo.comprobante_id]
    );
    await connection.commit();
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function reprogramarFallo(correo, err) {
  const estado = correo.intentos >= MAX_INTENTOS ? 'fallido' : 'pendiente';
  const demoraSegundos = Math.min(60 * (2 ** Math.max(0, correo.intentos - 1)), 3600);
  const codigo = codigoError(err);
  await pool.query(
    `UPDATE correo_outbox
     SET estado = ?, disponible_en = DATE_ADD(NOW(), INTERVAL ? SECOND),
         ultimo_error_code = ?
     WHERE id = ? AND estado = 'procesando'`,
    [estado, demoraSegundos, codigo, correo.correo_id]
  );
  console.error('[email-outbox] No se pudo enviar el correo:', {
    correoId: correo.correo_id,
    intento: correo.intentos,
    estado,
    codigo
  });
}

async function procesarSiguienteCorreo() {
  const correo = await reclamarCorreo();
  if (!correo) return false;
  try {
    await enviarCorreo(correo);
    await marcarEnviado(correo);
  } catch (err) {
    await reprogramarFallo(correo, err);
  }
  return true;
}

function iniciarWorkerEmail() {
  if (timer) return;
  const ciclo = async () => {
    if (procesando) return;
    procesando = true;
    try {
      for (let cantidad = 0; cantidad < 5; cantidad += 1) {
        if (!await procesarSiguienteCorreo()) break;
      }
    } catch (err) {
      console.error('[email-outbox] Error consultando la cola:', err.code || 'OUTBOX_DATABASE_ERROR');
    } finally {
      procesando = false;
    }
  };
  ciclo();
  timer = setInterval(ciclo, INTERVALO_MS);
  if (typeof timer.unref === 'function') timer.unref();
}

module.exports = { iniciarWorkerEmail, procesarSiguienteCorreo };

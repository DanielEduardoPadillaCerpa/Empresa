const { pool } = require('./db');
const { firmarPayload } = require('./automationSignatures');
const { descifrar } = require('./crypto');

const MAX_INTENTOS = 8;
const INTERVALO_MS = 5000;
const TIMEOUT_MS = 8000;
let timer;
let procesando = false;
let stockTimer;

const WORKFLOWS = {
  W1: {
    url: 'N8N_W1_PAYMENT_WEBHOOK_URL',
    secret: 'N8N_W1_SECRET'
  },
  W3: {
    url: 'N8N_W3_STOCK_WEBHOOK_URL',
    secret: 'N8N_W3_SECRET'
  },
  W6: {
    url: 'N8N_W6_ASSISTANT_ESCALATION_WEBHOOK_URL',
    secret: 'N8N_W6_ASSISTANT_ESCALATION_SECRET',
    tokenHeader: true
  },
  W8: {
    url: 'N8N_W8_ACCOUNT_WEBHOOK_URL',
    secret: 'N8N_W8_ACCOUNT_SECRET'
  }
};

function codigoError(err) {
  const codigo = String(err?.code || 'AUTOMATION_DELIVERY_FAILED').toUpperCase();
  return codigo.replace(/[^A-Z0-9_]/g, '').slice(0, 64) || 'AUTOMATION_DELIVERY_FAILED';
}

function obtenerUrlSegura(valor) {
  let url;
  try {
    url = new URL(valor);
  } catch {
    const error = new Error('AUTOMATION_WEBHOOK_URL_INVALID');
    error.code = 'AUTOMATION_WEBHOOK_URL_INVALID';
    throw error;
  }
  const localhost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(localhost && url.protocol === 'http:')) ||
      url.username || url.password) {
    const error = new Error('AUTOMATION_WEBHOOK_URL_MUST_USE_HTTPS');
    error.code = 'AUTOMATION_WEBHOOK_URL_MUST_USE_HTTPS';
    throw error;
  }
  return url.toString();
}

async function reclamarEvento() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query(
      `UPDATE automation_outbox
       SET estado = 'pendiente', disponible_en = NOW()
       WHERE estado = 'procesando' AND actualizado_en < DATE_SUB(NOW(), INTERVAL 2 MINUTE)`
    );
    const [filas] = await connection.query(
      `SELECT id, workflow, payload, payload_cifrado, intentos
       FROM automation_outbox
       WHERE estado = 'pendiente' AND disponible_en <= NOW()
       ORDER BY id LIMIT 1 FOR UPDATE`
    );
    if (!filas.length) {
      await connection.commit();
      return null;
    }
    const evento = filas[0];
    const [actualizacion] = await connection.query(
      `UPDATE automation_outbox SET estado = 'procesando', intentos = intentos + 1
       WHERE id = ? AND estado = 'pendiente'`,
      [evento.id]
    );
    if (actualizacion.affectedRows !== 1) {
      await connection.rollback();
      return null;
    }
    await connection.commit();
    evento.intentos = Number(evento.intentos) + 1;
    return evento;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function enviarEvento(evento) {
  const configuracion = WORKFLOWS[evento.workflow];
  if (!configuracion) {
    const error = new Error('AUTOMATION_WORKFLOW_INVALID');
    error.code = 'AUTOMATION_WORKFLOW_INVALID';
    throw error;
  }
  const url = obtenerUrlSegura(process.env[configuracion.url]);
  let payload = typeof evento.payload === 'string' ? JSON.parse(evento.payload) : evento.payload;
  if (evento.payload_cifrado) {
    if (!payload || typeof payload.contenido !== 'string') {
      const error = new Error('AUTOMATION_ENCRYPTED_PAYLOAD_INVALID');
      error.code = 'AUTOMATION_ENCRYPTED_PAYLOAD_INVALID';
      throw error;
    }
    payload = JSON.parse(descifrar(payload.contenido));
  }
  const firmado = firmarPayload(payload, process.env[configuracion.secret]);
  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), TIMEOUT_MS);
  try {
    const respuesta = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-automation-timestamp': firmado.timestamp,
        'x-automation-signature': firmado.firma,
        ...(configuracion.tokenHeader
          ? { Authorization: `Bearer ${process.env[configuracion.secret]}` }
          : {})
      },
      body: firmado.cuerpo,
      signal: controlador.signal
    });
    if (!respuesta.ok) {
      const error = new Error('AUTOMATION_WEBHOOK_REJECTED');
      error.code = `AUTOMATION_HTTP_${respuesta.status}`;
      throw error;
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function marcarEnviado(evento) {
  await pool.query(
    `UPDATE automation_outbox
     SET estado = 'enviado', ultimo_error_code = NULL
     WHERE id = ? AND estado = 'procesando'`,
    [evento.id]
  );
}

async function reprogramarFallo(evento, err) {
  const estado = evento.intentos >= MAX_INTENTOS ? 'fallido' : 'pendiente';
  const demoraSegundos = Math.min(30 * (2 ** Math.max(0, evento.intentos - 1)), 3600);
  const codigo = codigoError(err);
  await pool.query(
    `UPDATE automation_outbox
     SET estado = ?, disponible_en = DATE_ADD(NOW(), INTERVAL ? SECOND),
         ultimo_error_code = ?
     WHERE id = ? AND estado = 'procesando'`,
    [estado, demoraSegundos, codigo, evento.id]
  );
  console.error('[automation-outbox] No se pudo enviar el evento:', {
    eventoId: evento.id,
    workflow: evento.workflow,
    intento: evento.intentos,
    estado,
    codigo
  });
}

async function procesarSiguienteEvento() {
  const evento = await reclamarEvento();
  if (!evento) return false;
  try {
    await enviarEvento(evento);
    await marcarEnviado(evento);
  } catch (err) {
    await reprogramarFallo(evento, err);
  }
  return true;
}

async function detectarStockBajo() {
  const umbral = Number(process.env.AUTOMATION_STOCK_LOW_THRESHOLD || 5);
  if (!Number.isSafeInteger(umbral) || umbral < 1 || umbral > 10000) {
    throw new Error('AUTOMATION_STOCK_LOW_THRESHOLD_INVALID');
  }
  const [filas] = await pool.query(
    `SELECT 1 FROM productos
     WHERE estado = 'activo' AND cantidad_disponible <= ?
     LIMIT 1`,
    [umbral]
  );
  if (!filas.length) return;

  const fecha = new Date().toISOString();
  const dia = fecha.slice(0, 10);
  await pool.query(
    `INSERT IGNORE INTO automation_outbox (workflow, dedupe_key, payload)
     VALUES ('W3', ?, ?)`,
    [`stock-bajo:${dia}`, JSON.stringify({ evento: 'stock_bajo', fecha })]
  );
}

function iniciarWorkerAutomatizaciones() {
  if (timer) return;
  const ciclo = async () => {
    if (procesando) return;
    procesando = true;
    try {
      for (let cantidad = 0; cantidad < 10; cantidad += 1) {
        if (!await procesarSiguienteEvento()) break;
      }
    } catch (err) {
      console.error('[automation-outbox] Error consultando la cola:', err.code || 'OUTBOX_DATABASE_ERROR');
    } finally {
      procesando = false;
    }
  };
  const revisarStock = async () => {
    try {
      await detectarStockBajo();
    } catch (err) {
      console.error('[automation-outbox] No se pudo revisar stock bajo:', err.code || 'LOW_STOCK_CHECK_ERROR');
    }
  };
  ciclo();
  revisarStock();
  timer = setInterval(ciclo, INTERVALO_MS);
  stockTimer = setInterval(revisarStock, 15 * 60 * 1000);
  if (typeof timer.unref === 'function') timer.unref();
  if (typeof stockTimer.unref === 'function') stockTimer.unref();
}

module.exports = { iniciarWorkerAutomatizaciones, procesarSiguienteEvento, detectarStockBajo };

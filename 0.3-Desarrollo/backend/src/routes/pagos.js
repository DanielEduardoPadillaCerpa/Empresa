const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requiereAutenticacion } = require('./auth');
const { getPaymentProvider } = require('../paymentProviderInstance');
const { crearComprobanteAprobado } = require('../receiptService');
const { liberarReserva } = require('../inventoryReservations');
const { invalidarIndiceCatalogo } = require('../assistant/indiceCatalogo');

const ESTADOS_TERMINALES = new Set(['aprobado', 'rechazado', 'expirado', 'reembolsado']);

function parsearItems(items) {
  return typeof items === 'string' ? JSON.parse(items) : items;
}

async function encolarEventoPago(connection, pago, estado) {
  const fecha = new Date().toISOString();
  const payload = {
    evento: 'pago',
    pedido_id: Number(pago.pedido_id),
    estado,
    total: String(pago.monto_centavos),
    moneda: pago.moneda,
    fecha
  };
  await connection.query(
    `INSERT IGNORE INTO automation_outbox (workflow, dedupe_key, payload)
     VALUES ('W1', ?, ?)`,
    [`pago:${pago.id}:${estado}`, JSON.stringify(payload)]
  );
}

async function procesarWebhook(proveedorNombre, rawBody, headers) {
  const proveedor = getPaymentProvider();
  const evento = proveedor.verificarWebhook(rawBody, headers);
  const payloadHash = crypto.createHash('sha256').update(rawBody).digest('hex');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [eventoPrevio] = await connection.query(
      'SELECT payload_hash FROM eventos_pago WHERE evento_id = ? FOR UPDATE',
      [evento.event_id]
    );
    if (eventoPrevio.length) {
      await connection.rollback();
      return { duplicado: true, conflicto: eventoPrevio[0].payload_hash !== payloadHash };
    }

    const [pagos] = await connection.query(
      `SELECT pa.id, pa.pedido_id, pa.proveedor, pa.referencia_externa, pa.estado,
              pa.monto_centavos, pa.moneda, pe.estado AS estado_pedido, pe.items,
              pe.enviar_comprobante
       FROM pagos pa JOIN pedidos pe ON pe.id = pa.pedido_id
       WHERE pa.referencia_externa = ? FOR UPDATE`,
      [evento.referencia_externa]
    );
    if (!pagos.length || pagos[0].proveedor !== proveedorNombre) {
      await connection.rollback();
      return { noEncontrado: true };
    }

    const pago = pagos[0];
    if (String(pago.monto_centavos) !== String(evento.monto_centavos) || pago.moneda !== evento.moneda) {
      await connection.rollback();
      return { montoInvalido: true };
    }

    await connection.query(
      `INSERT INTO eventos_pago (evento_id, proveedor, pago_id, payload_hash)
       VALUES (?, ?, ?, ?)`,
      [evento.event_id, proveedorNombre, pago.id, payloadHash]
    );

    if (ESTADOS_TERMINALES.has(pago.estado)) {
      await connection.commit();
      return { aceptado: true, obsoleto: true };
    }

    if (evento.estado === 'pendiente') {
      await connection.query(
        "UPDATE pagos SET estado = 'pendiente' WHERE id = ? AND estado IN ('creado','pendiente')",
        [pago.id]
      );
      await connection.commit();
      return { aceptado: true, estado: 'pendiente' };
    }

    if (pago.estado !== 'creado' && pago.estado !== 'pendiente') {
      await connection.commit();
      return { aceptado: true, obsoleto: true };
    }

    if (evento.estado === 'aprobado') {
      const [pedidoActualizado] = await connection.query(
        `UPDATE pedidos SET estado = 'pagado'
         WHERE id = ? AND estado = 'pendiente_pago'`,
        [pago.pedido_id]
      );
      if (pedidoActualizado.affectedRows !== 1) {
        await connection.commit();
        return { aceptado: true, obsoleto: true };
      }
      const [pagoActualizado] = await connection.query(
        "UPDATE pagos SET estado = 'aprobado' WHERE id = ? AND estado IN ('creado','pendiente')",
        [pago.id]
      );
      if (pagoActualizado.affectedRows !== 1) {
        throw new Error('PAYMENT_STATE_TRANSITION_FAILED');
      }
      await crearComprobanteAprobado(connection, {
        pedidoId: pago.pedido_id,
        enviarCorreo: Boolean(pago.enviar_comprobante)
      });
      await encolarEventoPago(connection, pago, 'aprobado');
      await connection.commit();
      return { aceptado: true, estado: 'aprobado', pedido_id: pago.pedido_id };
    }

    const estadoPago = evento.estado === 'rechazado' ? 'rechazado' : 'expirado';
    const estadoPedido = evento.estado === 'rechazado' ? 'rechazado' : 'expirado';
    const [pedidoActualizado] = await connection.query(
      'UPDATE pedidos SET estado = ? WHERE id = ? AND estado = ?',
      [estadoPedido, pago.pedido_id, 'pendiente_pago']
    );
    if (pedidoActualizado.affectedRows !== 1) {
      await connection.commit();
      return { aceptado: true, obsoleto: true };
    }
    const [pagoActualizado] = await connection.query(
      "UPDATE pagos SET estado = ? WHERE id = ? AND estado IN ('creado','pendiente')",
      [estadoPago, pago.id]
    );
    if (pagoActualizado.affectedRows !== 1) throw new Error('PAYMENT_STATE_TRANSITION_FAILED');
    await liberarReserva(connection, pago);
    if (estadoPago === 'rechazado') await encolarEventoPago(connection, pago, 'rechazado');
    await connection.commit();
    invalidarIndiceCatalogo();
    return { aceptado: true, estado: estadoPago, pedido_id: pago.pedido_id };
  } catch (err) {
    await connection.rollback();
    if (err.code === 'ER_DUP_ENTRY') {
      const [eventoExistente] = await connection.query(
        'SELECT payload_hash FROM eventos_pago WHERE evento_id = ? FOR UPDATE',
        [evento.event_id]
      );
      if (eventoExistente.length) {
        return {
          duplicado: true,
          conflicto: eventoExistente[0].payload_hash !== payloadHash
        };
      }
    }
    throw err;
  } finally {
    connection.release();
  }
}

router.post('/webhook/:proveedor', async (req, res) => {
  try {
    const proveedorNombre = String(req.params.proveedor || '').toLowerCase();
    if (proveedorNombre !== 'mock') return res.status(404).json({ error: 'Proveedor no disponible.' });
    const resultado = await procesarWebhook(proveedorNombre, req.body, req.headers);
    if (resultado.conflicto) return res.status(409).json({ error: 'El identificador del evento ya fue utilizado.' });
    if (resultado.noEncontrado) return res.status(404).json({ error: 'Pago no encontrado.' });
    if (resultado.montoInvalido) return res.status(400).json({ error: 'El importe del evento no coincide con el pago.' });
    if (resultado.duplicado || resultado.aceptado) return res.status(200).json({ ok: true });
    return res.status(400).json({ error: 'Evento de pago no procesable.' });
  } catch (err) {
    console.error('[pagos] Webhook no procesado:', err.code || 'PAYMENT_WEBHOOK_ERROR');
    const status = Buffer.isBuffer(req.body) ? 401 : 400;
    res.status(status).json({ error: 'No se pudo verificar el evento de pago.' });
  }
});

router.post('/dev/simular-webhook', requiereAutenticacion, async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production' || process.env.PAYMENT_MODE === 'prod') {
      return res.status(404).json({ error: 'Ruta no disponible.' });
    }
    if (String(process.env.PAYMENT_MODE || 'mock').toLowerCase() !== 'mock') {
      return res.status(404).json({ error: 'La simulación solo está habilitada en modo mock.' });
    }
    const pedidoId = Number(req.body?.pedido_id);
    if (!Number.isSafeInteger(pedidoId) || pedidoId <= 0) {
      return res.status(400).json({ error: 'El identificador de pedido no es válido.' });
    }
    const [filas] = await pool.query(
      `SELECT pa.referencia_externa, pa.monto_centavos, pa.moneda, pe.cliente_id
       FROM pagos pa JOIN pedidos pe ON pe.id = pa.pedido_id
       WHERE pa.pedido_id = ?`,
      [pedidoId]
    );
    if (!filas.length || Number(filas[0].cliente_id) !== Number(req.usuario.clienteId)) {
      return res.status(404).json({ error: 'Intento de pago no encontrado.' });
    }

    const evento = getPaymentProvider().crearEventoSimulado({
      referenciaExterna: filas[0].referencia_externa,
      montoCentavos: filas[0].monto_centavos,
      moneda: filas[0].moneda
    });
    const resultado = await procesarWebhook('mock', evento.rawBody, evento.headers);
    if (resultado.aceptado || resultado.duplicado) return res.status(200).json({ ok: true });
    if (resultado.montoInvalido) return res.status(400).json({ error: 'El importe del evento no coincide con el pago.' });
    return res.status(409).json({ error: 'El intento ya no admite simulación.' });
  } catch (err) {
    console.error('[pagos] Simulación mock no completada:', err.code || 'INTERNAL_ERROR');
    const status = err.code === 'PAYMENT_PROVIDER_TIMEOUT' ? 504 : 500;
    res.status(status).json({ error: 'No fue posible simular el resultado de pago.' });
  }
});

router.get('/:pedidoId/estado', requiereAutenticacion, async (req, res) => {
  try {
    const pedidoId = Number(req.params.pedidoId);
    if (!Number.isSafeInteger(pedidoId) || pedidoId <= 0) {
      return res.status(400).json({ error: 'El identificador de pedido no es válido.' });
    }
    const [filas] = await pool.query(
      `SELECT pe.id, pe.estado AS estado_pedido, pa.estado AS estado_pago,
              pa.monto_centavos, pa.moneda, pa.expira_en
       FROM pedidos pe JOIN pagos pa ON pa.pedido_id = pe.id
       WHERE pe.id = ? AND pe.cliente_id = ?`,
      [pedidoId, req.usuario.clienteId]
    );
    if (!filas.length) return res.status(404).json({ error: 'Pedido no encontrado.' });
    res.json({
      pedido_id: filas[0].id,
      estado_pedido: filas[0].estado_pedido,
      estado_pago: filas[0].estado_pago,
      monto_centavos: String(filas[0].monto_centavos),
      moneda: filas[0].moneda,
      expira_en: filas[0].expira_en
    });
  } catch (err) {
    console.error('[pagos] No se pudo consultar el estado:', err.code || 'INTERNAL_ERROR');
    res.status(500).json({ error: 'No fue posible consultar el estado del pago.' });
  }
});

router.post('/procesar', requiereAutenticacion, async (req, res) => {
  res.status(410).json({ error: 'Este endpoint fue retirado. Usa POST /api/checkout y confirma el pago por webhook.' });
});

module.exports = { router, procesarWebhook };

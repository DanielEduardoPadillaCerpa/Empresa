const { pool } = require('./db');
const { liberarReserva } = require('./inventoryReservations');
const { invalidarIndiceCatalogo } = require('./assistant/indiceCatalogo');

const INTERVALO_MS = 60 * 1000;
const LOTE_MAXIMO = 25;
let timer;
let procesando = false;

async function expirarPedidosPendientes() {
  const connection = await pool.getConnection();
  let expirados = 0;
  try {
    await connection.beginTransaction();
    const [pagos] = await connection.query(
      `SELECT pa.id AS pago_id, pa.pedido_id
       FROM pagos pa
       WHERE pa.estado IN ('creado','pendiente')
         AND pa.expira_en <= NOW()
         AND EXISTS (
           SELECT 1 FROM pedidos pe
           WHERE pe.id = pa.pedido_id AND pe.estado = 'pendiente_pago'
         )
       ORDER BY pa.id
       LIMIT ?
       FOR UPDATE`,
      [LOTE_MAXIMO]
    );

    for (const pago of pagos) {
      const [pedidos] = await connection.query(
        'SELECT id, estado, items FROM pedidos WHERE id = ? FOR UPDATE',
        [pago.pedido_id]
      );
      const pedido = pedidos[0];
      if (!pedido || pedido.estado !== 'pendiente_pago') continue;

      const [pedidoActualizado] = await connection.query(
        `UPDATE pedidos SET estado = 'expirado'
         WHERE id = ? AND estado = 'pendiente_pago'`,
        [pedido.id]
      );
      if (pedidoActualizado.affectedRows !== 1) continue;

      const [pagoActualizado] = await connection.query(
        `UPDATE pagos SET estado = 'expirado'
         WHERE id = ? AND estado IN ('creado','pendiente') AND expira_en <= NOW()`,
        [pago.pago_id]
      );
      if (pagoActualizado.affectedRows < 1) {
        throw new Error('PAYMENT_EXPIRATION_TRANSITION_FAILED');
      }
      await liberarReserva(connection, pedido);
      expirados += 1;
    }

    await connection.commit();
    if (expirados > 0) invalidarIndiceCatalogo();
    return expirados;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

function iniciarJobExpiracionPedidos() {
  if (timer) return;
  const ciclo = async () => {
    if (procesando) return;
    procesando = true;
    try {
      const cantidad = await expirarPedidosPendientes();
      if (cantidad) console.info('[payment-jobs] Pedidos expirados y reservas liberadas:', cantidad);
    } catch (err) {
      console.error('[payment-jobs] No se pudieron expirar pedidos:', err.code || 'ORDER_EXPIRATION_ERROR');
    } finally {
      procesando = false;
    }
  };
  ciclo();
  timer = setInterval(ciclo, INTERVALO_MS);
  if (typeof timer.unref === 'function') timer.unref();
}

module.exports = { expirarPedidosPendientes, iniciarJobExpiracionPedidos };

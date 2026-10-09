const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requiereAutenticacion, requiereAdmin } = require('./auth');
const { liberarReserva } = require('../inventoryReservations');
const { registrarAuditoria } = require('../auditoria');
const { invalidarIndiceCatalogo } = require('../assistant/indiceCatalogo');

// Convierte el campo items a array/objeto JS sin importar si mysql2
// ya lo entregó parseado (columna JSON) o como texto.
function parsearItems(items) {
  return typeof items === 'string' ? JSON.parse(items) : items;
}

// Los pedidos solo se crean junto con un intento de pago en /api/checkout.
router.post('/', requiereAutenticacion, async (req, res) => {
  res.status(410).json({ error: 'Este endpoint fue retirado. Los pedidos deben iniciar mediante POST /api/checkout.' });
});

// GET /api/pedidos/todos -> todos los pedidos (solo admin)
// IMPORTANTE: debe declararse ANTES de '/:clienteId', porque Express
// prueba las rutas en orden y '/:clienteId' capturaría "todos" como si
// fuera un ID de cliente, dejando esta ruta inalcanzable.
router.get('/todos', requiereAutenticacion, requiereAdmin, async (req, res) => {
  try {
    const [filas] = await pool.query(`
      SELECT p.id, p.fecha_pedido, p.items, p.total, p.estado,
             c.nombre_unidad AS nombreUnidad, c.nit
      FROM pedidos p
      JOIN clientes c ON p.cliente_id = c.id
      ORDER BY p.fecha_pedido DESC
    `);
    res.json(filas.map(p => ({
      id: p.id,
      fechaPedido: p.fecha_pedido,
      items: parsearItems(p.items),
      total: p.total,
      estado: p.estado,
      cliente: { unidad: p.nombreUnidad, nit: p.nit }
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error consultando pedidos' });
  }
});

// GET /api/pedidos -> historial del cliente autenticado
router.get('/', requiereAutenticacion, async (req, res) => {
  try {
    const clienteId = req.usuario.clienteId;
    if (!clienteId) return res.json([]);

    const [filas] = await pool.query(
      'SELECT id, fecha_pedido, items, total, estado FROM pedidos WHERE cliente_id = ? ORDER BY fecha_pedido DESC',
      [clienteId]
    );
    res.json(filas.map(p => ({
      id: p.id,
      fechaPedido: p.fecha_pedido,
      items: parsearItems(p.items),
      total: p.total,
      estado: p.estado
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error consultando historial de pedidos' });
  }
});

// PUT /api/pedidos/:id/cancelar -> el cliente cancela SU PROPIO pedido,
// solo si todavía está en estado "pendiente" (antes de ser enviado).
// Declarada antes de '/:id' para no chocar con la ruta de admin.
router.put('/:id/cancelar', requiereAutenticacion, async (req, res) => {
  let connection;
  try {
    const clienteId = req.usuario.clienteId;
    connection = await pool.getConnection();
    await connection.beginTransaction();
    await connection.query(
      "SELECT id FROM pagos WHERE pedido_id = ? AND estado IN ('creado','pendiente') FOR UPDATE",
      [req.params.id]
    );
    const [filas] = await connection.query(
      'SELECT id, cliente_id, estado, items FROM pedidos WHERE id = ? FOR UPDATE',
      [req.params.id]
    );
    if (!filas.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    const pedido = filas[0];
    if (Number(pedido.cliente_id) !== Number(clienteId)) {
      await connection.rollback();
      return res.status(403).json({ error: 'No puedes cancelar un pedido que no es tuyo' });
    }
    if (!['pendiente', 'pendiente_pago'].includes(pedido.estado)) {
      await connection.rollback();
      return res.status(400).json({ error: 'Este pedido ya no puede cancelarse.' });
    }

    const [actualizacion] = await connection.query(
      "UPDATE pedidos SET estado = 'cancelado' WHERE id = ? AND estado = ?",
      [req.params.id, pedido.estado]
    );
    if (actualizacion.affectedRows !== 1) {
      await connection.rollback();
      return res.status(409).json({ error: 'El pedido cambió de estado y no pudo cancelarse.' });
    }

    const [pagosActualizados] = await connection.query(
      "UPDATE pagos SET estado = 'expirado' WHERE pedido_id = ? AND estado IN ('creado','pendiente')",
      [req.params.id]
    );
    if (pedido.estado === 'pendiente_pago' && pagosActualizados.affectedRows < 1) {
      throw new Error('PAYMENT_CANCELLATION_TRANSITION_FAILED');
    }

    await liberarReserva(connection, pedido);

    await connection.commit();
    invalidarIndiceCatalogo();
    res.json({ ok: true });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('[pedidos] No se pudo cancelar el pedido:', err.code || 'INTERNAL_ERROR');
    res.status(500).json({ error: 'Error cancelando el pedido' });
  } finally {
    if (connection) connection.release();
  }
});

// PUT /api/pedidos/:id -> actualizar estado de un pedido (solo admin)
router.put('/:id', requiereAutenticacion, requiereAdmin, async (req, res) => {
  let connection;
  try {
    const { estado } = req.body;
    // Se conservan los estados históricos y se añaden las etapas del timeline.
    if (!['pendiente', 'confirmado', 'preparado', 'enviado', 'entregado', 'cancelado'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [filas] = await connection.query(
      'SELECT id, estado, items FROM pedidos WHERE id = ? FOR UPDATE',
      [req.params.id]
    );
    if (!filas.length) {
      await connection.rollback();
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }
    const anterior = filas[0];
    if (['pendiente_pago', 'rechazado', 'expirado'].includes(anterior.estado) ||
        (anterior.estado === 'pagado' && ['pendiente', 'cancelado'].includes(estado))) {
      await connection.rollback();
      return res.status(409).json({ error: 'El estado del pago solo puede cambiar mediante un evento verificado.' });
    }

    const [actualizacion] = await connection.query(
      'UPDATE pedidos SET estado = ? WHERE id = ? AND estado = ?',
      [estado, req.params.id, anterior.estado]
    );
    if (actualizacion.affectedRows !== 1) {
      await connection.rollback();
      return res.status(409).json({ error: 'El pedido cambió de estado y no pudo actualizarse.' });
    }

    // Si el admin cancela un pedido que no estaba cancelado, repone inventario
    if (estado === 'cancelado' && anterior.estado !== 'cancelado') {
      const items = parsearItems(anterior.items);
      for (const item of items) {
        await connection.query(
          'UPDATE productos SET cantidad_disponible = cantidad_disponible + ? WHERE id = ?',
          [item.cantidad, item.id]
        );
      }
    }

    await connection.commit();
    if (estado === 'cancelado' && anterior.estado !== 'cancelado') invalidarIndiceCatalogo();
    await registrarAuditoria({
      usuario: req.usuario,
      accion: 'editar',
      entidad: 'pedido',
      entidadId: req.params.id,
      detalle: { estadoAnterior: anterior.estado, estadoNuevo: estado },
    });

    res.json({ ok: true });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('[pedidos] No se pudo actualizar el estado:', err.code || 'INTERNAL_ERROR');
    res.status(500).json({ error: 'Error actualizando estado del pedido' });
  } finally {
    if (connection) connection.release();
  }
});

// GET /api/pedidos/:clienteId -> historial de compras de un cliente (solo admin)
router.get('/:clienteId', requiereAutenticacion, requiereAdmin, async (req, res) => {
  try {
    const clienteId = req.params.clienteId;
    const [filas] = await pool.query(
      'SELECT id, fecha_pedido, items, total, estado FROM pedidos WHERE cliente_id = ? ORDER BY fecha_pedido DESC',
      [clienteId]
    );
    res.json(filas.map(p => ({
      id: p.id,
      fechaPedido: p.fecha_pedido,
      items: parsearItems(p.items),
      total: p.total,
      estado: p.estado
    })));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error consultando compras del cliente' });
  }
});

module.exports = router;

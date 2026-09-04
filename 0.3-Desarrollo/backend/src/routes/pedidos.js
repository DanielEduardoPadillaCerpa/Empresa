const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requiereAutenticacion, requiereAdmin } = require('./auth');
const { registrarAuditoria } = require('../auditoria');

// Convierte el campo items a array/objeto JS sin importar si mysql2
// ya lo entregó parseado (columna JSON) o como texto.
function parsearItems(items) {
  return typeof items === 'string' ? JSON.parse(items) : items;
}

// POST /api/pedidos -> registrar un pedido (cliente)
router.post('/', requiereAutenticacion, async (req, res) => {
  try {
    const clienteId = req.usuario.clienteId;
    if (!clienteId) {
      return res.status(400).json({ error: 'Tu cuenta todavía no está vinculada a un cliente registrado. Completa el registro antes de comprar.' });
    }

    const { items } = req.body; // items = [{ id, nombre, precio, cantidad }]
    if (!items || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ error: 'Datos de pedido inválidos' });
    }
    for (const item of items) {
      if (!item.id) {
        return res.status(400).json({ error: `El producto "${item.nombre || '?'}" no tiene un ID válido` });
      }
    }

    // Trae el estado real de cada producto desde la base de datos — nunca
    // se confía en lo que el navegador diga sobre precio, stock o si el
    // producto es restringido, porque el carrito viaja en localStorage y
    // se puede manipular.
    const [clienteFilas] = await pool.query(
      'SELECT autorizacion_general FROM clientes WHERE id = ?',
      [clienteId]
    );
    if (!clienteFilas.length) {
      return res.status(400).json({ error: 'No se encontró el cliente asociado a tu cuenta.' });
    }
    const clienteAutorizado = !!clienteFilas[0].autorizacion_general;

    let hayRestringido = false;
    for (const item of items) {
      const [producto] = await pool.query(
        'SELECT cantidad_disponible, restringido, estado FROM productos WHERE id=?',
        [item.id]
      );
      if (!producto.length || producto[0].estado !== 'activo') {
        return res.status(404).json({ error: `Producto ${item.id} no encontrado o no disponible` });
      }
      if (item.cantidad > producto[0].cantidad_disponible) {
        return res.status(400).json({ error: `No hay suficiente inventario para ${item.nombre}` });
      }
      if (producto[0].restringido) hayRestringido = true;
    }

    // Equipo restringido: exige que el cliente tenga la autorización general
    // registrada (verificación de antecedentes) antes de permitir la compra.
    if (hayRestringido && !clienteAutorizado) {
      return res.status(403).json({
        error: 'Tu pedido incluye equipo restringido. Para completarlo, tu cuenta debe tener registrada la autorización/verificación de antecedentes. Actualiza tu registro o contacta al administrador.'
      });
    }

    // Calcular total
    const total = items.reduce((sum, i) => sum + i.precio * i.cantidad, 0);

    // Registrar pedido
    const [resultado] = await pool.query(
      'INSERT INTO pedidos (cliente_id, items, total, estado) VALUES (?, ?, ?, ?)',
      [clienteId, JSON.stringify(items), total, 'pendiente']
    );

    // Registrar el detalle (línea por producto) y descontar inventario
    for (const item of items) {
      await pool.query(
        'INSERT INTO detalle_pedido (pedido_id, producto_id, cantidad, precio_unitario) VALUES (?, ?, ?, ?)',
        [resultado.insertId, item.id, item.cantidad, item.precio]
      );
      await pool.query(
        'UPDATE productos SET cantidad_disponible = cantidad_disponible - ? WHERE id=?',
        [item.cantidad, item.id]
      );
    }

    res.status(201).json({ id: resultado.insertId, total });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error registrando pedido' });
  }
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
  try {
    const clienteId = req.usuario.clienteId;
    const [filas] = await pool.query(
      'SELECT id, cliente_id, estado, items FROM pedidos WHERE id = ?',
      [req.params.id]
    );
    if (!filas.length) return res.status(404).json({ error: 'Pedido no encontrado' });

    const pedido = filas[0];
    if (pedido.cliente_id !== clienteId) {
      return res.status(403).json({ error: 'No puedes cancelar un pedido que no es tuyo' });
    }
    if (pedido.estado !== 'pendiente') {
      return res.status(400).json({ error: 'Solo se pueden cancelar pedidos en estado "pendiente" (antes de ser enviados)' });
    }

    await pool.query("UPDATE pedidos SET estado = 'cancelado' WHERE id = ?", [req.params.id]);

    // Repone el inventario descontado al crear el pedido
    const items = parsearItems(pedido.items);
    for (const item of items) {
      await pool.query(
        'UPDATE productos SET cantidad_disponible = cantidad_disponible + ? WHERE id = ?',
        [item.cantidad, item.id]
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error cancelando el pedido' });
  }
});

// PUT /api/pedidos/:id -> actualizar estado de un pedido (solo admin)
router.put('/:id', requiereAutenticacion, requiereAdmin, async (req, res) => {
  try {
    const { estado } = req.body;
    if (!['pendiente', 'enviado', 'entregado', 'cancelado'].includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const [filas] = await pool.query('SELECT id, estado, items FROM pedidos WHERE id = ?', [req.params.id]);
    if (!filas.length) return res.status(404).json({ error: 'Pedido no encontrado' });
    const anterior = filas[0];

    await pool.query('UPDATE pedidos SET estado = ? WHERE id = ?', [estado, req.params.id]);

    // Si el admin cancela un pedido que no estaba cancelado, repone inventario
    if (estado === 'cancelado' && anterior.estado !== 'cancelado') {
      const items = parsearItems(anterior.items);
      for (const item of items) {
        await pool.query(
          'UPDATE productos SET cantidad_disponible = cantidad_disponible + ? WHERE id = ?',
          [item.cantidad, item.id]
        );
      }
    }

    await registrarAuditoria({
      usuario: req.usuario,
      accion: 'editar',
      entidad: 'pedido',
      entidadId: req.params.id,
      detalle: { estadoAnterior: anterior.estado, estadoNuevo: estado },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error actualizando estado del pedido' });
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

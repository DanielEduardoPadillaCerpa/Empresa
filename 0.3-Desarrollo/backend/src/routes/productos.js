const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requiereAutenticacion, requiereAdmin } = require('./auth');
const { registrarAuditoria } = require('../auditoria');

// Umbral por defecto para considerar "inventario bajo" (configurable por .env)
const STOCK_MINIMO = Number(process.env.STOCK_MINIMO || 10);

// GET /api/productos -> catálogo público (solo productos activos)
// Admite ?categoria_id= para filtrar y ?incluir_inactivos=1 (solo admin) para gestión.
router.get('/', async (req, res) => {
  try {
    const categoriaId = req.query.categoria_id;
    const incluirInactivos = req.query.incluir_inactivos === '1';

    let sql = `
      SELECT id, nombre, descripcion, precio, imagen, cantidad_disponible, estado, restringido, categoria_id, fecha_creacion
      FROM productos
    `;
    const condiciones = [];
    const params = [];

    if (!incluirInactivos) {
      condiciones.push("estado = 'activo'");
    }
    if (categoriaId) {
      condiciones.push('categoria_id = ?');
      params.push(categoriaId);
    }
    if (condiciones.length) {
      sql += ' WHERE ' + condiciones.join(' AND ');
    }
    sql += ' ORDER BY nombre ASC';

    const [filas] = await pool.query(sql, params);
    res.json(filas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error cargando productos' });
  }
});

// GET /api/productos/bajo-inventario -> productos por debajo del umbral mínimo (solo admin)
// IMPORTANTE: declarada ANTES de '/:id', porque Express prueba las rutas en
// orden y '/:id' interpretaría "bajo-inventario" como si fuera un ID.
router.get('/bajo-inventario', requiereAutenticacion, requiereAdmin, async (req, res) => {
  try {
    const umbral = req.query.umbral ? Number(req.query.umbral) : STOCK_MINIMO;
    const [filas] = await pool.query(
      `SELECT id, nombre, cantidad_disponible, categoria_id
       FROM productos
       WHERE estado = 'activo' AND cantidad_disponible <= ?
       ORDER BY cantidad_disponible ASC`,
      [umbral]
    );
    res.json({ umbral, productos: filas });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error consultando inventario bajo' });
  }
});

// GET /api/productos/:id -> detalle de un producto (público — página tipo "detalle de producto")
router.get('/:id', async (req, res) => {
  try {
    const [filas] = await pool.query(
      `SELECT id, nombre, descripcion, precio, imagen, cantidad_disponible, estado, restringido, categoria_id, fecha_creacion
       FROM productos WHERE id = ?`,
      [req.params.id]
    );
    if (!filas.length) return res.status(404).json({ error: 'Producto no encontrado' });
    res.json(filas[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error consultando producto' });
  }
});

// POST /api/productos -> crear producto (solo admin)
router.post('/', requiereAutenticacion, requiereAdmin, async (req, res) => {
  try {
    const { nombre, descripcion, precio, imagen, cantidad_disponible, estado, restringido, categoria_id } = req.body;

    if (!nombre || precio === undefined || precio === null) {
      return res.status(400).json({ error: 'Nombre y precio son obligatorios' });
    }

    const [resultado] = await pool.query(
      `INSERT INTO productos (nombre, descripcion, precio, imagen, cantidad_disponible, estado, restringido, categoria_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        nombre,
        descripcion || null,
        Number(precio),
        imagen || null,
        Number(cantidad_disponible) || 0,
        estado === 'inactivo' ? 'inactivo' : 'activo',
        !!restringido,
        categoria_id || null,
      ]
    );

    await registrarAuditoria({
      usuario: req.usuario,
      accion: 'crear',
      entidad: 'producto',
      entidadId: resultado.insertId,
      detalle: { nombre, precio },
    });

    res.status(201).json({ id: resultado.insertId, nombre });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creando producto' });
  }
});

// PUT /api/productos/:id -> editar producto (solo admin)
router.put('/:id', requiereAutenticacion, requiereAdmin, async (req, res) => {
  try {
    const { nombre, descripcion, precio, imagen, cantidad_disponible, estado, restringido, categoria_id } = req.body;

    const [existente] = await pool.query('SELECT id FROM productos WHERE id = ?', [req.params.id]);
    if (!existente.length) return res.status(404).json({ error: 'Producto no encontrado' });

    await pool.query(
      `UPDATE productos SET
         nombre = ?,
         descripcion = ?,
         precio = ?,
         imagen = COALESCE(?, imagen),
         cantidad_disponible = ?,
         estado = ?,
         restringido = ?,
         categoria_id = ?
       WHERE id = ?`,
      [
        nombre,
        descripcion || null,
        Number(precio),
        imagen || null,
        Number(cantidad_disponible) || 0,
        estado === 'inactivo' ? 'inactivo' : 'activo',
        !!restringido,
        categoria_id || null,
        req.params.id,
      ]
    );

    await registrarAuditoria({
      usuario: req.usuario,
      accion: 'editar',
      entidad: 'producto',
      entidadId: req.params.id,
      detalle: { nombre, precio, cantidad_disponible },
    });

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error actualizando producto' });
  }
});

// DELETE /api/productos/:id -> eliminar producto (solo admin)
// Si el producto ya tiene pedidos asociados (detalle_pedido), no se puede
// borrar sin romper el historial de compras: en ese caso se desactiva
// (estado = 'inactivo') en vez de eliminarlo físicamente, y se informa al
// admin por qué. Si nunca se vendió, se elimina de verdad.
router.delete('/:id', requiereAutenticacion, requiereAdmin, async (req, res) => {
  try {
    const [existente] = await pool.query('SELECT id, nombre FROM productos WHERE id = ?', [req.params.id]);
    if (!existente.length) return res.status(404).json({ error: 'Producto no encontrado' });

    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM detalle_pedido WHERE producto_id = ?',
      [req.params.id]
    );

    if (total > 0) {
      await pool.query("UPDATE productos SET estado = 'inactivo' WHERE id = ?", [req.params.id]);
      await registrarAuditoria({
        usuario: req.usuario,
        accion: 'editar',
        entidad: 'producto',
        entidadId: req.params.id,
        detalle: { motivo: 'desactivado en vez de eliminado (tiene pedidos asociados)' },
      });
      return res.json({ ok: true, desactivado: true, mensaje: 'El producto tiene pedidos asociados: se desactivó del catálogo en vez de eliminarse, para no romper el historial.' });
    }

    await pool.query('DELETE FROM productos WHERE id = ?', [req.params.id]);
    await registrarAuditoria({
      usuario: req.usuario,
      accion: 'eliminar',
      entidad: 'producto',
      entidadId: req.params.id,
      detalle: { nombre: existente[0].nombre },
    });
    res.json({ ok: true, desactivado: false });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error eliminando producto' });
  }
});

module.exports = router;

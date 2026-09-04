const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requiereAutenticacion, requiereAdmin } = require('./auth');
const { registrarAuditoria } = require('../auditoria');

// GET /api/categorias -> listar todas
router.get('/', async (req, res) => {
  try {
    const [filas] = await pool.query('SELECT * FROM categorias ORDER BY nombre ASC');
    res.json(filas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error consultando categorías' });
  }
});

// GET /api/categorias/:id -> detalle de una categoría
router.get('/:id', async (req, res) => {
  try {
    const [filas] = await pool.query('SELECT * FROM categorias WHERE id=?', [req.params.id]);
    if (!filas.length) return res.status(404).json({ error: 'Categoría no encontrada' });
    res.json(filas[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error consultando categoría' });
  }
});

// POST /api/categorias -> crear categoría (solo admin)
router.post('/', requiereAutenticacion, requiereAdmin, async (req, res) => {
  try {
    const { nombre, descripcion } = req.body;
    const [resultado] = await pool.query(
      'INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)',
      [nombre, descripcion]
    );
    await registrarAuditoria({ usuario: req.usuario, accion: 'crear', entidad: 'categoria', entidadId: resultado.insertId, detalle: { nombre } });
    res.status(201).json({ id: resultado.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creando categoría' });
  }
});

// PUT /api/categorias/:id -> actualizar categoría (solo admin)
router.put('/:id', requiereAutenticacion, requiereAdmin, async (req, res) => {
  try {
    const { nombre, descripcion } = req.body;
    await pool.query(
      'UPDATE categorias SET nombre=?, descripcion=? WHERE id=?',
      [nombre, descripcion, req.params.id]
    );
    await registrarAuditoria({ usuario: req.usuario, accion: 'editar', entidad: 'categoria', entidadId: req.params.id, detalle: { nombre } });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error actualizando categoría' });
  }
});

// DELETE /api/categorias/:id -> eliminar categoría (solo admin)
router.delete('/:id', requiereAutenticacion, requiereAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM categorias WHERE id=?', [req.params.id]);
    await registrarAuditoria({ usuario: req.usuario, accion: 'eliminar', entidad: 'categoria', entidadId: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error eliminando categoría' });
  }
});

module.exports = router;

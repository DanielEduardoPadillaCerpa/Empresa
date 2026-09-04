const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requiereAutenticacion } = require('./auth');

// Todas las rutas de este módulo exigen sesión de cliente y solo permiten
// ver/editar/eliminar los reportes del PROPIO cliente (nunca de otro).

// GET /api/mis-reportes -> lista los reportes del cliente autenticado
router.get('/', requiereAutenticacion, async (req, res) => {
  try {
    const clienteId = req.usuario.clienteId;
    if (!clienteId) return res.json([]);

    const [filas] = await pool.query(
      'SELECT id, comentario, calificacion, fecha, fecha_actualizacion FROM reportes_cliente WHERE cliente_id = ? ORDER BY fecha DESC',
      [clienteId]
    );
    res.json(filas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error consultando tus reportes' });
  }
});

// POST /api/mis-reportes -> crear un reporte/sugerencia nuevo
router.post('/', requiereAutenticacion, async (req, res) => {
  try {
    const clienteId = req.usuario.clienteId;
    if (!clienteId) {
      return res.status(400).json({ error: 'Tu cuenta todavía no está vinculada a un cliente registrado.' });
    }

    const { comentario, calificacion } = req.body;
    if (!comentario || !comentario.trim()) {
      return res.status(400).json({ error: 'El comentario es obligatorio' });
    }
    const calif = Number(calificacion);
    if (!calif || calif < 1 || calif > 5) {
      return res.status(400).json({ error: 'La calificación debe estar entre 1 y 5' });
    }

    const [resultado] = await pool.query(
      'INSERT INTO reportes_cliente (cliente_id, comentario, calificacion) VALUES (?, ?, ?)',
      [clienteId, comentario.trim(), calif]
    );

    res.status(201).json({ id: resultado.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error creando el reporte' });
  }
});

// PUT /api/mis-reportes/:id -> editar/actualizar un reporte propio
router.put('/:id', requiereAutenticacion, async (req, res) => {
  try {
    const clienteId = req.usuario.clienteId;
    const { comentario, calificacion } = req.body;

    const [filas] = await pool.query('SELECT cliente_id FROM reportes_cliente WHERE id = ?', [req.params.id]);
    if (!filas.length) return res.status(404).json({ error: 'Reporte no encontrado' });
    if (filas[0].cliente_id !== clienteId) {
      return res.status(403).json({ error: 'No puedes editar un reporte que no es tuyo' });
    }

    if (!comentario || !comentario.trim()) {
      return res.status(400).json({ error: 'El comentario es obligatorio' });
    }
    const calif = Number(calificacion);
    if (!calif || calif < 1 || calif > 5) {
      return res.status(400).json({ error: 'La calificación debe estar entre 1 y 5' });
    }

    await pool.query(
      'UPDATE reportes_cliente SET comentario = ?, calificacion = ? WHERE id = ?',
      [comentario.trim(), calif, req.params.id]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error actualizando el reporte' });
  }
});

// DELETE /api/mis-reportes/:id -> eliminar un reporte propio
router.delete('/:id', requiereAutenticacion, async (req, res) => {
  try {
    const clienteId = req.usuario.clienteId;
    const [filas] = await pool.query('SELECT cliente_id FROM reportes_cliente WHERE id = ?', [req.params.id]);
    if (!filas.length) return res.status(404).json({ error: 'Reporte no encontrado' });
    if (filas[0].cliente_id !== clienteId) {
      return res.status(403).json({ error: 'No puedes eliminar un reporte que no es tuyo' });
    }

    await pool.query('DELETE FROM reportes_cliente WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error eliminando el reporte' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requiereAutenticacion, requiereAdmin } = require('./auth');

// GET /api/auditoria -> historial de acciones administrativas (solo admin)
// Admite ?limite= (por defecto 100) y ?entidad= para filtrar.
router.get('/', requiereAutenticacion, requiereAdmin, async (req, res) => {
  try {
    const limite = Math.min(Number(req.query.limite) || 100, 500);
    const entidad = req.query.entidad;

    let sql = 'SELECT id, usuario_id, correo, accion, entidad, entidad_id, detalle, fecha FROM auditoria';
    const params = [];
    if (entidad) {
      sql += ' WHERE entidad = ?';
      params.push(entidad);
    }
    sql += ' ORDER BY fecha DESC LIMIT ?';
    params.push(limite);

    const [filas] = await pool.query(sql, params);
    res.json(filas);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error consultando la auditoría' });
  }
});

module.exports = router;

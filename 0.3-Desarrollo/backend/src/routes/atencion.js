const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// POST /api/atencion/calificacion
router.post('/calificacion', async (req, res) => {
  try {
    const { conversacionId, calificacion, comentario, escaladoAHumano } = req.body;

    if (!calificacion || calificacion < 1 || calificacion > 5) {
      return res.status(400).json({ error: 'La calificación debe estar entre 1 y 5' });
    }

    const [resultado] = await pool.query(
      `INSERT INTO atenciones (conversacion_id, calificacion, comentario, escalado_a_humano)
       VALUES (?, ?, ?, ?)`,
      [conversacionId || null, calificacion, comentario || null, !!escaladoAHumano]
    );

    res.status(201).json({ id: resultado.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error registrando calificación' });
  }
});

module.exports = router;

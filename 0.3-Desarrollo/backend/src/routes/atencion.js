const express = require('express');
const { pool } = require('../db');
const { manejarMensaje, limitarMensajes } = require('./asistente');

const router = express.Router();

router.post('/mensaje', limitarMensajes, (req, res) => manejarMensaje(req, res));

router.post('/calificacion', async (req, res) => {
  try {
    const { conversacionId, calificacion, comentario, escaladoAHumano } = req.body || {};
    if (!Number.isInteger(calificacion) || calificacion < 1 || calificacion > 5) {
      return res.status(400).json({ error: 'La calificación debe estar entre 1 y 5.' });
    }
    if (conversacionId != null &&
        (typeof conversacionId !== 'string' || conversacionId.length > 100)) {
      return res.status(400).json({ error: 'El identificador de conversación no es válido.' });
    }
    if (comentario != null && (typeof comentario !== 'string' || comentario.length > 1000)) {
      return res.status(400).json({ error: 'El comentario no puede superar 1000 caracteres.' });
    }

    const [resultado] = await pool.query(
      `INSERT INTO atenciones (conversacion_id, calificacion, comentario, escalado_a_humano)
       VALUES (?, ?, ?, ?)`,
      [conversacionId || null, calificacion, comentario || null, Boolean(escaladoAHumano)]
    );
    return res.status(201).json({ id: resultado.insertId });
  } catch (error) {
    console.error('[atencion] No se pudo registrar la calificación:', error.code || 'RATING_SAVE_FAILED');
    return res.status(500).json({ error: 'No fue posible registrar la calificación.' });
  }
});

module.exports = router;

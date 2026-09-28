const express = require('express');
const router = express.Router();
const { pool } = require('../db');

async function reenviarWebhook(url, cuerpo) {
  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), 8000);
  try {
    const respuesta = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.N8N_API_TOKEN ? { Authorization: `Bearer ${process.env.N8N_API_TOKEN}` } : {})
      },
      body: JSON.stringify(cuerpo),
      signal: controlador.signal
    });
    if (!respuesta.ok) throw new Error(`Webhook respondió HTTP ${respuesta.status}`);
    return await respuesta.json();
  } finally {
    clearTimeout(timeout);
  }
}

// POST /api/atencion/mensaje -> proxy seguro al workflow de n8n, si está configurado
router.post('/mensaje', async (req, res) => {
  const texto = typeof req.body?.mensaje === 'string' ? req.body.mensaje.trim() : '';
  if (!texto || texto.length > 2000) {
    return res.status(400).json({ error: 'El mensaje es obligatorio y debe tener máximo 2000 caracteres.' });
  }

  const webhook = process.env.N8N_CHAT_WEBHOOK_URL;
  if (!webhook) {
    return res.status(503).json({ error: 'La atención automatizada no está configurada actualmente.' });
  }

  try {
    const respuesta = await reenviarWebhook(webhook, {
      mensaje: texto,
      conversacionId: String(req.body.conversacionId || '').slice(0, 100),
      idioma: String(req.body.idioma || 'es-419').slice(0, 10)
    });
    const mensaje = respuesta.respuesta || respuesta.answer || respuesta.output;
    if (typeof mensaje !== 'string' || !mensaje.trim()) {
      throw new Error('El webhook no devolvió una respuesta válida');
    }
    res.json({ respuesta: mensaje.trim().slice(0, 4000) });
  } catch (err) {
    console.error('[atencion] Error consultando el workflow de n8n:', err.message);
    res.status(502).json({ error: 'No fue posible conectar con la atención automatizada.' });
  }
});

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

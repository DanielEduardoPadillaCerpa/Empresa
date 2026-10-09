const crypto = require('crypto');
const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { pool } = require('../db');
const { requiereAutenticacion } = require('./auth');
const { obtenerIndice } = require('../assistant/indiceCatalogo');
const {
  clasificarIntencion,
  responder,
  verificarRespuesta
} = require('../assistant/motor');
const { normalizarTexto, tokens } = require('../assistant/normalizador');
const { inferirIntencion } = require('../assistant/llmAdapter');

const router = express.Router();
const conversaciones = new Map();
const VIGENCIA_CONTEXTO_MS = 30 * 60 * 1000;
const MAX_CONVERSACIONES = 1000;

const limitarMensajes = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Has enviado demasiados mensajes. Intenta de nuevo en un minuto.' }
});

function limpiarConversaciones(ahora = Date.now()) {
  for (const [id, contexto] of conversaciones) {
    if (ahora - contexto.actualizadoEn > VIGENCIA_CONTEXTO_MS) conversaciones.delete(id);
  }
  while (conversaciones.size >= MAX_CONVERSACIONES) {
    conversaciones.delete(conversaciones.keys().next().value);
  }
}

function sanearTextoPendiente(texto) {
  const protegido = String(texto || '')
    .replace(/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/gi, '[correo]')
    .replace(/\b(?:https?:\/\/|www\.)\S+/gi, '[enlace]')
    .replace(/\b(?:calle|carrera|avenida|diagonal|transversal)\s+[\w#.-]+(?:\s+[\w#.-]+){0,5}/gi, '[direccion]')
    .replace(/\b\d{5,}\b/g, '[numero]');
  return normalizarTexto(protegido).slice(0, 500);
}

function tokenIgualConfigurado(recibido, esperado) {
  if (!recibido || !esperado) return false;
  const a = Buffer.from(String(recibido));
  const b = Buffer.from(String(esperado));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function seguimiento(texto, contexto, catalogo) {
  const normal = normalizarTexto(texto);
  if (!contexto) return { texto, productoActualId: null };

  if (/\b(?:el|la|producto)\s+segundo\b/.test(normal) && contexto.resultadosIds?.length > 1) {
    const producto = catalogo.productos.find(item => item.id === contexto.resultadosIds[1]);
    if (producto) return { texto: `${producto.nombre} ${texto}`, productoActualId: producto.id };
  }
  const esSeguimiento = /\b(?:y cuanto|cuanto cuesta|precio|disponible|stock|tallas?|y el|y la)\b/.test(normal);
  if (esSeguimiento && contexto.ultimoProductoId) {
    const producto = catalogo.productos.find(item => item.id === contexto.ultimoProductoId);
    if (producto && !tokens(texto).some(token => tokens(producto.nombre).includes(token))) {
      return { texto: `${producto.nombre} ${texto}`, productoActualId: producto.id };
    }
  }
  return { texto, productoActualId: null };
}

async function consultarEstadoPedido(req, res) {
  try {
    const clienteId = Number(req.usuario?.clienteId);
    if (!Number.isSafeInteger(clienteId) || clienteId < 1) {
      return res.json({
        respuesta: 'No hay pedidos asociados a esta cuenta.',
        tarjetas: [],
        sugerencias: [],
        escalar: false,
        origen: 'ninguno'
      });
    }
    const [pedidos] = await pool.query(
      `SELECT id, estado, fecha_pedido
       FROM pedidos WHERE cliente_id = ?
       ORDER BY fecha_pedido DESC LIMIT 5`,
      [clienteId]
    );
    const respuesta = pedidos.length
      ? `Estados de tus pedidos:\n${pedidos.map(pedido =>
        `Pedido ${pedido.id}: ${pedido.estado} (${new Date(pedido.fecha_pedido).toLocaleDateString('es-CO')}).`
      ).join('\n')}`
      : 'No hay pedidos asociados a esta cuenta.';
    return res.json({ respuesta, tarjetas: [], sugerencias: [], escalar: false, origen: 'ninguno' });
  } catch (error) {
    console.error('[assistant] No se pudo consultar el estado del pedido:', error.code || 'ORDER_STATUS_FAILED');
    return res.status(500).json({ error: 'No fue posible consultar el estado del pedido.' });
  }
}

async function manejarMensaje(req, res) {
  const mensaje = typeof req.body?.mensaje === 'string' ? req.body.mensaje.trim() : '';
  if (!mensaje || mensaje.length > 500) {
    return res.status(400).json({ error: 'El mensaje es obligatorio y debe tener máximo 500 caracteres.' });
  }
  const conversacionId = typeof req.body.conversacionId === 'string' &&
    /^[A-Za-z0-9_-]{8,100}$/.test(req.body.conversacionId)
    ? req.body.conversacionId
    : crypto.randomUUID();

  if (clasificarIntencion(mensaje) === 'estado_pedido') {
    return requiereAutenticacion(req, res, () => consultarEstadoPedido(req, res));
  }

  try {
    limpiarConversaciones();
    const contexto = conversaciones.get(conversacionId);
    const catalogo = await obtenerIndice();
    const seguimientoResuelto = seguimiento(mensaje, contexto, catalogo);
    const productoActualId = Number.isSafeInteger(Number(req.body.productoActualId))
      ? Number(req.body.productoActualId)
      : seguimientoResuelto.productoActualId;
    const intencionReglas = clasificarIntencion(seguimientoResuelto.texto);
    let plan = null;
    if (process.env.ASSISTANT_MODE === 'llm' &&
        !['estado_pedido', 'faq', 'como_comprar', 'humano', 'restringidos', 'fuera_tema', 'saludo', 'agradecimiento'].includes(intencionReglas)) {
      const planPropuesto = await inferirIntencion(seguimientoResuelto.texto);
      if (planPropuesto && ['buscar', 'precio', 'disponibilidad', 'comparar', 'recomendar', 'categoria', 'tallas'].includes(planPropuesto.intent)) {
        plan = planPropuesto;
      }
    }
    const resultado = responder(catalogo, seguimientoResuelto.texto, {
      contexto,
      productoActualId,
      plan
    });

    if (process.env.NODE_ENV !== 'production' && !verificarRespuesta(resultado, catalogo)) {
      console.error('[assistant] Respuesta no respaldada por el índice de catálogo.');
      return res.status(500).json({ error: 'No fue posible validar la respuesta del asistente.' });
    }

    const ids = resultado.tarjetas.map(tarjeta => Number(tarjeta.id));
    conversaciones.set(conversacionId, {
      ultimoProductoId: ids[0] || seguimientoResuelto.productoActualId || contexto?.ultimoProductoId || null,
      resultadosIds: ids,
      actualizadoEn: Date.now()
    });

    const textoRespuestaNormalizado = normalizarTexto(resultado.respuesta);
    const respuestaSinDato = textoRespuestaNormalizado.startsWith('no lo encuentro en el catalogo') ||
      textoRespuestaNormalizado.startsWith('no tengo esa politica') ||
      textoRespuestaNormalizado.startsWith('no tengo informacion confirmada');
    if (respuestaSinDato) {
      await pool.query(
        `INSERT INTO asistente_pendientes (conversacion_id, texto_normalizado)
         VALUES (?, ?)`,
        [conversacionId, sanearTextoPendiente(mensaje)]
      );
    }
    if (resultado.escalar) {
      const fecha = new Date().toISOString();
      const motivo = resultado.origen === 'faq' ? 'consulta_de_politica' : 'solicitud_de_atencion';
      await pool.query(
        `INSERT IGNORE INTO automation_outbox (workflow, dedupe_key, payload)
         VALUES ('W6', ?, ?)`,
        [
          `asistente-escalado:${conversacionId}:${crypto.createHash('sha256').update(mensaje).digest('hex').slice(0, 12)}`,
          JSON.stringify({
            evento: 'asistente.escalado',
            conversacion_id: conversacionId,
            motivo,
            resumen: 'El cliente solicitó atención humana o información no disponible en el catálogo.',
            fecha
          })
        ]
      );
    }
    return res.json({
      respuesta: resultado.respuesta,
      tarjetas: resultado.tarjetas,
      sugerencias: resultado.sugerencias,
      escalar: resultado.escalar,
      origen: resultado.origen,
      conversacionId
    });
  } catch (error) {
    console.error('[assistant] No se pudo procesar el mensaje:', error.code || 'ASSISTANT_REQUEST_FAILED');
    return res.status(500).json({ error: 'No fue posible procesar tu consulta. Intenta de nuevo.' });
  }
}

router.post('/mensaje', limitarMensajes, manejarMensaje);
router.get('/sugerencias', async (req, res) => {
  try {
    const catalogo = await obtenerIndice();
    const preguntas = catalogo.faq.slice(0, 6).map(faq => faq.pregunta);
    res.json({
      sugerencias: preguntas.length ? preguntas : [
        '¿Qué productos tienen disponibles?',
        '¿Cuánto cuesta un producto?',
        '¿Qué productos están restringidos?'
      ]
    });
  } catch (error) {
    console.error('[assistant] No se pudieron cargar sugerencias:', error.code || 'ASSISTANT_SUGGESTIONS_FAILED');
    res.status(500).json({ error: 'No fue posible cargar las sugerencias.' });
  }
});

router.get('/pendientes/resumen-semanal', async (req, res) => {
  const esperado = process.env.ASSISTANT_WEEKLY_SUMMARY_TOKEN;
  if (!esperado || esperado.length < 32) {
    return res.status(503).json({ error: 'El resumen semanal no está configurado.' });
  }
  const recibido = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!tokenIgualConfigurado(recibido, esperado)) {
    return res.status(401).json({ error: 'No autorizado.' });
  }
  try {
    const [resumen] = await pool.query(
      `SELECT DATE(creado_en) AS fecha, COUNT(*) AS cantidad
       FROM asistente_pendientes
      WHERE creado_en >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY DATE(creado_en)
       ORDER BY fecha`
    );
    res.json({
      periodo_dias: 7,
      total: resumen.reduce((total, fila) => total + Number(fila.cantidad), 0),
      por_dia: resumen.map(fila => ({ fecha: fila.fecha, cantidad: Number(fila.cantidad) }))
    });
  } catch (error) {
    console.error('[assistant] No se pudo crear el resumen semanal:', error.code || 'ASSISTANT_SUMMARY_FAILED');
    res.status(500).json({ error: 'No fue posible generar el resumen semanal.' });
  }
});

module.exports = { router, manejarMensaje, limitarMensajes, sanearTextoPendiente, tokenIgualConfigurado };

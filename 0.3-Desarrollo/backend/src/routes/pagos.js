const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { requiereAutenticacion } = require('./auth');

const METODOS_PAGO = new Set(['NEQUI', 'DAVIPLATA', 'PSE', 'VISA', 'MASTERCARD', 'AMEX', 'ACH', 'TARJETA']);

router.post('/procesar', requiereAutenticacion, async (req, res) => {
  const webhook = process.env.N8N_PAYMENT_WEBHOOK_URL;
  if (!webhook) {
    return res.status(503).json({ error: 'La pasarela de pagos no está configurada. No se ha realizado ningún cobro.' });
  }
  const entorno = String(process.env.N8N_PAYMENT_ENVIRONMENT || 'sandbox').toLowerCase();
  if (entorno !== 'sandbox') {
    return res.status(503).json({ error: 'La pasarela está habilitada únicamente para pruebas sandbox. No se ha realizado ningún cobro.' });
  }

  const metodo = String(req.body?.metodo || '').toUpperCase();
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!METODOS_PAGO.has(metodo) || !items.length || items.length > 100) {
    return res.status(400).json({ error: 'Los datos de la solicitud de pago no son válidos.' });
  }

  const cantidadesPorId = new Map();
  const lineasSolicitadas = [];
  for (const item of items) {
    const id = Number(item?.id);
    const cantidad = Number(item?.cantidad);
    if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(cantidad) || cantidad <= 0 || cantidad > 500) {
      return res.status(400).json({ error: 'Los artículos de la solicitud de pago no son válidos.' });
    }
    cantidadesPorId.set(id, (cantidadesPorId.get(id) || 0) + cantidad);
    lineasSolicitadas.push({
      id,
      cantidad,
      variacion: typeof item.variacion === 'string' ? item.variacion.slice(0, 80) : null
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const ids = [...cantidadesPorId.keys()];
    const [productos] = await pool.query(
      `SELECT id, nombre, precio, cantidad_disponible, estado FROM productos WHERE id IN (${ids.map(() => '?').join(',')})`,
      ids
    );
    if (productos.length !== ids.length) {
      return res.status(409).json({ error: 'Uno o más productos ya no están disponibles.' });
    }

    const productosPorId = new Map(productos.map(producto => [Number(producto.id), producto]));
    for (const producto of productos) {
      const cantidad = cantidadesPorId.get(Number(producto.id));
      if (producto.estado !== 'activo' || Number(producto.cantidad_disponible) < cantidad) {
        throw Object.assign(new Error('Stock insuficiente o producto inactivo'), { status: 409 });
      }
    }
    let importe = 0;
    const itemsValidados = lineasSolicitadas.map(linea => {
      const producto = productosPorId.get(linea.id);
      importe += Number(producto.precio) * linea.cantidad;
      return {
        id: producto.id,
        nombre: producto.nombre,
        cantidad: linea.cantidad,
        variacion: linea.variacion,
        precioUnitario: Number(producto.precio)
      };
    });

    const response = await fetch(webhook, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(process.env.N8N_API_TOKEN ? { Authorization: `Bearer ${process.env.N8N_API_TOKEN}` } : {})
      },
      signal: controller.signal,
      body: JSON.stringify({
        evento: 'solicitud_pago_sandbox',
        entorno,
        destinatarioAdministrador: process.env.ADMIN_NOTIFICATION_EMAIL || 'pcerpadaniel@gmail.com',
        cliente: {
          correo: req.usuario.correo,
          tipo: req.body.tipoComprador,
          nombre: req.body.datosComprador?.nombre || req.body.datosComprador?.razonSocial,
          identificacion: req.body.datosComprador?.rutNit || req.body.datosComprador?.nit
        },
        direccionEntrega: req.body.direccionEntrega,
        metodo,
        importe: Math.round(importe * 100) / 100,
        moneda: 'COP',
        items: itemsValidados
      })
    });
    if (!response.ok) throw new Error(`Webhook respondió HTTP ${response.status}`);

    const result = await response.json();
    const estado = String(result.estado || result.status || '').toLowerCase();
    if (!['aprobado', 'rechazado', 'pendiente'].includes(estado)) {
      throw new Error('El webhook de pagos devolvió un estado desconocido');
    }
    res.json({
      estado,
      referencia: typeof result.referencia === 'string' ? result.referencia.slice(0, 120) : null,
      mensaje: typeof result.mensaje === 'string' ? result.mensaje.slice(0, 300) : null
    });
  } catch (err) {
    console.error('[pagos] Error consultando el workflow de n8n:', err.message);
    if (err.status) return res.status(err.status).json({ error: err.message });
    res.status(502).json({ error: 'No fue posible verificar el pago. No se ha confirmado la transacción.' });
  } finally {
    clearTimeout(timeout);
  }
});

module.exports = router;

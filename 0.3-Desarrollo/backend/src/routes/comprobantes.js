const express = require('express');
const PDFDocument = require('pdfkit');
const { pool } = require('../db');
const { descifrar } = require('../crypto');
const { requiereAutenticacion } = require('./auth');
const { validarTokenComprobante } = require('../receiptTokens');

const router = express.Router();

function parsearIdentificador(valor) {
  const numero = Number(valor);
  return Number.isSafeInteger(numero) && numero > 0 ? numero : null;
}

function parsearItems(items) {
  return typeof items === 'string' ? JSON.parse(items) : items;
}

function formatoCentavos(valor) {
  const monto = BigInt(valor);
  const pesos = monto / 100n;
  const centavos = String(monto % 100n).padStart(2, '0');
  return `COP ${pesos.toLocaleString('es-CO')},${centavos}`;
}

function desgloseIva(totalCentavos) {
  const total = BigInt(totalCentavos);
  const neto = (total * 100n + 59n) / 119n;
  return { subtotal_centavos: String(neto), iva_centavos: String(total - neto) };
}

function textoPdf(valor) {
  return String(valor ?? '').replace(/[^\x00-\xFF]/g, ' ');
}

function enviarPdf(res, comprobante, items) {
  res.set({
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="comprobante-${comprobante.numero}.pdf"`
  });
  const documento = new PDFDocument({ size: 'A4', margin: 52 });
  documento.on('error', err => {
    console.error('[comprobantes] Error generando PDF:', err.code || 'PDF_GENERATION_ERROR');
    if (!res.headersSent) res.status(500).json({ error: 'No fue posible generar el comprobante.' });
    else res.destroy(err);
  });
  res.on('close', () => {
    if (!res.writableEnded) documento.destroy();
  });
  documento.pipe(res);
  documento.fontSize(21).text('Suministros Institucionales', { align: 'center' });
  documento.moveDown(0.5).fontSize(16).text('Comprobante de compra', { align: 'center' });
  documento.moveDown(0.4).fontSize(9).text('Documento informativo. No es factura electrónica DIAN.', { align: 'center' });
  documento.moveDown(1).fontSize(11);
  documento.text(`Número: ${textoPdf(comprobante.numero)}`);
  documento.text(`Pedido: #${comprobante.pedido_id}`);
  documento.text(`Fecha: ${new Date(comprobante.fecha_pedido).toLocaleString('es-CO', { timeZone: 'America/Bogota' })}`);
  documento.text(`Medio de pago: ${textoPdf(comprobante.metodo || '—')}`);
  documento.text(`Estado: ${textoPdf(comprobante.estado_pago)}`);
  documento.moveDown();
  documento.fontSize(12).text('Artículos', { underline: true });
  documento.moveDown(0.4).fontSize(10);
  for (const item of items) {
    const nombre = textoPdf(item.nombre || `Producto ${item.id || ''}`);
    const variacion = item.variacion ? ` (${textoPdf(item.variacion)})` : '';
    const precioCentavos = item.precio_centavos !== undefined
      ? BigInt(item.precio_centavos)
      : BigInt(Math.round(Number(item.precio || 0) * 100));
    const cantidad = BigInt(item.cantidad || 0);
    documento.text(`${cantidad} x ${nombre}${variacion} - ${formatoCentavos(precioCentavos * cantidad)}`);
  }
  documento.moveDown();
  const desglose = desgloseIva(comprobante.monto_centavos);
  documento.text(`Subtotal neto: ${formatoCentavos(desglose.subtotal_centavos)}`);
  documento.text(`IVA discriminado (19%): ${formatoCentavos(desglose.iva_centavos)}`);
  documento.fontSize(13).text(`Total pagado: ${formatoCentavos(comprobante.monto_centavos)}`);
  documento.moveDown(2).fontSize(8).text(
    'Los datos personales de entrega se omitieron de esta copia. La factura electrónica, si aplica, será emitida por el proveedor tecnológico autorizado.',
    { align: 'center' }
  );
  documento.end();
}

async function cargarComprobante(pedidoId) {
  const [filas] = await pool.query(
    `SELECT c.id AS comprobante_id, c.pedido_id, c.numero, c.enviar_correo,
            c.token_hash, c.expira_en, c.enviado_cliente_en, c.enviado_admin_en,
            p.cliente_id, p.fecha_pedido, p.items, p.datos_comprador_cifrados,
            p.direccion_entrega_cifrada,
            pa.estado AS estado_pago, pa.monto_centavos, pa.moneda, pa.metodo
     FROM comprobantes c
     JOIN pedidos p ON p.id = c.pedido_id
     JOIN pagos pa ON pa.pedido_id = p.id
     WHERE c.pedido_id = ? AND pa.estado = 'aprobado'
     LIMIT 1`,
    [pedidoId]
  );
  return filas[0] || null;
}

function autorizarAcceso(req, res, next) {
  if (req.get('Authorization')) return requiereAutenticacion(req, res, next);
  if (typeof req.query.token === 'string' && req.query.token) return next();
  return res.status(401).json({ error: 'Se requiere una sesión o un enlace seguro vigente.' });
}

router.get('/:pedidoId', autorizarAcceso, async (req, res) => {
  try {
    const pedidoId = parsearIdentificador(req.params.pedidoId);
    if (!pedidoId) return res.status(400).json({ error: 'El identificador del pedido no es válido.' });
    const comprobante = await cargarComprobante(pedidoId);
    if (!comprobante) return res.status(404).json({ error: 'Comprobante no encontrado.' });

    if (req.get('Authorization')) {
      if (Number(comprobante.cliente_id) !== Number(req.usuario.clienteId)) {
        return res.status(404).json({ error: 'Comprobante no encontrado.' });
      }
    } else if (!comprobante.enviar_correo ||
        !validarTokenComprobante(pedidoId, req.query.token, comprobante.token_hash, comprobante.expira_en)) {
      return res.status(401).json({ error: 'El enlace del comprobante no es válido o ha expirado.' });
    }

    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    const items = parsearItems(comprobante.items);
    if (req.query.format === 'pdf' || req.query.download === '1' || !req.get('Authorization')) {
      return enviarPdf(res, comprobante, items);
    }

    let comprador = {};
    try {
      comprador = JSON.parse(descifrar(comprobante.datos_comprador_cifrados) || '{}');
    } catch (err) {
      console.error('[comprobantes] No se pudieron descifrar los datos del comprador:', err.code || 'BUYER_DATA_DECRYPTION_ERROR');
      return res.status(500).json({ error: 'No fue posible leer los datos del comprobante.' });
    }
    const desglose = desgloseIva(comprobante.monto_centavos);
    res.json({
      pedido_id: comprobante.pedido_id,
      numero: comprobante.numero,
      estado: comprobante.estado_pago,
      fecha: comprobante.fecha_pedido,
      moneda: comprobante.moneda,
      metodo: comprobante.metodo,
      total_centavos: String(comprobante.monto_centavos),
      subtotal_centavos: desglose.subtotal_centavos,
      iva_centavos: desglose.iva_centavos,
      comprador,
      direccion_entrega: descifrar(comprobante.direccion_entrega_cifrada),
      items,
      enviar_correo: Boolean(comprobante.enviar_correo),
      enviado_cliente_en: comprobante.enviado_cliente_en
    });
  } catch (err) {
    console.error('[comprobantes] No se pudo recuperar el comprobante:', err.code || 'RECEIPT_READ_ERROR');
    res.status(500).json({ error: 'No fue posible recuperar el comprobante.' });
  }
});

router.post('/:pedidoId/reenviar', requiereAutenticacion, async (req, res) => {
  let connection;
  try {
    const pedidoId = parsearIdentificador(req.params.pedidoId);
    const usuarioId = parsearIdentificador(req.usuario?.uid);
    const clienteId = parsearIdentificador(req.usuario?.clienteId);
    if (!pedidoId || !usuarioId || !clienteId) {
      return res.status(400).json({ error: 'La solicitud de reenvío no es válida.' });
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const [filas] = await connection.query(
      `SELECT c.id, c.enviar_correo, p.cliente_id
       FROM comprobantes c
       JOIN pedidos p ON p.id = c.pedido_id
       JOIN pagos pa ON pa.pedido_id = p.id AND pa.estado = 'aprobado'
       WHERE c.pedido_id = ?
       FOR UPDATE`,
      [pedidoId]
    );
    if (!filas.length || Number(filas[0].cliente_id) !== clienteId) {
      await connection.rollback();
      return res.status(404).json({ error: 'Comprobante no encontrado.' });
    }
    if (!filas[0].enviar_correo) {
      await connection.rollback();
      return res.status(403).json({ error: 'El envío por correo no fue seleccionado al realizar la compra.' });
    }

    const [solicitudes] = await connection.query(
      `SELECT COUNT(*) AS cantidad
       FROM solicitudes_reenvio_comprobante
       WHERE comprobante_id = ? AND usuario_id = ?
         AND creado_en >= DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
      [filas[0].id, usuarioId]
    );
    if (Number(solicitudes[0].cantidad) >= 3) {
      await connection.rollback();
      return res.status(429).json({ error: 'Se alcanzó el límite de tres reenvíos por hora.' });
    }

    await connection.query(
      `INSERT INTO solicitudes_reenvio_comprobante (comprobante_id, usuario_id)
       VALUES (?, ?)`,
      [filas[0].id, usuarioId]
    );
    await connection.query(
      `INSERT INTO correo_outbox (comprobante_id, tipo)
       VALUES (?, 'cliente')`,
      [filas[0].id]
    );
    await connection.commit();
    res.status(202).json({ ok: true, mensaje: 'El reenvío del comprobante quedó en cola.' });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('[comprobantes] No se pudo solicitar el reenvío:', err.code || 'RECEIPT_RESEND_ERROR');
    res.status(500).json({ error: 'No fue posible solicitar el reenvío del comprobante.' });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;

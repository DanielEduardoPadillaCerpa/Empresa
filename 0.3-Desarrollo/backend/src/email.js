const nodemailer = require('nodemailer');

function obtenerTransportador() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASSWORD;
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !pass) {
    throw new Error('SMTP_NOT_CONFIGURED');
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: { user, pass }
  });
}

async function enviarMensaje({ to, subject, text, html }) {
  const transportador = obtenerTransportador();
  const remitente = process.env.SMTP_FROM || process.env.SMTP_USER;
  const resultado = await transportador.sendMail({ from: remitente, to, subject, text, html });
  const destinatarios = Array.isArray(to) ? to : [to];
  const aceptados = new Set((resultado.accepted || []).map(direccion => String(direccion).toLowerCase()));
  if (!destinatarios.some(direccion => aceptados.has(String(direccion).toLowerCase()))) {
    const error = new Error('SMTP_RECIPIENT_NOT_ACCEPTED');
    error.code = 'SMTP_RECIPIENT_NOT_ACCEPTED';
    throw error;
  }
}

function obtenerBaseUrlComprobante() {
  const baseUrl = process.env.RECEIPT_LINK_BASE_URL;
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    const error = new Error('RECEIPT_LINK_BASE_URL_INVALID');
    error.code = 'RECEIPT_LINK_BASE_URL_INVALID';
    throw error;
  }
  const localhost = ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(localhost && url.protocol === 'http:')) ||
      url.username || url.password) {
    const error = new Error('RECEIPT_LINK_BASE_URL_INVALID');
    error.code = 'RECEIPT_LINK_BASE_URL_INVALID';
    throw error;
  }
  return url.toString().replace(/\/+$/, '');
}

async function enviarEnlaceComprobanteCliente({ correo, pedidoId, numero, token }) {
  const enlace = `${obtenerBaseUrlComprobante()}/api/comprobantes/${encodeURIComponent(pedidoId)}?token=${encodeURIComponent(token)}`;
  const enlaceHtml = enlace.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  await enviarMensaje({
    to: correo,
    subject: `Comprobante de compra ${numero}`,
    text: `Tu comprobante está disponible en este enlace seguro, válido por 24 horas:\n${enlace}\n\nEste documento es un comprobante de compra y no una factura electrónica DIAN.`,
    html: `<p>Tu comprobante está disponible en este <a href="${enlaceHtml}">enlace seguro</a>, válido por 24 horas.</p><p>Este documento es un comprobante de compra y no una factura electrónica DIAN.</p>`
  });
}

async function enviarAvisoComprobanteAdmin({ pedidoId, numero, totalCentavos, moneda, fecha }) {
  const destinatario = process.env.ADMIN_NOTIFICATION_EMAIL;
  if (!destinatario) {
    const error = new Error('ADMIN_NOTIFICATION_EMAIL_NOT_CONFIGURED');
    error.code = 'ADMIN_NOTIFICATION_EMAIL_NOT_CONFIGURED';
    throw error;
  }
  const monto = BigInt(totalCentavos);
  const total = `${(monto / 100n).toString()}.${String(monto % 100n).padStart(2, '0')}`;
  await enviarMensaje({
    to: destinatario,
    subject: `Pago aprobado · Pedido #${pedidoId}`,
    text: [
      `Pedido: #${pedidoId}`,
      `Comprobante: ${numero}`,
      `Estado: aprobado`,
      `Total: ${total} ${moneda}`,
      `Fecha: ${fecha}`
    ].join('\n'),
    html: `<p>Pago aprobado</p><ul><li>Pedido: #${Number(pedidoId)}</li><li>Comprobante: ${numero}</li><li>Total: ${total} ${moneda}</li><li>Fecha: ${fecha}</li></ul>`
  });
}

module.exports = {
  enviarEnlaceComprobanteCliente,
  enviarAvisoComprobanteAdmin
};

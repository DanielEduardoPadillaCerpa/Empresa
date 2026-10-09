const crypto = require('crypto');

const WEBHOOK_TOLERANCE_SECONDS = 5 * 60;
const MOCK_WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET
  || crypto.randomBytes(32).toString('hex');

function firmaWebhook(rawBody, timestamp, secret = MOCK_WEBHOOK_SECRET) {
  return crypto.createHmac('sha256', secret)
    .update(`${timestamp}.`)
    .update(rawBody)
    .digest('hex');
}

function compararFirmas(firmaRecibida, firmaEsperada) {
  if (typeof firmaRecibida !== 'string' || !/^[a-f0-9]{64}$/i.test(firmaRecibida)) return false;
  const recibida = Buffer.from(firmaRecibida, 'hex');
  const esperada = Buffer.from(firmaEsperada, 'hex');
  return recibida.length === esperada.length && crypto.timingSafeEqual(recibida, esperada);
}

function resultadoDeterminista(montoCentavos) {
  const centavos = BigInt(montoCentavos);
  const terminacion = centavos % 100n;
  if (terminacion === 1n) return 'rechazado';
  if (terminacion === 2n) return 'pendiente';
  if (terminacion === 3n) return 'timeout';
  return 'aprobado';
}

class MockProvider {
  async crearIntento({ montoCentavos }) {
    if (resultadoDeterminista(montoCentavos) === 'timeout') {
      const error = new Error('El proveedor mock agotó el tiempo de espera.');
      error.code = 'PAYMENT_PROVIDER_TIMEOUT';
      throw error;
    }
    return {
      referenciaExterna: `mock_${crypto.randomUUID()}`,
      widgetToken: crypto.randomBytes(24).toString('hex'),
      widgetUrl: '/api/pagos/dev/simular-webhook',
      estado: 'creado',
      resultadoSimulado: resultadoDeterminista(montoCentavos)
    };
  }

  verificarWebhook(rawBody, headers) {
    if (!Buffer.isBuffer(rawBody)) {
      throw new Error('El webhook de pago requiere el cuerpo HTTP raw.');
    }
    const timestamp = String(headers['x-payment-timestamp'] || '');
    const firma = headers['x-payment-signature'];
    if (!/^\d{10}$/.test(timestamp)) {
      throw new Error('Falta una marca de tiempo válida en el webhook.');
    }
    const tiempo = Number(timestamp);
    if (Math.abs(Math.floor(Date.now() / 1000) - tiempo) > WEBHOOK_TOLERANCE_SECONDS) {
      throw new Error('La marca de tiempo del webhook está vencida.');
    }
    if (!compararFirmas(firma, firmaWebhook(rawBody, timestamp))) {
      throw new Error('La firma del webhook no es válida.');
    }

    let evento;
    try {
      evento = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new Error('El cuerpo del webhook no es JSON válido.');
    }
    if (
      !evento || typeof evento !== 'object' ||
      typeof evento.event_id !== 'string' || evento.event_id.length < 1 || evento.event_id.length > 191 ||
      typeof evento.referencia_externa !== 'string' || evento.referencia_externa.length > 191 ||
      !['pendiente', 'aprobado', 'rechazado', 'expirado'].includes(evento.estado) ||
      !/^\d+$/.test(String(evento.monto_centavos)) ||
      evento.moneda !== 'COP'
    ) {
      throw new Error('El evento de pago no tiene un formato válido.');
    }
    return evento;
  }

  async consultar({ montoCentavos }) {
    const estado = resultadoDeterminista(montoCentavos);
    if (estado === 'timeout') {
      const error = new Error('El proveedor mock agotó el tiempo de espera.');
      error.code = 'PAYMENT_PROVIDER_TIMEOUT';
      throw error;
    }
    return { estado };
  }

  async reembolsar() {
    throw new Error('Los reembolsos no están disponibles en el proveedor mock.');
  }

  crearEventoSimulado({ referenciaExterna, montoCentavos, moneda = 'COP' }) {
    const estado = resultadoDeterminista(montoCentavos);
    if (estado === 'timeout') {
      const error = new Error('El proveedor mock agotó el tiempo de espera.');
      error.code = 'PAYMENT_PROVIDER_TIMEOUT';
      throw error;
    }
    const evento = {
      event_id: crypto.randomUUID(),
      referencia_externa: referenciaExterna,
      estado,
      monto_centavos: String(montoCentavos),
      moneda
    };
    const rawBody = Buffer.from(JSON.stringify(evento));
    const timestamp = String(Math.floor(Date.now() / 1000));
    return {
      rawBody,
      headers: {
        'x-payment-timestamp': timestamp,
        'x-payment-signature': firmaWebhook(rawBody, timestamp)
      }
    };
  }
}

function crearPaymentProvider() {
  const mode = String(process.env.PAYMENT_MODE || 'mock').toLowerCase();
  if (!['mock', 'sandbox', 'prod'].includes(mode)) {
    throw new Error('PAYMENT_MODE debe ser mock, sandbox o prod.');
  }
  if (mode === 'mock' && process.env.NODE_ENV === 'production') {
    throw new Error('El proveedor mock está prohibido cuando NODE_ENV=production.');
  }
  if (mode !== 'mock') {
    throw new Error(`El proveedor ${mode} aún no está habilitado. El backend se niega a aceptar pagos sin un adaptador validado.`);
  }
  return new MockProvider();
}

module.exports = {
  crearPaymentProvider,
  resultadoDeterminista,
  firmaWebhook
};

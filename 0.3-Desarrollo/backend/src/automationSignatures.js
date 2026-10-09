const crypto = require('crypto');

const MAX_CLOCK_SKEW_SECONDS = 5 * 60;

function validarSecreto(secreto, codigo) {
  if (typeof secreto !== 'string' || secreto.length < 32 || secreto.startsWith('replace_')) {
    const error = new Error(codigo);
    error.code = codigo;
    throw error;
  }
  return secreto;
}

function firmarPayload(payload, secreto, ahora = Date.now()) {
  const clave = validarSecreto(secreto, 'AUTOMATION_SECRET_NOT_CONFIGURED');
  const timestamp = String(Math.floor(ahora / 1000));
  const cuerpo = JSON.stringify(payload);
  const firma = crypto.createHmac('sha256', clave)
    .update(`${timestamp}.${cuerpo}`)
    .digest('hex');
  return {
    timestamp,
    firma,
    cuerpo
  };
}

function compararFirmas(recibida, esperada) {
  if (typeof recibida !== 'string' || !/^[a-f0-9]{64}$/i.test(recibida)) return false;
  const firmaRecibida = Buffer.from(recibida, 'hex');
  const firmaEsperada = Buffer.from(esperada, 'hex');
  return firmaRecibida.length === firmaEsperada.length &&
    crypto.timingSafeEqual(firmaRecibida, firmaEsperada);
}

function verificarPayload(payload, headers, secreto, ahora = Date.now()) {
  const timestamp = String(headers['x-automation-timestamp'] || '');
  if (!/^\d{10}$/.test(timestamp)) return false;
  if (Math.abs(Math.floor(ahora / 1000) - Number(timestamp)) > MAX_CLOCK_SKEW_SECONDS) return false;

  let firmaEsperada;
  try {
    firmaEsperada = firmarPayload(payload, secreto, Number(timestamp) * 1000).firma;
  } catch (error) {
    if (error.code === 'AUTOMATION_SECRET_NOT_CONFIGURED') return false;
    throw error;
  }
  return compararFirmas(headers['x-automation-signature'], firmaEsperada);
}

module.exports = { firmarPayload, verificarPayload };

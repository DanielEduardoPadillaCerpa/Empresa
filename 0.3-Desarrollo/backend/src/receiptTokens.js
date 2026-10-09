const crypto = require('crypto');

const TOKEN_VIGENCIA_HORAS = 24;

function obtenerSecreto() {
  const secreto = process.env.RECEIPT_LINK_SECRET || '';
  if (secreto.length < 32 || secreto.startsWith('replace_')) {
    const error = new Error('RECEIPT_LINK_SECRET_NOT_CONFIGURED');
    error.code = 'RECEIPT_LINK_SECRET_NOT_CONFIGURED';
    throw error;
  }
  return secreto;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function crearTokenComprobante(pedidoId, ahora = Date.now()) {
  const expiraEpoch = Math.floor(ahora / 1000) + TOKEN_VIGENCIA_HORAS * 60 * 60;
  const nonce = crypto.randomBytes(24).toString('base64url');
  const contenido = `${pedidoId}.${expiraEpoch}.${nonce}`;
  const firma = crypto.createHmac('sha256', obtenerSecreto()).update(contenido).digest('hex');
  const token = `${expiraEpoch}.${nonce}.${firma}`;
  return {
    token,
    hash: hashToken(token),
    expiraEn: new Date(expiraEpoch * 1000)
  };
}

function compararHash(hashA, hashB) {
  if (!/^[a-f0-9]{64}$/i.test(String(hashA)) || !/^[a-f0-9]{64}$/i.test(String(hashB))) return false;
  const a = Buffer.from(hashA, 'hex');
  const b = Buffer.from(hashB, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function validarTokenComprobante(pedidoId, token, hashGuardado, expiraEn, ahora = Date.now()) {
  if (typeof token !== 'string' || token.length > 160) return false;
  const coincidencia = /^(\d{10})\.([A-Za-z0-9_-]{32})\.([a-f0-9]{64})$/.exec(token);
  if (!coincidencia || !hashGuardado || !expiraEn) return false;

  const expiraEpoch = Number(coincidencia[1]);
  const expiraGuardado = new Date(expiraEn).getTime();
  if (!Number.isSafeInteger(expiraEpoch) || expiraEpoch * 1000 <= ahora ||
      !Number.isFinite(expiraGuardado) || Math.abs(expiraGuardado - expiraEpoch * 1000) > 1000) {
    return false;
  }

  let firmaEsperada;
  try {
    firmaEsperada = crypto.createHmac('sha256', obtenerSecreto())
      .update(`${pedidoId}.${expiraEpoch}.${coincidencia[2]}`)
      .digest('hex');
  } catch (error) {
    if (error.code === 'RECEIPT_LINK_SECRET_NOT_CONFIGURED') return false;
    throw error;
  }

  return compararHash(coincidencia[3], firmaEsperada) && compararHash(hashToken(token), hashGuardado);
}

module.exports = { crearTokenComprobante, validarTokenComprobante };

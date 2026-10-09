const crypto = require('crypto');

function hashCodigoMfa(retoId, usuarioId, codigo) {
  const pepper = process.env.MFA_TOKEN_PEPPER || '';
  if (pepper.length < 32 || pepper.startsWith('replace_')) {
    throw new Error('MFA_TOKEN_PEPPER debe configurarse con al menos 32 caracteres');
  }
  return crypto.createHmac('sha256', pepper)
    .update(`${retoId}:${usuarioId}:${codigo}`)
    .digest('hex');
}

function compararHashesMfa(hashA, hashB) {
  if (!/^[a-f0-9]{64}$/i.test(String(hashA)) || !/^[a-f0-9]{64}$/i.test(String(hashB))) return false;
  const bufferA = Buffer.from(hashA, 'hex');
  const bufferB = Buffer.from(hashB, 'hex');
  return bufferA.length === bufferB.length && crypto.timingSafeEqual(bufferA, bufferB);
}

function generarCodigoMfa() {
  return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
}

module.exports = { hashCodigoMfa, compararHashesMfa, generarCodigoMfa };

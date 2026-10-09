const crypto = require('crypto');

function comparaToken(recibido, esperado) {
  if (typeof recibido !== 'string' || typeof esperado !== 'string' ||
      recibido.length < 32 || esperado.length < 32 ||
      esperado.startsWith('replace_')) return false;
  const hashRecibido = crypto.createHash('sha256').update(recibido).digest();
  const hashEsperado = crypto.createHash('sha256').update(esperado).digest();
  return crypto.timingSafeEqual(hashRecibido, hashEsperado);
}

function requiereTokenAutomatizacion(variable) {
  return (req, res, next) => {
    const esperado = process.env[variable];
    if (!esperado || esperado.length < 32 || esperado.startsWith('replace_')) {
      return res.status(503).json({ error: 'La automatización no está configurada.' });
    }
    if (!comparaToken(req.get('x-automation-token'), esperado)) {
      return res.status(401).json({ error: 'No autorizado.' });
    }
    next();
  };
}

module.exports = { requiereTokenAutomatizacion };

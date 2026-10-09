const TIMEOUT_MS = 8000;

function errorConfiguracion(codigo) {
  const error = new Error(codigo);
  error.code = codigo;
  return error;
}

function esLocalhost(hostname) {
  return ['localhost', '127.0.0.1', '::1'].includes(hostname);
}

function obtenerConfiguracionMfa({ produccion = process.env.NODE_ENV === 'production' } = {}) {
  const urlConfigurada = process.env.N8N_MFA_WEBHOOK_URL;
  const secreto = process.env.N8N_MFA_WEBHOOK_SECRET;
  if (!urlConfigurada || !secreto) {
    if (produccion) {
      throw errorConfiguracion('N8N_MFA_CONFIGURATION_REQUIRED');
    }
    return null;
  }
  if (secreto.length < 32 || secreto.startsWith('replace_')) {
    throw errorConfiguracion('N8N_MFA_WEBHOOK_SECRET_INVALID');
  }

  let url;
  try {
    url = new URL(urlConfigurada);
  } catch {
    throw errorConfiguracion('N8N_MFA_WEBHOOK_URL_INVALID');
  }
  if (url.username || url.password || url.search || url.hash ||
      (url.protocol !== 'https:' && !(esLocalhost(url.hostname) && url.protocol === 'http:'))) {
    throw errorConfiguracion('N8N_MFA_WEBHOOK_HTTPS_REQUIRED');
  }
  if (produccion && url.pathname.includes('/webhook-test/')) {
    throw errorConfiguracion('N8N_MFA_PRODUCTION_WEBHOOK_TEST_URL');
  }
  return { url: url.toString(), secreto };
}

function sanitizarRespuestaWebhook(texto, correo, codigo, secreto) {
  return String(texto || '')
    .replaceAll(correo, '[email]')
    .replaceAll(codigo, '[code]')
    .replaceAll(secreto, '[secret]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .replace(/\b\d{6}\b/g, '[code]')
    .slice(0, 200);
}

async function enviarCodigoMfaN8n({ correo, codigo, vigenciaMinutos }) {
  const configuracion = obtenerConfiguracionMfa();
  if (!configuracion) {
    throw errorConfiguracion('N8N_MFA_CONFIGURATION_REQUIRED');
  }
  const expiresInSeconds = vigenciaMinutos * 60;
  const payload = {
    event: 'mfa.login.code',
    email: correo,
    token_mfa: codigo,
    timestamp: new Date().toISOString(),
    expires_in_seconds: expiresInSeconds
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(configuracion.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${configuracion.secreto}`
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });
    if (!response.ok) {
      const cuerpo = await response.text();
      const extractoSeguro = sanitizarRespuestaWebhook(cuerpo, correo, codigo, configuracion.secreto);
      console.error('[auth] Webhook MFA rechazó el envío:', {
        status: response.status,
        cuerpo: extractoSeguro
      });
      const error = new Error('N8N_MFA_DELIVERY_REJECTED');
      error.code = `N8N_MFA_HTTP_${response.status}`;
      throw error;
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      throw errorConfiguracion('N8N_MFA_DELIVERY_TIMEOUT');
    }
    if (err.code) throw err;
    throw errorConfiguracion('N8N_MFA_DELIVERY_FAILED');
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  enviarCodigoMfaN8n,
  obtenerConfiguracionMfa,
  sanitizarRespuestaWebhook
};

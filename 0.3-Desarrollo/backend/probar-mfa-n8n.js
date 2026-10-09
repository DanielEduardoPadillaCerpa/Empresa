const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { enviarCodigoMfaN8n, obtenerConfiguracionMfa } = require('./src/mfaCourier');

const correo = process.argv[2];
if (!correo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
  console.error('Uso: node probar-mfa-n8n.js correo_destino@example.com');
  console.error('Esta prueba envía un código de prueba 123456 al correo indicado.');
  process.exit(1);
}

try {
  const configuracion = obtenerConfiguracionMfa({ produccion: false });
  if (!configuracion) {
    console.error('Faltan N8N_MFA_WEBHOOK_URL o N8N_MFA_WEBHOOK_SECRET en backend/.env.');
    process.exit(1);
  }
  const destino = new URL(configuracion.url);
  console.log(`Probando webhook MFA en ${destino.origin}${destino.pathname}`);
  if (destino.pathname.includes('/webhook-test/')) {
    console.log('Aviso: URL de prueba de n8n; requiere "Listen for test event".');
  }
} catch (error) {
  console.error('Configuración inválida:', error.message);
  process.exit(1);
}

(async () => {
  try {
    await enviarCodigoMfaN8n({ correo, codigo: '123456', vigenciaMinutos: 5 });
    console.log('n8n aceptó el mensaje. Comprueba el correo y spam; el código enviado es ficticio.');
  } catch (error) {
    const codigo = error.code || 'N8N_MFA_DELIVERY_FAILED';
    if (codigo === 'N8N_MFA_HTTP_404') {
      console.error('HTTP 404: workflow inactivo o path/URL no coincide.');
    } else if (codigo === 'N8N_MFA_HTTP_401' || codigo === 'N8N_MFA_HTTP_403') {
      console.error('HTTP 401/403: configura Header Auth como Authorization: Bearer <secreto>.');
    } else if (codigo.startsWith('N8N_MFA_HTTP_5')) {
      console.error(`${codigo}: revisa el nodo SMTP y las ejecuciones fallidas de n8n.`);
    } else if (codigo === 'N8N_MFA_DELIVERY_TIMEOUT') {
      console.error('Timeout: revisa conectividad y que el workflow responda tras el nodo SMTP.');
    } else if (codigo === 'N8N_MFA_DELIVERY_FAILED') {
      console.error('Fallo de red: confirma que n8n esté disponible y que la URL sea correcta.');
    } else {
      console.error('No se pudo completar la prueba:', codigo);
    }
    process.exitCode = 1;
  }
})();

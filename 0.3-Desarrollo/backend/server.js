// CAMBIO 1: path primero y ruta explícita del .env
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const { migrar } = require('./src/db');
const { getPaymentProvider } = require('./src/paymentProviderInstance');
const { iniciarWorkerEmail } = require('./src/emailOutbox');
const { iniciarWorkerAutomatizaciones } = require('./src/automationOutbox');
const { iniciarJobExpiracionPedidos } = require('./src/paymentJobs');
const { obtenerConfiguracionMfa } = require('./src/mfaCourier');
const { iniciarRefrescoIndice } = require('./src/assistant/indiceCatalogo');

const app = express();
const saltosProxy = Number(process.env.TRUST_PROXY_HOPS || 0);
if (!Number.isSafeInteger(saltosProxy) || saltosProxy < 0) {
  throw new Error('TRUST_PROXY_HOPS debe ser un entero no negativo.');
}
app.set('trust proxy', saltosProxy);
const origenesPermitidos = new Set(
  (process.env.CORS_ORIGINS ||
    'http://localhost:5500,http://127.0.0.1:5500,http://localhost:8765,http://127.0.0.1:8765,http://localhost:8081,http://127.0.0.1:8081')
    .split(',')
    .map(origen => origen.trim())
    .filter(Boolean)
);
if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGINS) {
  throw new Error('CORS_ORIGINS debe configurarse con los dominios del frontend en producción.');
}
app.use(cors({
  origin: (origen, callback) => callback(null, !origen || origenesPermitidos.has(origen)),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  maxAge: 600
}));
app.use('/api/pagos/webhook', express.raw({ type: 'application/json', limit: '64kb' }));
app.use(express.json());
app.use('/img', express.static(path.join(__dirname, 'img')));

app.get('/', (req, res) => {
  res.json({ status: 'ok', servicio: 'Suministros Institucionales - Backend' });
});

// Rutas
app.use('/api/clientes', require('./src/routes/clientes'));
app.use('/api/atencion', require('./src/routes/atencion'));
app.use('/api/asistente', require('./src/routes/asistente').router);
app.use('/api/checkout', require('./src/routes/checkout'));
app.use('/api/pagos', require('./src/routes/pagos').router);
app.use('/api/comprobantes', require('./src/routes/comprobantes'));
app.use('/api/automatizaciones', require('./src/routes/automatizaciones'));
app.use('/api/mi-cuenta', require('./src/routes/miCuenta'));
app.use('/api/reportes', require('./src/routes/reportes'));
app.use('/api/auth', require('./src/routes/auth').router);
app.use('/api/pedidos', require('./src/routes/pedidos'));
app.use('/api/productos', require('./src/routes/productos'));
app.use('/api/categorias', require('./src/routes/categorias'));
app.use('/api/mis-reportes', require('./src/routes/misreportes'));
app.use('/api/auditoria', require('./src/routes/auditoria'));

const PORT = process.env.PORT || 8080;

async function iniciar() {
  try {
    const modoAsistente = process.env.ASSISTANT_MODE || 'rules';
    if (!['rules', 'llm'].includes(modoAsistente)) {
      throw new Error('ASSISTANT_MODE debe ser rules o llm');
    }
    getPaymentProvider();
    if (process.env.NODE_ENV === 'production') {
      obtenerConfiguracionMfa({ produccion: true });
    }
    await migrar(); // crea tablas si no existen
    iniciarRefrescoIndice();
    iniciarWorkerEmail();
    iniciarWorkerAutomatizaciones();
    iniciarJobExpiracionPedidos();

    // No registrar valores de configuración ni información sensible.
    console.log('[env] Archivo .env:', path.join(__dirname, '.env'));

    // CAMBIO 3: avisa si el puerto ya está ocupado por otro backend
    const servidor = app.listen(PORT, () => {
      console.log(`[server] Backend corriendo en http://localhost:${PORT}`);
    });
    servidor.on('error', err => {
      if (err.code === 'EADDRINUSE') {
        console.error(`[server] El puerto ${PORT} ya está en uso: hay OTRO backend corriendo. Ciérralo y vuelve a iniciar.`);
      } else {
        console.error('[server] Error del servidor:', err.message);
      }
      process.exit(1);
    });
  } catch (err) {
    console.error('[server] No se pudo iniciar (revisa tu .env y la conexión a la base de datos):', err.message);
    process.exit(1);
  }
}

iniciar();
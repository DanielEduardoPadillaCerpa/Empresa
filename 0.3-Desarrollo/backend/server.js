// CAMBIO 1: path primero y ruta explícita del .env
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const { migrar } = require('./src/db');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/img', express.static(path.join(__dirname, 'img')));

app.get('/', (req, res) => {
  res.json({ status: 'ok', servicio: 'Suministros Institucionales - Backend' });
});

// Rutas
app.use('/api/clientes', require('./src/routes/clientes'));
app.use('/api/atencion', require('./src/routes/atencion'));
app.use('/api/pagos', require('./src/routes/pagos'));
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
    await migrar(); // crea tablas si no existen

    // CAMBIO 2: muestra qué .env se leyó y si encontró la variable de n8n
    console.log('[env] Archivo .env:', path.join(__dirname, '.env'));
    console.log('[env] N8N_PAYMENT_WEBHOOK_URL:', process.env.N8N_PAYMENT_WEBHOOK_URL ? 'configurada' : 'NO ENCONTRADA');
    console.log('[env] N8N_PAYMENT_ENVIRONMENT:', process.env.N8N_PAYMENT_ENVIRONMENT || '(vacío, se usa "sandbox")');

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
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
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
    app.listen(PORT, () => {
      console.log(`[server] Backend corriendo en http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('[server] No se pudo iniciar (revisa tu .env y la conexión a la base de datos):', err.message);
    process.exit(1);
  }
}

iniciar();

const express = require('express');
const { pool } = require('../db');
const { requiereTokenAutomatizacion } = require('../automationAuth');
const { expirarPedidosPendientes } = require('../paymentJobs');

const router = express.Router();

router.get(
  '/resumen-diario',
  requiereTokenAutomatizacion('N8N_W2_DAILY_SUMMARY_TOKEN'),
  async (req, res) => {
    try {
      const [filas] = await pool.query(
        `SELECT COALESCE(SUM(monto_centavos), 0) AS total
         FROM pagos
         WHERE estado = 'aprobado' AND actualizado_en >= DATE_SUB(NOW(), INTERVAL 1 DAY)`
      );
      res.set('Cache-Control', 'no-store');
      res.json({
        evento: 'resumen_diario',
        total: String(filas[0].total),
        moneda: 'COP',
        fecha: new Date().toISOString()
      });
    } catch (err) {
      console.error('[automatizaciones] No se pudo generar el resumen diario:', err.code || 'DAILY_SUMMARY_ERROR');
      res.status(500).json({ error: 'No fue posible generar el resumen diario.' });
    }
  }
);

router.post(
  '/pedidos/expirar',
  requiereTokenAutomatizacion('N8N_W4_EXPIRY_TOKEN'),
  async (req, res) => {
    try {
      await expirarPedidosPendientes();
      res.json({ ok: true });
    } catch (err) {
      console.error('[automatizaciones] No se pudieron expirar pedidos:', err.code || 'ORDER_EXPIRATION_ERROR');
      res.status(500).json({ error: 'No fue posible procesar la expiración de pedidos.' });
    }
  }
);

module.exports = router;

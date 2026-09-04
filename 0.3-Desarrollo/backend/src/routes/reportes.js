const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET /api/reportes/mensual
router.get('/mensual', async (req, res) => {
  try {
    // Métricas de atenciones (chatbot)
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM atenciones');
    const [[{ escalados }]] = await pool.query('SELECT COUNT(*) AS escalados FROM atenciones WHERE escalado_a_humano = TRUE');
    const [[{ promedio }]] = await pool.query('SELECT AVG(calificacion) AS promedio FROM atenciones');
    const [sugerencias] = await pool.query(
      'SELECT id, calificacion, comentario, fecha FROM atenciones WHERE calificacion <= 3 ORDER BY fecha DESC LIMIT 20'
    );

    // Métricas de pedidos
    const [pedidosPorEstado] = await pool.query(
      'SELECT estado, COUNT(*) AS cantidad FROM pedidos GROUP BY estado'
    );

    // Productos más vendidos (top 5)
    const [productosMasVendidos] = await pool.query(`
      SELECT p.id, p.nombre, SUM(dp.cantidad) AS total_vendidos
      FROM detalle_pedido dp
      JOIN productos p ON dp.producto_id = p.id
      GROUP BY p.id, p.nombre
      ORDER BY total_vendidos DESC
      LIMIT 5
    `);

    res.json({
      clientesAtendidos: total,
      escaladosAHumano: escalados,
      calificacionPromedio: promedio ? Math.round(promedio * 10) / 10 : 0,
      sugerencias,
      pedidosPorEstado,
      productosMasVendidos
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error generando el reporte' });
  }
});

module.exports = router;

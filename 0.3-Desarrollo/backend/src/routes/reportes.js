const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET /api/reportes/mensual
router.get('/mensual', async (req, res) => {
  try {
    const [
      [[{ total }]],
      [[{ escalados }]],
      [[{ promedio }]],
      [sugerencias],
      [pedidosPorEstado],
      [productosMasVendidos]
    ] = await Promise.all([
      pool.query('SELECT COUNT(*) AS total FROM atenciones'),
      pool.query('SELECT COUNT(*) AS escalados FROM atenciones WHERE escalado_a_humano = TRUE'),
      pool.query('SELECT AVG(calificacion) AS promedio FROM atenciones'),
      pool.query('SELECT id, calificacion, comentario, fecha FROM atenciones WHERE calificacion <= 3 ORDER BY fecha DESC LIMIT 20'),
      pool.query('SELECT estado, COUNT(*) AS cantidad FROM pedidos GROUP BY estado'),
      pool.query(`
        SELECT p.id, p.nombre, SUM(dp.cantidad) AS total_vendidos
        FROM detalle_pedido dp
        JOIN productos p ON dp.producto_id = p.id
        GROUP BY p.id, p.nombre
        ORDER BY total_vendidos DESC
        LIMIT 5
      `)
    ]);

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

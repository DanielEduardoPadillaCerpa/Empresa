const { pool } = require('./db');

// Registra una acción administrativa (crear/editar/eliminar) en la tabla
// `auditoria`. Se usa desde las rutas de admin (clientes, productos,
// categorías, pedidos) para dejar trazabilidad de quién hizo qué y cuándo.
// Es "best effort": si falla el insert, solo se registra en consola —
// nunca debe tumbar la petición original del usuario.
async function registrarAuditoria({ usuario, accion, entidad, entidadId, detalle }) {
  try {
    await pool.query(
      `INSERT INTO auditoria (usuario_id, correo, accion, entidad, entidad_id, detalle)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        usuario?.uid || null,
        usuario?.correo || null,
        accion,
        entidad,
        entidadId !== undefined && entidadId !== null ? String(entidadId) : null,
        detalle ? JSON.stringify(detalle) : null,
      ]
    );
  } catch (err) {
    console.error('[auditoria] No se pudo registrar la acción:', err.message);
  }
}

module.exports = { registrarAuditoria };

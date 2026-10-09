async function crearComprobanteAprobado(connection, { pedidoId, enviarCorreo }) {
  const numero = `CP-${String(pedidoId).padStart(10, '0')}`;
  const [resultado] = await connection.query(
    `INSERT INTO comprobantes (pedido_id, numero, enviar_correo)
     VALUES (?, ?, ?)`,
    [pedidoId, numero, enviarCorreo]
  );

  await connection.query(
    `INSERT INTO correo_outbox (comprobante_id, tipo)
     VALUES (?, 'admin')`,
    [resultado.insertId]
  );
  if (enviarCorreo) {
    await connection.query(
      `INSERT INTO correo_outbox (comprobante_id, tipo)
       VALUES (?, 'cliente')`,
      [resultado.insertId]
    );
  }

  return resultado.insertId;
}

module.exports = { crearComprobanteAprobado };

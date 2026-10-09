function parsearItems(items) {
  return typeof items === 'string' ? JSON.parse(items) : items;
}

async function liberarReserva(connection, pedido) {
  const items = parsearItems(pedido.items);
  if (!Array.isArray(items)) throw new Error('ORDER_ITEMS_INVALID');
  for (const item of items) {
    const cantidad = Number(item.cantidad);
    const productoId = Number(item.id);
    if (!Number.isSafeInteger(cantidad) || cantidad < 1 ||
        !Number.isSafeInteger(productoId) || productoId < 1) {
      throw new Error('ORDER_ITEM_INVALID');
    }
    const [resultado] = await connection.query(
      'UPDATE productos SET cantidad_disponible = cantidad_disponible + ? WHERE id = ?',
      [cantidad, productoId]
    );
    if (resultado.affectedRows !== 1) throw new Error('RESERVED_PRODUCT_NOT_FOUND');
  }
}

module.exports = { liberarReserva };

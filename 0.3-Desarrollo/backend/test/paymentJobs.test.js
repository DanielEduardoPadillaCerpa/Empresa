const test = require('node:test');
const assert = require('node:assert/strict');
const { pool } = require('../src/db');
const { expirarPedidosPendientes } = require('../src/paymentJobs');

function crearConexionMock({ pedido, productoEncontrado = true }) {
  const llamadas = [];
  let candidatoDisponible = true;
  const connection = {
    async beginTransaction() { llamadas.push('begin'); },
    async commit() { llamadas.push('commit'); },
    async rollback() { llamadas.push('rollback'); },
    release() { llamadas.push('release'); },
    async query(sql, values) {
      llamadas.push({ sql, values });
      if (sql.includes('SELECT pa.id AS pago_id')) {
        if (!candidatoDisponible) return [[]];
        candidatoDisponible = false;
        return [[{ pago_id: 11, pedido_id: 22 }]];
      }
      if (sql.includes('SELECT id, estado, items FROM pedidos')) return [[pedido]];
      if (sql.includes('UPDATE pedidos SET estado')) return [{ affectedRows: 1 }];
      if (sql.includes('UPDATE pagos SET estado')) return [{ affectedRows: 1 }];
      if (sql.includes('UPDATE productos SET cantidad_disponible')) {
        return [{ affectedRows: productoEncontrado ? 1 : 0 }];
      }
      return [{ affectedRows: 0 }];
    }
  };
  return { connection, llamadas };
}

test('expired payment changes status and releases the reserved quantities in one transaction', async t => {
  const originalGetConnection = pool.getConnection;
  const { connection, llamadas } = crearConexionMock({
    pedido: {
      id: 22,
      estado: 'pendiente_pago',
      items: JSON.stringify([{ id: 4, cantidad: 2 }, { id: 7, cantidad: 1 }])
    }
  });
  pool.getConnection = async () => connection;
  t.after(() => { pool.getConnection = originalGetConnection; });

  assert.equal(await expirarPedidosPendientes(), 1);
  assert.equal(llamadas.filter(llamada =>
    typeof llamada === 'object' && llamada.sql.includes('UPDATE productos SET cantidad_disponible')
  ).length, 2);
  assert.equal(llamadas[0], 'begin');
  assert.equal(llamadas[llamadas.length - 2], 'commit');
  assert.equal(llamadas[llamadas.length - 1], 'release');
});

test('expiration rolls back instead of silently losing a reserved product', async t => {
  const originalGetConnection = pool.getConnection;
  const { connection, llamadas } = crearConexionMock({
    pedido: {
      id: 22,
      estado: 'pendiente_pago',
      items: JSON.stringify([{ id: 4, cantidad: 2 }])
    },
    productoEncontrado: false
  });
  pool.getConnection = async () => connection;
  t.after(() => { pool.getConnection = originalGetConnection; });

  await assert.rejects(expirarPedidosPendientes(), /RESERVED_PRODUCT_NOT_FOUND/);
  assert.ok(llamadas.includes('rollback'));
  assert.ok(!llamadas.includes('commit'));
});

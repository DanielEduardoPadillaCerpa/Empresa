const test = require('node:test');
const assert = require('node:assert/strict');
const { crearComprobanteAprobado } = require('../src/receiptService');

test('approved payment queues admin email and only queues customer email with consent', async () => {
  const queries = [];
  const connection = {
    async query(sql, values) {
      queries.push({ sql, values });
      if (sql.includes('INSERT INTO comprobantes')) return [{ insertId: 7 }];
      return [{ insertId: queries.length }];
    }
  };

  const comprobanteId = await crearComprobanteAprobado(connection, {
    pedidoId: 42,
    enviarCorreo: true
  });

  assert.equal(comprobanteId, 7);
  assert.equal(queries.length, 3);
  assert.match(queries[1].sql, /'admin'/);
  assert.match(queries[2].sql, /'cliente'/);
});

test('approved payment does not queue customer email without consent', async () => {
  const queries = [];
  const connection = {
    async query(sql, values) {
      queries.push({ sql, values });
      if (sql.includes('INSERT INTO comprobantes')) return [{ insertId: 8 }];
      return [{ insertId: queries.length }];
    }
  };

  await crearComprobanteAprobado(connection, {
    pedidoId: 43,
    enviarCorreo: false
  });

  assert.equal(queries.length, 2);
  assert.match(queries[1].sql, /'admin'/);
  assert.doesNotMatch(queries[1].sql, /'cliente'/);
});

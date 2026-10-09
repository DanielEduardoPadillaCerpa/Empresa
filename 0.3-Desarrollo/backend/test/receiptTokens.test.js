const test = require('node:test');
const assert = require('node:assert/strict');

process.env.RECEIPT_LINK_SECRET = 'test-only-receipt-link-secret-32-chars';
const { crearTokenComprobante, validarTokenComprobante } = require('../src/receiptTokens');

test('receipt link validates only for its order and stored token hash', () => {
  const pedidoId = 123;
  const token = crearTokenComprobante(pedidoId);

  assert.equal(
    validarTokenComprobante(pedidoId, token.token, token.hash, token.expiraEn),
    true
  );
  assert.equal(
    validarTokenComprobante(pedidoId + 1, token.token, token.hash, token.expiraEn),
    false
  );
  assert.equal(
    validarTokenComprobante(pedidoId, `${token.token.slice(0, -1)}0`, token.hash, token.expiraEn),
    false
  );
});

test('receipt link rejects expired tokens', () => {
  const now = Date.now();
  const token = crearTokenComprobante(123, now - 25 * 60 * 60 * 1000);

  assert.equal(
    validarTokenComprobante(123, token.token, token.hash, token.expiraEn, now),
    false
  );
});

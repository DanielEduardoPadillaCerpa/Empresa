'use strict';

const { pool, migrarCuentaSegura } = require('../src/db');

describe('migración idempotente de cuenta segura', () => {
  afterEach(() => jest.restoreAllMocks());

  test('tolera columnas ya instaladas y vuelve a asegurar tabla y enum', async () => {
    const query = jest.spyOn(pool, 'query').mockImplementation(async sql => {
      if (/ADD COLUMN/i.test(String(sql))) {
        const error = new Error('Duplicate column name');
        error.code = 'ER_DUP_FIELDNAME';
        throw error;
      }
      return [{ affectedRows: 0 }, []];
    });

    await migrarCuentaSegura();
    await migrarCuentaSegura();

    expect(query.mock.calls.filter(([sql]) => /ADD COLUMN/i.test(String(sql)))).toHaveLength(8);
    expect(query.mock.calls.filter(([sql]) => /MODIFY workflow/i.test(String(sql)))).toHaveLength(2);
    expect(query.mock.calls.filter(([sql]) => /CREATE TABLE IF NOT EXISTS solicitudes_cuenta/i.test(String(sql)))).toHaveLength(2);
  });
});

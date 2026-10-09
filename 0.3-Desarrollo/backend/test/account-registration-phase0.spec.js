'use strict';

const express = require('express');
const jwt = require('jsonwebtoken');
const request = require('supertest');

process.env.JWT_SECRET = 'phase-zero-test-secret-with-enough-length';
process.env.NODE_ENV = 'test';

jest.mock('../src/db', () => ({
  pool: {
    query: jest.fn(),
    getConnection: jest.fn()
  }
}));
jest.mock('../src/crypto', () => ({
  cifrar: value => value,
  descifrar: value => value
}));
jest.mock('../src/auditoria', () => ({
  registrarAuditoria: jest.fn().mockResolvedValue(undefined)
}));

const { pool } = require('../src/db');
const authRouter = require('../src/routes/auth').router;
const clientesRouter = require('../src/routes/clientes');
const checkoutRouter = require('../src/routes/checkout');

function appConRutas() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use('/api/clientes', clientesRouter);
  app.use('/api/checkout', checkoutRouter);
  return app;
}

function crearConexionMock() {
  const connection = {
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    release: jest.fn(),
    query: jest.fn(async sql => {
      if (/INSERT INTO clientes/i.test(sql)) return [{ insertId: 71, affectedRows: 1 }, []];
      if (/INSERT INTO usuarios/i.test(sql)) return [{ insertId: 91, affectedRows: 1 }, []];
      if (/INSERT INTO datos_sensibles/i.test(sql)) return [{ insertId: 17, affectedRows: 1 }, []];
      return [{ affectedRows: 1 }, []];
    })
  };
  pool.getConnection.mockResolvedValue(connection);
  return connection;
}

beforeEach(() => {
  pool.query.mockReset().mockImplementation(async sql => {
    if (/SELECT session_version FROM usuarios/i.test(String(sql))) return [[{ session_version: 0 }], []];
    if (/SELECT id FROM clientes/i.test(String(sql))) return [[{ id: 5 }], []];
    return [{ insertId: 1, affectedRows: 1 }, []];
  });
  pool.getConnection.mockReset();
});

describe('Fase 0 - registro y control de acceso', () => {
  test('el registro no permite vincular la cuenta a un clienteId recibido del navegador', async () => {
    const response = await request(appConRutas())
      .post('/api/auth/registro')
      .send({ correo: 'attacker@example.test', password: 'Password123!', clienteId: 5 });

    expect(response.status).toBe(400);
    expect(pool.query).not.toHaveBeenCalled();
    expect(pool.getConnection).not.toHaveBeenCalled();
  });

  test('el autorregistro rechaza cualquier intento de asignar autorización general', async () => {
    const response = await request(appConRutas())
      .post('/api/auth/registro')
      .send({
        nombreUnidad: 'Entidad',
        direccionInstalacion: 'Calle 1',
        nit: '900123456-7',
        nombreFuncionario: 'Persona',
        correo: 'persona@example.test',
        password: 'Password123!',
        autorizacionGeneral: true
      });

    expect(response.status).toBe(400);
    expect(pool.getConnection).not.toHaveBeenCalled();
  });

  test('el autorregistro crea cliente y usuario en una transacción y no concede autorización', async () => {
    const connection = crearConexionMock();
    const response = await request(appConRutas())
      .post('/api/auth/registro')
      .send({
        nombreUnidad: 'Entidad de prueba',
        direccionInstalacion: 'Calle 1',
        nit: '900123456-7',
        nombreFuncionario: 'Comprador de prueba',
        correo: 'comprador@example.test',
        telefono: '3001234567',
        direccionEntrega: 'Carrera 2',
        password: 'Password123!'
      });

    expect(response.status).toBe(201);
    expect(connection.beginTransaction).toHaveBeenCalledTimes(1);
    expect(connection.commit).toHaveBeenCalledTimes(1);
    expect(connection.rollback).not.toHaveBeenCalled();
    const insercionCliente = connection.query.mock.calls.find(([sql]) => /INSERT INTO clientes/i.test(sql));
    expect(insercionCliente).toBeDefined();
    expect(insercionCliente[0]).toMatch(/autorizacion_general\)\s*VALUES\s*\([^)]*FALSE/i);
    expect(connection.query.mock.calls.some(([sql]) => /INSERT INTO usuarios/i.test(sql))).toBe(true);
    expect(response.body.clienteId).toBe(71);
  });

  test('el registro revierte cliente y usuario si falla la creación del usuario', async () => {
    const connection = crearConexionMock();
    connection.query.mockImplementation(async sql => {
      if (/INSERT INTO clientes/i.test(sql)) return [{ insertId: 72, affectedRows: 1 }, []];
      if (/INSERT INTO usuarios/i.test(sql)) throw Object.assign(new Error('duplicate'), { code: 'ER_DUP_ENTRY' });
      return [{ affectedRows: 1 }, []];
    });
    const response = await request(appConRutas())
      .post('/api/auth/registro')
      .send({
        nombreUnidad: 'Entidad de prueba',
        direccionInstalacion: 'Calle 1',
        nit: '900123456-7',
        nombreFuncionario: 'Comprador de prueba',
        correo: 'comprador@example.test',
        password: 'Password123!'
      });

    expect(response.status).toBe(409);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
  });

  test('POST /api/clientes requiere autenticación y no crea cliente públicamente', async () => {
    const response = await request(appConRutas())
      .post('/api/clientes')
      .send({ nombreUnidad: 'Entidad', nit: '9001', nombreFuncionario: 'Persona', correo: 'p@example.test' });

    expect(response.status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('solo un administrador puede crear manualmente un cliente y conceder autorización', async () => {
    const adminToken = jwt.sign({ uid: 1, rol: 'admin', mfa: true }, process.env.JWT_SECRET);
    const response = await request(appConRutas())
      .post('/api/clientes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        nombreUnidad: 'Entidad',
        nit: '9001',
        nombreFuncionario: 'Persona',
        correo: 'p@example.test',
        autorizacionGeneral: true
      });

    expect(response.status).toBe(201);
    const insercion = pool.query.mock.calls.find(([sql]) => /INSERT INTO clientes/i.test(sql));
    expect(insercion[0]).toMatch(/autorizacion_general\)\s*VALUES\s*\([^)]*FALSE/i);
  });

  test('un usuario autenticado como cliente no puede crear clientes ni asignar autorización', async () => {
    const clientToken = jwt.sign({ uid: 10, clienteId: 5, rol: 'cliente', mfa: true }, process.env.JWT_SECRET);
    const response = await request(appConRutas())
      .post('/api/clientes')
      .set('Authorization', `Bearer ${clientToken}`)
      .send({
        nombreUnidad: 'Entidad',
        nit: '9001',
        nombreFuncionario: 'Persona',
        correo: 'p@example.test',
        autorizacionGeneral: true
      });

    expect(response.status).toBe(403);
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[0][0]).toMatch(/session_version/);
  });

  test('solo un administrador puede conceder la autorización general mediante PUT', async () => {
    const adminToken = jwt.sign({ uid: 1, rol: 'admin', mfa: true }, process.env.JWT_SECRET);
    pool.query.mockImplementation(async sql => {
      if (/SELECT session_version FROM usuarios/i.test(String(sql))) return [[{ session_version: 0 }], []];
      if (/SELECT id FROM clientes/i.test(String(sql))) return [[{ id: 5 }], []];
      return [{ affectedRows: 1 }, []];
    });
    const response = await request(appConRutas())
      .put('/api/clientes/5')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ autorizacionGeneral: true });

    expect(response.status).toBe(200);
    expect(pool.query.mock.calls[2][0]).toMatch(/autorizacion_general\s*=\s*COALESCE/i);
    expect(pool.query.mock.calls[2][1][5]).toBe(true);
  });

  test('POST /dato-sensible requiere sesión y no escribe sin autenticación', async () => {
    pool.query.mockResolvedValueOnce([[{ id: 5 }], []]);
    const response = await request(appConRutas())
      .post('/api/clientes/5/dato-sensible')
      .send({ numeroConsultaAntecedentes: 'consulta', autorizacionSensible: true });

    expect(response.status).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('un cliente no puede enviar datos sensibles a otro cliente', async () => {
    const token = jwt.sign({ uid: 10, clienteId: 4, rol: 'cliente', mfa: true }, process.env.JWT_SECRET);
    const response = await request(appConRutas())
      .post('/api/clientes/5/dato-sensible')
      .set('Authorization', `Bearer ${token}`)
      .send({ numeroConsultaAntecedentes: 'consulta', autorizacionSensible: true });

    expect(response.status).toBe(403);
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query.mock.calls[0][0]).toMatch(/session_version/);
  });

  test('el consentimiento para guardar antecedentes no concede autorización de compra restringida', async () => {
    const token = jwt.sign({ uid: 10, clienteId: 5, rol: 'cliente', mfa: true }, process.env.JWT_SECRET);
    let insertado = false;
    pool.query.mockImplementation(async sql => {
      if (/SELECT session_version FROM usuarios/i.test(String(sql))) return [[{ session_version: 0 }], []];
      if (/SELECT id FROM clientes/i.test(String(sql))) return [[{ id: 5 }], []];
      if (/INSERT INTO datos_sensibles/i.test(String(sql))) {
        insertado = true;
        return [{ insertId: 3 }, []];
      }
      if (/FROM clientes c/i.test(String(sql))) {
        return [[{
          id: 5,
          nombre_unidad: 'Entidad',
          nit: '',
          nombre_funcionario: '',
          correo: '',
          telefono: '',
          direccion_entrega: '',
          autorizacion_restringidos: 0
        }], []];
      }
      return [{ affectedRows: insertado ? 1 : 0 }, []];
    });
    const response = await request(appConRutas())
      .post('/api/clientes/5/dato-sensible')
      .set('Authorization', `Bearer ${token}`)
      .send({ numeroConsultaAntecedentes: 'consulta', autorizacionSensible: true });

    expect(response.status).toBe(201);
    const insercionDato = pool.query.mock.calls.find(([sql]) => /INSERT INTO datos_sensibles/i.test(sql));
    expect(insercionDato[1][2]).toBe(true);
    const perfil = await request(appConRutas())
      .get('/api/checkout/perfil')
      .set('Authorization', `Bearer ${token}`);
    expect(perfil.status).toBe(200);
    expect(perfil.body.autorizacionRestringidos).toBe(false);
  });
});

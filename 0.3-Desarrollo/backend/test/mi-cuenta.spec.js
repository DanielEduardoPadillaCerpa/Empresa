'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const request = require('supertest');

process.env.JWT_SECRET = 'mi-cuenta-test-secret-long-enough';
process.env.MFA_TOKEN_PEPPER = 'mi-cuenta-mfa-pepper-that-is-long-enough';
process.env.CRYPTO_KEY = 'mi-cuenta-crypto-key-long-enough';
process.env.NODE_ENV = 'test';

jest.mock('../src/db', () => ({
  pool: {
    query: jest.fn(),
    getConnection: jest.fn()
  }
}));
jest.mock('../src/auditoria', () => ({
  registrarAuditoria: jest.fn().mockResolvedValue(undefined),
  registrarAuditoriaTransaccional: jest.fn().mockResolvedValue(undefined)
}));
jest.mock('../src/mfaCourier', () => ({
  enviarCodigoMfaN8n: jest.fn().mockResolvedValue(undefined)
}));

const { pool } = require('../src/db');
const { registrarAuditoria, registrarAuditoriaTransaccional } = require('../src/auditoria');
const { cifrar, descifrar } = require('../src/crypto');
const { hashCodigoMfa } = require('../src/mfaCodes');
const miCuentaRouter = require('../src/routes/miCuenta');
const authRouter = require('../src/routes/auth').router;

const PASSWORD = 'CurrentPassword123!';
const EMAIL_OLD = 'old@example.test';
const EMAIL_NEW = 'new@example.test';
const challengeId = 'a'.repeat(64);

function crearApp(token = crearToken()) {
  const app = express();
  app.use(express.json());
  app.use('/api/mi-cuenta', miCuentaRouter);
  app.locals.token = token;
  return app;
}

function crearAppAutenticacion() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  return app;
}

function crearToken(payload = {}) {
  return jwt.sign({
    uid: 10,
    clienteId: 7,
    rol: 'cliente',
    mfa: true,
    sv: 0,
    ...payload
  }, process.env.JWT_SECRET);
}

function crearConexion(queryHandler = async () => [{ affectedRows: 1, insertId: 51 }, []]) {
  const connection = {
    beginTransaction: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    rollback: jest.fn().mockResolvedValue(undefined),
    release: jest.fn(),
    query: jest.fn(queryHandler)
  };
  pool.getConnection.mockResolvedValue(connection);
  return connection;
}

function configurarSesionVersion(version = 0) {
  pool.query.mockImplementation(async sql => {
    if (/SELECT session_version FROM usuarios/i.test(String(sql))) {
      return [[{ session_version: version }], []];
    }
    return [{ affectedRows: 1 }, []];
  });
}

function datosReto(overrides = {}) {
  return {
    usuario_id: 10,
    codigo_hash: hashCodigoMfa(challengeId, 10, '123456'),
    estado: 'pendiente',
    intentos: 0,
    vigente: 1,
    correo_destino_cifrado: cifrar(EMAIL_NEW),
    cliente_id: 7,
    correo_anterior: EMAIL_OLD,
    ...overrides
  };
}

beforeEach(() => {
  pool.query.mockReset();
  pool.getConnection.mockReset();
  registrarAuditoria.mockClear();
  registrarAuditoriaTransaccional.mockClear();
  configurarSesionVersion();
});

describe('API autenticada de mi cuenta', () => {
  test('un JWT anterior queda rechazado cuando aumenta session_version', async () => {
    pool.query.mockResolvedValue([[{ session_version: 1 }], []]);
    const response = await request(crearApp(crearToken({ sv: 0 })))
      .get('/api/mi-cuenta')
      .set('Authorization', `Bearer ${crearToken({ sv: 0 })}`);

    expect(response.status).toBe(401);
    expect(response.body.error).toMatch(/sesión fue revocada/i);
  });

  test('GET devuelve únicamente el perfil asociado al cliente del JWT', async () => {
    pool.query.mockImplementation(async (sql, params) => {
      if (/SELECT session_version FROM usuarios/i.test(String(sql))) return [[{ session_version: 0 }], []];
      return [[{
        id: 7,
        nombre_funcionario: 'Nombre propio',
        telefono: '3001234567',
        direccion_entrega: 'Dirección propia',
        direccion_instalacion: 'Sede propia',
        correo_login: EMAIL_OLD,
        autorizacion_general: 0
      }], []];
    });
    const response = await request(crearApp())
      .get('/api/mi-cuenta')
      .set('Authorization', `Bearer ${crearToken()}`);

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toEqual({
      nombreFuncionario: 'Nombre propio',
      telefono: '3001234567',
      direccionEntrega: 'Dirección propia',
      direccionInstalacion: 'Sede propia',
      correo: EMAIL_OLD,
      autorizacionGeneral: false
    });
    expect(pool.query.mock.calls[1][1]).toEqual([7, 10]);
  });

  test('PATCH rechaza campos fuera de la allowlist sin escribir en la base', async () => {
    const response = await request(crearApp())
      .patch('/api/mi-cuenta')
      .set('Authorization', `Bearer ${crearToken()}`)
      .send({ nit: '900123456-7', autorizacionGeneral: true, rol: 'admin', cliente_id: 8 });

    expect(response.status).toBe(400);
    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.getConnection).not.toHaveBeenCalled();
  });

  test('PATCH normaliza el teléfono y audita nombres de campos sin sus valores', async () => {
    const response = await request(crearApp())
      .patch('/api/mi-cuenta')
      .set('Authorization', `Bearer ${crearToken()}`)
      .send({ nombreFuncionario: 'Nuevo nombre', telefono: '300 123 4567' });

    expect(response.status).toBe(200);
    const update = pool.query.mock.calls.find(([sql]) => /UPDATE clientes c/i.test(String(sql)));
    expect(update[0]).toMatch(/nombre_funcionario = \?, telefono = \?/);
    expect(update[1].slice(0, 2).map(descifrar)).toEqual(['Nuevo nombre', '+573001234567']);
    expect(registrarAuditoria).toHaveBeenCalledWith(expect.objectContaining({
      detalle: { campos: ['nombreFuncionario', 'telefono'] },
      usuario: { uid: 10, correo: null }
    }));
    const detalle = JSON.stringify(registrarAuditoria.mock.calls[0][0].detalle);
    expect(detalle).not.toContain('Nuevo nombre');
    expect(detalle).not.toContain('3001234567');
  });

  test('PATCH rechaza HTML, teléfonos no colombianos y acceso sin perfil vinculado', async () => {
    const html = await request(crearApp())
      .patch('/api/mi-cuenta')
      .set('Authorization', `Bearer ${crearToken()}`)
      .send({ nombreFuncionario: '<b>Nombre</b>' });
    expect(html.status).toBe(400);

    const telefono = await request(crearApp())
      .patch('/api/mi-cuenta')
      .set('Authorization', `Bearer ${crearToken()}`)
      .send({ telefono: '+14155550123' });
    expect(telefono.status).toBe(400);

    const sinCliente = await request(crearApp(crearToken({ clienteId: null })))
      .get('/api/mi-cuenta')
      .set('Authorization', `Bearer ${crearToken({ clienteId: null })}`);
    expect(sinCliente.status).toBe(403);
  });

  test('una versión de sesión obsoleta revoca también el access token', async () => {
    configurarSesionVersion(1);
    const response = await request(crearApp())
      .get('/api/mi-cuenta')
      .set('Authorization', `Bearer ${crearToken({ sv: 0 })}`);
    expect(response.status).toBe(401);
    expect(pool.query).toHaveBeenCalledTimes(1);
  });
});

describe('cambio de correo con verificación MFA', () => {
  test('el inicio de sesión acepta el correo nuevo y vuelve a solicitar MFA', async () => {
    const passwordHash = await bcrypt.hash(PASSWORD, 4);
    const connection = crearConexion(async () => [{ affectedRows: 1 }, []]);
    pool.query.mockImplementation(async (sql, params) => {
      if (/SELECT \* FROM usuarios WHERE correo = \?/i.test(String(sql))) {
        expect(params).toEqual([EMAIL_NEW]);
        return [[{
          id: 10,
          correo: EMAIL_NEW,
          password_hash: passwordHash,
          cliente_id: 7,
          rol: 'cliente',
          session_version: 1
        }], []];
      }
      if (/SELECT COUNT\(\*\) AS cantidad/i.test(String(sql))) {
        return [[{ cantidad: 0 }], []];
      }
      return [{ affectedRows: 1 }, []];
    });

    const response = await request(crearAppAutenticacion())
      .post('/api/auth/login')
      .send({ correo: EMAIL_NEW, password: PASSWORD });

    expect(response.status).toBe(202);
    expect(response.body.mfaRequired).toBe(true);
    expect(connection.commit).toHaveBeenCalledTimes(1);
  });

  test('solicitar cambio requiere contraseña actual y no inicia consulta de correo sin ella', async () => {
    const response = await request(crearApp())
      .post('/api/mi-cuenta/correo/solicitar')
      .set('Authorization', `Bearer ${crearToken()}`)
      .send({ nuevoCorreo: EMAIL_NEW });

    expect(response.status).toBe(403);
    expect(pool.getConnection).not.toHaveBeenCalled();
  });

  test('correo duplicado produce respuesta genérica sin crear reto', async () => {
    const passwordHash = await bcrypt.hash(PASSWORD, 4);
    const connection = crearConexion(async sql => {
      if (/SELECT id, correo, password_hash/i.test(String(sql))) {
        return [[{ id: 10, correo: EMAIL_OLD, password_hash: passwordHash }], []];
      }
      if (/SELECT id FROM usuarios WHERE correo/i.test(String(sql))) return [[{ id: 22 }], []];
      return [{ affectedRows: 1 }, []];
    });
    const response = await request(crearApp())
      .post('/api/mi-cuenta/correo/solicitar')
      .set('Authorization', `Bearer ${crearToken()}`)
      .send({ nuevoCorreo: EMAIL_NEW, passwordActual: PASSWORD });

    expect(response.status).toBe(409);
    expect(response.body.error).toBe('Ese correo no está disponible.');
    expect(response.body.error).not.toContain(EMAIL_NEW);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.query.mock.calls.some(([sql]) => /INSERT INTO retos_mfa/i.test(String(sql)))).toBe(false);
  });

  test('la solicitud guarda código/correo cifrados y encola solo el evento autorizado', async () => {
    const passwordHash = await bcrypt.hash(PASSWORD, 4);
    const inserts = [];
    const connection = crearConexion(async (sql, params) => {
      if (/SELECT id, correo, password_hash/i.test(String(sql))) {
        return [[{ id: 10, correo: EMAIL_OLD, password_hash: passwordHash }], []];
      }
      if (/SELECT id FROM usuarios WHERE correo/i.test(String(sql))) return [[], []];
      if (/INSERT INTO retos_mfa/i.test(String(sql))) {
        inserts.push({ sql: String(sql), params });
        return [{ affectedRows: 1, insertId: 1 }, []];
      }
      if (/INSERT IGNORE INTO automation_outbox/i.test(String(sql))) {
        inserts.push({ sql: String(sql), params });
        return [{ affectedRows: 1, insertId: 2 }, []];
      }
      return [{ affectedRows: 1 }, []];
    });
    const response = await request(crearApp())
      .post('/api/mi-cuenta/correo/solicitar')
      .set('Authorization', `Bearer ${crearToken()}`)
      .send({ nuevoCorreo: EMAIL_NEW, passwordActual: PASSWORD });

    expect(response.status).toBe(202);
    expect(response.body.challengeId).toMatch(/^[a-f0-9]{64}$/);
    const reto = inserts.find(item => /INSERT INTO retos_mfa/i.test(item.sql));
    expect(reto.params[4]).not.toBe(EMAIL_NEW);
    const outbox = inserts.find(item => /INSERT IGNORE INTO automation_outbox/i.test(item.sql));
    expect(outbox.sql).toMatch(/payload_cifrado/);
    expect(outbox.params[0]).toBe(`mfa-email-change:${response.body.challengeId}`);
    expect(outbox.params[1]).not.toContain(EMAIL_NEW);
    expect(outbox.params[1]).not.toMatch(/\d{6}/);
    expect(connection.commit).toHaveBeenCalledTimes(1);
  });

  test('código incorrecto, vencido y reutilizado no actualizan el correo', async () => {
    const casos = [
      { reto: datosReto(), code: '654321', status: 401 },
      { reto: datosReto({ vigente: 0 }), code: '123456', status: 410 },
      { reto: datosReto({ estado: 'verificado' }), code: '123456', status: 401 }
    ];
    for (const caso of casos) {
      const connection = crearConexion(async sql => {
        if (/SELECT r\.usuario_id/i.test(String(sql))) return [[caso.reto], []];
        return [{ affectedRows: 1 }, []];
      });
      const response = await request(crearApp())
        .post('/api/mi-cuenta/correo/confirmar')
        .set('Authorization', `Bearer ${crearToken()}`)
        .send({ challengeId, code: caso.code });

      expect(response.status).toBe(caso.status);
      expect(connection.query.mock.calls.some(([sql]) => /UPDATE usuarios SET correo/i.test(String(sql)))).toBe(false);
      expect(connection.rollback).toHaveBeenCalledTimes(caso.reto.estado === 'verificado' ? 1 : 0);
    }
  });

  test('confirmar sincroniza ambos correos, revoca sesiones, encola aviso y audita solo el campo', async () => {
    const consultas = [];
    const connection = crearConexion(async (sql, params) => {
      consultas.push({ sql: String(sql), params });
      if (/SELECT r\.usuario_id/i.test(String(sql))) return [[datosReto()], []];
      return [{ affectedRows: 1, insertId: 4 }, []];
    });
    const response = await request(crearApp())
      .post('/api/mi-cuenta/correo/confirmar')
      .set('Authorization', `Bearer ${crearToken()}`)
      .send({ challengeId, code: '123456' });

    expect(response.status).toBe(200);
    const updateUsuario = consultas.find(item => /UPDATE usuarios SET correo/i.test(item.sql));
    const updateCliente = consultas.find(item => /UPDATE clientes SET correo/i.test(item.sql));
    expect(updateUsuario.params[0]).toBe(EMAIL_NEW);
    expect(updateCliente.params[0]).not.toBe(EMAIL_NEW);
    expect(consultas.some(item => /UPDATE refresh_tokens SET revocado = TRUE/i.test(item.sql))).toBe(true);
    const outbox = consultas.find(item => /INSERT IGNORE INTO automation_outbox/i.test(item.sql));
    expect(outbox.params[1]).not.toContain(EMAIL_OLD);
    expect(registrarAuditoriaTransaccional).toHaveBeenCalledWith(connection, expect.objectContaining({
      detalle: { campos: ['correo'] },
      usuario: { uid: 10, correo: null }
    }));
    expect(connection.commit).toHaveBeenCalledTimes(1);
  });

  test('si falla la actualización del perfil, revierte el cambio de usuarios', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    const connection = crearConexion(async sql => {
      if (/SELECT r\.usuario_id/i.test(String(sql))) return [[datosReto()], []];
      if (/UPDATE clientes SET correo/i.test(String(sql))) throw Object.assign(new Error('database failure'), { code: 'DB_FAIL' });
      return [{ affectedRows: 1 }, []];
    });
    const response = await request(crearApp())
      .post('/api/mi-cuenta/correo/confirmar')
      .set('Authorization', `Bearer ${crearToken()}`)
      .send({ challengeId, code: '123456' });

    expect(response.status).toBe(500);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
    expect(log.mock.calls.flat().join(' ')).not.toContain(EMAIL_OLD);
    expect(log.mock.calls.flat().join(' ')).not.toContain('123456');
    log.mockRestore();
  });

  test('si falla la auditoría transaccional, tampoco confirma el cambio de correo', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    registrarAuditoriaTransaccional.mockRejectedValueOnce(new Error('audit failure'));
    const connection = crearConexion(async sql => {
      if (/SELECT r\.usuario_id/i.test(String(sql))) return [[datosReto()], []];
      return [{ affectedRows: 1 }, []];
    });
    const response = await request(crearApp())
      .post('/api/mi-cuenta/correo/confirmar')
      .set('Authorization', `Bearer ${crearToken()}`)
      .send({ challengeId, code: '123456' });

    expect(response.status).toBe(500);
    expect(connection.rollback).toHaveBeenCalledTimes(1);
    expect(connection.commit).not.toHaveBeenCalled();
    expect(log.mock.calls.flat().join(' ')).not.toContain(EMAIL_OLD);
    expect(log.mock.calls.flat().join(' ')).not.toContain('123456');
    log.mockRestore();
  });
});

describe('contraseña, sesiones y privacidad', () => {
  test('cambio de contraseña exige MFA reciente y revoca todas las sesiones', async () => {
    const passwordHash = await bcrypt.hash(PASSWORD, 4);
    const connection = crearConexion(async sql => {
      if (/SELECT id, correo, password_hash FROM usuarios/i.test(String(sql))) {
        return [[{ id: 10, correo: EMAIL_OLD, password_hash: passwordHash }], []];
      }
      if (/SELECT id FROM refresh_tokens/i.test(String(sql))) return [[{ id: 12 }], []];
      return [{ affectedRows: 1, insertId: 5 }, []];
    });
    const response = await request(crearApp())
      .post('/api/mi-cuenta/password')
      .set('Authorization', `Bearer ${crearToken()}`)
      .send({ passwordActual: PASSWORD, passwordNueva: 'NewPassword456!' });

    expect(response.status).toBe(200);
    const update = connection.query.mock.calls.find(([sql]) => /UPDATE usuarios SET password_hash/i.test(String(sql)));
    expect(await bcrypt.compare('NewPassword456!', update[1][0])).toBe(true);
    expect(await bcrypt.compare(PASSWORD, update[1][0])).toBe(false);
    expect(connection.query.mock.calls.some(([sql]) => /UPDATE refresh_tokens SET revocado = TRUE/i.test(String(sql)))).toBe(true);
    expect(connection.query.mock.calls.some(([sql]) => /session_version = session_version \+ 1/i.test(String(sql)))).toBe(true);
    expect(connection.commit).toHaveBeenCalledTimes(1);
  });

  test('sin MFA en los últimos 15 minutos no cambia la contraseña', async () => {
    const passwordHash = await bcrypt.hash(PASSWORD, 4);
    const connection = crearConexion(async sql => {
      if (/SELECT id, correo, password_hash FROM usuarios/i.test(String(sql))) {
        return [[{ id: 10, correo: EMAIL_OLD, password_hash: passwordHash }], []];
      }
      if (/SELECT id FROM refresh_tokens/i.test(String(sql))) return [[], []];
      return [{ affectedRows: 1 }, []];
    });
    const response = await request(crearApp())
      .post('/api/mi-cuenta/password')
      .set('Authorization', `Bearer ${crearToken()}`)
      .send({ passwordActual: PASSWORD, passwordNueva: 'NewPassword456!' });

    expect(response.status).toBe(403);
    expect(connection.query.mock.calls.some(([sql]) => /UPDATE usuarios SET password_hash/i.test(String(sql)))).toBe(false);
  });

  test('cerrar todas las sesiones revoca refresh y aumenta la versión de sesión', async () => {
    const connection = crearConexion();
    const response = await request(crearApp())
      .post('/api/mi-cuenta/sesiones/cerrar-todas')
      .set('Authorization', `Bearer ${crearToken()}`);

    expect(response.status).toBe(200);
    expect(connection.query.mock.calls.some(([sql]) => /UPDATE refresh_tokens SET revocado = TRUE/i.test(String(sql)))).toBe(true);
    expect(connection.query.mock.calls.some(([sql]) => /session_version = session_version \+ 1/i.test(String(sql)))).toBe(true);
  });

  test('la solicitud de privacidad encola al n8n solo id y tipo', async () => {
    const connection = crearConexion(async (sql, params) => {
      if (/INSERT INTO solicitudes_cuenta/i.test(String(sql))) return [{ insertId: 41, affectedRows: 1 }, []];
      if (/INSERT IGNORE INTO automation_outbox/i.test(String(sql))) {
        expect(params[0]).toBe('account-request:41');
        expect(params[1]).not.toContain('detalle personal privado');
        const wrapper = JSON.parse(params[1]);
        return [{ insertId: 42, affectedRows: 1 }, []];
      }
      return [{ affectedRows: 1 }, []];
    });
    const response = await request(crearApp())
      .post('/api/mi-cuenta/solicitud-cambio')
      .set('Authorization', `Bearer ${crearToken()}`)
      .send({ campo: 'correccion', detalle: 'Solicito corregir detalle personal privado' });

    expect(response.status).toBe(201);
    expect(response.body.solicitudId).toBe(41);
    expect(connection.commit).toHaveBeenCalledTimes(1);
  });

  test('solo un administrador puede resolver solicitudes de cuenta', async () => {
    pool.query.mockImplementation(async sql => {
      if (/SELECT session_version FROM usuarios/i.test(String(sql))) return [[{ session_version: 0 }], []];
      return [{ affectedRows: 1 }, []];
    });
    const admin = crearToken({ uid: 1, clienteId: null, rol: 'admin' });
    const response = await request(crearApp(admin))
      .patch('/api/mi-cuenta/solicitudes/41')
      .set('Authorization', `Bearer ${admin}`)
      .send({ estado: 'aprobada', respuesta: 'Aprobada' });

    expect(response.status).toBe(200);
    expect(pool.query.mock.calls[1][0]).toMatch(/UPDATE solicitudes_cuenta/);
  });

  test('el limitador responde 429 al superar las solicitudes de cambio de correo', async () => {
    const app = crearApp();
    let ultima;
    for (let intento = 0; intento < 6; intento += 1) {
      ultima = await request(app)
        .post('/api/mi-cuenta/correo/solicitar')
        .set('Authorization', `Bearer ${crearToken()}`)
        .send({ nuevoCorreo: EMAIL_NEW });
    }
    expect(ultima.status).toBe(429);
  });
});

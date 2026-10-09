const test = require('node:test');
const assert = require('node:assert/strict');
const {
  enviarCodigoMfaN8n,
  obtenerConfiguracionMfa,
  sanitizarRespuestaWebhook
} = require('../src/mfaCourier');

const variableUrl = 'N8N_MFA_WEBHOOK_URL';
const variableSecreto = 'N8N_MFA_WEBHOOK_SECRET';
const secretoPrueba = 'test-only-mfa-webhook-secret-32-characters';

function guardarEntorno(t) {
  const anteriores = {
    url: process.env[variableUrl],
    secreto: process.env[variableSecreto]
  };
  t.after(() => {
    if (anteriores.url === undefined) delete process.env[variableUrl];
    else process.env[variableUrl] = anteriores.url;
    if (anteriores.secreto === undefined) delete process.env[variableSecreto];
    else process.env[variableSecreto] = anteriores.secreto;
  });
}

test('MFA courier requires HTTPS outside localhost and production URL', t => {
  guardarEntorno(t);
  process.env[variableUrl] = 'http://n8n.example.com/webhook/mfa-login-code';
  process.env[variableSecreto] = secretoPrueba;
  assert.throws(
    () => obtenerConfiguracionMfa({ produccion: true }),
    error => error.code === 'N8N_MFA_WEBHOOK_HTTPS_REQUIRED'
  );

  process.env[variableUrl] = 'https://n8n.example.com/webhook-test/mfa-login-code';
  assert.throws(
    () => obtenerConfiguracionMfa({ produccion: true }),
    error => error.code === 'N8N_MFA_PRODUCTION_WEBHOOK_TEST_URL'
  );
});

test('MFA courier sends only the approved minimal payload and Bearer auth', async t => {
  guardarEntorno(t);
  process.env[variableUrl] = 'http://localhost:5678/webhook/mfa-login-code';
  process.env[variableSecreto] = secretoPrueba;
  const fetchAnterior = global.fetch;
  let solicitud;
  global.fetch = async (url, options) => {
    solicitud = { url, options };
    return { ok: true, status: 200 };
  };
  t.after(() => { global.fetch = fetchAnterior; });

  await enviarCodigoMfaN8n({
    correo: 'cliente@example.com',
    codigo: '023456',
    vigenciaMinutos: 5
  });

  assert.equal(solicitud.url, process.env[variableUrl]);
  assert.equal(solicitud.options.headers.Authorization, `Bearer ${secretoPrueba}`);
  const payload = JSON.parse(solicitud.options.body);
  assert.deepEqual(Object.keys(payload).sort(), [
    'email',
    'event',
    'expires_in_seconds',
    'timestamp',
    'token_mfa'
  ]);
  assert.equal(payload.email, 'cliente@example.com');
  assert.equal(payload.token_mfa, '023456');
  assert.equal(payload.expires_in_seconds, 300);
});

test('MFA failure logging redacts email, code, and webhook secret', () => {
  const extracto = sanitizarRespuestaWebhook(
    'recipient=cliente@example.com code=123456 auth=test-only-mfa-webhook-secret-32-characters',
    'cliente@example.com',
    '123456',
    secretoPrueba
  );
  assert.doesNotMatch(extracto, /cliente@example\.com|123456|test-only-mfa-webhook-secret/);
  assert.match(extracto, /\[email\]/);
  assert.match(extracto, /\[code\]/);
  assert.match(extracto, /\[secret\]/);
});

test('MFA courier reports n8n status without leaking the secret payload', async t => {
  guardarEntorno(t);
  process.env[variableUrl] = 'http://localhost:5678/webhook/mfa-login-code';
  process.env[variableSecreto] = secretoPrueba;
  const fetchAnterior = global.fetch;
  const errorAnterior = console.error;
  let log;
  global.fetch = async () => ({
    ok: false,
    status: 404,
    async text() {
      return 'email cliente@example.com código 023456 secreto test-only-mfa-webhook-secret-32-characters';
    }
  });
  console.error = (...argumentos) => { log = argumentos; };
  t.after(() => {
    global.fetch = fetchAnterior;
    console.error = errorAnterior;
  });

  await assert.rejects(
    enviarCodigoMfaN8n({
      correo: 'cliente@example.com',
      codigo: '023456',
      vigenciaMinutos: 5
    }),
    error => error.code === 'N8N_MFA_HTTP_404'
  );
  const textoLog = JSON.stringify(log);
  assert.match(textoLog, /404/);
  assert.doesNotMatch(textoLog, /cliente@example\.com|023456|test-only-mfa-webhook-secret/);
});

test('production requires an HTTPS production webhook and configured secret', t => {
  guardarEntorno(t);
  delete process.env[variableUrl];
  delete process.env[variableSecreto];
  assert.throws(
    () => obtenerConfiguracionMfa({ produccion: true }),
    error => error.code === 'N8N_MFA_CONFIGURATION_REQUIRED'
  );

  process.env[variableUrl] = 'https://n8n.example.com/webhook/mfa-login-code';
  process.env[variableSecreto] = secretoPrueba;
  assert.equal(obtenerConfiguracionMfa({ produccion: true }).url, process.env[variableUrl]);
});

test('MFA courier distinguishes authorization, workflow, and network failures', async t => {
  guardarEntorno(t);
  process.env[variableUrl] = 'http://localhost:5678/webhook/mfa-login-code';
  process.env[variableSecreto] = secretoPrueba;
  const fetchAnterior = global.fetch;
  const errorAnterior = console.error;
  t.after(() => {
    global.fetch = fetchAnterior;
    console.error = errorAnterior;
  });
  console.error = () => {};

  for (const status of [403, 500]) {
    global.fetch = async () => ({
      ok: false,
      status,
      async text() { return 'safe test response'; }
    });
    await assert.rejects(
      enviarCodigoMfaN8n({ correo: 'cliente@example.com', codigo: '123456', vigenciaMinutos: 5 }),
      error => error.code === `N8N_MFA_HTTP_${status}`
    );
  }

  global.fetch = async () => {
    const error = new Error('aborted');
    error.name = 'AbortError';
    throw error;
  };
  await assert.rejects(
    enviarCodigoMfaN8n({ correo: 'cliente@example.com', codigo: '123456', vigenciaMinutos: 5 }),
    error => error.code === 'N8N_MFA_DELIVERY_TIMEOUT'
  );

  global.fetch = async () => {
    const error = new TypeError('network unavailable');
    throw error;
  };
  await assert.rejects(
    enviarCodigoMfaN8n({ correo: 'cliente@example.com', codigo: '123456', vigenciaMinutos: 5 }),
    error => error.code === 'N8N_MFA_DELIVERY_FAILED'
  );
});

test('MFA n8n workflow validates request fields and does not retain executions', () => {
  const fs = require('fs');
  const path = require('path');
  const workflowPath = path.join(__dirname, '..', '..', 'n8n', 'workflows', 'W5-mfa-email.json');
  const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
  assert.equal(workflow.settings.saveDataSuccessExecution, 'none');
  assert.equal(workflow.settings.saveDataErrorExecution, 'none');
  assert.equal(workflow.settings.saveManualExecutions, false);
  assert.equal(workflow.settings.saveExecutionProgress, false);

  const codigo = workflow.nodes.find(node => node.name === 'Validar y armar correo').parameters.jsCode;
  const validar = new Function('$input', codigo);
  const entrada = {
    body: {
      event: 'mfa.login.code',
      email: 'cliente@example.com',
      token_mfa: '023456',
      timestamp: new Date().toISOString(),
      expires_in_seconds: 300
    }
  };
  const correo = validar({ first: () => ({ json: entrada }) })[0].json;
  assert.equal(correo.to, entrada.body.email);
  assert.match(correo.html, /023456/);
  assert.throws(() => validar({
    first: () => ({ json: { body: { ...entrada.body, token_mfa: 'no-es-codigo' } } })
  }), /Código inválido/);
});

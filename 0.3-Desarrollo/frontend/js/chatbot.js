/* Chat UI. Las respuestas se solicitan al proxy backend, que las reenvía a n8n. */

function cbAgregarMensaje(texto, tipo) {
  const body = document.getElementById('cb-body');
  const div = document.createElement('div');
  div.className = 'cb-msg ' + tipo;
  div.textContent = texto;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

async function cbEnviar(textoManual) {
  const input = document.getElementById('cb-input-text');
  const texto = (textoManual || input.value).trim();
  if (!texto) return;
  cbAgregarMensaje(texto, 'user');
  input.value = '';
  input.disabled = true;
  try {
    const base = typeof API_BASE !== 'undefined' ? API_BASE : 'http://localhost:8081';
    const respuesta = await fetch(base + '/api/atencion/mensaje', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mensaje: texto,
        conversacionId: CB_CONVERSACION_ID,
        idioma: typeof idiomaGuardado === 'function' ? idiomaGuardado() : 'es-419'
      })
    });
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(datos.error || 'Servicio de atención no disponible.');
    cbAgregarMensaje(datos.respuesta, 'bot');
    cbOfrecerCalificacion();
  } catch (err) {
    console.error('[chatbot] No se pudo obtener respuesta:', err);
    cbAgregarMensaje('La atención automatizada no está disponible por el momento. Intenta nuevamente más tarde.', 'bot');
  } finally {
    input.disabled = false;
    input.focus();
  }
}

let cbCalificado = false;
function cbOfrecerCalificacion() {
  if (cbCalificado) return;
  const historial = document.getElementById('cb-body').children.length;
  if (historial >= 4) {
    cbCalificado = true;
    setTimeout(() => {
      cbAgregarMensaje('¿Cómo calificarías esta atención? (1 a 5)', 'bot');
      const body = document.getElementById('cb-body');
      const wrap = document.createElement('div');
      wrap.className = 'cb-quick';
      for (let i = 1; i <= 5; i++) {
        const b = document.createElement('button');
        b.textContent = '★'.repeat(i);
        b.onclick = () => cbRegistrarCalificacion(i);
        wrap.appendChild(b);
      }
      body.appendChild(wrap);
      body.scrollTop = body.scrollHeight;
    }, 600);
  }
}

// Identificador de conversación para agrupar los mensajes de esta sesión de chat.
const CB_CONVERSACION_ID = 'cb-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);

async function cbRegistrarCalificacion(valor) {
  cbAgregarMensaje(`Calificación registrada: ${valor}/5. Gracias por tu retroalimentación.`, 'bot');
  try {
    const base = (typeof API_BASE !== 'undefined') ? API_BASE : 'http://localhost:8081';
    await fetch(base + '/api/atencion/calificacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversacionId: CB_CONVERSACION_ID, calificacion: valor })
    });
  } catch (err) {
    console.error('No se pudo guardar la calificación en el servidor:', err);
  }
}

function cbToggle() {
  document.getElementById('chatbot-panel').classList.toggle('abierto');
}

function cbInicializar() {
  const input = document.getElementById('cb-input-text');
  if (input) {
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') cbEnviar(); });
  }
  document.querySelectorAll('.cb-quick-start button').forEach(btn => {
    btn.addEventListener('click', () => cbEnviar(btn.dataset.q));
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', cbInicializar, { once: true });
} else {
  cbInicializar();
}

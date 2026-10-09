const CB_STORAGE_KEY = 'si_chat_history_v1';
const CB_CONVERSACION_ID = (() => {
  const key = 'si_chat_conversation_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = 'cb-' + (window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
    sessionStorage.setItem(key, id);
  }
  return id;
})();

let cbCalificado = false;
let cbEnviando = false;

function cbBaseApi() {
  return typeof API_BASE !== 'undefined' ? API_BASE : 'http://localhost:8081';
}

function cbSesion() {
  try {
    return JSON.parse(localStorage.getItem('si_auth') || 'null');
  } catch {
    return null;
  }
}

function cbAgregarMensaje(texto, tipo, guardar = true) {
  const body = document.getElementById('cb-body');
  if (!body) return null;
  const div = document.createElement('div');
  div.className = `cb-msg ${tipo}`;
  div.textContent = String(texto);
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
  if (guardar) cbGuardarHistorial();
  return div;
}

function cbGuardarHistorial() {
  const mensajes = [...document.querySelectorAll('#cb-body > .cb-msg')]
    .slice(-30)
    .map(elemento => ({
      texto: elemento.textContent || '',
      tipo: elemento.classList.contains('user') ? 'user' : 'bot'
    }));
  try {
    sessionStorage.setItem(CB_STORAGE_KEY, JSON.stringify(mensajes));
  } catch (error) {
    console.error('[chatbot] No se pudo guardar el historial de esta sesión.');
  }
}

function cbRestaurarHistorial() {
  let historial = [];
  try {
    historial = JSON.parse(sessionStorage.getItem(CB_STORAGE_KEY) || '[]');
  } catch {
    sessionStorage.removeItem(CB_STORAGE_KEY);
  }
  if (!Array.isArray(historial)) return;
  historial.slice(-30).forEach(mensaje => {
    if (typeof mensaje?.texto === 'string' && ['user', 'bot'].includes(mensaje.tipo)) {
      cbAgregarMensaje(mensaje.texto, mensaje.tipo, false);
    }
  });
}

function cbUrlSegura(valor, base = window.location.href) {
  try {
    const url = new URL(String(valor || ''), base);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    return url.href;
  } catch {
    return null;
  }
}

function cbAgregarTarjetas(tarjetas) {
  const body = document.getElementById('cb-body');
  if (!body || !Array.isArray(tarjetas)) return;
  tarjetas.forEach(tarjeta => {
    const card = document.createElement('article');
    card.className = 'cb-product-card';
    if (tarjeta.imagen) {
      const imagenUrl = cbUrlSegura(tarjeta.imagen, cbBaseApi());
      if (imagenUrl) {
        const imagen = document.createElement('img');
        imagen.src = imagenUrl;
        imagen.alt = String(tarjeta.nombre || 'Producto del catálogo');
        imagen.loading = 'lazy';
        card.appendChild(imagen);
      }
    }
    const titulo = document.createElement('strong');
    titulo.textContent = String(tarjeta.nombre || 'Producto');
    card.appendChild(titulo);
    const precio = document.createElement('p');
    precio.textContent = `$${String(tarjeta.precio || '0')} ${String(tarjeta.moneda || 'COP')}`;
    card.appendChild(precio);
    const disponibilidad = document.createElement('p');
    disponibilidad.textContent = String(tarjeta.disponibilidad || 'Consultar disponibilidad');
    card.appendChild(disponibilidad);
    if (tarjeta.restringido) {
      const aviso = document.createElement('p');
      aviso.textContent = 'Requiere autorización registrada del cliente.';
      card.appendChild(aviso);
    }
    const destino = cbUrlSegura(tarjeta.url, window.location.href);
    if (destino) {
      const enlace = document.createElement('a');
      enlace.href = destino;
      enlace.textContent = 'Ver producto';
      card.appendChild(enlace);
    }
    body.appendChild(card);
  });
  body.scrollTop = body.scrollHeight;
}

function cbMostrarSugerencias(sugerencias) {
  const contenedor = document.querySelector('.cb-quick-start');
  if (!contenedor) return;
  contenedor.replaceChildren();
  (Array.isArray(sugerencias) ? sugerencias : []).slice(0, 5).forEach(pregunta => {
    if (typeof pregunta !== 'string' || pregunta.length > 160) return;
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.textContent = pregunta;
    boton.dataset.q = pregunta;
    boton.addEventListener('click', () => cbEnviar(pregunta));
    contenedor.appendChild(boton);
  });
}

async function cbCargarSugerencias() {
  try {
    const respuesta = await fetch(`${cbBaseApi()}/api/asistente/sugerencias`);
    const datos = await respuesta.json();
    if (!respuesta.ok) throw new Error(datos.error || 'No fue posible cargar sugerencias.');
    cbMostrarSugerencias(datos.sugerencias);
  } catch (error) {
    cbMostrarSugerencias([
      '¿Qué productos tienen disponibles?',
      '¿Cuánto cuesta un producto?',
      '¿Qué productos están restringidos?'
    ]);
  }
}

function cbIndicadorEscritura(mostrar) {
  const body = document.getElementById('cb-body');
  if (!body) return;
  const existente = document.getElementById('cb-typing');
  if (!mostrar) {
    existente?.remove();
    return;
  }
  if (!existente) {
    const indicador = document.createElement('div');
    indicador.id = 'cb-typing';
    indicador.className = 'cb-msg bot';
    indicador.setAttribute('role', 'status');
    indicador.textContent = 'Escribiendo…';
    body.appendChild(indicador);
    body.scrollTop = body.scrollHeight;
  }
}

async function cbEnviar(textoManual) {
  if (cbEnviando) return;
  const input = document.getElementById('cb-input-text');
  const boton = document.getElementById('cb-send-button');
  const texto = String(textoManual || input?.value || '').trim();
  if (!texto) return;
  if (texto.length > 500) {
    cbAgregarMensaje('El mensaje puede tener máximo 500 caracteres.', 'bot');
    return;
  }
  cbEnviando = true;
  cbAgregarMensaje(texto, 'user');
  if (input) {
    input.value = '';
    input.disabled = true;
  }
  if (boton) boton.disabled = true;
  cbIndicadorEscritura(true);
  try {
    const detalleId = new URLSearchParams(window.location.search).get('id');
    const sesion = cbSesion();
    const headers = { 'Content-Type': 'application/json' };
    if (sesion?.token) headers.Authorization = `Bearer ${sesion.token}`;
    const respuesta = await fetch(`${cbBaseApi()}/api/asistente/mensaje`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        mensaje: texto,
        conversacionId: CB_CONVERSACION_ID,
        ...(detalleId && /^\d+$/.test(detalleId) ? { productoActualId: Number(detalleId) } : {})
      })
    });
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(datos.error || 'No fue posible responder ahora.');
    cbAgregarMensaje(datos.respuesta || 'No se recibió una respuesta del catálogo.', 'bot');
    cbAgregarTarjetas(datos.tarjetas);
    cbMostrarSugerencias(datos.sugerencias);
    cbOfrecerCalificacion();
  } catch (error) {
    console.error('[chatbot] Falló la consulta del catálogo.');
    cbAgregarMensaje(error.message || 'No fue posible conectar con el asistente. Intenta nuevamente.', 'bot');
  } finally {
    cbIndicadorEscritura(false);
    if (input) {
      input.disabled = false;
      input.focus();
    }
    if (boton) boton.disabled = false;
    cbEnviando = false;
  }
}

function cbOfrecerCalificacion() {
  const body = document.getElementById('cb-body');
  if (cbCalificado || !body || body.querySelectorAll('.cb-msg.user').length < 3) return;
  cbCalificado = true;
  const pregunta = cbAgregarMensaje('¿Cómo calificarías esta atención? (1 a 5)', 'bot');
  if (!pregunta) return;
  const wrap = document.createElement('div');
  wrap.className = 'cb-quick';
  for (let valor = 1; valor <= 5; valor += 1) {
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.textContent = '★'.repeat(valor);
    boton.setAttribute('aria-label', `${valor} de 5`);
    boton.addEventListener('click', () => cbRegistrarCalificacion(valor));
    wrap.appendChild(boton);
  }
  body.appendChild(wrap);
}

async function cbRegistrarCalificacion(valor) {
  cbAgregarMensaje(`Calificación registrada: ${valor}/5. Gracias por tu retroalimentación.`, 'bot');
  try {
    const respuesta = await fetch(`${cbBaseApi()}/api/atencion/calificacion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversacionId: CB_CONVERSACION_ID, calificacion: valor })
    });
    if (!respuesta.ok) throw new Error('RATING_SAVE_FAILED');
  } catch {
    cbAgregarMensaje('No fue posible guardar tu calificación.', 'bot');
  }
}

function cbToggle() {
  const panel = document.getElementById('chatbot-panel');
  if (!panel) return;
  const abierto = panel.classList.toggle('abierto');
  document.getElementById('chatbot-toggle')?.setAttribute('aria-expanded', String(abierto));
  if (abierto) document.getElementById('cb-input-text')?.focus();
}

function cbInicializar() {
  const input = document.getElementById('cb-input-text');
  document.querySelector('.cb-human-button')?.addEventListener('click', () => {
    cbEnviar('Quiero hablar con una persona');
  });
  if (input) {
    input.maxLength = 500;
    input.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        cbEnviar();
      }
    });
  }
  cbRestaurarHistorial();
  cbCargarSugerencias();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', cbInicializar, { once: true });
} else {
  cbInicializar();
}

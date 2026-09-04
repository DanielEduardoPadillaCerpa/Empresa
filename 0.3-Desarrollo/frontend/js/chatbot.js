/* ============================================================
   Chatbot de atención al cliente — prototipo front-end
   En producción: este archivo solo maneja UI. Las respuestas
   deben venir de un endpoint backend (POST /api/chatbot/mensaje)
   que orquesta el modelo de NLP + consulta el catálogo real.
   Aquí se simula con un motor de reglas para la demo.
   ============================================================ */

const CB_RESPUESTAS = [
  { match: /horario|hora|abren|cierran/i, r: "Atendemos pedidos en línea las 24 horas. La entrega en sede se coordina de lunes a viernes, 7:00 a.m. a 5:00 p.m." },
  { match: /envio|entrega|domicilio/i, r: "Los envíos a instalaciones oficiales se despachan en 2 a 5 días hábiles, según la ciudad. Necesitas registrar la dirección de entrega en tu perfil." },
  { match: /pago|factura|precio/i, r: "Aceptamos PSE, transferencia y orden de compra institucional. Todas las compras generan factura electrónica automática." },
  { match: /dato|privacidad|habeas|informacion personal/i, r: "Tus datos se clasifican y protegen según la Ley 1581 de 2012. Puedes ver el detalle en la sección 'Tratamiento de datos' del formulario de registro." },
  { match: /agente|humano|persona|asesor/i, r: "Te transfiero con un agente. Un miembro del equipo revisará esta conversación en breve." },
  { match: /gracias/i, r: "Con gusto. ¿Necesitas algo más?" },
];

const CB_DEFAULT = "No tengo una respuesta exacta para eso todavía. Puedo transferirte con un agente humano si lo prefieres — escribe 'agente'.";

function cbBuscarRespuesta(texto) {
  for (const item of CB_RESPUESTAS) {
    if (item.match.test(texto)) return item.r;
  }
  return CB_DEFAULT;
}

function cbAgregarMensaje(texto, tipo) {
  const body = document.getElementById('cb-body');
  const div = document.createElement('div');
  div.className = 'cb-msg ' + tipo;
  div.textContent = texto;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

function cbEnviar(textoManual) {
  const input = document.getElementById('cb-input-text');
  const texto = (textoManual || input.value).trim();
  if (!texto) return;
  cbAgregarMensaje(texto, 'user');
  input.value = '';
  setTimeout(() => {
    cbAgregarMensaje(cbBuscarRespuesta(texto), 'bot');
    cbOfrecerCalificacion();
  }, 400);
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
    const base = (typeof API_BASE !== 'undefined') ? API_BASE : 'http://localhost:8080';
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

document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('cb-input-text');
  if (input) {
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') cbEnviar(); });
  }
  document.querySelectorAll('.cb-quick-start button').forEach(btn => {
    btn.addEventListener('click', () => cbEnviar(btn.dataset.q));
  });
});

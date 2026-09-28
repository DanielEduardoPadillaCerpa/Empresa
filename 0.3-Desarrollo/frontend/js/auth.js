/* ============================================================
   Autenticación — prototipo front-end
   Guarda el JWT (access token) + refresh token en localStorage
   tras login/registro. Antes de cada compra, renueva el access
   token automáticamente si está por vencer, usando el refresh
   token — sin pedirle al usuario que vuelva a loguearse.
   ============================================================ */

// URL única del backend, compartida por todas las páginas (cart.js, index.html, etc.)
const API_BASE = 'http://localhost:8081';

const AUTH_KEY = 'si_auth';
let authRenovacionEnCurso = null;

function portalToastStack() {
  let stack = document.getElementById('portal-toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'portal-toast-stack';
    stack.className = 'portal-toast-stack';
    stack.setAttribute('aria-live', 'polite');
    document.body.appendChild(stack);
  }
  return stack;
}

function mostrarNotificacion(mensaje, tipo = 'info', duracion = 3000) {
  const toast = document.createElement('div');
  toast.className = `portal-toast portal-toast--${tipo}`;
  toast.setAttribute('role', 'status');
  const contenido = document.createElement('span');
  contenido.textContent = String(mensaje);
  const cerrarBtn = document.createElement('button');
  cerrarBtn.type = 'button';
  cerrarBtn.className = 'portal-toast__close';
  cerrarBtn.setAttribute('aria-label', 'Cerrar');
  cerrarBtn.textContent = '×';
  toast.append(contenido, cerrarBtn);
  const cerrar = () => toast.remove();
  cerrarBtn.addEventListener('click', cerrar);
  portalToastStack().appendChild(toast);
  window.setTimeout(cerrar, duracion);
  return toast;
}

function confirmarAccion(mensaje) {
  return new Promise(resolve => {
    const toast = mostrarNotificacion('', 'info', 10000);
    const contenido = toast.querySelector('span');
    contenido.textContent = String(mensaje);
    const acciones = document.createElement('div');
    acciones.className = 'portal-confirm__actions';
    acciones.innerHTML = '<button type="button" class="btn btn-sm btn-dark" data-confirmar>Sí, continuar</button><button type="button" class="btn btn-sm btn-outline-secondary" data-cancelar>Cancelar</button>';
    contenido.appendChild(acciones);
    const terminar = resultado => { toast.remove(); resolve(resultado); };
    toast.querySelector('[data-confirmar]').addEventListener('click', () => terminar(true));
    toast.querySelector('[data-cancelar]').addEventListener('click', () => terminar(false));
  });
}

function authGuardar(datos) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(datos));
  authRenderNavbar();
}

function authLeer() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY));
  } catch {
    return null;
  }
}

function authEstaLogueado() {
  return !!authLeer()?.token;
}

// Cierra sesión localmente y avisa al backend para revocar el refresh token
// (best-effort: si falla la petición, igual se limpia la sesión local).
function authCerrarSesion() {
  const sesion = authLeer();
  if (sesion?.refreshToken) {
    fetch(API_BASE + '/api/auth/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: sesion.refreshToken })
    }).catch(() => {});
  }
  localStorage.removeItem(AUTH_KEY);
  authRenderNavbar();
  window.location.href = 'landing.html';
}

function authRenderNavbar() {
  const slot = document.getElementById('auth-nav-slot');
  const sesion = authLeer();
  const logueado = !!sesion?.correo;
  const esAdmin = !!(logueado && sesion?.rol === 'admin' &&
    (!sesion.expiraEn || Number(sesion.expiraEn) > Date.now()));

  if (slot) {
    if (logueado) {
      slot.innerHTML = `
        <a href="#" class="nav-link" 
           data-bs-toggle="tooltip" 
           data-bs-placement="bottom" 
           title="${sesion.correo}">
          <i class="bi bi-person-circle"></i>
        </a>
        <button class="btn btn-sm"
                style="border:1px solid var(--brass-600);
                       color:var(--brass-500);
                       background:transparent;"
                onclick="authCerrarSesion()">
          Cerrar sesión
        </button>
      `;
    } else {
      slot.innerHTML = `
        <a href="login.html" class="btn btn-sm"
           style="border:1px solid var(--brass-600);
                  color:var(--brass-500);
                  background:transparent;">
          Iniciar sesión
        </a>
      `;
    }
  }

  // "Registro de cliente" solo tiene sentido si todavía no hay cuenta.
  document.querySelectorAll('.nav-registro-link').forEach(el => {
    el.style.display = logueado ? 'none' : '';
  });

  // Historial y Mis reportes solo tienen sentido si ya hay sesión.
  document.querySelectorAll('.nav-cliente-link').forEach(el => {
    el.style.display = logueado ? '' : 'none';
  });

  if (esAdmin) {
    document.querySelectorAll('.navbar a[href="admin-dashboard.html"]').forEach(el => {
      el.textContent = '← Regresar al panel principal';
    });
    document.querySelectorAll('.navbar a[href="historial.html"]').forEach(el => {
      el.textContent = 'Historial de clientes';
      el.href = 'admin-pedidos.html';
    });
    document.querySelectorAll('.navbar a[href="mis-reportes.html"]').forEach(el => {
      el.textContent = 'Reportes de clientes';
      el.href = 'reportes.html';
    });
    document.querySelectorAll('.navbar a[href="registro.html"]').forEach(el => {
      el.textContent = 'Nuevo cliente';
      el.href = 'registro.html?modo=admin';
    });
    document.querySelectorAll('.nav-registro-link').forEach(el => {
      el.style.display = '';
    });

    const navList = document.querySelector('.navbar .navbar-nav');
    const esCatalogo = /(^|\/)index\.html$/.test(window.location.pathname) || window.location.pathname.endsWith('/');
    if (esCatalogo && navList) {
      const enlacesAdmin = [
        ['admin-clientes.html', 'Clientes'],
        ['admin-productos.html', 'Productos'],
        ['admin-pedidos.html', 'Pedidos'],
        ['reportes.html', 'Reportes']
      ];
      enlacesAdmin.forEach(([href, label]) => {
        if (navList.querySelector(`a[href="${href}"]`)) return;
        const li = document.createElement('li');
        li.className = 'nav-item';
        const link = document.createElement('a');
        link.className = 'nav-link';
        link.href = href;
        link.textContent = label;
        li.appendChild(link);
        const authItem = navList.querySelector('#auth-nav-slot')?.parentElement;
        navList.insertBefore(li, authItem || null);
      });
    }

    const navbar = document.querySelector('.navbar .navbar-nav');
    const tieneDashboard = navbar && Array.from(navbar.querySelectorAll('a'))
      .some(link => link.getAttribute('href') === 'admin-dashboard.html');
    const modoRegistroAdmin = document.body.classList.contains('modo-admin-registro');
    const esDashboard = window.location.pathname.endsWith('admin-dashboard.html');
    if (navbar && !tieneDashboard && !esDashboard && !modoRegistroAdmin && !document.getElementById('nav-regresar-admin-global')) {
      const li = document.createElement('li');
      li.className = 'nav-item';
      const link = document.createElement('a');
      link.id = 'nav-regresar-admin-global';
      link.className = 'nav-link';
      link.href = 'admin-dashboard.html';
      link.textContent = '← Regresar al panel principal';
      li.appendChild(link);
      navbar.insertBefore(li, navbar.firstChild);
    }
  }

  // Inicializar tooltips de Bootstrap
  const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
  tooltipTriggerList.map(el => new bootstrap.Tooltip(el));
}


// Llama esto antes de dejar avanzar al checkout. Si no hay sesión,
// redirige a login.html y recuerda a dónde volver.
function authRequerirParaComprar(destinoSiLogueado) {
  if (authEstaLogueado()) {
    window.location.href = destinoSiLogueado;
    return;
  }
  window.location.href = 'login.html?redirect=' + encodeURIComponent(destinoSiLogueado);
}

// Verifica que el access token siga siendo válido antes de una acción
// sensible (como confirmar una compra). Si está vencido o a punto de
// vencer, lo renueva en silencio usando el refresh token.
// Devuelve true si hay una sesión válida lista para usar, false si no
// (y ya se encargó de cerrar la sesión / redirigir si corresponde).
async function authAsegurarTokenValido() {
  const sesion = authLeer();
  if (!sesion?.token) return false;
  if (authRenovacionEnCurso) return authRenovacionEnCurso;

  let expiraEn = Number(sesion.expiraEn) || 0;
  if (!expiraEn) {
    try {
      const payload = sesion.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      expiraEn = Number(JSON.parse(atob(payload)).exp) * 1000;
    } catch {
      expiraEn = 0;
    }
  }

  const margenMs = 60 * 1000;
  const vencidoOPorVencer = !expiraEn || (expiraEn - Date.now()) < margenMs;

  if (!vencidoOPorVencer) return true;

  if (!sesion.refreshToken) {
    localStorage.removeItem(AUTH_KEY);
    authRenderNavbar();
    return false;
  }

  authRenovacionEnCurso = (async () => {
    try {
      const resp = await fetch(API_BASE + '/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: sesion.refreshToken })
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(data.error || 'No se pudo renovar la sesión');

      authGuardar(data);
      return true;
    } catch (err) {
      console.error('[auth] Error renovando sesión:', err);
      localStorage.removeItem(AUTH_KEY);
      authRenderNavbar();
      return false;
    } finally {
      authRenovacionEnCurso = null;
    }
  })();
  return authRenovacionEnCurso;
}

document.addEventListener('DOMContentLoaded', authRenderNavbar);

function authEnsureChatbot() {
  if (document.getElementById('chatbot-toggle') || document.getElementById('chatbot-panel')) return;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = `
    <button id="chatbot-toggle" type="button" onclick="cbToggle()" title="Atención al cliente" aria-label="Abrir atención al cliente">💬</button>
    <section id="chatbot-panel" aria-label="Atención al cliente">
      <div class="cb-header"><span>Atención al cliente</span><button type="button" onclick="cbToggle()" aria-label="Cerrar">×</button></div>
      <div class="cb-body" id="cb-body"><div class="cb-msg bot">Hola. ¿En qué podemos ayudarte?</div></div>
      <div class="cb-quick cb-quick-start">
        <button type="button" data-q="¿Cuáles son los tiempos de entrega?">Tiempos de entrega</button>
        <button type="button" data-q="¿Qué métodos de pago aceptan?">Métodos de pago</button>
      </div>
      <div class="cb-input"><input type="text" id="cb-input-text" placeholder="Escribe tu mensaje..." aria-label="Mensaje"><button type="button" onclick="cbEnviar()">Enviar</button></div>
    </section>`;
  document.body.appendChild(wrapper);
  if (!document.querySelector('script[src$="js/chatbot.js"]')) {
    const script = document.createElement('script');
    script.src = 'js/chatbot.js';
    document.body.appendChild(script);
  }
}

document.addEventListener('DOMContentLoaded', authEnsureChatbot);
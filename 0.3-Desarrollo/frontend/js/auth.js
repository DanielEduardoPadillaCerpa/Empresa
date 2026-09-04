/* ============================================================
   Autenticación — prototipo front-end
   Guarda el JWT (access token) + refresh token en localStorage
   tras login/registro. Antes de cada compra, renueva el access
   token automáticamente si está por vencer, usando el refresh
   token — sin pedirle al usuario que vuelva a loguearse.
   ============================================================ */

// URL única del backend, compartida por todas las páginas (cart.js, index.html, etc.)
const API_BASE = 'http://localhost:8080';

const AUTH_KEY = 'si_auth';

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

  if (slot) {
    if (logueado) {
      slot.innerHTML = `
        <span class="small me-2" style="color:var(--paper-100);">👤 ${sesion.correo}</span>
        <button class="btn btn-sm" style="border:1px solid var(--brass-600); color:var(--brass-500); background:transparent;" onclick="authCerrarSesion()">Cerrar sesión</button>
      `;
    } else {
      slot.innerHTML = `
        <a href="login.html" class="btn btn-sm" style="border:1px solid var(--brass-600); color:var(--brass-500); background:transparent;">Iniciar sesión</a>
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

  const margenMs = 60 * 1000; // renueva si falta menos de 1 minuto para vencer
  const vencidoOPorVencer = !sesion.expiraEn || (sesion.expiraEn - Date.now()) < margenMs;

  if (!vencidoOPorVencer) return true;

  if (!sesion.refreshToken) {
    authCerrarSesion();
    return false;
  }

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
    authCerrarSesion();
    return false;
  }
}

document.addEventListener('DOMContentLoaded', authRenderNavbar);
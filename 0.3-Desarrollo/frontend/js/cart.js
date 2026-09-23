/* ============================================================
   Carrito de compras — persistencia en localStorage.
   El checkout final (confirmarCompra) SÍ envía el pedido al backend
   vía POST /api/pedidos, para que quede guardado en la base de datos.
   ============================================================ */

const CARRITO_KEY = 'si_carrito';

function carritoLeer() {
  try {
    const items = JSON.parse(localStorage.getItem(CARRITO_KEY)) || [];
    return items.filter(i => i.id);
  } catch {
    return [];
  }
}

function formatoMoneda(valor) {
  const numero = Number(valor) || 0;
  return '$' + numero.toLocaleString('es-CO') + ' COP';
}

function carritoGuardar(items) {
  localStorage.setItem(CARRITO_KEY, JSON.stringify(Array.isArray(items) ? items : []));
  carritoActualizarBadge();
  carritoRenderPanel();
}

function carritoVaciar() {
  localStorage.removeItem(CARRITO_KEY);
  carritoActualizarBadge();
  carritoRenderPanel();
}

function agregarAlCarrito(boton) {
  const id = boton.dataset.id;
  const nombre = boton.dataset.nombre;
  const precio = parseInt(boton.dataset.precio, 10);
  const restringido = boton.dataset.restringido === 'true';

  const items = carritoLeer();
  const existente = items.find(i => i.id === id);
  if (existente) {
    existente.cantidad += 1;
  } else {
    items.push({ id, nombre, precio, restringido, cantidad: 1 });
  }
  carritoGuardar(items);

  const textoOriginal = boton.textContent;
  boton.textContent = 'Agregado ✓';
  boton.disabled = true;
  setTimeout(() => { boton.textContent = textoOriginal; boton.disabled = false; }, 900);
}

function quitarDelCarrito(id) {
  const items = carritoLeer().filter(i => i.id !== id);
  carritoGuardar(items);
  carritoRenderPanel();
}

function modificarCantidad(id, nuevaCantidad) {
  const cantidad = parseInt(nuevaCantidad, 10);
  if (!cantidad || cantidad < 1) return;
  const items = carritoLeer();
  const item = items.find(i => i.id === id);
  if (item) {
    item.cantidad = cantidad;
    carritoGuardar(items);
    carritoRenderPanel();
  }
}

function carritoTotal(items) {
  return items.reduce((sum, i) => sum + i.precio * i.cantidad, 0);
}

function carritoActualizarBadge() {
  const items = carritoLeer();
  const cantidad = items.reduce((sum, i) => sum + i.cantidad, 0);
  const badge = document.getElementById('carrito-badge');
  if (badge) {
    badge.textContent = cantidad;
    badge.style.display = cantidad > 0 ? 'inline-flex' : 'none';
  }
}

function carritoRenderPanel() {
  const cont = document.getElementById('carrito-items');
  if (!cont) return;

  const items = carritoLeer();
  const subtotal = carritoTotal(items);
  const cantidadTotal = items.reduce((sum, i) => sum + i.cantidad, 0);
  const t = (typeof textoI18n === 'function') ? textoI18n : (_clave, fallback) => fallback;

  const subtotalEl = document.getElementById('carrito-subtotal');
  const totalEl = document.getElementById('carrito-total');
  const cantidadEl = document.getElementById('carrito-cantidad-items');

  if (cantidadEl) cantidadEl.textContent = cantidadTotal;
  if (subtotalEl) subtotalEl.textContent = formatoMoneda(subtotal);
  if (totalEl) totalEl.textContent = formatoMoneda(subtotal);

  const avisoEl = document.getElementById('carrito-aviso-restringido');
  if (avisoEl) {
    const hayRestringido = items.some(i => i.restringido);
    avisoEl.style.display = hayRestringido ? 'block' : 'none';
  }

  if (!items.length) {
    cont.innerHTML = `
      <div class="text-center text-muted py-5">
        <div class="mb-2" style="font-size: 2rem;">🛒</div>
        <p class="mb-0 small">${t('cart_empty', 'Tu carrito está vacío.')}</p>
      </div>`;
    return;
  }

  cont.innerHTML = items.map(i => `
    <div class="d-flex align-items-start justify-content-between border-bottom py-3" style="gap: 12px;">
      <div class="flex-grow-1 min-width-0">
        <div class="d-flex justify-content-between align-items-start" style="gap: 12px;">
          <div class="fw-semibold" style="font-size: 15px; line-height: 1.3; color: #1c1c1c;">${i.nombre}</div>
          <button type="button" class="btn btn-link text-danger p-0 carrito-quitar-btn" data-id="${i.id}" style="font-size: 13px; text-decoration: none;">Quitar</button>
        </div>

        <div class="d-flex align-items-center mt-2" style="gap: 10px; flex-wrap: wrap;">
          <div class="d-flex align-items-center border rounded" style="background:#fff; overflow:hidden;">
            <button type="button" class="btn btn-link btn-sm px-2 py-1 text-dark carrito-cantidad-btn" data-id="${i.id}" data-accion="restar" style="text-decoration:none; font-size: 18px; line-height: 1;">−</button>
            <input type="number" min="1" value="${i.cantidad}" class="carrito-cantidad-input border-0 text-center" data-id="${i.id}" style="width: 52px; height: 32px; background: transparent; outline: none; font-size: 14px;">
            <button type="button" class="btn btn-link btn-sm px-2 py-1 text-dark carrito-cantidad-btn" data-id="${i.id}" data-accion="sumar" style="text-decoration:none; font-size: 18px; line-height: 1;">+</button>
          </div>
          <span class="small text-muted">× ${formatoMoneda(i.precio)}</span>
        </div>

        ${i.restringido ? `<div class="mt-2"><span class="badge rounded-pill bg-warning text-dark small">${t('cart_restricted_badge', 'Equipo restringido')}</span></div>` : ''}
      </div>

      <div class="fw-semibold text-end" style="min-width: 96px; font-size: 14px; color: #1d1d1d;">
        ${formatoMoneda(i.precio * i.cantidad)}
      </div>
    </div>
  `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  carritoActualizarBadge();
  const panel = document.getElementById('carritoOffcanvas');
  if (panel) panel.addEventListener('show.bs.offcanvas', carritoRenderPanel);

  const cont = document.getElementById('carrito-items');
  if (cont) {
    cont.addEventListener('click', (e) => {
      const quitar = e.target.closest('.carrito-quitar-btn');
      if (quitar) {
        quitarDelCarrito(quitar.dataset.id);
        return;
      }

      const accion = e.target.closest('.carrito-cantidad-btn');
      if (accion) {
        const item = carritoLeer().find(i => String(i.id) === String(accion.dataset.id));
        if (!item) return;
        const siguiente = accion.dataset.accion === 'sumar' ? item.cantidad + 1 : item.cantidad - 1;
        modificarCantidad(item.id, siguiente);
      }
    });

    cont.addEventListener('change', (e) => {
      const input = e.target.closest('.carrito-cantidad-input');
      if (input) modificarCantidad(input.dataset.id, input.value);
    });
  }
});

async function confirmarCompra() {
  // 1. Verificar (y renovar si hace falta) el access token
  const sesionValida = await authAsegurarTokenValido();
  if (!sesionValida) {
    window.location.href = 'login.html?redirect=checkout.html';
    return;
  }

  // 2. Verificar que el carrito no esté vacío
  const items = carritoLeer();
  if (!items.length) {
    const t = (typeof textoI18n === 'function') ? textoI18n : (_c, fb) => fb;
    alert(t('cart_empty_alert', 'Tu carrito está vacío. Agrega productos antes de continuar.'));
    return;
  }

  // 3. Redirigir a checkout.html para elegir dirección y método de pago
  window.location.href = 'checkout.html';
}
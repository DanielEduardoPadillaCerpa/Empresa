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

function carritoGuardar(items) {
  localStorage.setItem(CARRITO_KEY, JSON.stringify(items));
  carritoActualizarBadge();
}

function carritoVaciar() {
  carritoGuardar([]);
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
  const t = (typeof textoI18n === 'function') ? textoI18n : (_clave, fallback) => fallback;

  if (!items.length) {
    cont.innerHTML = `<p class="text-muted small p-3 mb-0">${t('cart_empty', 'Tu carrito está vacío.')}</p>`;
  } else {
    cont.innerHTML = items.map(i => `
      <div class="d-flex justify-content-between align-items-start border-bottom py-2 px-3">
        <div>
          <div class="small fw-semibold">${i.nombre}</div>
          <div class="small text-muted">
            <input type="number" min="1" value="${i.cantidad}" class="carrito-cantidad-input"
              data-id="${i.id}" style="width:56px">
            × $${i.precio.toLocaleString('es-CO')}
          </div>
          ${i.restringido ? `<span class="badge-clasif-mini">${t('cart_restricted_badge', 'Equipo restringido')}</span>` : ''}
        </div>
        <button type="button" class="btn btn-sm btn-link text-danger p-0 carrito-quitar-btn" data-id="${i.id}">${t('cart_remove', 'Quitar')}</button>
      </div>`).join('');
  }

  const totalEl = document.getElementById('carrito-total');
  if (totalEl) totalEl.textContent = '$' + carritoTotal(items).toLocaleString('es-CO');

  const avisoEl = document.getElementById('carrito-aviso-restringido');
  if (avisoEl) {
    const hayRestringido = items.some(i => i.restringido);
    avisoEl.style.display = hayRestringido ? 'block' : 'none';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  carritoActualizarBadge();
  const panel = document.getElementById('carritoOffcanvas');
  if (panel) panel.addEventListener('show.bs.offcanvas', carritoRenderPanel);

  const cont = document.getElementById('carrito-items');
  if (cont) {
    cont.addEventListener('click', (e) => {
      const btn = e.target.closest('.carrito-quitar-btn');
      if (btn) quitarDelCarrito(btn.dataset.id);
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
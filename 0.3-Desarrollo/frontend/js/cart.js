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
  const imagen = boton.dataset.imagen || '';

  const items = carritoLeer();
  const existente = items.find(i => i.id === id);
  if (existente) {
    existente.cantidad += 1;
  } else {
    items.push({ id, nombre, precio, restringido, imagen, cantidad: 1 });
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
  const total = subtotal;
  const t = (typeof textoI18n === 'function') ? textoI18n : (_clave, fallback) => fallback;

  const subtotalEl = document.getElementById('carrito-subtotal');
  const totalEl = document.getElementById('carrito-total');
  const cantidadEl = document.getElementById('carrito-cantidad-items');

  [cantidadEl, subtotalEl, totalEl].forEach(el => {
    if (el) el.removeAttribute('data-i18n');
  });
  if (cantidadEl) cantidadEl.textContent = cantidadTotal;
  if (subtotalEl) subtotalEl.textContent = formatoMoneda(subtotal);
  if (totalEl) totalEl.textContent = formatoMoneda(total);

  const avisoEl = document.getElementById('carrito-aviso-restringido');
  if (avisoEl) {
    const hayRestringido = items.some(i => i.restringido);
    avisoEl.style.display = hayRestringido ? 'block' : 'none';
  }

  if (!items.length) {
    cont.innerHTML = `
      <div class="carrito-vacio">
        <div>
          <div class="mb-2" style="font-size: 2rem;">🛒</div>
          <p class="mb-0 small">${t('cart_empty', 'Tu carrito está vacío.')}</p>
        </div>
      </div>`;
    return;
  }

  const itemMarkup = items.map(i => {
    const imagen = i.imagen || imgPlaceholderProducto(i.nombre, i.restringido ? 1 : 2);
    return `
      <article class="carrito-producto" data-id="${i.id}">
        <div class="carrito-producto__thumb">
          <img src="${imagen}" alt="${i.nombre}">
        </div>

        <div class="carrito-producto__info">
          <h3 class="carrito-producto__title">${i.nombre}</h3>
          <p class="carrito-producto__desc">${i.restringido ? 'Equipo restringido /' : 'Producto institucional /'} ${i.nombre}</p>

          <div class="carrito-producto__meta">
            <div class="carrito-cantidad-control">
              <button type="button" class="carrito-cantidad-btn" data-id="${i.id}" data-accion="restar" aria-label="Disminuir cantidad">−</button>
              <input type="number" min="1" value="${i.cantidad}" class="carrito-cantidad-input" data-id="${i.id}" aria-label="Cantidad de producto">
              <button type="button" class="carrito-cantidad-btn" data-id="${i.id}" data-accion="sumar" aria-label="Aumentar cantidad">+</button>
            </div>
          </div>
        </div>

        <div>
          <div class="carrito-producto__price">${formatoMoneda(i.precio * i.cantidad)}</div>
          <button type="button" class="carrito-producto__remove carrito-quitar-btn" data-id="${i.id}">Eliminar</button>
        </div>
      </article>
    `;
  }).join('');

  cont.innerHTML = `
    <div class="carrito-header" style="display:flex; justify-content:space-between; align-items:center; margin:0 0 20px; padding: 0 4px;">
      <h2 style="margin:0; font-size: 1.05rem; font-weight:700; letter-spacing:-.02em; color:#1e2a39;">Carrito de Compras <span style="font-weight:600; color:#5c6877;">(${cantidadTotal} ${cantidadTotal === 1 ? 'producto' : 'productos'})</span></h2>
      <button type="button" class="btn btn-outline-dark btn-sm" onclick="carritoVaciar()">Vaciar Carrito</button>
    </div>
    ${itemMarkup}
  `;
}

document.addEventListener('DOMContentLoaded', () => {
  // Leer primero localStorage y actualizar el badge antes de enlazar controles.
  // Ninguna inicialización de UI debe reemplazar el estado persistido.
  carritoActualizarBadge();
  carritoRenderPanel();
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
    mostrarNotificacion(t('cart_empty_alert', 'Tu carrito está vacío. Agrega productos antes de continuar.'), 'info');
    return;
  }

  // 3. Redirigir a checkout.html para elegir dirección y método de pago
  window.location.href = 'checkout.html';
}
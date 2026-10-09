(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CheckoutAutofill = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  function mostrarEstado(elemento, mensaje, tipo = 'info') {
    elemento.replaceChildren();
    elemento.className = `alert alert-${tipo} small mb-3`;
    elemento.textContent = mensaje;
    elemento.style.display = 'block';
  }

  function marcarDesdePerfil(input) {
    const label = document.querySelector(`label[for="${input.id}"]`);
    if (!label || label.querySelector('[data-profile-marker]')) return;
    const marca = document.createElement('span');
    marca.dataset.profileMarker = 'true';
    marca.className = 'badge text-bg-light border ms-2';
    marca.textContent = 'Desde tu perfil';
    label.appendChild(marca);
  }

  function rellenarSiVacio(id, valor) {
    const input = document.getElementById(id);
    if (!input || input.value.trim() || typeof valor !== 'string' || !valor.trim()) return false;
    input.value = valor;
    marcarDesdePerfil(input);
    return true;
  }

  function faltantesParaCheckout(cliente, tipo) {
    const faltantes = [];
    if (tipo === 'empresa') {
      if (!cliente.razonSocial) faltantes.push('razón social');
      if (!cliente.documento || cliente.tipoDocumento !== 'NIT') faltantes.push('NIT de la empresa');
      if (!cliente.nombre) faltantes.push('nombre del comprador autorizado');
    } else {
      if (!cliente.nombre) faltantes.push('nombre completo');
      if (!cliente.documento || cliente.tipoDocumento !== 'CC') faltantes.push('cédula de ciudadanía');
    }
    if (!cliente.telefono) faltantes.push('teléfono');
    if (!cliente.correo) faltantes.push('correo');
    if (!cliente.direccionEntrega) faltantes.push('dirección de envío');
    return faltantes;
  }

  async function inicializar({
    apiBase,
    token,
    estado,
    seleccionarTipoComprador,
    seleccionarDireccionGuardada
  }) {
    if (!token) {
      mostrarEstado(estado, 'No hay una sesión activa. Inicia sesión para cargar los datos guardados; puedes continuar usando el formulario.', 'warning');
      return null;
    }

    try {
      const response = await fetch(`${apiBase.replace(/\/$/, '')}/api/checkout/perfil`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store'
      });
      const resultado = await response.json().catch(() => ({}));
      if (response.status === 401) {
        mostrarEstado(estado, 'Tu sesión no está disponible. Puedes continuar con el formulario o iniciar sesión nuevamente.');
        return null;
      }
      if (!response.ok) {
        mostrarEstado(estado, resultado.error || 'No se pudieron cargar los datos guardados. El formulario sigue disponible.', 'warning');
        return null;
      }

      const cliente = resultado.cliente || {};
      const esEmpresa = Boolean(cliente.razonSocial && cliente.tipoDocumento === 'NIT' && cliente.documento);
      if (esEmpresa) seleccionarTipoComprador('empresa');

      rellenarSiVacio('nombreCompletoNat', cliente.nombre);
      rellenarSiVacio('empresaComprador', cliente.nombre);
      rellenarSiVacio('empresaRazonSocial', cliente.razonSocial);
      rellenarSiVacio('empresaNit', cliente.tipoDocumento === 'NIT' ? cliente.documento : '');
      rellenarSiVacio('rutNitNat', cliente.tipoDocumento === 'CC' ? cliente.documento : '');
      rellenarSiVacio('telefonoContactoNat', cliente.telefono);
      rellenarSiVacio('empresaTelefono', cliente.telefono);
      rellenarSiVacio('checkoutCorreo', cliente.correo);

      const direccion = (resultado.direcciones || []).find(item =>
        String(item.id) === String(resultado.predeterminadaId)
      );
      const direccionBox = document.getElementById('checkout-direccion-guardada');
      if (direccion && typeof direccion.direccion === 'string' && direccion.direccion.trim()) {
        document.getElementById('checkout-direccion-guardada-texto').textContent = direccion.direccion;
        direccionBox.style.display = 'block';
        const botonDireccion = document.getElementById('checkout-usar-direccion-guardada');
        botonDireccion.textContent = 'Dirección seleccionada';
        seleccionarDireccionGuardada(direccion.direccion);
        botonDireccion.addEventListener('click', () => {
          seleccionarDireccionGuardada(direccion.direccion);
          botonDireccion.textContent = 'Dirección seleccionada';
        });
      }

      const faltantes = faltantesParaCheckout(cliente, esEmpresa ? 'empresa' : 'natural');
      if (!faltantes.length) {
        mostrarEstado(estado, 'Cargamos los datos disponibles de tu perfil. Revísalos y edítalos si lo necesitas.', 'success');
      } else {
        mostrarEstado(
          estado,
          `Completa estos ${faltantes.length} datos para continuar: ${faltantes.join(', ')}. Los campos no guardados se dejan vacíos.`,
          'warning'
        );
      }
      return resultado;
    } catch {
      mostrarEstado(estado, 'No se pudieron cargar los datos guardados. El formulario sigue disponible para que los ingreses manualmente.', 'warning');
      return null;
    }
  }

  return { inicializar, faltantesParaCheckout };
});

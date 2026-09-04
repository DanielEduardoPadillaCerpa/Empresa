window.addEventListener('DOMContentLoaded', () => {
  const navRegistro = document.getElementById('navRegistro');
  const authSlot = document.getElementById('auth-nav-slot');
  const logeado = localStorage.getItem('logeado');

  if (logeado === 'true') {
    if (navRegistro) navRegistro.style.display = 'none';
    if (authSlot) {
      authSlot.innerHTML = `
        <button class="btn btn-sm btn-danger" id="logoutBtn">Cerrar sesión</button>
      `;
      document.getElementById('logoutBtn').addEventListener('click', () => {
        localStorage.removeItem('logeado');
        window.location.href = 'login.html';
      });
    }
  } else {
    if (navRegistro) navRegistro.style.display = 'block';
    if (authSlot) {
      authSlot.innerHTML = `
        <a class="nav-link" href="login.html">Iniciar sesión</a>
      `;
    }
  }
});

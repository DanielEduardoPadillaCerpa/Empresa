/* navbar.js — delegates to auth.js if available.
   auth.js already handles the navbar rendering via authRenderNavbar().
   This file exists for backward compatibility on pages that still reference it. */
window.addEventListener('DOMContentLoaded', () => {
  if (typeof authRenderNavbar === 'function') {
    authRenderNavbar();
  }
});

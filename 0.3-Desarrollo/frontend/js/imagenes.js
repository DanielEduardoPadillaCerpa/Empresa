/* ============================================================
   Imágenes de producto
   Si el producto tiene una URL real en `imagen`, se usa esa.
   Si no, se genera una imagen de respaldo (SVG) determinística
   por categoría, para que el catálogo nunca se vea con huecos
   ni con el emoji de placeholder anterior. El admin puede subir
   una foto real en cualquier momento desde admin-productos.html
   (campo "Imagen (URL)") y esa reemplaza la generada.
   ============================================================ */

const IMG_PALETA_CATEGORIA = [
  '#0b2340', '#8a5a2b', '#3f6f76', '#5c4a72',
  '#6b3f3f', '#3f5c3f', '#4a4a72', '#7a5230',
];

function imgColorParaCategoria(categoriaId) {
  const n = Number(categoriaId) || 0;
  return IMG_PALETA_CATEGORIA[n % IMG_PALETA_CATEGORIA.length];
}

function imgInicialesProducto(nombre) {
  if (!nombre) return '?';
  const palabras = nombre.trim().split(/\s+/).slice(0, 2);
  return palabras.map(p => p[0]?.toUpperCase() || '').join('');
}

// Genera una imagen SVG (como data URI) con el color de la categoría y las
// iniciales del nombre del producto — sirve como imagen de respaldo cuando
// no hay una foto real cargada en el campo `imagen`.
function imgPlaceholderProducto(nombre, categoriaId) {
  const color = imgColorParaCategoria(categoriaId);
  const iniciales = imgInicialesProducto(nombre);
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${color}"/>
          <stop offset="100%" stop-color="#00000022"/>
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill="${color}"/>
      <rect width="400" height="300" fill="url(#g)"/>
      <circle cx="200" cy="140" r="58" fill="#ffffff22"/>
      <text x="200" y="158" font-family="Inter, Arial, sans-serif" font-size="46"
            font-weight="600" fill="#f4f1ea" text-anchor="middle">${iniciales}</text>
      <text x="200" y="255" font-family="Inter, Arial, sans-serif" font-size="15"
            fill="#f4f1eacc" text-anchor="middle">Suministros Institucionales</text>
    </svg>`.trim();
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

// Devuelve la URL a usar en <img src>: la imagen real del producto si existe,
// o la generada de respaldo si no. Si la imagen es una ruta relativa (ej: /img/...),
// se concatena con la URL base de la API backend (API_BASE).
function imgProducto(producto) {
  if (producto && producto.imagen) {
    if (producto.imagen.startsWith('http://') || producto.imagen.startsWith('https://') || producto.imagen.startsWith('data:')) {
      return producto.imagen;
    }
    const base = (typeof API_BASE !== 'undefined' ? API_BASE : 'http://localhost:8080').replace(/\/$/, '');
    const ruta = producto.imagen.startsWith('/') ? producto.imagen : '/' + producto.imagen;
    return base + ruta;
  }
  return imgPlaceholderProducto(producto?.nombre, producto?.categoria_id);
}

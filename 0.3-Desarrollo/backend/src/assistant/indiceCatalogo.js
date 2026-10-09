const { pool } = require('../db');
const { normalizarTexto, tokens } = require('./normalizador');

const INTERVALO_REFRESH_MS = 60 * 1000;
const sinonimos = require('./sinonimos.json');

let indice = { productos: [], categorias: [], faq: [], actualizadoEn: 0 };
let refrescoEnCurso;
let timer;

function parsearMetadatos(valor) {
  if (!valor) return {};
  if (typeof valor === 'object') {
    if (Array.isArray(valor)) throw new Error('CATALOG_METADATA_INVALID');
    return valor;
  }
  try {
    const parseado = JSON.parse(valor);
    if (!parseado || typeof parseado !== 'object' || Array.isArray(parseado)) {
      throw new Error('CATALOG_METADATA_INVALID');
    }
    return parseado;
  } catch {
    throw new Error('CATALOG_METADATA_INVALID');
  }
}

function precioEnCentavos(valor) {
  const texto = String(valor ?? '').trim();
  const coincidencia = texto.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!coincidencia) throw new Error('CATALOG_PRICE_INVALID');
  return BigInt(coincidencia[1]) * 100n +
    BigInt((coincidencia[2] || '').padEnd(2, '0') || '0');
}

function stockEntero(valor) {
  const stock = Number(valor);
  if (!Number.isSafeInteger(stock) || stock < 0) throw new Error('CATALOG_STOCK_INVALID');
  return stock;
}

function restriccionBooleano(valor) {
  if (valor === true || valor === 1 || valor === '1') return true;
  if (valor === false || valor === 0 || valor === '0') return false;
  throw new Error('CATALOG_RESTRICTION_INVALID');
}

function mapearProducto(fila) {
  const metadatos = parsearMetadatos(fila.metadatos);
  const id = Number(fila.id);
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('CATALOG_PRODUCT_ID_INVALID');
  return {
    id,
    nombre: String(fila.nombre || ''),
    descripcion: String(fila.descripcion || ''),
    precioCentavos: precioEnCentavos(fila.precio),
    stock: stockEntero(fila.cantidad_disponible),
    estado: String(fila.estado || ''),
    restringido: restriccionBooleano(fila.restringido),
    categoriaId: fila.categoria_id == null ? null : Number(fila.categoria_id),
    categoria: String(fila.categoria || ''),
    macrocategoria: String(fila.macrocategoria || ''),
    metadatos,
    imagen: String(fila.imagen || ''),
    url: `producto-detalle.html?id=${encodeURIComponent(fila.id)}`,
    indiceNombre: tokens(fila.nombre).join(' '),
    indiceCategoria: tokens(fila.categoria || '').join(' '),
    indiceDescripcion: tokens(fila.descripcion || '').join(' '),
    indiceMetadatos: tokens(JSON.stringify(metadatos)).join(' ')
  };
}

async function refrescarIndice({ poolBD = pool } = {}) {
  if (refrescoEnCurso) return refrescoEnCurso;
  refrescoEnCurso = (async () => {
    const [productos] = await poolBD.query(
      `SELECT p.id, p.nombre, p.descripcion, p.precio, p.imagen,
              p.cantidad_disponible, p.estado, p.restringido, p.categoria_id,
              p.macrocategoria, p.metadatos, c.nombre AS categoria
       FROM productos p
       LEFT JOIN categorias c ON c.id = p.categoria_id
       WHERE p.estado = 'activo'
       ORDER BY p.id`
    );
    const [filasFaq] = await poolBD.query(
      `SELECT id, palabras_clave, pregunta, respuesta
       FROM faq_asistente WHERE activo = TRUE ORDER BY id`
    );
    const faq = filasFaq
      .filter(fila => typeof fila.respuesta === 'string' &&
        fila.respuesta.trim() && !/\[COMPLETAR\b/i.test(fila.respuesta))
      .map(fila => ({
        id: Number(fila.id),
        palabrasClave: String(fila.palabras_clave || ''),
        pregunta: String(fila.pregunta || ''),
        respuesta: String(fila.respuesta)
      }));

    indice = {
      productos: productos.map(mapearProducto),
      categorias: [...new Set(productos.map(producto => producto.categoria).filter(Boolean))],
      faq,
      actualizadoEn: Date.now()
    };
    return indice;
  })();

  try {
    return await refrescoEnCurso;
  } finally {
    refrescoEnCurso = undefined;
  }
}

async function obtenerIndice({ poolBD = pool, ahora = Date.now() } = {}) {
  if (!indice.actualizadoEn || ahora - indice.actualizadoEn >= INTERVALO_REFRESH_MS) {
    return refrescarIndice({ poolBD });
  }
  return indice;
}

function invalidarIndiceCatalogo() {
  indice = { ...indice, actualizadoEn: 0 };
}

function iniciarRefrescoIndice() {
  if (timer) return;
  const refrescar = () => {
    refrescarIndice().catch(error => {
      console.error('[assistant] No se pudo refrescar el catálogo:', error.code || 'CATALOG_REFRESH_FAILED');
    });
  };
  refrescar();
  timer = setInterval(refrescar, INTERVALO_REFRESH_MS);
  if (typeof timer.unref === 'function') timer.unref();
}

function expandirSinonimos(listaTokens) {
  const salida = new Set(listaTokens);
  for (const token of listaTokens) {
    for (const [clave, valores] of Object.entries(sinonimos)) {
      const normalClave = tokens(clave, { incluirStopwords: true })[0];
      const normalValores = valores.flatMap(valor => tokens(valor, { incluirStopwords: true }));
      if (token === normalClave || normalValores.includes(token)) {
        salida.add(normalClave);
        for (const valor of normalValores) salida.add(valor);
      }
    }
  }
  return [...salida];
}

function obtenerSnapshot() {
  return indice;
}

module.exports = {
  INTERVALO_REFRESH_MS,
  obtenerIndice,
  refrescarIndice,
  invalidarIndiceCatalogo,
  iniciarRefrescoIndice,
  expandirSinonimos,
  obtenerSnapshot,
  mapearProducto,
  precioEnCentavos,
  stockEntero,
  restriccionBooleano,
  normalizarTexto
};

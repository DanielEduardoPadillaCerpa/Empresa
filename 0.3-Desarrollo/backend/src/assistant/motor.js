const { tokens, normalizarTexto, distanciaLevenshtein } = require('./normalizador');
const { expandirSinonimos } = require('./indiceCatalogo');

const UMBRAL_CONFIANZA = 7;
const stockMinimoConfigurado = Number(process.env.STOCK_MINIMO || 5);
if (!Number.isSafeInteger(stockMinimoConfigurado) || stockMinimoConfigurado < 0) {
  throw new Error('STOCK_MINIMO debe ser un entero no negativo.');
}
const STOCK_MINIMO = Math.max(1, stockMinimoConfigurado);

function formatearPrecioCentavos(centavos) {
  const pesos = BigInt(centavos) / 100n;
  const centavosRestantes = String(BigInt(centavos) % 100n).padStart(2, '0');
  return `$${pesos.toLocaleString('es-CO')}${centavosRestantes === '00' ? '' : `,${centavosRestantes}`} COP`;
}

function estadoDisponibilidad(stock) {
  if (stock < 1) return 'agotado';
  if (stock <= STOCK_MINIMO) return 'pocas unidades';
  return 'disponible';
}

function extraerFiltroPrecio(texto) {
  const normal = normalizarTexto(texto);
  const expresion = /(menos de|hasta|por debajo de|inferior a|maximo)?\s*\$?\s*(\d+(?:[.,]\d+)*)\s*(millones?|millon|mil|k)?/;
  const coincidencia = normal.match(expresion);
  if (!coincidencia) return null;
  const [, operador = '', cantidadTexto, escala = ''] = coincidencia;
  let cantidadNormalizada = cantidadTexto;
  if (cantidadTexto.includes('.') && cantidadTexto.includes(',')) {
    cantidadNormalizada = cantidadTexto.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(cantidadTexto)) {
    cantidadNormalizada = cantidadTexto.replace(/\./g, '');
  } else if (cantidadTexto.includes(',')) {
    cantidadNormalizada = cantidadTexto.replace(',', '.');
  }
  const cantidad = Number(cantidadNormalizada);
  if (!Number.isFinite(cantidad) || cantidad <= 0) return null;
  const multiplicador = /^mill/.test(escala) ? 1_000_000 : /^(mil|k)$/.test(escala) ? 1_000 : 1;
  const valorPesos = Math.round(cantidad * multiplicador);
  if (!Number.isSafeInteger(valorPesos)) return null;
  if (!operador.trim() && !escala && valorPesos < 1000 && !normal.includes('$')) return null;
  return {
    maxCentavos: BigInt(valorPesos) * 100n,
    inclusivo: /hasta|maximo|máximo/.test(operador)
  };
}

function clasificarIntencion(texto) {
  const normal = normalizarTexto(texto);
  const palabras = tokens(texto, { incluirStopwords: true });
  if (/\b(hola|buenos dias|buenas tardes|buenas noches|que tal)\b/.test(normal)) return 'saludo';
  if (/\b(clima|receta|recetas|chiste|chistes|futbol|noticias|musica|pelicula|peliculas)\b/.test(normal)) return 'fuera_tema';
  if (/\b(gracias|muchas gracias|te agradezco)\b/.test(normal)) return 'agradecimiento';
  if (/\b(humano|persona|asesor|asesora|agente)\b/.test(normal) &&
      /\b(hablar|contactar|comunicar|ayuda|ayudar|quiero|necesito|conectar)\b/.test(normal)) return 'humano';
  if (/\b(estado|seguimiento)\b/.test(normal) && /\b(pedido|compra|orden)\b/.test(normal)) return 'estado_pedido';
  if (/\b(comprar|compra|pagar|pago|checkout|carrito)\b/.test(normal) &&
      !/\b(precio|cuesta|disponible|stock)\b/.test(normal)) return 'como_comprar';
  if (/\b(restringido|restringida|autorizacion|autorizacion|autorizado|permiso|regulado)\b/.test(normal)) return 'restringidos';
  if (/\b(comparar|compara|versus|vs)\b/.test(normal)) return 'comparar';
  if (/\b(talla|tallas|medida|medidas|variacion|variaciones)\b/.test(normal)) return 'tallas';
  if (/\b(categoria|categorias|lista|listar|muestrame|ver)\b/.test(normal) && palabras.length <= 5) return 'categoria';
  if (/\b(garantia|garantias|envio|envios|devolucion|devoluciones|horario|horarios|politica|politicas)\b/.test(normal)) return 'faq';
  if (/\b(precio|precios|cuesta|cuestan|vale|valen|valor|cuanto)\b/.test(normal)) return 'precio';
  if (/\b(disponible|disponibilidad|stock|inventario|unidades|agotado|agotada)\b/.test(normal)) return 'disponibilidad';
  if (/\b(recomienda|recomendar|recomendacion|sugiere|sugerir|sirve para|necesito para|busco para)\b/.test(normal)) return 'recomendar';
  if (/\b(productos|catalogo|venden|tienen|busco|necesito|busqueda)\b/.test(normal)) return 'buscar';
  return 'buscar';
}

function puntuarTokenConsulta(token, campoTokens) {
  if (campoTokens.includes(token)) return 1;
  if (token.length < 5) return 0;
  return campoTokens.some(candidato => distanciaLevenshtein(token, candidato, 1) <= 1) ? 0.65 : 0;
}

function puntuarProducto(producto, consultaTokens) {
  const campos = [
    [producto.indiceNombre, 8],
    [producto.indiceCategoria, 5],
    [producto.indiceDescripcion, 2],
    [producto.indiceMetadatos, 1]
  ];
  let puntaje = 0;
  for (const token of consultaTokens) {
    for (const [campo, peso] of campos) {
      const coincidencia = puntuarTokenConsulta(token, campo.split(' ').filter(Boolean));
      if (coincidencia) {
        puntaje += coincidencia * peso;
        break;
      }
    }
  }
  return puntaje;
}

function buscarProductos(catalogo, texto, { limite = 12, contexto = null, filtros = {} } = {}) {
  const filtroPrecio = Number.isSafeInteger(filtros.maximoPrecioPesos) && filtros.maximoPrecioPesos > 0
    ? { maxCentavos: BigInt(filtros.maximoPrecioPesos) * 100n, inclusivo: true }
    : extraerFiltroPrecio(texto);
  let consultaTokens = tokens(texto).filter(token =>
    !/^\d+$/.test(token) &&
    !/^(?:mil|k|millon|millone|hasta|menos|inferior|maximo|debajo|precio|precios|producto|productos)$/.test(token)
  );
  if (!consultaTokens.length && contexto?.ultimoProductoId) {
    const producto = catalogo.productos.find(item => item.id === contexto.ultimoProductoId);
    if (producto) consultaTokens = tokens(producto.nombre);
  }
  consultaTokens = expandirSinonimos(consultaTokens);
  if (!consultaTokens.length && contexto?.ultimaCategoria) {
    consultaTokens = tokens(contexto.ultimaCategoria);
  }

  let candidatos = catalogo.productos
    .map(producto => ({
      producto,
      puntaje: consultaTokens.length
        ? puntuarProducto(producto, consultaTokens)
        : (filtroPrecio || filtros.categoria || filtros.restringido ? 1 : 0)
    }))
    .filter(resultado => resultado.puntaje > 0);

  if (filtroPrecio) {
    candidatos = candidatos.filter(({ producto }) => filtroPrecio.inclusivo
      ? producto.precioCentavos <= filtroPrecio.maxCentavos
      : producto.precioCentavos < filtroPrecio.maxCentavos);
    candidatos = candidatos.map(resultado => ({
      ...resultado,
      puntaje: resultado.puntaje + 1
    }));
  }
  if (typeof filtros.categoria === 'string' && filtros.categoria.trim()) {
    const categoria = normalizarTexto(filtros.categoria);
    candidatos = candidatos.filter(({ producto }) =>
      normalizarTexto(producto.categoria).includes(categoria) ||
      categoria.includes(normalizarTexto(producto.categoria))
    );
  }
  if (filtros.restringido === true) {
    candidatos = candidatos.filter(({ producto }) => producto.restringido);
  }
  return candidatos.sort((a, b) => b.puntaje - a.puntaje || a.producto.id - b.producto.id)
    .slice(0, limite)
    .map(resultado => resultado.producto);
}

function puntuarFaq(faq, consultaTokens) {
  const campos = tokens(`${faq.palabrasClave} ${faq.pregunta}`);
  return consultaTokens.reduce((puntaje, token) => puntaje + puntuarTokenConsulta(token, campos) * 2, 0);
}

function buscarFaq(catalogo, texto) {
  const consultaTokens = expandirSinonimos(tokens(texto));
  if (!consultaTokens.length) return null;
  const resultados = catalogo.faq
    .map(faq => ({ faq, puntaje: puntuarFaq(faq, consultaTokens) }))
    .sort((a, b) => b.puntaje - a.puntaje);
  return resultados[0]?.puntaje >= 4 ? resultados[0].faq : null;
}

function extraerTallas(producto) {
  const datos = producto.metadatos || {};
  const tallas = datos.tallas || datos.tallas_disponibles || datos.variaciones?.tallas;
  if (Array.isArray(tallas)) {
    return tallas.map(talla => typeof talla === 'string' ? talla : talla.nombre || talla.talla).filter(Boolean);
  }
  const descripcion = `${producto.nombre} ${producto.descripcion}`;
  const coincidencia = descripcion.match(/\b(?:tallas?|talla(?:s)? disponibles?)\s*(?:de\s*)?([0-9]{1,2}\s*(?:a|[-–])\s*[0-9]{1,2}|S\s*(?:a|[-–])\s*XXL)\b/i);
  return coincidencia ? [coincidencia[1].replace(/\s+/g, '')] : [];
}

function construirTarjeta(producto) {
  return {
    id: producto.id,
    nombre: producto.nombre,
    precio: `${producto.precioCentavos / 100n}.${String(producto.precioCentavos % 100n).padStart(2, '0')}`,
    moneda: 'COP',
    disponibilidad: estadoDisponibilidad(producto.stock),
    restringido: producto.restringido,
    imagen: producto.imagen,
    url: producto.url
  };
}

function lineaProducto(producto) {
  const requisito = producto.restringido ? ' Requiere autorización registrada del cliente.' : '';
  return `${producto.nombre}: ${formatearPrecioCentavos(producto.precioCentavos)}; ${estadoDisponibilidad(producto.stock)} (${producto.stock} unidades).${requisito}`;
}

function obtenerAlternativas(catalogo, consultaTokens, excluidos = new Set()) {
  const alternativas = catalogo.productos
    .filter(producto => !excluidos.has(producto.id))
    .map(producto => ({ producto, puntaje: puntuarProducto(producto, consultaTokens) }))
    .sort((a, b) => b.puntaje - a.puntaje || a.producto.id - b.producto.id)
    .filter(resultado => resultado.puntaje > 0)
    .slice(0, 3)
    .map(resultado => resultado.producto);
  if (alternativas.length < 3) {
    for (const producto of catalogo.productos) {
      if (!excluidos.has(producto.id) && !alternativas.some(item => item.id === producto.id)) {
        alternativas.push(producto);
      }
      if (alternativas.length === 3) break;
    }
  }
  return alternativas.slice(0, 3);
}

function respuestaSinResultado(catalogo, texto) {
  const consultaTokens = expandirSinonimos(tokens(texto));
  const alternativas = obtenerAlternativas(catalogo, consultaTokens);
  const lista = alternativas.map((producto, indice) => `${indice + 1}. ${lineaProducto(producto)}`).join('\n');
  const cantidadAlternativas = alternativas.length;
  const descripcionAlternativas = cantidadAlternativas
    ? ` Puedes explorar estas ${cantidadAlternativas} alternativa${cantidadAlternativas === 1 ? '' : 's'} del catálogo:\n${lista}`
    : '';
  return crearResultado(
    `No lo encuentro en el catálogo.${descripcionAlternativas}\nSi necesitas más ayuda, puedes pedir hablar con una persona.`,
    alternativas,
    ['Hablar con una persona', 'Buscar otro producto'],
    { origen: cantidadAlternativas ? 'catalogo' : 'ninguno' }
  );
}

function respuestaAclaratoria(catalogo, texto) {
  const alternativas = obtenerAlternativas(catalogo, expandirSinonimos(tokens(texto)));
  const lista = alternativas.map((producto, indice) => `${indice + 1}. ${lineaProducto(producto)}`).join('\n');
  if (!alternativas.length) return respuestaSinResultado(catalogo, texto);
  return crearResultado(
    `No estoy seguro de cuál producto buscas. ¿Te refieres a una de estas opciones del catálogo?\n${lista}`,
    alternativas,
    [...alternativas.map(producto => producto.nombre), 'Hablar con una persona'],
    { origen: 'catalogo' }
  );
}

function crearResultado(respuesta, productos = [], sugerencias = [], opciones = {}) {
  return {
    respuesta,
    tarjetas: productos.map(construirTarjeta),
    sugerencias,
    escalar: Boolean(opciones.escalar),
    origen: opciones.origen || (productos.length ? 'catalogo' : 'ninguno')
  };
}

function responder(catalogo, texto, opciones = {}) {
  const intencion = opciones.plan?.intent || clasificarIntencion(texto);
  const contexto = opciones.contexto || null;
  const sugerencias = ['Buscar un producto', 'Ver productos restringidos', 'Hablar con una persona'];

  if (intencion === 'saludo') {
    return crearResultado('Hola. Puedo ayudarte a buscar productos, consultar precios y disponibilidad del catálogo.', [], sugerencias);
  }
  if (intencion === 'agradecimiento') {
    return crearResultado('Con gusto. Si necesitas consultar otro producto, precio o disponibilidad, aquí estoy.', [], sugerencias);
  }
  if (intencion === 'fuera_tema') {
    return crearResultado('Puedo ayudarte únicamente con productos del catálogo, precios, disponibilidad y proceso de compra.', [], ['Buscar un producto', 'Ver productos restringidos']);
  }
  if (intencion === 'estado_pedido') {
    return crearResultado('Para consultar el estado de un pedido, inicia sesión con tu cuenta.', [], ['Hablar con una persona']);
  }
  if (intencion === 'humano') {
    return crearResultado('De acuerdo. Registraré tu solicitud para que una persona pueda atenderte sobre el catálogo.', [], [], {
      escalar: true
    });
  }
  if (intencion === 'como_comprar') {
    const faq = buscarFaq(catalogo, texto);
    if (faq) return crearResultado(faq.respuesta, [], sugerencias, { origen: 'faq' });
    return crearResultado('No tengo información confirmada sobre el proceso de compra o pago en las FAQ. Puedo derivar tu consulta a una persona.', [], ['Hablar con una persona'], { escalar: true });
  }
  if (intencion === 'faq') {
    const faq = buscarFaq(catalogo, texto);
    if (faq) return crearResultado(faq.respuesta, [], sugerencias, { origen: 'faq' });
    return crearResultado('No tengo esa política en las FAQ publicadas, así que no puedo confirmarla. Puedo derivar tu consulta a una persona.', [], ['Hablar con una persona'], { escalar: true });
  }

  if (intencion === 'restringidos') {
    const productos = catalogo.productos.filter(producto => producto.restringido).slice(0, 12);
    if (!productos.length) return respuestaSinResultado(catalogo, texto);
    return crearResultado(
      `En el catálogo encontré ${productos.length} productos restringidos en esta lista. Cada artículo marcado como restringido requiere autorización registrada del cliente:\n${productos.map(lineaProducto).join('\n')}`,
      productos,
      ['Consultar un producto restringido', 'Hablar con una persona']
    );
  }

  if (intencion === 'categoria') {
    const consultaCategoria = tokens(opciones.plan?.filtros?.categoria || texto);
    const categoria = catalogo.categorias
      .map(nombre => ({
        nombre,
        puntaje: tokens(nombre).reduce((total, token) =>
          total + (consultaCategoria.some(palabra =>
            palabra === token || (palabra.length > 4 && distanciaLevenshtein(palabra, token, 1) <= 1)
          ) ? 1 : 0), 0)
      }))
      .sort((a, b) => b.puntaje - a.puntaje)[0];
    if (categoria?.puntaje > 0) {
      const productos = catalogo.productos.filter(producto => producto.categoria === categoria.nombre).slice(0, 12);
      return crearResultado(
        `Productos de ${categoria.nombre} en el catálogo:\n${productos.map(lineaProducto).join('\n')}`,
        productos,
        sugerencias
      );
    }
  }

  if (intencion === 'comparar') {
    const partes = normalizarTexto(texto).split(/\b(?:vs|versus|comparar|compara)\b/);
    const izquierda = partes[0] || '';
    const derecha = partes[1] || '';
    const productoA = buscarProductos(catalogo, izquierda, { limite: 1, contexto })[0];
    const productoB = buscarProductos(catalogo, derecha, { limite: 1, contexto })[0];
    if (productoA && productoB && productoA.id !== productoB.id) {
      return crearResultado(
        `Comparación según los datos del catálogo:\n${lineaProducto(productoA)}\n${lineaProducto(productoB)}`,
        [productoA, productoB],
        sugerencias
      );
    }
    return crearResultado('¿Qué dos productos quieres comparar? Selecciona dos nombres del catálogo.', [], ['Ver productos del catálogo']);
  }

  if (intencion === 'categoria' && !catalogo.categorias.length) {
    return crearResultado('No encuentro categorías en el catálogo disponible.', [], ['Hablar con una persona']);
  }

  const filtros = opciones.plan?.filtros || {};
  const textoBusqueda = filtros.busqueda || texto;
  let productos = buscarProductos(catalogo, textoBusqueda, { limite: 12, contexto, filtros });
  const productoActualId = Number(opciones.productoActualId);
  if (!productos.length && Number.isSafeInteger(productoActualId)) {
    const productoActual = catalogo.productos.find(producto => producto.id === productoActualId);
    if (productoActual && /precio|cuesta|disponible|stock|talla|variacion/.test(normalizarTexto(texto))) {
      productos = [productoActual];
    }
  }

  if (!productos.length) {
    return respuestaSinResultado(catalogo, texto);
  }
  if (productos[0] &&
      puntuarProducto(productos[0], expandirSinonimos(tokens(textoBusqueda))) < UMBRAL_CONFIANZA &&
      !extraerFiltroPrecio(textoBusqueda) && !filtros.maximoPrecioPesos && !contexto?.ultimoProductoId) {
    return respuestaAclaratoria(catalogo, texto);
  }

  if (intencion === 'tallas') {
    const tallas = productos.flatMap(producto => {
      const valores = extraerTallas(producto);
      return valores.length ? [`${producto.nombre}: tallas registradas ${valores.join(', ')}.`] : [];
    });
    if (tallas.length) return crearResultado(tallas.join('\n'), productos.slice(0, 3), sugerencias);
    return crearResultado(
      `No encuentro tallas o variaciones registradas para ${productos[0].nombre}. Puedo mostrarte alternativas o derivar la consulta.`,
      productos.slice(0, 3),
      ['Ver alternativas', 'Hablar con una persona'],
      { escalar: true }
    );
  }

  if (intencion === 'precio') {
    const seleccionados = productos.slice(0, 3);
    return crearResultado(seleccionados.map(producto =>
      `${producto.nombre}: ${formatearPrecioCentavos(producto.precioCentavos)}.`
    ).join('\n'), seleccionados, sugerencias);
  }
  if (intencion === 'disponibilidad') {
    const seleccionados = productos.slice(0, 3);
    return crearResultado(seleccionados.map(producto =>
      `${producto.nombre}: ${estadoDisponibilidad(producto.stock)} (${producto.stock} unidades).`
    ).join('\n'), seleccionados, sugerencias);
  }

  const seleccionados = productos.slice(0, 5);
  if (intencion === 'recomendar') {
    return crearResultado(
      `Coincidencias del catálogo por nombre y descripción para tu búsqueda:\n${seleccionados.map(lineaProducto).join('\n')}`,
      seleccionados,
      sugerencias
    );
  }
  return crearResultado(
    `Coincidencias encontradas en el catálogo:\n${seleccionados.map(lineaProducto).join('\n')}`,
    seleccionados,
    sugerencias
  );
}

function verificarRespuesta(resultado, catalogo) {
  if (resultado.origen === 'faq') {
    return !resultado.tarjetas?.length &&
      catalogo.faq.some(faq => faq.respuesta === resultado.respuesta);
  }
  const porId = new Map(catalogo.productos.map(producto => [producto.id, producto]));
  for (const tarjeta of resultado.tarjetas || []) {
    const producto = porId.get(Number(tarjeta.id));
    if (!producto || tarjeta.nombre !== producto.nombre ||
        String(tarjeta.precio) !== `${producto.precioCentavos / 100n}.${String(producto.precioCentavos % 100n).padStart(2, '0')}` ||
        tarjeta.disponibilidad !== estadoDisponibilidad(producto.stock) ||
        Boolean(tarjeta.restringido) !== producto.restringido) return false;
  }

  const texto = String(resultado.respuesta || '');
  const productosMencionados = catalogo.productos.filter(producto =>
    normalizarTexto(texto).includes(normalizarTexto(producto.nombre))
  );
  const preciosCitados = [...texto.matchAll(/\$([\d.,]+)(?:\s*COP)?/gi)]
    .map(coincidencia => normalizarTexto(coincidencia[1]));
  const preciosCatalogo = new Set(catalogo.productos.map(producto =>
    normalizarTexto(formatearPrecioCentavos(producto.precioCentavos).replace(/^\$|\s*COP$/g, ''))
  ));
  if (preciosCitados.some(precio => !preciosCatalogo.has(precio))) return false;
  const unidadesCitadas = [...texto.matchAll(/\b(\d+)\s+unidades\b/gi)].map(coincidencia => coincidencia[1]);
  if (unidadesCitadas.length && productosMencionados.length === 0) return false;
  for (const linea of texto.split(/\r?\n/)) {
    if (!/:\s*(?:\$|tallas registradas|disponible|pocas unidades|agotado)/i.test(linea) &&
        !/\b\d+\s+unidades\b/i.test(linea)) continue;
    const prefijo = normalizarTexto(linea.split(':', 1)[0].replace(/^\d+\.\s*/, ''));
    const producto = catalogo.productos.find(item => normalizarTexto(item.nombre) === prefijo);
    if (!producto) return false;
    const precioLinea = linea.match(/\$([\d.,]+)(?:\s*COP)?/i);
    if (precioLinea && normalizarTexto(precioLinea[1]) !== normalizarTexto(
      formatearPrecioCentavos(producto.precioCentavos).replace(/^\$|\s*COP$/g, '')
    )) return false;
    const stockLinea = linea.match(/\b(\d+)\s+unidades\b/i);
    if (stockLinea && Number(stockLinea[1]) !== producto.stock) return false;
    const estadoLinea = normalizarTexto(linea);
    const estadosPosibles = ['disponible', 'pocas unidades', 'agotado'];
    if (estadosPosibles.some(estado => estadoLinea.includes(estado)) &&
        !estadoLinea.includes(estadoDisponibilidad(producto.stock))) return false;
  }
  for (const producto of productosMencionados) {
    if (preciosCitados.length && !preciosCitados.includes(normalizarTexto(
      formatearPrecioCentavos(producto.precioCentavos).replace(/^\$|\s*COP$/g, '')
    ))) return false;
    const contieneStock = new RegExp(`\\b${producto.stock}\\s+unidades\\b`, 'i').test(texto);
    if (/\bunidades\b/i.test(texto) && !contieneStock) return false;
    const lineaProducto = texto.split(/\r?\n/).find(linea =>
      normalizarTexto(linea).includes(normalizarTexto(producto.nombre))
    );
    if (normalizarTexto(lineaProducto || '').includes('requiere autorizacion registrada') && !producto.restringido) return false;
    if (lineaProducto && /tallas registradas/i.test(lineaProducto)) {
      const tallasDeclaradas = lineaProducto.split(/tallas registradas/i)[1]
        .replace(/[.]$/, '')
        .split(',')
        .map(talla => normalizarTexto(talla.trim()));
      const tallasRespaldadas = extraerTallas(producto).map(talla => normalizarTexto(talla));
      if (!tallasDeclaradas.every(talla => tallasRespaldadas.includes(talla))) return false;
    }
  }
  return true;
}

module.exports = {
  STOCK_MINIMO,
  estadoDisponibilidad,
  formatearPrecioCentavos,
  extraerFiltroPrecio,
  clasificarIntencion,
  buscarProductos,
  buscarFaq,
  construirTarjeta,
  responder,
  verificarRespuesta,
  extraerTallas,
  respuestaSinResultado,
  respuestaAclaratoria
};

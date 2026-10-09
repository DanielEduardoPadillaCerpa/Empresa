const STOPWORDS = new Set([
  'a', 'al', 'algo', 'algun', 'alguna', 'algunas', 'alguno', 'algunos', 'como',
  'con', 'cual', 'cuales', 'cuanto', 'cuanta', 'cuantos', 'cuantas', 'de', 'del',
  'desde', 'el', 'ella', 'ellas', 'ellos', 'en', 'es', 'esa', 'esas', 'ese',
  'eso', 'esos', 'esta', 'estas', 'este', 'esto', 'estos', 'favor', 'hay', 'la',
  'las', 'le', 'les', 'lo', 'los', 'mas', 'me', 'mi', 'mis', 'muy', 'necesito',
  'para', 'por', 'que', 'quiero', 'se', 'si', 'sin', 'su', 'sus', 'un', 'una',
  'unas', 'uno', 'unos', 'ver', 'y'
]);

function reducirPlural(palabra) {
  if (palabra.length > 5 && palabra.endsWith('es')) return palabra.slice(0, -2);
  if (palabra.length > 4 && palabra.endsWith('s')) return palabra.slice(0, -1);
  return palabra;
}

function normalizarTexto(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9$.,\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(texto, { incluirStopwords = false } = {}) {
  return normalizarTexto(texto)
    .split(/[\s.,$-]+/)
    .filter(Boolean)
    .map(reducirPlural)
    .filter(token => incluirStopwords || !STOPWORDS.has(token));
}

function distanciaLevenshtein(a, b, maximo = 2) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > maximo) return maximo + 1;
  let anterior = Array.from({ length: b.length + 1 }, (_, indice) => indice);
  for (let i = 1; i <= a.length; i += 1) {
    const actual = [i];
    let minimoFila = i;
    for (let j = 1; j <= b.length; j += 1) {
      actual[j] = Math.min(
        actual[j - 1] + 1,
        anterior[j] + 1,
        anterior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      minimoFila = Math.min(minimoFila, actual[j]);
    }
    if (minimoFila > maximo) return maximo + 1;
    anterior = actual;
  }
  return anterior[b.length];
}

module.exports = { normalizarTexto, tokens, distanciaLevenshtein };

// price-utils.mjs — parsePrice: maneja todos los formatos de precio argentinos
// Uso: import { parsePrice } from './price-utils.mjs'

/**
 * Parsea un precio desde cualquier formato argentino/común.
 *
 * Casos que maneja:
 *   "28267.64"      → 28267.64   (inglés, punto = decimal)
 *   "28.267,64"     → 28267.64   (ARG, punto = miles, coma = decimal)
 *   "$28.267,64"    → 28267.64   (ARG con $)
 *   "28,267.64"     → 28267.64   (US, coma = miles, punto = decimal)
 *   "28267"         → 28267      (entero)
 *   "2826764"       → 2826764    (entero sin separador)
 *   28267.64        → 28267.64   (ya es número)
 *
 * @param {string|number|null|undefined} value
 * @returns {number} Precio como float (p.ej. 28267.64)
 */
export function parsePrice(value) {
  if (value == null) return 0;

  // Ya es número
  if (typeof value === 'number') {
    return isNaN(value) ? 0 : value;
  }

  let str = String(value).trim();
  if (!str) return 0;

  // Sacar símbolos de moneda, espacios, cualquier cosa que no sea dígito, coma, punto o guión
  str = str.replace(/[^0-9,.\-]/g, '');
  if (!str) return 0;

  // Contar separadores
  const dots = (str.match(/\./g) || []).length;
  const commas = (str.match(/,/g) || []).length;

  if (dots === 0 && commas === 0) {
    // Entero sin separadores: "28267" o "2826764"
    return parseFloat(str);
  }

  if (commas >= 1 && dots === 0) {
    // Solo coma(s): "28267,64" → coma = decimal
    str = str.replace(',', '.');
    // Si había más de una coma, las otras eran miles
    str = str.replace(/\.(?=.*\.)/g, '');
  } else if (dots >= 1 && commas === 0) {
    // Solo punto(s): "28267.64" o "28.267.64"
    const lastDot = str.lastIndexOf('.');
    const afterDot = str.slice(lastDot + 1);
    if (afterDot.length === 2 && /^\d+$/.test(afterDot)) {
      // "28267.64" → 2 dígitos después del último punto → es decimal
      // Si hay múltiples puntos como "28.267.64", los anteriores son miles
      if (dots > 1) {
        str = str.slice(0, lastDot).replace(/\./g, '') + '.' + afterDot;
      }
      // Si es un solo punto, no tocamos nada → parseFloat("28267.64") = 28267.64
    } else {
      // No parece decimal (ej: "28.267", "123456") → sacar todos los puntos
      str = str.replace(/\./g, '');
    }
  } else {
    // Tiene puntos Y comas: el ÚLTIMO separador es el decimal
    const lastDot = str.lastIndexOf('.');
    const lastComma = str.lastIndexOf(',');

    if (lastComma > lastDot) {
      // Último separador es coma → "28.267,64"
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Último separador es punto → "28,267.64"
      str = str.replace(/,/g, '');
    }
  }

  const result = parseFloat(str);
  return isNaN(result) ? 0 : result;
}

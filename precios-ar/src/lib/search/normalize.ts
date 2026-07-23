/**
 * Normalización de texto para búsqueda.
 * Funciones puras, sin dependencias externas.
 */

/** Normaliza un texto: lowercase, sin acentos, sin caracteres especiales */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9áéíóúüñ\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normaliza plurales españoles básicos */
export function normalizePlural(word: string): string {
  if (word.length <= 3) return word;

  // ces → z (lápices → lapiz)
  if (/ces$/.test(word)) {
    const s = word.slice(0, -3) + "z";
    if (s.length >= 2) return s;
  }

  // es → '' (leches → leche, panes → pan)
  if (/es$/.test(word) && word.length > 4) {
    const s = word.slice(0, -2);
    if (s.length >= 2) return s;
  }

  // s → '' (fideos → fideo, gatos → gato, zapatillas → zapatilla)
  if (/s$/.test(word)) {
    const s = word.slice(0, -1);
    if (s.length >= 2) return s;
  }

  return word;
}

/** Normaliza una consulta completa: normaliza cada palabra y aplica plurales */
export function normalizeQuery(query: string): string {
  const n = normalize(query);
  const words = n.split(" ").filter(Boolean);
  return words.map(normalizePlural).join(" ");
}

/** Normaliza unidades de medida a su abreviatura estándar */
export function normalizeUnit(unit: string): string {
  const map: Record<string, string> = {
    kilogramo: "kg",
    kilogramos: "kg",
    kilo: "kg",
    kilos: "kg",
    gramo: "g",
    gramos: "g",
    litro: "l",
    litros: "l",
    mililitro: "ml",
    mililitros: "ml",
    centimetro: "cm",
    centimetros: "cm",
    metro: "m",
    metros: "m",
    miligramo: "mg",
    miligramos: "mg",
  };
  return map[unit.toLowerCase().trim()] || unit;
}

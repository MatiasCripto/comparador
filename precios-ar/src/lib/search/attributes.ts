/**
 * Extracción de atributos estructurados desde una consulta de búsqueda.
 * Genérico: funciona para alimentos, indumentaria, ferretería, etc.
 */
import { normalize } from "./normalize";

export interface ParsedAttribute {
  value: number;
  unit: string;
}

export interface ExtractedAttributes {
  /** Término principal del producto (sin atributos) */
  product: string;
  /** Marca detectada, ej: "Nike", "La Serenísima" */
  brand: string | null;
  /** Peso detectado, ej: { value: 1, unit: "kg" } */
  weight: ParsedAttribute | null;
  /** Volumen detectado, ej: { value: 500, unit: "ml" } */
  volume: ParsedAttribute | null;
  /** Color detectado, ej: "negro", "blanco" */
  color: string | null;
  /** Talle detectado, ej: "42", "M", "XL" */
  size: string | null;
  /** Tipo o variante, ej: "descremada", "largo fino", "amargo" */
  type: string | null;
}

// Colores comunes en español
const COLORS = new Set([
  "negro", "negra", "negros", "negras",
  "blanco", "blanca", "blancos", "blancas",
  "rojo", "roja", "rojos", "rojas",
  "azul", "azules",
  "verde", "verdes",
  "amarillo", "amarilla", "amarillos", "amarillas",
  "naranja", "naranjas",
  "rosa", "rosas", "rosado", "rosada",
  "violeta", "violetas", "lila", "lilas",
  "marron", "marrones", "cafe", "cafes",
  "gris", "grises",
  "beige", "beiges",
  "dorado", "dorada", "dorados",
  "plateado", "plateada",
  "celeste", "celestes",
  "transparente",
  "bordo", "burdeo",
  "crema",
  "mostaza",
  "turquesa",
  "fucsia",
  "salmón", "salmon",
]);

// Marcas comunes argentinas (se puede extender)
const BRAND_ALIASES: Record<string, string[]> = {
  "la serenisima": ["serenisima", "la serenisima", "serenísima"],
  "sancor": ["sancor"],
  "arcor": ["arcor"],
  "terrabusi": ["terrabusi"],
  "bagley": ["bagley"],
  "nestle": ["nestle", "nestlé"],
  "kraft": ["kraft"],
  "molinos": ["molinos", "molinos rio de la plata"],
  "coca cola": ["coca", "coca cola", "cocacola"],
  "pepsi": ["pepsi"],
  "manaos": ["manaos"],
  "quilmes": ["quilmes"],
  "brahma": ["brahma"],
  "patricia": ["patricia"],
  "schneider": ["schneider"],
  "nike": ["nike"],
  "adidas": ["adidas"],
  "puma": ["puma"],
  "topper": ["topper"],
  "reebok": ["reebok"],
  "under armour": ["under armour"],
  "fila": ["fila"],
  "vans": ["vans"],
  "converse": ["converse"],
  "samsung": ["samsung"],
  "lg": ["lg"],
  "sony": ["sony"],
  "philips": ["philips"],
  "whirlpool": ["whirlpool"],
  "dreams": ["dreams"],
  "ferrum": ["ferrum"],
  "fevicol": ["fevicol"],
  "alba": ["alba"],
  "siken": ["siken"],
  "plasvale": ["plasvale"],
};

const ALL_BRANDS = new Set(
  Object.values(BRAND_ALIASES).flat().map(normalize)
);

// Patrones para extraer peso/volumen
const WEIGHT_RE = /(\d+(?:[.,]\d+)?)\s*(kg|kilo|kilos|kilogramo|kilogramos)\b/i;
const GRAM_RE = /(\d+(?:[.,]\d+)?)\s*(g|gramo|gramos)\b/i;
const VOLUME_L_RE = /(\d+(?:[.,]\d+)?)\s*(l|litro|litros|lt)\b/i;
const VOLUME_ML_RE = /(\d+(?:[.,]\d+)?)\s*(ml|mililitro|mililitros|cc)\b/i;
const SIZE_RE = /talle\s*(\d+(?:[.,]\d+)?)|\btalle\s*(s|m|l|xl|xxl|xxxl)\b/i;
const CM_RE = /(\d+(?:[.,]\d+)?)\s*(cm|centimetro|centimetros)\b/i;

/** Extrae una medida numérica de la consulta */
function extractMeasure(
  text: string,
  re: RegExp
): { value: number; unit: string } | null {
  const m = text.match(re);
  if (!m) return null;
  const raw = m[1].replace(",", ".");
  const value = parseFloat(raw);
  if (isNaN(value) || value <= 0) return null;
  let unit = m[2].toLowerCase();
  // Normalizar unidad
  if (["kilo", "kilos", "kilogramo", "kilogramos", "kg"].includes(unit)) unit = "kg";
  else if (["gramo", "gramos", "g"].includes(unit)) unit = "g";
  else if (["litro", "litros", "lt", "l"].includes(unit)) unit = "l";
  else if (["mililitro", "mililitros", "cc", "ml"].includes(unit)) unit = "ml";
  else if (["centimetro", "centimetros", "cm"].includes(unit)) unit = "cm";
  return { value, unit };
}

/**
 * Extrae atributos estructurados de una consulta de búsqueda.
 * Retorna el término principal y los atributos detectados.
 */
export function extractAttributes(query: string): ExtractedAttributes {
  const normalized = normalize(query);
  const words = normalized.split(" ").filter(Boolean);

  const weight = extractMeasure(normalized, WEIGHT_RE) || extractMeasure(normalized, GRAM_RE) || null;
  const volume = extractMeasure(normalized, VOLUME_L_RE) || extractMeasure(normalized, VOLUME_ML_RE) || null;

  const sizeMatch = normalized.match(SIZE_RE);
  const size = sizeMatch ? sizeMatch[1]?.toUpperCase() ?? sizeMatch[2]?.toUpperCase() ?? null : null;

  const colors = words.filter((w) => COLORS.has(w));
  const color = colors.length > 0 ? colors[0] : null;

  const brands = words.filter((w) => ALL_BRANDS.has(w));
  const brand = brands.length > 0 ? brands[0] : null;

  // Construir "producto" = todas las palabras que NO sean atributos detectados
  const used = new Set<string>();
  if (weight) {
    const rawWeight = normalized.match(WEIGHT_RE)?.[0] || normalized.match(GRAM_RE)?.[0] || "";
    rawWeight.split(" ").forEach((w) => used.add(normalize(w)));
  }
  if (volume) {
    const rawVol = normalized.match(VOLUME_L_RE)?.[0] || normalized.match(VOLUME_ML_RE)?.[0] || "";
    rawVol.split(" ").forEach((w) => used.add(normalize(w)));
  }
  if (size && sizeMatch) {
    // Add every word from the size match to used set
    sizeMatch[0].split(" ").forEach((w) => used.add(normalize(w)));
  }
  if (color) used.add(color);
  if (brand) used.add(brand);

  const productWords = words.filter((w) => !used.has(w));
  const product = productWords.join(" ");

  return {
    product: product || normalized,
    brand,
    weight,
    volume,
    color,
    size,
    type: null, // No intentamos inferir tipo por ahora
  };
}

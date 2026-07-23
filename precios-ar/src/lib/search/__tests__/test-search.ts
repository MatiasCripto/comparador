/**
 * Tests del motor de búsqueda — funciones puras (sin DB).
 * Ejecutar: npx tsx src/lib/search/__tests__/test-search.ts
 */

import { normalizeQuery, normalize, normalizePlural } from "../normalize";
import { extractAttributes } from "../attributes";

// =========================================================================
// ComputeRelevance inline (misma lógica que search-engine.ts pero sin
// dependencias Next.js)
// =========================================================================

interface RelevanceResult {
  score: number;
  matchedFields: string[];
  matchType: "exact" | "strong" | "moderate" | "weak" | "minimal";
}

// Categorización simplificada para tests
function detectCategory(q: string): string | null {
  const n = normalize(q);
  if (/^(leche|yogur|queso|crema|manteca|huevo|arroz|fideo|pan|galletita|harina|chocolate|cereal|avena)/.test(n)) return "supermercados";
  if (/^(zapatilla|zapato|bota|sandalia|remera|pantalon|buzo)/.test(n)) return "ropa";
  if (/^(ibuprofeno|paracetamol|aspirina|shampoo)/.test(n)) return "farmacia";
  if (/^(cemento|cal|arena|ladrillo)/.test(n)) return "construccion";
  return null;
}

const S = {
  EXACT: 100,
  STARTS: 80,
  FIRST: 70,
  WORD: 30,
  SUB: 15,
  BRAND: 25,
  CAT: 20,
  ALL_WORDS: 15,
  PART_WORDS: 8,
  LATE: -15,
  FRAGMENT: -10,
} as const;

function relevance(query: string, name: string, brand = "", category?: string): RelevanceResult {
  const nq = normalizeQuery(query);
  const nn = normalizeQuery(name);
  const nb = normalize(brand);
  const words = nq.split(" ").filter(Boolean);
  const nWords = nn.split(" ").filter(Boolean);

  let score = 0;
  const fields: string[] = [];

  if (nn === nq) return { score: S.EXACT, matchedFields: ["exact_name"], matchType: "exact" };

  const primary = words[0];
  const primaryIndex = nWords.indexOf(primary);
  const isPrimaryStart = nn.startsWith(primary + " ") || primary === nn;

  if (isPrimaryStart) {
    score += S.STARTS; fields.push("starts_with_primary");
  } else if (primaryIndex === 0) {
    score += S.FIRST; fields.push("first_word_primary");
  } else if (primaryIndex > 0) {
    score += S.WORD; fields.push(`word_in_name_${primaryIndex}`);
  } else if (nn.includes(primary)) {
    score += S.SUB; fields.push("substring_name");
  } else {
    return { score: 0, matchedFields: [], matchType: "minimal" };
  }

  // Multi-word bonus
  if (words.length > 1) {
    const matched = words.filter(w => nWords.includes(w)).length;
    const r = matched / words.length;
    if (r >= 1) { score += S.ALL_WORDS; fields.push("all_words"); }
    else if (r >= 0.5) { score += S.PART_WORDS; fields.push(`partial_words_${matched}_${words.length}`); }
  }

  // Brand
  if (nb && words.some(w => nb.includes(w) || w.includes(nb))) { score += S.BRAND; fields.push("brand"); }

  // Category
  const qCat = detectCategory(query);
  if (qCat && category && category === qCat) { score += S.CAT; fields.push("category"); }

  // Penalty: late position
  if (words.length === 1 && primaryIndex >= 2) { score += S.LATE; fields.push(`late_${primaryIndex}`); }

  // Penalty: fragment
  if (words.length === 1 && nWords.length >= 4 && nWords.length > 1) {
    const avg = nWords.reduce((a, w) => a + w.length, 0) / nWords.length;
    if (primary.length < avg * 0.6) { score += S.FRAGMENT; fields.push("fragment"); }
  }

  const clamped = Math.max(0, Math.min(100, score));
  return {
    score: clamped,
    matchedFields: fields,
    matchType: clamped >= 80 ? "strong" : clamped >= 50 ? "moderate" : clamped >= 25 ? "weak" : "minimal",
  };
}

// =========================================================================
// Tests
// =========================================================================

let passed = 0;
let failed = 0;

function check(condition: boolean, label: string) {
  if (condition) { passed++; }
  else { failed++; console.log(`  FAIL: ${label}`); }
}

// ====================
// TEST 1: "leche"
// ====================
console.log("\n=== TEST 1: leche ===");

const r1a = relevance("leche", "LECHE ENTERA 1L LA SERENISIMA", "La Serenisima", "supermercados");
console.log(`  Leche Entera:        score=${r1a.score} type=${r1a.matchType} fields=[${r1a.matchedFields}]`);
check(r1a.score >= 75, "Leche Entera debe tener score >= 75");

const r1b = relevance("leche", "LECHE DESCREMADA 1L SANCOR", "Sancor", "supermercados");
console.log(`  Leche Descremada:    score=${r1b.score} type=${r1b.matchType} fields=[${r1b.matchedFields}]`);
check(r1b.score >= 75, "Leche Descremada debe tener score >= 75");

const r1c = relevance("leche", "LECHE CHOCOLATADA 1L", "", "supermercados");
console.log(`  Leche Chocolatada:   score=${r1c.score} type=${r1c.matchType} fields=[${r1c.matchedFields}]`);
check(r1c.score >= 75, "Leche Chocolatada debe tener score >= 75");

const r1d = relevance("leche", "GALLETITAS CON LECHE", "", "supermercados");
console.log(`  Galletitas con leche: score=${r1d.score} type=${r1d.matchType} fields=[${r1d.matchedFields}]`);
check(r1d.score < r1a.score, "Galletitas debe tener MENOR score que Leche Entera");
check(r1d.score <= 50, "Galletitas debe tener score <= 50 (mención secundaria, penalizada por posición tardía)");

const r1e = relevance("leche", "CHOCOLATE CON LECHE TBC", "", "supermercados");
console.log(`  Chocolate con leche: score=${r1e.score} type=${r1e.matchType} fields=[${r1e.matchedFields}]`);
check(r1e.score < r1a.score, "Chocolate con leche debe tener MENOR score que Leche Entera");
check(r1e.score <= 50, "Chocolate con leche debe tener score <= 50");

// ====================
// TEST 2: "chocolate"
// ====================
console.log("\n=== TEST 2: chocolate ===");

const r2a = relevance("chocolate", "CHOCOLATE AGUILA 100G", "", "supermercados");
console.log(`  Chocolate Aguila:     score=${r2a.score} type=${r2a.matchType} fields=[${r2a.matchedFields}]`);
check(r2a.score >= 75, "Chocolate Aguila debe tener score >= 75");

const r2b = relevance("chocolate", "CHOCOLATE MILKA 200G", "Milka", "supermercados");
console.log(`  Chocolate Milka:      score=${r2b.score} type=${r2b.matchType} fields=[${r2b.matchedFields}]`);
check(r2b.score >= 75, "Chocolate Milka debe tener score >= 75");

const r2c = relevance("chocolate", "GALLETITAS CON CHOCOLATE", "", "supermercados");
console.log(`  Galletitas con chocolate: score=${r2c.score} type=${r2c.matchType} fields=[${r2c.matchedFields}]`);
check(r2c.score < r2a.score, "Galletitas debe tener MENOR score que Chocolate Aguila");
check(r2c.score <= 40, "Galletitas debe tener score <= 40 (mención secundaria, penalizada)");

const r2d = relevance("chocolate", "CEREAL CON CHOCOLATE", "", "supermercados");
console.log(`  Cereal con chocolate: score=${r2d.score} type=${r2d.matchType} fields=[${r2d.matchedFields}]`);
check(r2d.score < r2a.score, "Cereal debe tener MENOR score que Chocolate Aguila");
check(r2d.score <= 40, "Cereal debe tener score <= 40");

// ====================
// TEST 3: "arroz 1kg"
// ====================
console.log("\n=== TEST 3: arroz 1kg ===");
const attr3 = extractAttributes("arroz 1kg");
console.log(`  Attributes: product="${attr3.product}" weight=${JSON.stringify(attr3.weight)}`);

const r3a = relevance("arroz 1kg", "ARROZ LARGO FINO 1KG", "", "supermercados");
console.log(`  Arroz Largo Fino 1kg: score=${r3a.score} type=${r3a.matchType} fields=[${r3a.matchedFields}]`);
check(r3a.score >= 75, "Arroz Largo Fino 1kg debe tener score >= 75");

const r3b = relevance("arroz 1kg", "ARROZ LARGO FINO 500G", "", "supermercados");
console.log(`  Arroz Largo Fino 500g: score=${r3b.score} type=${r3b.matchType} fields=[${r3b.matchedFields}]`);
check(r3b.score >= 55, "Arroz 500g debe tener score >= 55 (arroz es primera palabra)");

// Verify weight extraction
check(attr3.product === "arroz", "Producto extraído debe ser 'arroz'");
check(attr3.weight?.value === 1, "Peso debe ser 1");
check(attr3.weight?.unit === "kg", "Unidad debe ser kg");

// ====================
// TEST 4: "zapatillas negras Nike talle 42"
// ====================
console.log("\n=== TEST 4: zapatillas negras nike talle 42 ===");
const attr4 = extractAttributes("zapatillas negras nike talle 42");
console.log(`  Attributes: product="${attr4.product}" brand="${attr4.brand}" color="${attr4.color}" size="${attr4.size}"`);

check(attr4.product === "zapatillas", "Producto debe ser 'zapatillas'");
check(attr4.color === "negras", "Color debe ser 'negras'");
check(attr4.brand === "nike", "Marca debe ser 'nike'");

const r4a = relevance("zapatillas negras nike talle 42", "ZAPATILLAS NIKE NEGRAS TALLE 42", "Nike", "ropa");
console.log(`  Zapatillas Nike negras t42: score=${r4a.score} type=${r4a.matchType} fields=[${r4a.matchedFields}]`);
check(r4a.score >= 75, "Nike negras t42 debe tener score >= 75");

const r4b = relevance("zapatillas negras nike talle 42", "ZAPATILLAS ADIDAS BLANCAS TALLE 42", "Adidas", "ropa");
console.log(`  Zapatillas Adidas blancas: score=${r4b.score} type=${r4b.matchType} fields=[${r4b.matchedFields}]`);
  // En la función pura, ambas obtienen mismo score porque empiezan con "zapatillas"
  // y están en categoría "ropa". La diferenciación por atributos (marca, color, talle)
  // se aplica en searchProducts() como segunda pasada con bonuses.
  console.log(`    Nota: ambas obtienen score=${r4b.score} en función pura.`);
  console.log(`    La diferenciación por marca/color/talle ocurre en searchProducts().`);

// ====================
// TEST 5: normalize
// ====================
console.log("\n=== TEST 5: Normalización ===");
check(normalizeQuery("LÉCHE") === "leche", "LÉCHE → leche (acento)");
check(normalizeQuery("fideos") === "fideo", "fideos → fideo (plural)");
check(normalizeQuery("zapatillas") === "zapatilla", "zapatillas → zapatilla (plural)");
check(normalizeQuery("ARROZ 1KG") === "arroz 1kg", "ARROZ 1KG → arroz 1kg");
check(normalizePlural("leche") === "leche", "leche → leche (singular no cambia)");

// ====================
// Summary
// ====================
console.log(`\n============`);
console.log(`${passed}/${passed + failed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

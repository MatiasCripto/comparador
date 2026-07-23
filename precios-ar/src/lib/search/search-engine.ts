/**
 * Motor de búsqueda con relevancia.
 *
 * - computeRelevance(): puntúa un producto contra una consulta
 * - searchProducts(): orquesta búsqueda multicapa con scoring
 *
 * La puntuación distingue entre:
 *   Producto principal:  "Leche Entera"  → score 80-100
 *   Variante:            "Leche Chocolatada" → score 60-75
 *   Mención secundaria:  "Galletitas leche" → score 30-55
 *   Solo descripción:     score < 30
 */
import { createAdminClient } from "@/lib/supabase/service";
import { autoDetectCategory } from "@/lib/product-categories";
import { normalizeQuery, normalize } from "./normalize";
import { extractAttributes } from "./attributes";
import type { LatestPrice, AutocompleteSuggestion } from "@/types/database";

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface RelevanceResult {
  score: number; // 0-100
  matchedFields: string[];
  matchType: "exact" | "strong" | "moderate" | "weak" | "minimal";
}

export interface ScoredProduct extends LatestPrice {
  relevance: RelevanceResult;
}

export interface SearchFilters {
  storeIds?: string[] | null;
  category?: string;
  province?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "relevance" | "price_asc" | "price_desc";
}

export interface SearchResult {
  products: ScoredProduct[];
  total: number;
  query: string;
  attributes: ReturnType<typeof extractAttributes>;
}

// ---------------------------------------------------------------------------
// Ponderaciones (fáciles de ajustar)
// ---------------------------------------------------------------------------

const SCORES = {
  EXACT_NAME: 100,
  STARTS_WITH: 80,
  FIRST_WORD: 70,
  WORD_IN_NAME: 30,
  SUBSTRING_NAME: 15,
  BRAND_MATCH: 25,
  CATEGORY_MATCH: 20,
  ATTRIBUTE_WEIGHT: 15,
  ATTRIBUTE_VOLUME: 15,
  ATTRIBUTE_COLOR: 12,
  ATTRIBUTE_SIZE: 12,
  RAW_NAME_ONLY: 5,
  ALL_WORDS_MATCH: 15,
  PARTIAL_WORDS_MATCH: 8,
  PENALTY_LATE_POSITION: -15,
  PENALTY_FRAGMENT: -10,
} as const;

// ---------------------------------------------------------------------------
// computeRelevance — núcleo del scoring
// ---------------------------------------------------------------------------

export function computeRelevance(
  query: string,
  productName: string,
  productBrand?: string | null,
  productCategory?: string | null
): RelevanceResult {
  const nq = normalizeQuery(query);
  const nn = normalizeQuery(productName);
  const nb = normalize(productBrand || "");
  const words = nq.split(" ").filter(Boolean);
  const nameWords = nn.split(" ").filter(Boolean);

  let score = 0;
  const fields: string[] = [];

  // ------- 1. Coincidencia exacta -------
  if (nn === nq) {
    score += SCORES.EXACT_NAME;
    fields.push("exact_name");
    return clamp(score, fields, "exact");
  }

  // ------- 2. Match por palabra principal (para multi-word) -------
  const primary = words[0];
  const isPrimaryMatch =
    nn === primary ||
    nn.startsWith(primary + " ") ||
    nn.endsWith(" " + primary);

  if (isPrimaryMatch) {
    // Si el nombre completo o principal coincide con el término primario
    if (nn.startsWith(primary + " ") || primary === nn) {
      score += SCORES.STARTS_WITH;
      fields.push("starts_with_primary");
    } else if (nameWords[0] === primary) {
      score += SCORES.FIRST_WORD;
      fields.push("first_word_primary");
    }
  } else if (nameWords.includes(primary)) {
    // primary aparece como palabra (no primera)
    score += SCORES.WORD_IN_NAME;
    fields.push("word_in_name");
  } else if (nn.includes(primary)) {
    // substring match
    score += SCORES.SUBSTRING_NAME;
    fields.push("substring_name");
  } else {
    // No match del primary → score mínimo
    return clamp(0, fields, "minimal");
  }

  // ------- 3. Multi-word: bonus por palabras secundarias -------
  if (words.length > 1) {
    let matchCount = 0;
    for (const w of words) {
      if (nameWords.includes(w)) matchCount++;
    }
    const ratio = matchCount / words.length;
    if (ratio >= 1) {
      score += SCORES.ALL_WORDS_MATCH;
      fields.push("all_words");
    } else if (ratio >= 0.5) {
      score += SCORES.PARTIAL_WORDS_MATCH;
      fields.push(`partial_words_${matchCount}_${words.length}`);
    }
  }

  // ------- 4. Brand match -------
  if (nb && words.some((w) => nb.includes(w) || w.includes(nb))) {
    score += SCORES.BRAND_MATCH;
    fields.push("brand");
  }

  // ------- 5. Category match -------
  const queryCat = autoDetectCategory(query);
  if (queryCat && productCategory && productCategory === queryCat) {
    score += SCORES.CATEGORY_MATCH;
    fields.push("category");
  }

  // ------- 6. Penalizaciones -------
  // Palabra primaria aparece tarde (no en primeras 2 posiciones)
  if (words.length === 1 && nameWords.length > 2) {
    const pos = nameWords.indexOf(primary);
    if (pos >= 2) {
      score += SCORES.PENALTY_LATE_POSITION;
      fields.push(`late_pos_${pos}`);
    }
  }

  // Penalizar si la query es muy corta vs nombre largo (fragment)
  if (words.length === 1 && nameWords.length >= 4) {
    const avgWordLen =
      nameWords.reduce((a, w) => a + w.length, 0) / nameWords.length;
    if (primary.length < avgWordLen * 0.6) {
      score += SCORES.PENALTY_FRAGMENT;
      fields.push("fragment_penalty");
    }
  }

  return clamp(score, fields);
}

// ---------------------------------------------------------------------------
// searchProducts — función principal que consulta y puntúa
// ---------------------------------------------------------------------------

export async function searchProducts(
  query: string,
  filters: SearchFilters = {}
): Promise<SearchResult> {
  const supabase = createAdminClient();
  const nq = normalizeQuery(query);
  const extracted = extractAttributes(query);
  const searchTerm = extracted.product || nq;

  // 1. Query amplia — usar ILIKE (con índice trigram en el futuro)
  let dbQuery = supabase
    .from("latest_prices")
    .select("*")
    .ilike("canonical_name", `%${searchTerm}%`)
    .limit(200);

  if (filters.storeIds !== null && filters.storeIds !== undefined) {
    dbQuery = dbQuery.in("store_id", filters.storeIds);
  }

  if (filters.category) {
    dbQuery = dbQuery.eq("category", filters.category);
  }

  if (filters.province) {
    dbQuery = dbQuery.eq("province", filters.province);
  }

  if (filters.minPrice !== undefined) {
    dbQuery = dbQuery.gte("price", filters.minPrice);
  }

  if (filters.maxPrice !== undefined) {
    dbQuery = dbQuery.lte("price", filters.maxPrice);
  }

  const { data: rows } = await dbQuery;
  if (!rows || rows.length === 0) {
    return { products: [], total: 0, query, attributes: extracted };
  }

  // 2. Puntuar cada resultado
  const scored: ScoredProduct[] = (rows as LatestPrice[])
    .map((p) => ({
      ...p,
      relevance: computeRelevance(query, p.canonical_name, p.brand, p.category),
    }))
    .filter((p) => p.relevance.score > 0); // Descartar irrelevantes

  // 3. Ordenar por relevance desc, luego price asc
  scored.sort((a, b) => {
    const scoreDiff = b.relevance.score - a.relevance.score;
    if (scoreDiff !== 0) return scoreDiff;
    return a.price - b.price;
  });

  // 4. Atributos matching bonus
  for (const p of scored) {
    if (extracted.weight) {
      const pw = normalizeQuery(p.unit || "");
      const pq = normalizeQuery(`${extracted.weight.value}${extracted.weight.unit}`);
      if (pw === pq || p.quantity === extracted.weight.value) {
        p.relevance.score = Math.min(p.relevance.score + SCORES.ATTRIBUTE_WEIGHT, 100);
        p.relevance.matchedFields.push("weight");
      }
    }
    if (extracted.volume) {
      const pv = normalizeQuery(p.unit || "");
      if (pv === `${extracted.volume.value}${extracted.volume.unit}`) {
        p.relevance.score = Math.min(p.relevance.score + SCORES.ATTRIBUTE_VOLUME, 100);
        p.relevance.matchedFields.push("volume");
      }
    }
    if (extracted.color) {
      const nc = normalize(p.canonical_name);
      if (nc.includes(extracted.color)) {
        p.relevance.score = Math.min(p.relevance.score + SCORES.ATTRIBUTE_COLOR, 100);
        p.relevance.matchedFields.push("color");
      }
    }
    if (extracted.size) {
      const ns = normalize(p.canonical_name);
      if (ns.includes(extracted.size)) {
        p.relevance.score = Math.min(p.relevance.score + SCORES.ATTRIBUTE_SIZE, 100);
        p.relevance.matchedFields.push("size");
      }
    }
  }

  // Re-sort after attribute bonuses
  scored.sort((a, b) => {
    const scoreDiff = b.relevance.score - a.relevance.score;
    if (scoreDiff !== 0) return scoreDiff;
    return a.price - b.price;
  });

  return {
    products: scored.slice(0, 50),
    total: scored.length,
    query,
    attributes: extracted,
  };
}

// ---------------------------------------------------------------------------
// searchSuggestions — para autocomplete (más rápido, menos puntuación)
// ---------------------------------------------------------------------------

export async function searchSuggestions(
  query: string,
  storeCategory?: string
): Promise<AutocompleteSuggestion[]> {
  const supabase = createAdminClient();
  const nq = normalizeQuery(query);

  let dbQuery = supabase
    .from("latest_prices")
    .select("product_id, canonical_name, raw_name, brand, category, unit, quantity, price, price_original, is_offer, store_name, store_id, product_url, image_url")
    .ilike("canonical_name", `%${nq}%`)
    .order("price", { ascending: true })
    .limit(40);

  if (storeCategory) {
    dbQuery = dbQuery.eq("category", storeCategory);
  }

  const { data } = await dbQuery;
  if (!data || data.length === 0) return [];

  // Puntuar y deduplicar por canonical_name (mejor score)
  const seen = new Map<string, { score: number; item: AutocompleteSuggestion }>();
  for (const item of data as AutocompleteSuggestion[]) {
    const r = computeRelevance(query, item.canonical_name, item.brand, item.category);
    // Threshold más estricto para autocomplete: score >= 25
    if (r.score < 25) continue;
    const existing = seen.get(item.canonical_name);
    if (!existing || r.score > existing.score) {
      seen.set(item.canonical_name, { score: r.score, item });
    }
  }

  return Array.from(seen.values())
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.item.price - b.item.price;
    })
    .slice(0, 10)
    .map((s) => s.item);
}

// ---------------------------------------------------------------------------
// searchProductCandidates — para la lista inteligente (top N candidatos)
// ---------------------------------------------------------------------------

export async function searchProductCandidates(
  term: string,
  storeIds: string[] | null,
  storeCategory?: string
): Promise<ScoredProduct[]> {
  const supabase = createAdminClient();
  const nq = normalizeQuery(term);

  let query = supabase
    .from("latest_prices")
    .select("*")
    .ilike("canonical_name", `%${nq}%`)
    .limit(40);

  if (storeIds !== null) {
    query = query.in("store_id", storeIds);
  }
  if (storeCategory) {
    query = query.eq("category", storeCategory);
  }

  const { data } = await query.order("price", { ascending: true });
  if (!data || data.length === 0) return [];

  const scored: ScoredProduct[] = (data as LatestPrice[]).map((p) => ({
    ...p,
    relevance: computeRelevance(term, p.canonical_name, p.brand, p.category),
  }));

  // Filtrar irrelevantes (score < 15)
  const filtered = scored.filter((p) => p.relevance.score >= 15);

  // Re-score attributes
  const extracted = extractAttributes(term);
  for (const p of filtered) {
    if (extracted.weight) {
      const pw = normalizeQuery(p.unit || "");
      if (pw === `${extracted.weight.value}${extracted.weight.unit}` || p.quantity === extracted.weight.value) {
        p.relevance.score = Math.min(p.relevance.score + SCORES.ATTRIBUTE_WEIGHT, 100);
      }
    }
  }

  // Ordenar por relevance desc, price asc
  filtered.sort((a, b) => {
    const sd = b.relevance.score - a.relevance.score;
    if (sd !== 0) return sd;
    return a.price - b.price;
  });

  return filtered.slice(0, 5);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(
  score: number,
  fields: string[],
  matchType?: RelevanceResult["matchType"]
): RelevanceResult {
  const clamped = Math.max(0, Math.min(100, score));
  return {
    score: clamped,
    matchedFields: fields,
    matchType:
      matchType ??
      (clamped >= 80 ? "strong" : clamped >= 50 ? "moderate" : clamped >= 25 ? "weak" : "minimal"),
  };
}

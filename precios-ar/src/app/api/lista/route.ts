import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/service";
import { computeRelevance, resolveStoreCategoryIds } from "@/lib/search/search-engine";
import { normalizeQuery } from "@/lib/search/normalize";
import type { LatestPrice } from "@/types/database";
import type { SelectedProduct } from "@/types/search";

interface ItemMatch {
  term: string;
  canonical_name: string;
  store_id: string;
  store_name: string;
  price: number;
  price_original: number;
  product_url: string | null;
  image_url: string | null;
  province: string | null;
}

interface StoreItem {
  name: string;
  price: number;
  store_id: string;
  product_url: string | null;
}

interface StrategyResult {
  name: string;
  description: string;
  total: number;
  savings: number;
  missing: string[];
  stores: {
    store_id: string;
    store_name: string;
    items: StoreItem[];
    subtotal: number;
  }[];
}

interface ListaResponse {
  items: {
    term: string;
    matched: boolean;
    canonical_name: string | null;
    variants: number;
  }[];
  strategies: StrategyResult[];
}

/**
 * Búsqueda inteligente: encuentra el producto más relevante para el término.
 *
 * 1. Consulta amplia con ILIKE (100 rows)
 * 2. Puntúa cada resultado por relevancia
 * 3. Agrupa por canonical_name, elige el grupo con mejor score
 * 4. Retorna los precios de ESE producto en todas las tiendas
 */
async function searchProduct(term: string, storeIds: string[] | null, storeCategory?: string): Promise<LatestPrice[]> {
  const supabase = createAdminClient();
  const nq = normalizeQuery(term);

  let query = supabase
    .from("latest_prices")
    .select("*")
    .ilike("canonical_name", `%${nq}%`)
    .limit(100);

  if (storeIds !== null) {
    query = query.in("store_id", storeIds);
  }

  if (storeCategory) {
    const catStoreIds = await resolveStoreCategoryIds(storeCategory);
    if (catStoreIds.length === 0) return [];
    query = query.in("store_id", catStoreIds);
  }

  const { data } = await query;
  if (!data || data.length === 0) return [];

  // Score each result
  const scored = (data as LatestPrice[]).map((p) => ({
    ...p,
    relevance: computeRelevance(term, p.canonical_name, p.brand, p.category),
  }));

  // Group by canonical_name, compute best score per group
  const groups = new Map<string, { score: number; items: LatestPrice[] }>();
  for (const p of scored) {
    if (p.relevance.score < 15) continue; // Skip irrelevant
    const g = groups.get(p.canonical_name);
    if (g) {
      g.items.push(p);
      if (p.relevance.score > g.score) g.score = p.relevance.score;
    } else {
      groups.set(p.canonical_name, { score: p.relevance.score, items: [p] });
    }
  }

  if (groups.size === 0) return [];

  // Pick the group with the highest relevance score
  let bestGroup: { score: number; items: LatestPrice[] } | null = null;
  for (const [, g] of groups) {
    if (!bestGroup || g.score > bestGroup.score) {
      bestGroup = g;
    }
  }

  return bestGroup?.items ?? [];
}

async function getMatchingStoreIds(
  supabase: ReturnType<typeof createAdminClient>,
  userProvince: string | null
): Promise<{ storeIds: string[] | null; storeMetadata: Map<string, { province: string | null; city: string | null; deliveryType: string | null }> }> {
  const meta = new Map<string, { province: string | null; city: string | null; deliveryType: string | null }>();

  // Fetch ALL stores with their metadata, not just matching ones
  const { data: allStores } = await supabase
    .from("stores")
    .select("id, province, city, scraping_config")
    .limit(500);

  if (allStores) {
    for (const s of allStores) {
      meta.set(s.id, {
        province: s.province || null,
        city: s.city || null,
        deliveryType: s.scraping_config?.delivery_type || null,
      });
    }
  }

  if (!userProvince) return { storeIds: null, storeMetadata: meta };

  const { data: stores } = await supabase
    .from("stores")
    .select("id, scraping_config")
    .or(
      `scraping_config->>delivery_type.eq.national,province.eq.${userProvince}`
    );

  if (!stores || stores.length === 0) return { storeIds: [], storeMetadata: meta };

  return {
    storeIds: stores.map((s: { id: string }) => s.id),
    storeMetadata: meta,
  };
}

/**
 * Búsqueda exacta por product_id: retorna todos los precios del producto.
 */
async function searchProductById(productId: string, storeIds: string[] | null, storeCategory?: string): Promise<LatestPrice[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("latest_prices")
    .select("*")
    .eq("product_id", productId);

  if (storeIds !== null) {
    query = query.in("store_id", storeIds);
  }

  if (storeCategory) {
    const catStoreIds = await resolveStoreCategoryIds(storeCategory);
    if (catStoreIds.length === 0) return [];
    query = query.in("store_id", catStoreIds);
  }

  const { data } = await query;
  return (data as LatestPrice[]) ?? [];
}

// Score a store: lower is better. Prefers local stores over national ones.
function scoreStore(
  storeId: string,
  total: number,
  missing: number,
  userProvince: string | null,
  meta: Map<string, { province: string | null; city: string | null; deliveryType: string | null }>
): number {
  const m = meta.get(storeId);
  let score = 0;
  // Base: 0-10000 from total price (capped)
  score += Math.min(total, 10000);
  // Heavy penalty for missing items
  score += missing * 5000;
  // Geographic bonus: prefer local stores (same province, local delivery)
  if (userProvince && m) {
    if (m.province === userProvince) {
      score -= 2000; // big bonus for local stores
    } else if (m.deliveryType === 'national') {
      score -= 500; // small bonus for national delivery
    }
  }
  return score;
}

function calcStrategy1(
  items: { term: string; prices: Map<string, ItemMatch> }[],
  storeNames: Map<string, string>,
  userProvince: string | null,
  storeMeta: Map<string, { province: string | null; city: string | null; deliveryType: string | null }>
): StrategyResult {
  const storeItems = new Map<string, { term: string; price: number; product_url: string | null }[]>();

  for (const item of items) {
    for (const [storeId, match] of item.prices) {
      if (!storeItems.has(storeId)) storeItems.set(storeId, []);
      storeItems.get(storeId)!.push({
        term: item.term,
        price: match.price,
        product_url: match.product_url,
      });
    }
  }

  const scored = Array.from(storeItems.entries())
    .map(([storeId, sItems]) => {
      const coveredTerms = new Set(sItems.map(i => i.term));
      const missing = items.filter(i => !coveredTerms.has(i.term)).map(i => i.term);
      const total = sItems.reduce((sum, i) => sum + i.price, 0);
      return { storeId, items: sItems, total, missing: missing.length };
    })
    .map(s => ({
      ...s,
      geoScore: scoreStore(s.storeId, s.total, s.missing, userProvince, storeMeta),
    }))
    .sort((a, b) => a.geoScore - b.geoScore);

  const best = scored[0];
  if (!best) return { name: "", description: "", total: 0, savings: 0, missing: [], stores: [] };

  const m = storeMeta.get(best.storeId);
  const provinceLabel = m?.province ? ` en ${m.province}` : '';
  const storeLabel = storeNames.get(best.storeId) || best.storeId;

  return {
    name: "Una sola tienda",
    description: `Comprá todo en ${storeLabel}${provinceLabel}`,
    total: best.total,
    savings: 0,
    missing: items.filter(i => !new Set(best.items.map(x => x.term)).has(i.term)).map(i => i.term),
    stores: [{
      store_id: best.storeId,
      store_name: storeLabel,
      items: best.items.map(i => ({
        name: i.term,
        price: i.price,
        store_id: best.storeId,
        product_url: i.product_url,
      })),
      subtotal: best.total,
    }],
  };
}

function calcStrategy2(
  items: { term: string; prices: Map<string, ItemMatch> }[],
  storeNames: Map<string, string>,
  userProvince: string | null,
  storeMeta: Map<string, { province: string | null; city: string | null; deliveryType: string | null }>
): StrategyResult {
  const storeCoverage = new Map<string, { term: string; price: number; product_url: string | null }[]>();
  for (const item of items) {
    for (const [storeId, match] of item.prices) {
      if (!storeCoverage.has(storeId)) storeCoverage.set(storeId, []);
      storeCoverage.get(storeId)!.push({
        term: item.term,
        price: match.price,
        product_url: match.product_url,
      });
    }
  }

  const topStores = Array.from(storeCoverage.entries())
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 20)
    .map(([id]) => id);

  if (topStores.length < 2) {
    return { name: "", description: "", total: 0, savings: 0, missing: [], stores: [] };
  }

  let bestPair: { stores: [string, string]; total: number; missing: string[]; geoScore: number; assignments: { term: string; storeId: string; price: number; product_url: string | null }[] } | null = null;

  for (let i = 0; i < topStores.length; i++) {
    for (let j = i + 1; j < topStores.length; j++) {
      const s1 = topStores[i];
      const s2 = topStores[j];
      const missing: string[] = [];
      const assignments: { term: string; storeId: string; price: number; product_url: string | null }[] = [];
      let total = 0;

      for (const item of items) {
        const price1 = item.prices.get(s1);
        const price2 = item.prices.get(s2);

        if (!price1 && !price2) {
          missing.push(item.term);
        } else if (!price1) {
          total += price2!.price;
          assignments.push({ term: item.term, storeId: s2, price: price2!.price, product_url: price2!.product_url });
        } else if (!price2) {
          total += price1.price;
          assignments.push({ term: item.term, storeId: s1, price: price1.price, product_url: price1.product_url });
        } else {
          const cheaper = price1.price <= price2.price ? s1 : s2;
          const match = cheaper === s1 ? price1 : price2;
          total += match.price;
          assignments.push({ term: item.term, storeId: cheaper, price: match.price, product_url: match.product_url });
        }
      }

      const mCount = missing.length;
      const geoScore = scoreStore(s1, total, mCount, userProvince, storeMeta) + scoreStore(s2, total, mCount, userProvince, storeMeta);
      const bMCount = bestPair ? bestPair.missing.length : Infinity;
      const bGeoScore = bestPair ? bestPair.geoScore : Infinity;

      if (!bestPair || mCount < bMCount || (mCount === bMCount && geoScore < bGeoScore)) {
        bestPair = { stores: [s1, s2], total, missing, geoScore, assignments };
      }
    }
  }

  if (!bestPair) {
    return { name: "", description: "", total: 0, savings: 0, missing: [], stores: [] };
  }

  const storeGroups = new Map<string, { term: string; price: number; product_url: string | null }[]>();
  for (const a of bestPair.assignments) {
    if (!storeGroups.has(a.storeId)) storeGroups.set(a.storeId, []);
    storeGroups.get(a.storeId)!.push({ term: a.term, price: a.price, product_url: a.product_url });
  }

  const s1Meta = storeNames.get(bestPair.stores[0]) + (storeMeta.get(bestPair.stores[0])?.province ? ' (' + storeMeta.get(bestPair.stores[0])!.province + ')' : '');
  const s2Meta = storeNames.get(bestPair.stores[1]) + (storeMeta.get(bestPair.stores[1])?.province ? ' (' + storeMeta.get(bestPair.stores[1])!.province + ')' : '');

  return {
    name: "Combinar 2 tiendas",
    description: `Partí tu compra entre ${s1Meta} y ${s2Meta}`,
    total: bestPair.total,
    savings: 0,
    missing: bestPair.missing,
    stores: Array.from(storeGroups.entries()).map(([storeId, sItems]) => ({
      store_id: storeId,
      store_name: storeNames.get(storeId) || storeId,
      items: sItems.map(i => ({
        name: i.term,
        price: i.price,
        store_id: storeId,
        product_url: i.product_url,
      })),
      subtotal: sItems.reduce((sum, i) => sum + i.price, 0),
    })),
  };
}

function calcStrategy3(
  items: { term: string; prices: Map<string, ItemMatch> }[],
  storeNames: Map<string, string>,
  _userProvince: string | null,
  _storeMeta: Map<string, { province: string | null; city: string | null; deliveryType: string | null }>
): StrategyResult {
  const missing: string[] = [];
  const assignments: { term: string; storeId: string; storeName: string; price: number; product_url: string | null }[] = [];
  let total = 0;

  for (const item of items) {
    if (item.prices.size === 0) {
      missing.push(item.term);
      continue;
    }
    // Pick cheapest across all stores
    let best: { storeId: string; price: number; product_url: string | null } | null = null;
    for (const [storeId, match] of item.prices) {
      if (!best || match.price < best.price) {
        best = { storeId, price: match.price, product_url: match.product_url };
      }
    }
    if (best) {
      total += best.price;
      assignments.push({
        term: item.term,
        storeId: best.storeId,
        storeName: storeNames.get(best.storeId) || best.storeId,
        price: best.price,
        product_url: best.product_url,
      });
    }
  }

  // Group by store
  const storeGroups = new Map<string, { term: string; price: number; product_url: string | null }[]>();
  for (const a of assignments) {
    if (!storeGroups.has(a.storeId)) storeGroups.set(a.storeId, []);
    storeGroups.get(a.storeId)!.push({ term: a.term, price: a.price, product_url: a.product_url });
  }

  return {
    name: "Máximo ahorro",
    description: "Cada producto en la tienda más barata",
    total,
    savings: 0,
    missing,
    stores: Array.from(storeGroups.entries()).map(([storeId, sItems]) => ({
      store_id: storeId,
      store_name: storeNames.get(storeId) || storeId,
      items: sItems.map(i => ({
        name: i.term,
        price: i.price,
        store_id: storeId,
        product_url: i.product_url,
      })),
      subtotal: sItems.reduce((sum, i) => sum + i.price, 0),
    })),
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { store_category } = body;
    const rawItems: unknown[] = body.items;

    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return NextResponse.json({ error: "Lista de productos requerida" }, { status: 400 });
    }

    if (rawItems.length > 50) {
      return NextResponse.json({ error: "Máximo 50 productos por lista" }, { status: 400 });
    }

    // Normalize items: support both SelectedProduct objects and plain strings
    type ItemEntry = { term: string; selectedProduct: SelectedProduct | null };
    const entries: ItemEntry[] = rawItems.map((item) => {
      if (typeof item === "string") {
        return { term: item, selectedProduct: null };
      }
      const sp = item as Record<string, unknown>;
      const hasProductId = typeof sp.product_id === "string" && sp.product_id.length > 0;
      return {
        term: typeof sp.canonical_name === "string" ? sp.canonical_name : String(item),
        selectedProduct: hasProductId ? (item as SelectedProduct) : null,
      };
    });

    // Read user location from cookie
    const userProvince = request.cookies.get("user_province")?.value ?? null;
    const supabase = createAdminClient();
    const { storeIds, storeMetadata } = await getMatchingStoreIds(supabase, userProvince);

    // Search each product
    const results = await Promise.all(
      entries.map(async (entry) => {
        if (entry.selectedProduct) {
          const matches = await searchProductById(entry.selectedProduct.product_id, storeIds, store_category);
          return { term: entry.term, matches };
        }
        const matches = await searchProduct(entry.term, storeIds, store_category);
        return { term: entry.term, matches };
      })
    );

    // For each item, build store → price map (cheapest per store for the selected product)
    const storeNames = new Map<string, string>();
    const pricedItems: { term: string; prices: Map<string, ItemMatch> }[] = [];

    for (const { term, matches } of results) {
      const prices = new Map<string, ItemMatch>();

      for (const m of matches) {
        storeNames.set(m.store_id, m.store_name);
        const existing = prices.get(m.store_id);
        if (!existing || m.price < existing.price) {
          prices.set(m.store_id, {
            term,
            canonical_name: m.canonical_name,
            store_id: m.store_id,
            store_name: m.store_name,
            price: m.price,
            price_original: m.price_original,
            product_url: m.product_url,
            image_url: m.image_url,
            province: m.province,
          });
        }
      }

      pricedItems.push({ term, prices });
    }

    // Calculate strategies with geographic awareness
    const s1 = calcStrategy1(pricedItems, storeNames, userProvince, storeMetadata);
    const s2 = calcStrategy2(pricedItems, storeNames, userProvince, storeMetadata);
    const s3 = calcStrategy3(pricedItems, storeNames, userProvince, storeMetadata);

    // Calculate savings relative to max-ahorro (s3)
    if (s3.total > 0) {
      s1.savings = s1.total > 0 ? s1.total - s3.total : 0;
      if (s2.total > 0) s2.savings = s2.total - s3.total;
    }

    // Build response
    const response: ListaResponse = {
      items: results.map(({ term, matches }) => {
        const distinct = new Set(matches.map(m => m.canonical_name));
        return {
          term,
          matched: matches.length > 0,
          canonical_name: matches[0]?.canonical_name || null,
          variants: distinct.size,
        };
      }),
      strategies: [s1, s2, s3].filter(s => s.total > 0 || s.name === "Máximo ahorro"),
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: "Error al procesar la lista" }, { status: 500 });
  }
}

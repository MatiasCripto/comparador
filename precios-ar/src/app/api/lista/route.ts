import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/service";
import type { LatestPrice } from "@/types/database";

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

async function searchProduct(term: string, storeIds: string[] | null, storeCategory?: string): Promise<LatestPrice[]> {
  const supabase = createAdminClient();
  let query = supabase
    .from("latest_prices")
    .select("*")
    .ilike("canonical_name", `%${term}%`);

  if (storeIds !== null) {
    query = query.in("store_id", storeIds);
  }

  if (storeCategory) {
    query = query.eq("category", storeCategory);
  }

  const { data } = await query
    .order("price", { ascending: true })
    .limit(30);

  return (data as LatestPrice[]) ?? [];
}

async function getMatchingStoreIds(supabase: ReturnType<typeof createAdminClient>, userProvince: string | null): Promise<string[] | null> {
  if (!userProvince) return null;

  const { data: stores } = await supabase
    .from("stores")
    .select("id, scraping_config")
    .or(
      `scraping_config->>delivery_type.eq.national,province.eq.${userProvince}`
    );

  if (!stores || stores.length === 0) return [];
  return stores.map((s: { id: string }) => s.id);
}

function calcStrategy1(
  items: { term: string; prices: Map<string, ItemMatch> }[],
  storeNames: Map<string, string>
): StrategyResult {
  // Build store → items map with cheapest price per item per store
  const storeItems = new Map<string, { term: string; price: number; product_url: string | null }[]>();
  const storeAllTerms = new Map<string, Set<string>>();

  for (const item of items) {
    for (const [storeId, match] of item.prices) {
      if (!storeItems.has(storeId)) storeItems.set(storeId, []);
      if (!storeAllTerms.has(storeId)) storeAllTerms.set(storeId, new Set());
      storeItems.get(storeId)!.push({
        term: item.term,
        price: match.price,
        product_url: match.product_url,
      });
      storeAllTerms.get(storeId)!.add(item.term);
    }
  }

  // Score each store: fewest missing first, then lowest total
  const scored = Array.from(storeItems.entries())
    .map(([storeId, sItems]) => {
      const coveredTerms = new Set(sItems.map(i => i.term));
      const missing = items.filter(i => !coveredTerms.has(i.term)).map(i => i.term);
      const total = sItems.reduce((sum, i) => sum + i.price, 0);
      return { storeId, items: sItems, total, missing };
    })
    .sort((a, b) => {
      if (a.missing.length !== b.missing.length)
        return a.missing.length - b.missing.length;
      return a.total - b.total;
    });

  const best = scored[0];
  if (!best) {
    return { name: "", description: "", total: 0, savings: 0, missing: [], stores: [] };
  }

  return {
    name: "Una sola tienda",
    description: `Comprá todo en ${storeNames.get(best.storeId) || best.storeId}`,
    total: best.total,
    savings: 0, // calculated after all strategies
    missing: best.missing,
    stores: [{
      store_id: best.storeId,
      store_name: storeNames.get(best.storeId) || best.storeId,
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
  storeNames: Map<string, string>
): StrategyResult {
  // Get top stores by coverage
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

  let bestPair: { stores: [string, string]; total: number; missing: string[]; assignments: { term: string; storeId: string; price: number; product_url: string | null }[] } | null = null;

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
      const bCount = bestPair ? bestPair.missing.length : Infinity;
      const bTotal = bestPair ? bestPair.total : Infinity;

      if (!bestPair || mCount < bCount || (mCount === bCount && total < bTotal)) {
        bestPair = { stores: [s1, s2], total, missing, assignments };
      }
    }
  }

  if (!bestPair) {
    return { name: "", description: "", total: 0, savings: 0, missing: [], stores: [] };
  }

  // Group assignments by store
  const storeGroups = new Map<string, { term: string; price: number; product_url: string | null }[]>();
  for (const a of bestPair.assignments) {
    if (!storeGroups.has(a.storeId)) storeGroups.set(a.storeId, []);
    storeGroups.get(a.storeId)!.push({ term: a.term, price: a.price, product_url: a.product_url });
  }

  const s1Name = storeNames.get(bestPair.stores[0]) || bestPair.stores[0];
  const s2Name = storeNames.get(bestPair.stores[1]) || bestPair.stores[1];

  return {
    name: "Combinar 2 tiendas",
    description: `Partí tu compra entre ${s1Name} y ${s2Name}`,
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
  storeNames: Map<string, string>
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
    const { items, store_category } = body as { items: string[]; store_category?: string };

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Lista de productos requerida" }, { status: 400 });
    }

    if (items.length > 50) {
      return NextResponse.json({ error: "Máximo 50 productos por lista" }, { status: 400 });
    }

    // Read user location from cookie
    const userProvince = request.cookies.get("user_province")?.value ?? null;
    const supabase = createAdminClient();
    const storeIds = await getMatchingStoreIds(supabase, userProvince);

    // Search each product
    const results = await Promise.all(
      items.map(async (term) => {
        const matches = await searchProduct(term, storeIds, store_category);
        return { term, matches };
      })
    );

    // For each item, build store → price map (cheapest per store)
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

    // Calculate strategies
    const s1 = calcStrategy1(pricedItems, storeNames);
    const s2 = calcStrategy2(pricedItems, storeNames);
    const s3 = calcStrategy3(pricedItems, storeNames);

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

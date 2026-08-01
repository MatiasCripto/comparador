#!/usr/bin/env node
// off-enrich-worker.mjs — Enriquecimiento de productos con Open Food Facts.
//
// Uso:
//   node --env-file=.env.production scripts/off-enrich-worker.mjs            # drena 50 pendientes
//   node --env-file=.env.production scripts/off-enrich-worker.mjs 500        # drena 500
//   node --env-file=.env.production scripts/off-enrich-worker.mjs --backfill 2000  # siembra la cola
//
// Respeta el rate limit de OFF (15 req/min por código de barras, 20 req/min búsqueda):
// 4.5s entre llamadas. Resumible: las filas fallidas se reintentan hasta MAX_ATTEMPTS.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el .env');
  process.exit(1);
}

const AUTH = { Authorization: `Bearer ${SUPABASE_KEY}`, apikey: SUPABASE_KEY };
const OFF_USER_AGENT = 'PreciosAR/1.0 (precios.nexoiarg.com)';
const OFF_MIN_INTERVAL_MS = 4500;
const OFF_TIMEOUT_MS = 15000;
const MATCH_THRESHOLD = 0.5;
const MAX_ATTEMPTS = 5;

// Categorías de alimentos/consumo para el backfill (match en products.category)
const GROCERY_RE =
  /(supermercado|bebidas|almacen|dietetica|granja|kiosco|organico|naturista|panaderia|carniceria|verduleria|granos|farmacia)/i;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------- Supabase (raw REST, como el scraper) ----------

async function fetchJson(url, opts = {}) {
  const res = await fetch(url, { ...opts, headers: { ...AUTH, ...(opts.headers || {}) } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchQueue(limit) {
  const data = await fetchJson(
    `${SUPABASE_URL}/rest/v1/off_enrich_queue?select=id,product_id,status,attempts&status=eq.pending&order=created_at.asc&limit=${limit}`
  );
  return Array.isArray(data) ? data : [];
}

async function fetchProduct(id) {
  const data = await fetchJson(
    `${SUPABASE_URL}/rest/v1/products?select=id,canonical_name,brand,ean,image_url,category&id=eq.${id}&limit=1`
  );
  return Array.isArray(data) && data.length ? data[0] : null;
}

async function patchProduct(id, fields) {
  await fetchJson(`${SUPABASE_URL}/rest/v1/products?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
}

async function updateQueue(id, fields) {
  await fetchJson(`${SUPABASE_URL}/rest/v1/off_enrich_queue?id=eq.${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fields),
  });
}

// ---------- Open Food Facts ----------

let lastOffCall = 0;

async function offFetch(url) {
  const wait = Math.max(0, lastOffCall + OFF_MIN_INTERVAL_MS - Date.now());
  if (wait) await sleep(wait);
  lastOffCall = Date.now();
  const res = await fetch(url, {
    headers: { 'User-Agent': OFF_USER_AGENT },
    signal: AbortSignal.timeout(OFF_TIMEOUT_MS),
  });
  if (res.status === 429) {
    await sleep(60000); // back off un minuto por rate limit
    throw new Error('OFF 429 (rate limit)');
  }
  if (!res.ok) throw new Error(`OFF HTTP ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    // OFF a veces sirve una página HTML anti-bot; se trata como error transitorio (retry).
    throw new Error(`OFF respondió ${ct || 'sin content-type'} (no JSON)`);
  }
  return res.json();
}

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function similarity(a, b) {
  const ta = new Set(normalize(a).split(/\s+/).filter(Boolean));
  const tb = new Set(normalize(b).split(/\s+/).filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let hits = 0;
  for (const t of ta) if (tb.has(t)) hits++;
  return hits / Math.max(ta.size, tb.size);
}

function extractProduct(off) {
  if (!off) return null;
  const p = off.product || off;
  if (!p || (!p.code && !p._id)) return null;

  const categoriesTags = Array.isArray(p.categories_tags) ? p.categories_tags : [];
  const generic = new Set([
    'en:foods',
    'en:groceries',
    'en:commodities',
    'en:food',
    'en:plant-based-foods',
  ]);
  const food = categoriesTags.filter(
    (t) => typeof t === 'string' && t.startsWith('en:') && !generic.has(t)
  );
  const offCategory = food.length ? food[food.length - 1].replace(/^en:/, '') : null;

  const brands = String(p.brands || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    ean: String(p.code || p._id || ''),
    name: p.product_name || p.generic_name || '',
    brand: brands.length ? brands[0] : null,
    image: p.image_front_url || p.image_url || null,
    offCategory,
    nutriscore: p.nutriscore_grade || p.nutriscore?.grade || null,
  };
}

// ---------- Enriquecimiento ----------

async function enrichProduct(prod) {
  let off;
  let reason = null;

  if (prod.ean) {
    const data = await offFetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(prod.ean)}.json`
    );
    if (!data || data.status !== 1) {
      reason = 'no_encontrado_por_ean';
      return { matched: false, reason };
    }
    off = data;
  } else {
    const q = [prod.canonical_name, prod.brand].filter(Boolean).join(' ');
    const data = await offFetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=5`
    );
    const products = Array.isArray(data?.products) ? data.products : [];
    let best = null;
    let bestScore = 0;
    for (const cand of products) {
      const candName = cand.product_name || cand.generic_name || '';
      const score = similarity(q, candName);
      if (score > bestScore) {
        bestScore = score;
        best = cand;
      }
    }
    if (!best || bestScore < MATCH_THRESHOLD) {
      reason = `no_match (mejor ${(bestScore * 100).toFixed(0)}%)`;
      return { matched: false, reason };
    }
    off = { product: best };
  }

  const extracted = extractProduct(off);
  if (!extracted) {
    reason = 'sin_datos';
    return { matched: false, reason };
  }

  const update = {
    ean: prod.ean || extracted.ean || null,
    off_category: extracted.offCategory,
    nutriscore: extracted.nutriscore,
    ean_verificado: true,
    off_last_sync: new Date().toISOString(),
  };
  // Backfill solo si faltan (los campos existentes no se pisan)
  if (!prod.brand && extracted.brand) update.brand = extracted.brand;
  if (!prod.image_url && extracted.image) update.image_url = extracted.image;

  await patchProduct(prod.id, update);
  return { matched: true, ean: update.ean, name: extracted.name };
}

// ---------- Modos ----------

async function runWorker(maxItems) {
  const rows = await fetchQueue(maxItems);
  if (!rows.length) {
    console.log('Cola vacía.');
    return 0;
  }
  console.log(`Pendientes a procesar: ${rows.length}`);

  let processed = 0;
  for (const row of rows) {
    const prod = await fetchProduct(row.product_id);
    if (!prod) {
      // Producto eliminado: marcar la fila para no reintentar.
      await updateQueue(row.id, {
        status: 'error',
        attempts: row.attempts + 1,
        attempted_at: new Date().toISOString(),
      });
      console.log(`   X   producto inexistente (${row.product_id})`);
      processed++;
      continue;
    }

    try {
      const result = await enrichProduct(prod);
      await updateQueue(row.id, {
        status: result.matched ? 'enriched' : 'no_match',
        attempts: row.attempts + 1,
        attempted_at: new Date().toISOString(),
      });
      const detail = result.matched
        ? `ean ${result.ean} · ${result.name || ''}`
        : `(${result.reason})`;
      console.log(`   ${result.matched ? 'OK  ' : 'X   '} ${prod.canonical_name} ${detail}`);
      processed++;
    } catch (e) {
      const attempts = row.attempts + 1;
      const status = attempts >= MAX_ATTEMPTS ? 'error' : 'pending';
      await updateQueue(row.id, {
        status,
        attempts,
        attempted_at: new Date().toISOString(),
      });
      console.log(`   RETRY(${attempts}) ${prod.canonical_name}: ${e.message}`);
      processed++;
    }
  }
  return processed;
}

async function runBackfill(limit) {
  const data = await fetchJson(
    `${SUPABASE_URL}/rest/v1/products?select=id,brand,category&off_last_sync=is.null&ean=is.null&category=not.is.null&limit=5000`
  );
  const pool = Array.isArray(data) ? data : [];
  const candidates = pool.filter((p) => GROCERY_RE.test(p.category || ''));
  candidates.sort((a, b) => (b.brand ? 1 : 0) - (a.brand ? 1 : 0));
  const selected = candidates.slice(0, limit);

  if (!selected.length) {
    console.log('No hay candidatos para backfill.');
    return 0;
  }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/off_enrich_queue?on_conflict=product_id`,
    {
      method: 'POST',
      headers: {
        ...AUTH,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates',
      },
      body: JSON.stringify(
        selected.map((p) => ({ product_id: p.id, status: 'pending' }))
      ),
    }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  console.log(`Backfill: ${selected.length} productos encolados (de ${candidates.length} candidatos).`);
  return selected.length;
}

// ---------- Main ----------

async function main() {
  const args = process.argv.slice(2);
  const backfillIdx = args.indexOf('--backfill');
  const backfillLimit =
    backfillIdx !== -1 ? parseInt(args[backfillIdx + 1], 10) || 2000 : null;

  if (backfillLimit !== null) {
    console.log('--- OFF backfill ---');
    await runBackfill(backfillLimit);
    return;
  }

  const maxItems = parseInt(args[0], 10) || 50;
  console.log(`--- OFF worker (hasta ${maxItems} por corrida) ---`);
  const processed = await runWorker(maxItems);
  console.log(`Procesados: ${processed}`);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});

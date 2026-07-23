// scrape_tiendanube.mjs — Scraper de productos TiendaNube (Nube)
// Endpoint: /productos.json?per_page=50&page=1
// Fallback: HTML scraping
// Uso: node scrape_tiendanube.mjs

import { parsePrice } from './price-utils.mjs';
import { autoDetectCategory } from './category-utils.mjs';

const SUPABASE_URL = 'https://ygqfbbkjdiryilwjrpzh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlncWZiYmtqZGlyeWlsd2pycHpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDY1NDQ5NSwiZXhwIjoyMTAwMjMwNDk1fQ.6sfmLwuOJDfGzJjglHP8X_SQzdeUOd657CdEr_DVcTk';

const AUTH = { Authorization: 'Bearer ' + SUPABASE_KEY, apikey: SUPABASE_KEY };

// ------ HELPERS ------

async function fetchJson(url, timeoutMs = 10000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (!res.ok) return { error: 'HTTP ' + res.status, status: res.status };
    const text = await res.text();
    if (!text.trim()) return { error: 'empty' };
    return { data: JSON.parse(text), status: res.status };
  } catch (e) {
    return { error: e.message || 'fetch_error', status: 0 };
  } finally { clearTimeout(timer); }
}

async function fetchHtml(url, timeoutMs = 10000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ac.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
  finally { clearTimeout(timer); }
}

function origin(url) {
  try { return new URL(url).origin; } catch { return null; }
}

// ------ TIENDANUBE API EXTRACTOR ------

function extractFromTiendanubeApi(json) {
  // TiendaNube returns: { products: [...] } or [...]
  let products = [];
  if (Array.isArray(json)) {
    products = json;
  } else if (json?.products) {
    products = json.products;
  }

  return products.map(p => ({
    name: (p.name || p.title || '').trim(),
    price: parsePrice(p.price || 0),
    regular_price: parsePrice((p.compare_at_price || p.price || 0)),
    currency: p.currency || 'ARS',
    url: p.url || p.link || '',
    image: (p.image?.src || p.images?.[0]?.src || p.thumbnail || ''),
    description: (p.description || p.body_html || '').replace(/<[^>]*>/g, '').trim().slice(0, 500),
    categories: (p.categories || []).map(c => typeof c === 'string' ? c : (c.name || '')),
    stock_status: p.stock || p.available || p.stock_status || 'instock',
  })).filter(p => p.name && p.price > 0);
}

// ------ TIENDANUBE HTML EXTRACTOR ------

function extractTnFromHtml(html, baseUrl) {
  const products = [];
  const seen = new Set();

  // Método 1: JSON-LD
  const ldRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = ldRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const items = parsed['@graph'] || (Array.isArray(parsed) ? parsed : [parsed]);
      for (const item of items) {
        if (item['@type'] === 'Product' && item.name && !seen.has(item.name)) {
          seen.add(item.name);
          const offers = item.offers || {};
          const price = parsePrice(offers.price || offers.lowPrice || 0);
          if (price <= 0) continue;
          products.push({
            name: item.name.trim(), price,
            url: item.url || '',
            image: typeof item.image === 'string' ? item.image : (item.image?.url) || '',
            description: (item.description || '').replace(/<[^>]*>/g, '').trim().slice(0, 500),
            source: 'jsonld',
          });
        }
      }
    } catch {}
  }

  // Método 2: TiendaNube HTML structure
  // Buscar <div class="product"> o <div class="js-product-container">
  const blocks = [];
  const productBlockRegex = /<div[^>]*class=["'][^"']*(?:product-item|product-container|js-product|item-product)[^"']*["'][^>]*>[\s\S]*?<\/div>\s*<\/div>/gi;
  let match2;
  while ((match2 = productBlockRegex.exec(html)) !== null) {
    // Limitar tamaño de bloque
    if (match2[0].length < 3000) blocks.push(match2[0]);
  }

  // Si no hay bloques, buscar <div class="row product-row"> o similar
  if (blocks.length === 0) {
    const allProductDivs = html.match(/<div[^>]*class=["'][^"']*product[^"']*["'][^>]*>[\s\S]{100,3000}?<\/div>/gi);
    if (allProductDivs) blocks.push(...allProductDivs.filter(d => d.length < 3000));
  }

  for (const block of blocks) {
    const nameMatch = block.match(/<h[23][^>]*class=["'][^"']*(?:product-title|product-name|item-name)[^"']*["'][^>]*>([\s\S]*?)<\/h[23]>/i)
      || block.match(/<a[^>]*class=["'][^"']*product-name[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)
      || block.match(/<a[^>]*title=["']([^"']{4,120})["'][^>]*>/i);
    if (!nameMatch) continue;
    const name = nameMatch[1].replace(/<[^>]*>/g, '').trim();
    if (seen.has(name) || name.length < 3 || name.length > 120) continue;

    const priceMatch = block.match(/<span[^>]*class=["'][^"']*(?:price|product-price|js-price)[^"']*["'][^>]*>\s*\$?([\d.,]+)\s*<\/span>/i)
      || block.match(/\$\s*([\d.,]{4,15})/);
    if (!priceMatch) continue;
    const price = parsePrice(priceMatch[1]);
    if (isNaN(price) || price <= 0) continue;

    const linkMatch = block.match(/<a[^>]*href=["']([^"']+)["'][^>]*>/i);
    const imgMatch = block.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/i);

    seen.add(name);
    products.push({
      name, price,
      url: linkMatch ? linkMatch[1] : '',
      image: imgMatch ? imgMatch[1] : '',
      description: '', source: 'html',
    });
  }

  // Método 3: Fallback genérico
  if (products.length === 0) {
    const priceRegex = /\$\s*((?:[\d]{1,3}[.,]?)+[\d]{2})/g;
    while ((m = priceRegex.exec(html)) !== null) {
      const price = parsePrice(m[1]);
      if (isNaN(price) || price < 50 || price > 99999999) continue;
      const before = html.slice(Math.max(0, m.index - 400), m.index);
      const aMatch = before.match(/<a[^>]*>([^<]{4,120})<\/a>/gi);
      let name = '';
      if (aMatch) name = aMatch[aMatch.length - 1].replace(/<[^>]*>/g, '').trim();
      if (!name) {
        const tMatch = before.match(/title=["']([^"']{4,120})["']/i);
        if (tMatch) name = tMatch[1];
      }
      if (!name || name.length < 3 || name.length > 120 || seen.has(name)) continue;
      if (/^(inicio|home|categor|oferta|contacto|nosotros|carrito|ingresar|registrar|buscar|ver más|leer más|comprar|whatsapp|instagram|facebook)$/i.test(name)) continue;
      name = name.replace(/\s+/g, ' ').trim();
      seen.add(name);
      products.push({ name, price, url: '', image: '', description: '', source: 'generic' });
    }
  }

  return products;
}

// ------ SUPABASE UPSERT ------

async function getExistingProducts(storeId) {
  const res = await fetch(
    SUPABASE_URL + `/rest/v1/products?select=id,product_url,canonical_name&store_id=eq.${storeId}&limit=5000`,
    { headers: AUTH }
  );
  if (!res.ok) return {};
  const list = await res.json();
  const map = {};
  for (const p of list) map[p.product_url] = p;
  return map;
}

async function upsertProducts(storeId, products, category) {
  const existing = await getExistingProducts(storeId);
  const toInsert = [];
  const toUpdate = [];
  const priceRows = [];

  for (const p of products) {
    const url = p.url || '';
    const exist = existing[url];
    const productRow = {
      canonical_name: p.name.slice(0, 255),
      raw_name: p.name.slice(0, 255),
      store_id: storeId,
      product_url: url.slice(0, 500),
      image_url: (p.image || '').slice(0, 500),
      category: autoDetectCategory(p.name) || category || 'generico',
    };

    if (exist) {
      toUpdate.push({ id: exist.id, ...productRow });
      priceRows.push({ product_id: exist.id, store_id: storeId, price: p.price, price_original: p.regular_price || p.price, is_offer: p.regular_price > 0 && p.price < p.regular_price, scraped_at: new Date().toISOString() });
    } else {
      toInsert.push(productRow);
    }
  }

  const batchSize = 50;
  let inserted = 0, updated = 0, pricesInserted = 0;

  // Insert new products
  for (let i = 0; i < toInsert.length; i += batchSize) {
    const batch = toInsert.slice(i, i + batchSize);
    try {
      const res = await fetch(SUPABASE_URL + '/rest/v1/products?select=id', {
        method: 'POST',
        headers: { ...AUTH, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify(batch),
      });
      if (res.ok) {
        const created = await res.json();
        if (Array.isArray(created)) {
          for (let j = 0; j < created.length; j++) {
            const globalIdx = i + j;
            // Match to price rows by position
          }
          inserted += created.length;
          // Add price rows for new products
          for (let j = 0; j < created.length; j++) {
            const batchIdx = i + j;
            if (batchIdx < products.length) {
              const p = products[batchIdx];
              priceRows.push({
                product_id: created[j].id,
                store_id: storeId,
                price: p.price,
                price_original: p.regular_price || p.price,
                currency: 'ARS',
                is_offer: (p.regular_price || 0) > 0 && p.price < (p.regular_price || 0),
                scraped_at: new Date().toISOString(),
              });
            }
          }
        }
      }
    } catch (e) {
      console.log(`   Error insertando: ${e.message}`);
    }
  }

  // Update existing products
  for (let i = 0; i < toUpdate.length; i += batchSize) {
    const batch = toUpdate.slice(i, i + batchSize);
    for (const item of batch) {
      try {
        await fetch(SUPABASE_URL + `/rest/v1/products?id=eq.${item.id}`, {
          method: 'PATCH', headers: { ...AUTH, 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });
        updated++;
      } catch {}
    }
  }

  // Insert prices
  for (let i = 0; i < priceRows.length; i += batchSize) {
    const batch = priceRows.slice(i, i + batchSize);
    try {
      const res = await fetch(SUPABASE_URL + '/rest/v1/prices?select=id', {
        method: 'POST',
        headers: { ...AUTH, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify(batch),
      });
      if (res.ok) {
        const data = await res.json();
        pricesInserted += Array.isArray(data) ? data.length : 0;
      }
    } catch {}
  }

  // Insert price_history
  if (priceRows.length > 0) {
    try {
      await fetch(SUPABASE_URL + '/rest/v1/price_history', {
        method: 'POST',
        headers: { ...AUTH, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify(priceRows.map(r => ({
          product_id: r.product_id,
          store_id: storeId,
          price: r.price,
          currency: 'ARS',
          scraped_at: r.scraped_at,
        }))),
      }).catch(() => {});
    } catch {}
  }

  return { inserted, updated, pricesInserted };
}

// ------ MAIN ------

async function main() {
  console.log('--- Scraper TiendaNube ---\n');

  const storesRes = await fetch(
    SUPABASE_URL + '/rest/v1/stores?select=id,name,url,category,scraping_config&scraping_config->>platform_detected=eq.Tiendanube&limit=50',
    { headers: AUTH }
  );
  let stores = await storesRes.json();
  if (!Array.isArray(stores) || stores.length === 0) {
    console.log('No se encontraron tiendas TiendaNube');
    return;
  }

  console.log(`Tiendas TiendaNube: ${stores.length}\n`);

  let totalProducts = 0;
  let storeResults = [];

  for (let si = 0; si < stores.length; si++) {
    const store = stores[si];
    const base = origin(store.url);
    if (!base) {
      console.log(`[${si + 1}/${stores.length}] ${store.name} — URL inválida`);
      continue;
    }

    console.log(`[${si + 1}/${stores.length}] ${store.name}`);
    console.log(`   Base: ${base}`);

    let products = [];
    let method = '';

    // FASE 1: TiendaNube /productos.json
    if (products.length === 0) {
      for (let page = 1; page <= 5; page++) {
        const apiUrl = `${base}/productos.json?per_page=50&page=${page}`;
        const result = await fetchJson(apiUrl);
        if (result.data && !result.error) {
          const batch = extractFromTiendanubeApi(result.data);
          const newOnes = batch.filter(p => !products.some(e => e.name === p.name));
          products.push(...newOnes);
          if (batch.length < 50) break;
        } else break;
      }
      if (products.length > 0) method = `api_productos_json (${products.length})`;
    }

    // FASE 2: HTML scraping
    if (products.length === 0) {
      const htmlPaths = ['', '/productos', '/tienda', '/catalogo'];
      for (const path of htmlPaths) {
        if (products.length > 30) break;
        const html = await fetchHtml(base + path);
        if (html && html.length > 1000) {
          const extracted = extractTnFromHtml(html, base);
          const newOnes = extracted.filter(p => !products.some(e => e.name === p.name));
          products.push(...newOnes);
        }
      }
      if (products.length > 0) method = `html (${products.length} productos)`;
    }

    if (!method) method = 'no_products_found';
    console.log(`   Método: ${method}`);
    totalProducts += products.length;

    if (products.length === 0) {
      storeResults.push({ store: store.name, products: 0, method });
      continue;
    }

    const { inserted, updated, pricesInserted } = await upsertProducts(store.id, products, store.category);
    console.log(`   Insertados: ${inserted} nuevos, ${updated} actualizados, ${pricesInserted} precios`);

    await fetch(SUPABASE_URL + `/rest/v1/stores?id=eq.${store.id}`, {
      method: 'PATCH', headers: { ...AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ last_scraped_at: new Date().toISOString() }),
    }).catch(() => {});

    storeResults.push({ store: store.name, products: inserted + updated, method });
  }

  console.log('\n--- RESUMEN ---');
  console.log('Tiendas procesadas: ' + stores.length);
  console.log('Productos totales:  ' + totalProducts);
  console.log('');
  console.log('Resultados por tienda:');
  storeResults.forEach(r => {
    console.log(`  ${r.store.slice(0, 40).padEnd(42)} ${String(r.products).padEnd(5)} ${r.method}`);
  });
}

main().catch(e => console.error('FATAL:', e));

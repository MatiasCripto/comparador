// scrape_platforms.mjs — Scraper para Shopify, Tiendanube, VTEX, PrestaShop
// Usa API de cada plataforma + fallback HTML genérico
// Uso: node scrape_platforms.mjs

import { parsePrice } from './price-utils.mjs';
import { autoDetectCategory } from './category-utils.mjs';

const SUPABASE_URL = 'https://ygqfbbkjdiryilwjrpzh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlncWZiYmtqZGlyeWlsd2pycHpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDY1NDQ5NSwiZXhwIjoyMTAwMjMwNDk1fQ.6sfmLwuOJDfGzJjglHP8X_SQzdeUOd657CdEr_DVcTk';

const AUTH = { Authorization: 'Bearer ' + SUPABASE_KEY, apikey: SUPABASE_KEY };

const PLATFORMS = ['Shopify', 'Tiendanube', 'VTEX', 'PrestaShop'];

// ------ HELPERS ------

async function fetchJsonSafe(url, timeoutMs = 10000, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: ac.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      if (res.status === 429 && attempt < retries) {
        await new Promise(r => setTimeout(r, 10000));
        continue;
      }
      if (!res.ok) return { error: 'HTTP ' + res.status, status: res.status };
      const text = await res.text();
      if (!text.trim()) return { error: 'empty' };
      return { data: JSON.parse(text), status: res.status };
    } catch (e) {
      return { error: e.message || 'fetch_error', status: 0 };
    } finally { clearTimeout(timer); }
  }
  return { error: 'max_retries', status: 429 };
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

// ------ SHOPIFY EXTRACTOR ------

function extractShopify(json, baseUrl) {
  const items = json?.products || [];
  if (!Array.isArray(items)) return [];
  return items.map(p => {
    const v = p.variants?.[0] || {};
    return {
      name: (p.title || '').trim(),
      price: parsePrice(v.price || 0),
      regular_price: parsePrice(v.compare_at_price || v.price || 0),
      url: p.handle ? baseUrl + '/products/' + p.handle : '',
      image: p.images?.[0]?.src || p.image?.src || '',
    };
  }).filter(p => p.name && p.price > 0);
}

// ------ TIENDANUBE EXTRACTOR ------

function extractTiendanube(json, baseUrl) {
  const items = Array.isArray(json) ? json : (json?.products || []);
  if (!Array.isArray(items)) return [];
  return items.map(p => ({
    name: (p.name || '').trim(),
    price: parsePrice(p.price || 0),
    regular_price: parsePrice(p.compare_at_price || p.price || 0),
    url: p.permalink || p.url || '',
    image: (typeof p.image === 'object' ? p.image?.src : p.image) || '',
  })).filter(p => p.name && p.price > 0);
}

// ------ VTEX EXTRACTOR ------

function extractVtex(json, baseUrl) {
  if (!Array.isArray(json)) return [];
  return json.map(p => {
    const item = p.items?.[0] || {};
    const offer = item.sellers?.[0]?.commertialOffer || {};
    return {
      name: (p.productName || '').trim(),
      price: parsePrice(offer.Price || 0),
      regular_price: parsePrice(offer.ListPrice || offer.Price || 0),
      url: p.link ? baseUrl + '/' + p.link + '/p' : '',
      image: item.images?.[0]?.imageUrl || '',
    };
  }).filter(p => p.name && p.price > 0);
}

// ------ PRESTASHOP EXTRACTOR ------

function extractPrestashop(json, baseUrl) {
  const items = json?.products || [];
  if (!Array.isArray(items)) return [];
  return items.map(p => {
    const name = typeof p.name === 'object' ? p.name?.language?.[0]?.value || '' : p.name || '';
    return {
      name: name.trim(),
      price: parsePrice(p.price || 0),
      regular_price: 0,
      url: '',
      image: '',
    };
  }).filter(p => p.name && p.price > 0);
}

// ------ HTML FALLBACK EXTRACTOR ------

function extractFromHtml(html, baseUrl) {
  const products = [];
  const seen = new Set();

  // Método 1: JSON-LD
  const ldRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = ldRe.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1].trim());
      const items = parsed['@graph'] || (Array.isArray(parsed) ? parsed : [parsed]);
      for (const item of items) {
        if (item['@type'] === 'Product' && item.name && !seen.has(item.name)) {
          seen.add(item.name);
          const offers = item.offers || {};
          const price = parsePrice(offers.price || offers.lowPrice || 0);
          if (price <= 0) continue;
          const img = typeof item.image === 'string' ? item.image : (item.image?.url) || '';
          products.push({ name: item.name.trim(), price, url: item.url || '', image: img });
        }
      }
    } catch {}
  }

  // Método 2: Generic price + name extraction
  const priceRe = /\$\s*((?:[\d]{1,3}[.,]?)+[\d]{2})/g;
  while ((m = priceRe.exec(html)) !== null) {
    const price = parsePrice(m[1]);
    if (isNaN(price) || price < 50 || price > 99999999) continue;
    const before = html.slice(Math.max(0, m.index - 400), m.index);
    let name = '';
    const aMatch = before.match(/<a[^>]*>([^<]{4,120})<\/a>/gi);
    if (aMatch) name = aMatch[aMatch.length - 1].replace(/<[^>]*>/g, '').trim();
    if (!name) {
      const tMatch = before.match(/title=["']([^"']{4,120})["']/i);
      if (tMatch) name = tMatch[1];
    }
    if (!name || name.length < 3 || name.length > 120 || seen.has(name)) continue;
    if (/^(inicio|home|categor|oferta|contacto|nosotros|carrito|ingresar|registrar|buscar|ver más|leer más|comprar|whatsapp|instagram|facebook)$/i.test(name)) continue;
    name = name.replace(/\s+/g, ' ').trim();
    seen.add(name);
    const lastHref = before.match(/href=["']([^"']+)["']/gi);
    let link = '';
    if (lastHref) {
      const l = lastHref[lastHref.length - 1].match(/href=["']([^"']+)["']/i);
      if (l) link = l[1];
    }
    if (link && !link.startsWith('http')) link = baseUrl + (link.startsWith('/') ? link : '/' + link);
    products.push({ name, price, url: link, image: '' });
  }
  return products;
}

// ------ PLATFORM CONFIG ------

const PLATFORM_CONFIG = {
  Shopify: { apiPath: '/products.json?limit=250', extractor: extractShopify, needsHtmlFallback: true },
  Tiendanube: { apiPath: '/productos.json?per_page=50', extractor: extractTiendanube, needsHtmlFallback: true },
  VTEX: { apiPath: '/api/catalog_system/pub/products/search', extractor: extractVtex, needsHtmlFallback: true },
  PrestaShop: { apiPath: '/api/products?output_format=JSON', extractor: extractPrestashop, needsHtmlFallback: true },
};

// ------ MAIN ------

async function main() {
  console.log('--- Scraper Multi-Plataforma ---\n');

  for (const platform of PLATFORMS) {
    console.log(`\n========== ${platform} ==========\n`);

    const storesRes = await fetch(
      SUPABASE_URL + '/rest/v1/stores?select=id,name,url,category,scraping_config'
        + `&scraping_config->>platform_detected=eq.${encodeURIComponent(platform)}&limit=30`,
      { headers: AUTH }
    );
    const stores = await storesRes.json();
    if (!Array.isArray(stores) || stores.length === 0) {
      console.log('  Sin tiendas\n');
      continue;
    }
    console.log(`  Tiendas: ${stores.length}\n`);

    const cfg = PLATFORM_CONFIG[platform];
    let totalProducts = 0, totalInserted = 0;

    for (let si = 0; si < stores.length; si++) {
      const store = stores[si];
      const base = origin(store.url);
      if (!base) { console.log(`  [${si+1}] ${store.name} — URL inválida\n`); continue; }
      console.log(`  [${si+1}/${stores.length}] ${store.name}`);
      console.log(`     Base: ${base}`);

      // Try API
      let products = [];
      let method = '';
      const apiUrl = base + cfg.apiPath;
      const result = await fetchJsonSafe(apiUrl);
      if (result.data && !result.error) {
        products = cfg.extractor(result.data, base);
        method = `api (${products.length} productos)`;
      } else if (result.status === 429) {
        method = 'rate_limited';
      } else if (result.status) {
        method = `http_${result.status}`;
      }

      // HTML fallback (si API falló)
      if (products.length === 0) {
        const html = await fetchHtml(base);
        if (html && html.length > 1000) {
          products = extractFromHtml(html, base);
          method = `html (${products.length} productos)`;
        } else if (!html) {
          method = method || 'no_response';
        } else if (html.length < 500) {
          method = method || 'html_muy_corto';
        }
      }

      if (!method) method = 'no_products';
      console.log(`     Método: ${method}`);

      totalProducts += products.length;
      if (products.length === 0) continue;

      // Clean existing data
      try {
        await fetch(SUPABASE_URL + '/rest/v1/prices?store_id=eq.' + store.id, { method: 'DELETE', headers: AUTH });
        await fetch(SUPABASE_URL + '/rest/v1/products?store_id=eq.' + store.id, { method: 'DELETE', headers: AUTH });
      } catch {}

      // Insert products + prices linked
      const batchSize = 50;
      let inserted = 0, priceInserted = 0;

      for (let bi = 0; bi < products.length; bi += batchSize) {
        const batch = products.slice(bi, bi + batchSize);
        const productRows = batch.map(p => ({
          canonical_name: p.name.slice(0, 255),
          raw_name: p.name.slice(0, 255),
          store_id: store.id,
          product_url: p.url.slice(0, 500),
          image_url: p.image.slice(0, 500),
          category: autoDetectCategory(p.name) || store.category || 'generico',
        }));

        try {
          const insertRes = await fetch(SUPABASE_URL + '/rest/v1/products?select=id', {
            method: 'POST',
            headers: { ...AUTH, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
            body: JSON.stringify(productRows),
          });
          if (!insertRes.ok) { console.log(`     Error insertando productos`); continue; }
          const created = await insertRes.json();
          if (!Array.isArray(created)) continue;
          inserted += created.length;

          const priceRows = created.map((prod, idx) => ({
            product_id: prod.id,
            store_id: store.id,
            price: batch[idx].price,
            price_original: batch[idx].regular_price > 0 ? batch[idx].regular_price : batch[idx].price,
            currency: 'ARS',
            is_offer: batch[idx].regular_price > 0 && batch[idx].price < batch[idx].regular_price,
            scraped_at: new Date().toISOString(),
          }));

          const priceRes = await fetch(SUPABASE_URL + '/rest/v1/prices?select=id', {
            method: 'POST',
            headers: { ...AUTH, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
            body: JSON.stringify(priceRows),
          });
          if (priceRes.ok) {
            const pd = await priceRes.json();
            priceInserted += Array.isArray(pd) ? pd.length : 0;
          }
        } catch (e) { console.log(`     Error lote: ${e.message}`); }
      }
      console.log(`     Insertados: ${inserted} productos, ${priceInserted} precios`);
      totalInserted += inserted;
    }
    console.log(`\n  → ${platform}: ${totalProducts} encontrados, ${totalInserted} insertados`);
  }

  // Summary
  const allRes = await fetch(SUPABASE_URL + '/rest/v1/products?select=count', { headers: AUTH });
  const allCount = (await allRes.json())[0]?.count || 0;
  const priceRes = await fetch(SUPABASE_URL + '/rest/v1/prices?select=count', { headers: AUTH });
  const priceCount = (await priceRes.json())[0]?.count || 0;
  console.log('\n\n========== RESUMEN ==========');
  console.log(`Productos totales en DB: ${allCount}`);
  console.log(`Precios totales en DB:   ${priceCount}`);
}

main().catch(e => console.error('FATAL:', e));

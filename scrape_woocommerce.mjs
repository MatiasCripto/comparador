// scrape_woocommerce.mjs — Scraper de productos WooCommerce
// Intenta múltiples endpoints REST de WooCommerce + fallback HTML
// Uso: node scrape_woocommerce.mjs

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

// ------ WOOCOMMERCE API EXTRACTORS ------

// WC Store API (v1, público) — disponible en WC 3.7+
// La API devuelve precios como enteros en unidad minor (currency_minor_unit).
// Ej: minor_unit=2 significa que "4167000" = 41.670,00 ARS
function extractFromStoreApi(json, storeUrl) {
  if (!Array.isArray(json)) return [];
  return json.map(p => {
    const minorUnit = p.prices?.currency_minor_unit ?? 2;
    const divisor = Math.pow(10, minorUnit);
    const rawPrice = parseFloat(p.prices?.price || 0);
    const rawRegular = parseFloat(p.prices?.regular_price || 0);
    return {
      name: (p.name || '').trim(),
      price: isNaN(rawPrice) ? 0 : rawPrice / divisor,
      regular_price: isNaN(rawRegular) ? 0 : rawRegular / divisor,
      currency: p.prices?.currency_code || 'ARS',
      url: p.permalink || '',
      image: (p.images && p.images[0]?.src) || '',
      description: (p.description || '').replace(/<[^>]*>/g, '').trim().slice(0, 500),
      categories: (p.categories || []).map(c => c.name || c.slug || ''),
      stock_status: p.is_in_stock !== false ? 'instock' : 'outofstock',
    };
  }).filter(p => p.name && p.price > 0);
}

// WC REST API v3 (needs consumer key/secret)
function extractFromV3Api(json) {
  const items = Array.isArray(json) ? json : [];
  return items.map(p => ({
    name: (p.name || '').trim(),
    price: parsePrice(p.price || p.regular_price || 0),
    regular_price: parsePrice(p.regular_price || 0),
    currency: 'ARS',
    url: p.permalink || '',
    image: (p.images && p.images[0]?.src) || '',
    description: (p.description || '').replace(/<[^>]*>/g, '').trim().slice(0, 500),
    categories: (p.categories || []).map(c => c.name || ''),
    stock_status: p.stock_status || 'instock',
  })).filter(p => p.name && p.price > 0);
}

// WordPress REST API (custom post type 'product')
function extractFromWpApi(json) {
  const items = Array.isArray(json) ? json : [];
  return items.map(p => ({
    name: (p.title?.rendered || '').trim(),
    price: 0,
    regular_price: 0,
    currency: 'ARS',
    url: p.link || '',
    image: (p._embedded?.['wp:featuredmedia']?.[0]?.source_url) || '',
    description: (p.content?.rendered || '').replace(/<[^>]*>/g, '').trim().slice(0, 500),
    categories: (p._embedded?.['wp:term']?.[0] || []).map(c => c.name || ''),
    stock_status: 'instock',
  })).filter(p => p.name);
}

// ------ HTML FALLBACK EXTRACTOR ------

function extractFromHtml(html, baseUrl) {
  const products = [];
  const seen = new Set();

  // Buscar patrones de productos WooCommerce en HTML
  // Los productos suelen estar en <li class="product"> o <div class="product">

  // Método 1: JSON-LD (más confiable)
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
          const img = typeof item.image === 'string' ? item.image : (item.image?.url) || '';
          products.push({
            name: item.name.trim(),
            price,
            url: item.url || '',
            image: img,
            description: (item.description || '').replace(/<[^>]*>/g, '').trim().slice(0, 500),
            source: 'jsonld',
          });
        }
      }
    } catch {}
  }

  // Método 2: Patrones HTML comunes de WooCommerce
  // Buscar <li class="*product*"> conteniendo precio y nombre
  const productBlocks = html.match(/<li[^>]*class="[^"]*product[^"]*"[^>]*>[\s\S]*?<\/li>/gi) || [];
  const divBlocks = html.match(/<div[^>]*class="[^"]*product[^"]*"[^>]*>[\s\S]*?<\/div>/gi) || [];

  for (const block of [...productBlocks, ...divBlocks]) {
    const nameMatch = block.match(/<h2[^>]*class="[^"]*woocommerce-loop-product__title[^"]*"[^>]*>([^<]+)<\/h2>/i)
      || block.match(/<h[23][^>]*>([^<]{3,120})<\/h[23]>/i);
    if (!nameMatch) continue;
    const name = nameMatch[1].trim();
    if (seen.has(name) || name.length < 3 || name.length > 120) continue;

    const priceMatch = block.match(/<span class="woocommerce-Price-amount amount"><bdi>\s*\$?([\d.,]+)\s*<\/bdi><\/span>/i)
      || block.match(/\$\s*([\d.,]+)/);
    if (!priceMatch) continue;
    const price = parsePrice(priceMatch[1]);
    if (isNaN(price) || price <= 0) continue;

    const linkMatch = block.match(/<a[^>]*href="([^"]+)"[^>]*>/i);
    const imgMatch = block.match(/<img[^>]*src="([^"]+)"[^>]*>/i);

    seen.add(name);
    products.push({
      name,
      price,
      url: linkMatch ? linkMatch[1] : '',
      image: imgMatch ? imgMatch[1] : '',
      description: '',
      source: 'html',
    });
  }

  // Método 3: Precio genérico + <a> tag más cercano (fallback)
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

      const lastHref = before.match(/href=["']([^"']+)["']/gi);
      let link = '';
      if (lastHref) {
        const l = lastHref[lastHref.length - 1].match(/href=["']([^"']+)["']/i);
        if (l) link = l[1];
      }
      if (link && !link.startsWith('http')) {
        const origin = baseUrl.split('/').slice(0, 3).join('/');
        link = origin + (link.startsWith('/') ? link : '/' + link);
      }

      products.push({ name, price, url: link, image: '', description: '', source: 'generic' });
    }
  }

  return products;
}

// ------ SUPABASE ------

function origin(url) {
  try { return new URL(url).origin; } catch { return null; }
}

// ------ MAIN ------

async function main() {
  console.log('--- Scraper WooCommerce ---\n');

  // Obtener tiendas WooCommerce
  const storesRes = await fetch(
    SUPABASE_URL + '/rest/v1/stores?select=id,name,url,category,scraping_config&scraping_config->>platform_detected=eq.WooCommerce&limit=50',
    { headers: AUTH }
  );
  let stores = await storesRes.json();
  if (!Array.isArray(stores) || stores.length === 0) {
    console.log('No se encontraron tiendas WooCommerce');
    return;
  }

  console.log(`Tiendas WooCommerce: ${stores.length}\n`);

  let totalProducts = 0;
  let totalInserted = 0;
  let storeResults = [];

  for (let si = 0; si < stores.length; si++) {
    const store = stores[si];
    const base = origin(store.url);
    if (!base) {
      console.log(`[${si+1}/${stores.length}] ${store.name} — URL inválida`);
      continue;
    }

    console.log(`[${si+1}/${stores.length}] ${store.name}`);
    console.log(`   Base: ${base}`);

    let products = [];
    let method = '';

    // FASE 1: Intentar WC Store API (pública, no necesita auth)
    if (products.length === 0) {
      const apiUrl = base + '/wp-json/wc/store/v1/products?per_page=100';
      const result = await fetchJson(apiUrl);
      if (result.data && !result.error) {
        products = extractFromStoreApi(result.data, base);
        method = `store_api (${products.length} productos)`;
      }
    }

    // FASE 2: Intentar WC REST v3 (lo que pidió el usuario)
    if (products.length === 0) {
      const apiUrl = base + '/wp-json/wc/v3/products?per_page=100';
      const result = await fetchJson(apiUrl);
      if (result.data && !result.error) {
        products = extractFromV3Api(result.data);
        method = `v3_api (${products.length} productos)`;
      } else if (result.status === 401 || (result.data && result.data.code === 'woocommerce_rest_authentication_error')) {
        method = 'v3_api_needs_auth';
      }
    }

    // FASE 3: Intentar WP REST API (custom post type 'product')
    if (products.length === 0) {
      const apiUrl = base + '/wp-json/wp/v2/product?per_page=100&_embed';
      const result = await fetchJson(apiUrl);
      if (result.data && !result.error) {
        products = extractFromWpApi(result.data);
        method = `wp_api (${products.length} productos)`;
      }
    }

    // FASE 4: HTML fallback en /shop
    if (products.length === 0) {
      const html = await fetchHtml(base + '/shop');
      if (html && html.length > 1000) {
        products = extractFromHtml(html, base);
        method = `html_shop (${products.length} productos)`;
      }
    }

    // FASE 5: HTML fallback en homepage
    if (products.length === 0) {
      const html = await fetchHtml(base);
      if (html && html.length > 1000) {
        products = extractFromHtml(html, base);
        method = `html_home (${products.length} productos)`;
      }
    }

    if (!method) method = 'no_products_found';
    console.log(`   Método: ${method}`);
    totalProducts += products.length;

    if (products.length === 0) {
      storeResults.push({ store: store.name, products: 0, method });
      continue;
    }

    // Limpiar datos existentes de esta tienda (precios primero por FK)
    try {
      await fetch(SUPABASE_URL + '/rest/v1/prices?store_id=eq.' + store.id, { method: 'DELETE', headers: AUTH });
      await fetch(SUPABASE_URL + '/rest/v1/products?store_id=eq.' + store.id, { method: 'DELETE', headers: AUTH });
    } catch {}

    // Insertar productos y precios con IDs vinculados
    const batchSize = 50;
    let inserted = 0;
    let priceInserted = 0;

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

        if (!insertRes.ok) {
          const err = await insertRes.text();
          console.log(`   Error insertando productos: ${err.slice(0, 200)}`);
          continue;
        }

        const created = await insertRes.json();
        if (!Array.isArray(created) || created.length === 0) continue;
        inserted += created.length;

        const priceRows = created.map((prod, idx) => ({
          product_id: prod.id,
          store_id: store.id,
          price: batch[idx].price,
          price_original: batch[idx].regular_price > 0 ? batch[idx].regular_price : batch[idx].price,
          currency: batch[idx].currency || 'ARS',
          is_offer: batch[idx].regular_price > 0 && batch[idx].price < batch[idx].regular_price,
          scraped_at: new Date().toISOString(),
        }));

        const priceRes = await fetch(SUPABASE_URL + '/rest/v1/prices?select=id', {
          method: 'POST',
          headers: { ...AUTH, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
          body: JSON.stringify(priceRows),
        });

        if (priceRes.ok) {
          const priceData = await priceRes.json();
          priceInserted += Array.isArray(priceData) ? priceData.length : 0;
        } else {
          const err = await priceRes.text();
          console.log(`   Error insertando precios: ${err.slice(0, 200)}`);
        }
      } catch (e) {
        console.log(`   Error en lote ${bi}: ${e.message}`);
      }
    }

    console.log(`   Insertados: ${inserted} productos, ${priceInserted} precios`);
    totalInserted += inserted;
    storeResults.push({ store: store.name, products: inserted, method });
  }

  console.log('\n--- RESUMEN ---');
  console.log('Tiendas procesadas:  ' + stores.length);
  console.log('Productos totales:   ' + totalProducts);
  console.log('Productos insertados:' + totalInserted);
  console.log('');
  console.log('Resultados por tienda:');
  storeResults.forEach(r => {
    console.log(`  ${r.store.slice(0, 40).padEnd(42)} ${String(r.products).padEnd(5)} ${r.method}`);
  });
}

main().catch(e => console.error('FATAL:', e));

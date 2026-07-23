// scrape_prestashop.mjs — Scraper de productos PrestaShop
// Endpoint: /api/products?output_format=JSON&limit=100&page=1
// Fallback: HTML scraping de homepage y categorías
// Uso: node scrape_prestashop.mjs

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

// ------ PRESTASHOP API EXTRACTOR ------

function extractFromPrestaApi(json) {
  // PrestaShop API returns: { products: [...] } con schema PrestaShop
  const products = json?.products || (Array.isArray(json) ? json : []);
  if (!Array.isArray(products)) return [];

  return products.map(p => ({
    name: (typeof p.name === 'object' ? (p.name.language?.[0]?.value || p.name[0]?.value || '') : (p.name || '')).trim(),
    price: parsePrice(p.price || 0),
    regular_price: parsePrice(p.regular_price || p.price || 0),
    currency: 'ARS',
    url: (typeof p.link_rewrite === 'object' ? '' : (p.link || p.link_rewrite || '')),
    image: '',
    description: (typeof p.description === 'object' ? '' : (p.description || '')).replace(/<[^>]*>/g, '').trim().slice(0, 500),
    categories: [],
    stock_status: p.active == '1' ? 'instock' : 'outofstock',
  })).filter(p => p.name && p.price > 0);
}

// ------ PRESTASHOP HTML EXTRACTOR ------

function extractPrestaFromHtml(html, baseUrl) {
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

  // Método 2: PrestaShop HTML structure
  // Buscar productos en article[data-id-product] o div.product-container
  const productRegex = /<article[^>]*data-id-product=["'](\d+)["'][^>]*>[\s\S]*?<\/article>/gi;
  const divProductRegex = /<div[^>]*class=["'][^"']*product-container[^"']*["'][^>]*>[\s\S]*?<\/div>\s*<\/div>/gi;

  const blocks = [];
  let match;
  while ((match = productRegex.exec(html)) !== null) blocks.push(match[0]);
  if (blocks.length === 0) {
    const divMatch = html.match(divProductRegex);
    if (divMatch) blocks.push(...divMatch);
  }

  for (const block of blocks) {
    // Nombre: <h2 class="product-title"> o <a class="product-name">
    const nameMatch = block.match(/<h[23][^>]*class=["'][^"']*product-title[^"']*["'][^>]*>([\s\S]*?)<\/h[23]>/i)
      || block.match(/<a[^>]*class=["'][^"']*product-name[^"']*["'][^>]*>([\s\S]*?)<\/a>/i)
      || block.match(/alt=["']([^"']{3,120})["']/i);

    if (!nameMatch) continue;
    const name = nameMatch[1].replace(/<[^>]*>/g, '').trim();
    if (seen.has(name) || name.length < 3 || name.length > 120) continue;

    // Precio: .price o span.price
    const priceMatch = block.match(/<span[^>]*class=["'][^"']*price[^"']*["'][^>]*>\s*\$?([\d.,]+)\s*<\/span>/i)
      || block.match(/<span[^>]*itemprop=["']price["'][^>]*content=["']([\d.]+)["']/i)
      || block.match(/\$\s*([\d.,]+)/);
    if (!priceMatch) continue;
    const price = parsePrice(priceMatch[1]);
    if (isNaN(price) || price <= 0) continue;

    // URL y imagen
    const linkMatch = block.match(/<a[^>]*href=["']([^"']+)["'][^>]*>/i);
    const imgMatch = block.match(/<img[^>]*src=["']([^"']+)["'][^>]*>/i);

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

  // Método 3: Fallback genérico (mismo que WooCommerce)
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

// ------ SUPABASE UPSERT ------

async function getExistingProducts(storeId) {
  const res = await fetch(
    SUPABASE_URL + `/rest/v1/products?select=id,product_url,canonical_name,price&store_id=eq.${storeId}&limit=5000`,
    { headers: AUTH }
  );
  if (!res.ok) return {};
  const list = await res.json();
  const map = {};
  for (const p of list) {
    map[p.product_url] = p;
  }
  return map;
}

async function upsertProducts(storeId, products) {
  const existing = await getExistingProducts(storeId);
  const toInsert = [];
  const toUpdate = [];
  const priceRows = [];

  for (const p of products) {
    const url = p.url || p.product_url || '';
    const exist = existing[url];
    const productRow = {
      canonical_name: p.name.slice(0, 255),
      raw_name: p.name.slice(0, 255),
      store_id: storeId,
      product_url: url.slice(0, 500),
      image_url: (p.image || '').slice(0, 500),
      category: p.categories?.[0] || autoDetectCategory(p.name) || storeCategory || 'generico',
    };

    if (exist) {
      toUpdate.push({ id: exist.id, ...productRow });
      priceRows.push({ product_id: exist.id, store_id: storeId, price: p.price, scraped_at: new Date().toISOString() });
    } else {
      toInsert.push(productRow);
      priceRows.push({ product_id: null, store_id: storeId, price: p.price, scraped_at: new Date().toISOString() });
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
            // Assign IDs to price rows
            const idx = i + j;
            if (idx < priceRows.length) {
              priceRows[idx].product_id = created[j].id;
            }
          }
          inserted += created.length;
        }
      }
    } catch (e) {
      console.log(`   Error insertando productos: ${e.message}`);
    }
  }

  // Update existing products
  for (let i = 0; i < toUpdate.length; i += batchSize) {
    const batch = toUpdate.slice(i, i + batchSize);
    for (const item of batch) {
      try {
        await fetch(SUPABASE_URL + `/rest/v1/products?id=eq.${item.id}`, {
          method: 'PATCH',
          headers: { ...AUTH, 'Content-Type': 'application/json' },
          body: JSON.stringify(item),
        });
        updated++;
      } catch {}
    }
  }

  // Insert prices (only for products that have IDs assigned)
  const validPriceRows = priceRows.filter(r => r.product_id);
  for (let i = 0; i < validPriceRows.length; i += batchSize) {
    const batch = validPriceRows.slice(i, i + batchSize);
    try {
      const res = await fetch(SUPABASE_URL + '/rest/v1/prices?select=id', {
        method: 'POST',
        headers: { ...AUTH, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify(batch.map(r => ({
          product_id: r.product_id,
          store_id: storeId,
          price: r.price,
          price_original: r.price,
          currency: 'ARS',
          is_offer: false,
          scraped_at: r.scraped_at,
        }))),
      });
      if (res.ok) {
        const data = await res.json();
        pricesInserted += Array.isArray(data) ? data.length : 0;
      }
    } catch {}
  }

  // Insert into price_history
  if (validPriceRows.length > 0) {
    try {
      await fetch(SUPABASE_URL + '/rest/v1/price_history', {
        method: 'POST',
        headers: { ...AUTH, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify(validPriceRows.map(r => ({
          product_id: r.product_id,
          store_id: storeId,
          price: r.price,
          currency: 'ARS',
          scraped_at: r.scraped_at,
        }))),
      });
    } catch (e) {
      console.log(`   Error en price_history: ${e.message}`);
    }
  }

  return { inserted, updated, pricesInserted };
}

// ------ PRESTASHOP HTML PAGINATION ------

async function scrapePrestaHtml(base, maxPages = 5) {
  let allProducts = [];
  const categoryPaths = ['', '/tienda', '/productos', '/catalogo', '/products', '/store'];

  for (const cat of categoryPaths) {
    if (allProducts.length > 50) break;
    for (let page = 1; page <= maxPages; page++) {
      const pageUrl = base + cat + (cat ? '' : '') + (page > 1 ? `?page=${page}` : '');
      const html = await fetchHtml(pageUrl);
      if (!html || html.length < 500) break;
      const products = extractPrestaFromHtml(html, base);
      const newProducts = products.filter(p => !allProducts.some(e => e.url === p.url && e.name === p.name));
      allProducts.push(...newProducts);
      if (products.length < 5) break; // No more products on this page
    }
  }

  return allProducts.slice(0, 200); // Cap at 200 per store
}

// ------ MAIN ------

let storeCategory = 'generico';

async function main() {
  console.log('--- Scraper PrestaShop ---\n');

  const storesRes = await fetch(
    SUPABASE_URL + '/rest/v1/stores?select=id,name,url,category,scraping_config&scraping_config->>platform_detected=eq.PrestaShop&limit=50',
    { headers: AUTH }
  );
  let stores = await storesRes.json();
  if (!Array.isArray(stores) || stores.length === 0) {
    console.log('No se encontraron tiendas PrestaShop');
    return;
  }

  console.log(`Tiendas PrestaShop: ${stores.length}\n`);

  let totalProducts = 0;
  let storeResults = [];

  for (let si = 0; si < stores.length; si++) {
    const store = stores[si];
    const base = origin(store.url);
    if (!base) {
      console.log(`[${si + 1}/${stores.length}] ${store.name} — URL inválida`);
      continue;
    }

    storeCategory = store.category || 'generico';
    console.log(`[${si + 1}/${stores.length}] ${store.name}`);
    console.log(`   Base: ${base}`);

    let products = [];
    let method = '';

    // FASE 1: Intentar PrestaShop API
    if (products.length === 0) {
      const apiUrl = base + '/api/products?output_format=JSON&limit=100';
      const result = await fetchJson(apiUrl);
      if (result.data && !result.error) {
        products = extractFromPrestaApi(result.data).map(p => {
          // Construir URL del producto si no viene
          if (!p.url) {
            p.url = base + '/product/' + p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50);
          } else if (!p.url.startsWith('http')) {
            p.url = base + '/' + p.url.replace(/^\//, '');
          }
          return p;
        });
        method = `api (${products.length} productos)`;
      }
    }

    // FASE 2: HTML scraping
    if (products.length === 0) {
      products = await scrapePrestaHtml(base);
      method = `html (${products.length} productos)`;
    }

    if (!method) method = 'no_products_found';
    console.log(`   Método: ${method}`);
    totalProducts += products.length;

    if (products.length === 0) {
      storeResults.push({ store: store.name, products: 0, method });
      continue;
    }

    // Upsert products
    const { inserted, updated, pricesInserted } = await upsertProducts(store.id, products);
    console.log(`   Insertados: ${inserted} nuevos, ${updated} actualizados, ${pricesInserted} precios`);

    // Update last_scraped_at
    await fetch(SUPABASE_URL + `/rest/v1/stores?id=eq.${store.id}`, {
      method: 'PATCH',
      headers: { ...AUTH, 'Content-Type': 'application/json' },
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

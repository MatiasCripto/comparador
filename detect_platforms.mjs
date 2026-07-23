// detect_platforms.mjs — Detecta plataforma de cada tienda
// 1) Prueba API: /productos.json, /products.json, /wp-json/
// 2) Fallback: descarga homepage y busca patrones en HTML
// Uso: node detect_platforms.mjs

const SUPABASE_URL = 'https://ygqfbbkjdiryilwjrpzh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlncWZiYmtqZGlyeWlsd2pycHpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDY1NDQ5NSwiZXhwIjoyMTAwMjMwNDk1fQ.6sfmLwuOJDfGzJjglHP8X_SQzdeUOd657CdEr_DVcTk';

const AUTH = { Authorization: 'Bearer ' + SUPABASE_KEY, apikey: SUPABASE_KEY };

// ------ HELPERS ------

function origin(url) {
  try { return new URL(url).origin; } catch { return null; }
}

async function probeJson(url, timeoutMs = 5000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ac.signal, headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text.trim()) return null;
    return JSON.parse(text);
  } catch { return null; }
  finally { clearTimeout(timer); }
}

async function fetchHtml(url, timeoutMs = 8000) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: ac.signal, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; }
  finally { clearTimeout(timer); }
}

// ------ PLATFORM DETECTION ------

function detectPlatformFromHtml(html, baseUrl) {
  const h = html.toLowerCase();

  // 1) Tiendanube: patrones en HTML o URL
  if (h.includes('tiendanube') || h.includes('cdn.tiendanube') || h.includes('nubecommerce') || h.includes('/assets/nube/')) {
    return 'Tiendanube';
  }

  // 2) Shopify
  if (h.includes('shopify') || h.includes('myshopify') || h.includes('cdn.shopify')) {
    return 'Shopify';
  }

  // 3) WooCommerce
  if (h.includes('woocommerce') || h.includes('wc-') || h.includes('/wp-content/plugins/')) {
    return 'WooCommerce';
  }

  // 4) PrestaShop
  if (h.includes('prestashop') || h.includes('ps_') || h.includes('/themes/') && h.includes('controller')) {
    return 'PrestaShop';
  }

  // 5) MercadoShops
  if (h.includes('mercadoshops') || h.includes('mercadolibre') || baseUrl.includes('mercadoshops')) {
    return 'MercadoShops';
  }

  // 6) VTEX
  if (h.includes('vtex') || h.includes('vtexassets') || h.includes('vteximg')) {
    return 'VTEX';
  }

  // 7) Detectar JSON-LD con Product (tiene datos estructurados)
  if (h.includes('"@type":"product"') || h.includes("'@type':'product'") || h.includes('"@type": "product"')) {
    return 'JSON-LD';
  }

  return null;
}

function detectPlatformFromApi(json, url) {
  // Tiendanube /productos.json → { products: [...] } o [...]
  if (url.includes('productos.json')) {
    if (Array.isArray(json)) return json.length > 0 ? 'Tiendanube' : null;
    if (json && Array.isArray(json.products)) return 'Tiendanube';
    if (json && typeof json === 'object' && Object.keys(json).length > 0 && Object.values(json).some(v => Array.isArray(v))) return 'Tiendanube';
  }

  // Shopify /products.json → { products: [...] }
  if (url.includes('products.json')) {
    if (json && Array.isArray(json.products)) return 'Shopify';
    if (Array.isArray(json)) return 'Shopify';
  }

  // WooCommerce /wp-json/
  if (url.includes('wp-json')) {
    if (Array.isArray(json) && json.length > 0) return 'WooCommerce';
    // WooCommerce sin auth devuelve error con "woocommerce_rest" o "oauth"
    if (json && json.code && typeof json.code === 'string' && json.code.includes('woocommerce')) return 'WooCommerce';
  }

  return null;
}

function getScrapeMethod(platform) {
  if (!platform) return 'http_get_html';
  if (platform === 'Tiendanube') return 'api_productos_json';
  if (platform === 'Shopify') return 'api_products_json';
  if (platform === 'WooCommerce') return 'api_wp_json';
  return 'http_get_html';
}

function isBlocked(html) {
  if (!html) return 'no_response';
  const h = html.toLowerCase();
  if (h.includes('just a moment') || h.includes('cloudflare') || h.includes('cf-ray')) return 'cloudflare';
  if (h.includes('captcha') || h.includes('challenge') || h.includes('attention required')) return 'cloudflare';
  return null;
}

// ------ MAIN ------

async function main() {
  console.log('--- Detectando plataformas ---\n');

  const storesRes = await fetch(SUPABASE_URL + '/rest/v1/stores?select=id,name,url,scraping_config&limit=200', { headers: AUTH });
  const stores = await storesRes.json();
  if (!Array.isArray(stores) || stores.length === 0) { console.log('No se encontraron stores'); return; }
  console.log('Tiendas:', stores.length, '\n');

  const BATCH = 10;
  let totalTiendanube = 0, totalShopify = 0, totalWoo = 0, totalBlocked = 0, totalUnknown = 0;

  for (let i = 0; i < stores.length; i += BATCH) {
    const batch = stores.slice(i, i + BATCH);
    console.log(`Lote ${Math.floor(i / BATCH) + 1}/${Math.ceil(stores.length / BATCH)} (${i + 1}-${Math.min(i + BATCH, stores.length)})`);

    const results = await Promise.allSettled(batch.map(async (store) => {
      const base = origin(store.url);
      if (!base) return { store, platform: null, method: 'invalid_url', note: 'URL invalida' };

      let platform = null;
      let method = 'http_get_html';
      let note = '';

      // FASE 1: Probar API endpoints
      for (const [path, label] of [['/productos.json?per_page=3', 'Tiendanube'], ['/products.json?limit=3', 'Shopify'], ['/wp-json/wc/v3/products', 'WooCommerce']]) {
        const apiUrl = base + path;
        const json = await probeJson(apiUrl);
        if (json) {
          const detected = detectPlatformFromApi(json, apiUrl);
          if (detected) {
            platform = detected;
            method = getScrapeMethod(detected);
            note = 'api_' + path.split('?')[0].replace('/', '');
            break;
          }
        }
      }

      // FASE 2: Si API no detectó nada, probar HTML
      if (!platform) {
        const html = await fetchHtml(base);
        const blocked = isBlocked(html);

        if (blocked === 'cloudflare') {
          platform = null;
          method = 'needs_puppeteer';
          note = 'cloudflare';
        } else if (html && html.length > 500) {
          platform = detectPlatformFromHtml(html, base);
          method = 'http_get_html';
          note = 'html_' + (platform ? platform.toLowerCase() : 'unknown');

          // Si no detectó plataforma pero hay JSON-LD, ver si hay productos
          if (!platform && html.includes('"@type"')) {
            const hasProduct = html.includes('"Product"') || html.includes("'Product'");
            note = hasProduct ? 'html_jsond_products' : 'html_no_platform';
          }
        } else if (!html) {
          method = 'needs_puppeteer';
          note = 'no_response';
        } else if (html.length < 500) {
          method = 'needs_puppeteer';
          note = 'html_muy_corto';
        }
      }

      return { store, platform, method, note };
    }));

    // Update stores
    const updates = results.map(async (result) => {
      if (result.status !== 'fulfilled') return;
      const { store, platform, method, note } = result.value;
      const oldConfig = store.scraping_config || {};
      const newConfig = {
        ...oldConfig,
        platform_detected: platform,
        scrape_method: method,
        platform_note: note,
        platform_checked_at: new Date().toISOString(),
      };

      await fetch(SUPABASE_URL + '/rest/v1/stores?id=eq.' + store.id, {
        method: 'PATCH',
        headers: { ...AUTH, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ scraping_config: newConfig }),
      });

      if (platform === 'Tiendanube') totalTiendanube++;
      else if (platform === 'Shopify') totalShopify++;
      else if (platform === 'WooCommerce') totalWoo++;
      else if (method === 'needs_puppeteer') totalBlocked++;
      else totalUnknown++;

      const status = (platform || (method === 'needs_puppeteer' ? '🚫 BLOCKED' : 'Unknown')).padEnd(15);
      console.log(`  ${status} ${store.name.slice(0, 38).padEnd(40)} ${note}`);
    });

    await Promise.all(updates);
    if (i + BATCH < stores.length) console.log('');
  }

  console.log('\n--- RESUMEN ---');
  console.log('Tiendanube:              ' + totalTiendanube);
  console.log('Shopify:                 ' + totalShopify);
  console.log('WooCommerce:             ' + totalWoo);
  console.log('🚫 Blocked (needs Puppeteer): ' + totalBlocked);
  console.log('❓ Unknown (accesible):   ' + totalUnknown);
  console.log('─────────────────────────────');
  console.log('Total:                   ' + (totalTiendanube + totalShopify + totalWoo + totalBlocked + totalUnknown));
}

main().catch(e => console.error('FATAL:', e));

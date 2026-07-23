// fix_prices.mjs — Corrige precios inflados por el bug de parseFloat
// El bug: extractFromHtml() hacía .replace(/\./g, '') que eliminaba los puntos
// decimales del formato inglés, multiplicando precios por 100.
// Ej: "28267.64" → "2826764" (en vez de 28267.64)
//
// Heurística: si el precio medio de una tienda WooCommerce es > 500,000,
// todos sus precios están inflados y se dividen por 100.
// Para tiendas borderline, se corrigen precios individuales > 500,000.
//
// Uso: node fix_prices.mjs

import { parsePrice } from './price-utils.mjs';

const SUPABASE_URL = 'https://ygqfbbkjdiryilwjrpzh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlncWZiYmtqZGlyeWlsd2pycHpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDY1NDQ5NSwiZXhwIjoyMTAwMjMwNDk1fQ.6sfmLwuOJDfGzJjglHP8X_SQzdeUOd657CdEr_DVcTk';
const AUTH = { Authorization: 'Bearer ' + SUPABASE_KEY, apikey: SUPABASE_KEY };

// Categorías donde precios altos PUEDEN ser legítimos (electrodomésticos, electronica)
const HIGH_PRICE_CATEGORIES = new Set(['electronica', 'electrodomesticos', 'construccion',
  'herramientas', 'industria', 'automotor', 'ceramicas']);

async function getJson(path) {
  const res = await fetch(SUPABASE_URL + path, { headers: AUTH });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json();
}

async function main() {
  console.log('=== Fix de Precios Inflados (bug parseFloat HTML) ===\n');

  // 1. Get all stores
  const stores = await getJson('/rest/v1/stores?select=id,name,category,scraping_config&limit=200');
  if (!Array.isArray(stores)) { console.log('Error obteniendo stores'); return; }
  console.log(`Total tiendas: ${stores.length}\n`);

  let totalFixed = 0;
  let totalSkipped = 0;
  let storeResults = [];

  for (const store of stores) {
    const platform = store.scraping_config?.platform_detected || null;

    // Get all prices for this store
    const prices = await getJson(`/rest/v1/prices?select=id,price,price_original&store_id=eq.${store.id}&limit=500`);
    if (!Array.isArray(prices) || prices.length === 0) continue;

    const vals = prices.map(p => p.price).sort((a, b) => a - b);
    const min = vals[0];
    const max = vals[vals.length - 1];
    const median = vals.length % 2
      ? vals[Math.floor(vals.length / 2)]
      : (vals[vals.length / 2 - 1] + vals[vals.length / 2]) / 2;

    // Check if this store needs fixing
    // HARD threshold: median > 500K = fix ALL
    // SOFT threshold: individual prices > 500K in certain categories
    const fixAll = median > 500000;

    if (!fixAll) {
      // Check individual prices
      const expensiveCount = prices.filter(p => p.price > 500000).length;
      if (expensiveCount === 0) {
        totalSkipped += prices.length;
        continue;
      }
    }

    // Fix: divide by 100
    let fixed = 0;
    let errors = 0;

    for (const p of prices) {
      if (!fixAll && p.price <= 500000) {
        totalSkipped++;
        continue;
      }

      const corrected = Math.round(p.price / 100);
      if (corrected <= 0 && p.price > 0) {
        console.log(`  ⚠ Skipping ${store.name.slice(0, 30)}: price ${p.price} → 0 after fix`);
        totalSkipped++;
        continue;
      }

      try {
        const body = { price: corrected };
        if (p.price_original != null) {
          body.price_original = Math.round(p.price_original / 100);
        }

        const res = await fetch(
          SUPABASE_URL + `/rest/v1/prices?id=eq.${p.id}`,
          {
            method: 'PATCH',
            headers: { ...AUTH, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
            body: JSON.stringify(body),
          }
        );

        if (!res.ok) {
          const err = await res.text().catch(() => '');
          console.log(`  ✗ Error updating ${p.id.slice(0, 8)}: ${err.slice(0, 100)}`);
          errors++;
        } else {
          fixed++;
        }
      } catch (e) {
        errors++;
      }
    }

    totalFixed += fixed;
    const status = fixAll ? 'ALL ÷100' : 'spotted ÷100';
    console.log(`${status.padEnd(12)} ${store.name.slice(0, 40).padEnd(42)} ${String(prices.length).padStart(4)} prices → ${fixed} fixed, ${errors} errors (min:${min} max:${max} med:${Math.round(median)})`);
    storeResults.push({ store: store.name, total: prices.length, fixed, errors, fixAll });
  }

  // Summary
  console.log('\n=== RESUMEN ===');
  console.log(`Precios corregidos (÷100): ${totalFixed}`);
  console.log(`Precios saltados (ya correctos): ${totalSkipped}`);

  // Verify
  console.log('\n=== VERIFICACIÓN POST-FIX ===');
  const allRes = await fetch(SUPABASE_URL + '/rest/v1/prices?select=count', { headers: AUTH });
  const allCount = (await allRes.json())[0]?.count || 0;
  console.log(`Total precios en DB: ${allCount}`);

  // Check stores that were fixed
  for (const r of storeResults) {
    if (r.fixed > 0) {
      const pRes = await fetch(SUPABASE_URL + `/rest/v1/prices?select=price,price_original&store_id=eq.${stores.find(s => s.name === r.store)?.id}&limit=5&order=price.desc`, { headers: AUTH });
      const prices = await pRes.json();
      if (Array.isArray(prices) && prices.length > 0) {
        const maxAfter = prices[0].price;
        console.log(`  ${r.store.slice(0, 40).padEnd(42)} max price now: ${maxAfter}`);
      }
    }
  }
}

main().catch(e => console.error('FATAL:', e));

const U = 'https://ygqfbbkjdiryilwjrpzh.supabase.co';
const K = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlncWZiYmtqZGlyeWlsd2pycHpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDY1NDQ5NSwiZXhwIjoyMTAwMjMwNDk1fQ.6sfmLwuOJDfGzJjglHP8X_SQzdeUOd657CdEr_DVcTk';

async function g(path) {
  const r = await fetch(U + path, { headers: { Authorization: 'Bearer ' + K, apikey: K } });
  return r.json();
}

async function main() {
  const stores = await g('/rest/v1/stores?select=id,name,category,scraping_enabled,last_scraped_at&limit=500');
  const lp = await g('/rest/v1/latest_prices?select=category,store_name&limit=200000');
  const prod = await g('/rest/v1/products?select=category&limit=200000');
  const pc = await g('/rest/v1/products?select=count');
  const pr = await g('/rest/v1/prices?select=count');

  if (!Array.isArray(stores)) { console.log('Error stores'); return; }

  const byCat = {};
  const enb = {};
  const never = [];
  for (const s of stores) {
    const c = s.category || 'sin_cat';
    byCat[c] = (byCat[c] || 0) + 1;
    if (s.scraping_enabled !== false) enb[c] = (enb[c] || 0) + 1;
    if (!s.last_scraped_at) never.push({ name: s.name, cat: c });
  }

  console.log('========== TIENDAS POR CATEGORIA ==========');
  Object.entries(byCat).sort((a, b) => b[1] - a[1]).forEach(([cat, total]) => {
    console.log(cat.padEnd(32) + 't:' + String(total).padEnd(6) + 'act:' + (enb[cat] || 0));
  });
  console.log('TOTAL stores: ' + stores.length + '   NUNCA scrapeadas: ' + never.length);

  const priceByCat = {};
  const storesWith = new Set();
  if (Array.isArray(lp)) {
    for (const p of lp) {
      const c = p.category || 'sin_cat';
      priceByCat[c] = (priceByCat[c] || 0) + 1;
      storesWith.add(p.store_name);
    }
  }

  console.log('\n========== PRECIOS ACTIVOS POR CATEGORIA ==========');
  Object.entries(priceByCat).sort((a, b) => b[1] - a[1]).forEach(([cat, n]) => {
    console.log(cat.padEnd(32) + String(n));
  });
  console.log('TOTAL precios activos: ' + (Array.isArray(lp) ? lp.length : 0) + ' en ' + storesWith.size + ' tiendas');

  const prodCount = pc[0]?.count || 0;
  const priceCount = pr[0]?.count || 0;
  console.log('\n========== TOTALES DB ==========');
  console.log('Products: ' + prodCount);
  console.log('Prices (historicos): ' + priceCount);
  console.log('latest_prices: ' + (Array.isArray(lp) ? lp.length : 0));

  console.log('\n========== CATEGORIAS DEFICITARIAS ==========');
  Object.entries(byCat).sort((a, b) => b[1] - a[1]).forEach(([cat, total]) => {
    const p = priceByCat[cat] || 0;
    if (p < 50) {
      const tag = p === 0 ? 'VACIO' : (p < 10 ? 'CASI_VACIO' : 'ESCASO');
      const missing = never.filter(n => n.cat === cat).length;
      console.log(tag + ' ' + cat.padEnd(28) + 'tiendas:' + String(total).padEnd(4) + 'sin-scrapeo:' + missing + ' precios:' + p);
    }
  });

  // Show sample stores without scraping by category
  console.log('\n========== MUESTRA DE TIENDAS SIN PREAMOS (por categoria) ==========');
  const neverByCat = {};
  never.forEach(n => { neverByCat[n.cat] = (neverByCat[n.cat] || 0) + 1; });
  Object.entries(neverByCat).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([cat, cnt]) => {
    const samples = never.filter(n => n.cat === cat).slice(0, 3).map(n => n.name).join(' | ');
    console.log('  ' + cat + ': ' + cnt + ' tiendas sin scrape  (ej: ' + samples + ')');
  });
}

main().catch(e => console.error(e));
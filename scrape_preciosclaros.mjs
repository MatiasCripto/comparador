// scrape_preciosclaros.mjs — Scraper de Precios Claros (SEPA)
// Descarga el ZIP diario de SEPA desde datos.produccion.gob.ar,
// procesa cada cadena comercial, crea/actualiza stores en Supabase,
// e inserta productos + precios con batch operations.
// Uso: node scrape_preciosclaros.mjs

import { readFileSync, mkdirSync, rmSync, existsSync, createWriteStream, createReadStream } from 'fs';
import { createInterface } from 'readline';
import { spawnSync } from 'child_process';
import { join } from 'path';
import { get } from 'https';
import { autoDetectCategory } from './category-utils.mjs';
import { parsePrice } from './price-utils.mjs';

const SUPABASE_URL = 'https://ygqfbbkjdiryilwjrpzh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlncWZiYmtqZGlyeWlsd2pycHpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDY1NDQ5NSwiZXhwIjoyMTAwMjMwNDk1fQ.6sfmLwuOJDfGzJjglHP8X_SQzdeUOd657CdEr_DVcTk';

const AUTH = { Authorization: 'Bearer ' + SUPABASE_KEY, apikey: SUPABASE_KEY };
const TMP_DIR = '/tmp/sepa_scraper';
const RESOURCE_IDS = {
  domingo: 'f8e75128-515a-436e-bf8d-5c63a62f2005',
  lunes: '0a9069a9-06e8-4f98-874d-da5578693290',
  martes: '9dc06241-cc83-44f4-8e25-c9b1636b8bc8',
  miercoles: '1e92cd42-4f94-4071-a165-62c4cb2ce23c',
  jueves: 'd076720f-a7f0-4af8-b1d6-1b99d5a90c14',
  viernes: '91bc072a-4726-44a1-85ec-4a8467aad27e',
  sabado: 'b3c3da5d-213d-41e7-8d74-f23fda0a3c30',
};
const DATASET_ID = '6f47ec76-d1ce-4e34-a7e1-621fe9b1d0b5';
const BATCH_SIZE = 500;

// ------ HELPERS ------

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(dest);
    const req = get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close(); rmSync(dest, { force: true });
        downloadFile(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close(); rmSync(dest, { force: true });
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const total = parseInt(res.headers['content-length'] || '0', 10);
      let downloaded = 0;
      res.on('data', (chunk) => {
        downloaded += chunk.length;
        if (total) {
          const pct = (downloaded / total * 100).toFixed(1);
          process.stdout.write(`\r   ${(downloaded/1024/1024).toFixed(1)}MB / ${(total/1024/1024).toFixed(1)}MB (${pct}%)`);
        } else {
          process.stdout.write(`\r   ${(downloaded/1024/1024).toFixed(1)}MB`);
        }
      });
      res.pipe(file);
      file.on('finish', () => { console.log(''); file.close(); resolve(); });
    });
    req.on('error', (err) => { file.close(); rmSync(dest, { force: true }); reject(err); });
  });
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split('|').map(h => h.trim().replace(/^﻿/, ''));
  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = line.split('|');
    if (values.length < headers.length) continue;
    const row = {};
    for (let j = 0; j < headers.length; j++) row[headers[j]] = values[j] || '';
    results.push(row);
  }
  return results;
}

function getDateStr(date) {
  return date.toISOString().slice(0, 10);
}

function todayDayName() {
  const days = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
  return days[new Date().getDay()];
}

// ------ SUPABASE BATCH OPERATIONS ------

async function fetchAllByStore(storeIds) {
  if (!storeIds.length) return {};
  const result = {};
  for (const sid of storeIds) {
    const res = await fetch(
      SUPABASE_URL + `/rest/v1/products?select=id,product_url,canonical_name&store_id=eq.${sid}&limit=100000`,
      { headers: AUTH }
    );
    if (res.ok) {
      const list = await res.json();
      result[sid] = {};
      for (const p of list) result[sid][p.product_url] = p;
    } else {
      result[sid] = {};
    }
  }
  return result;
}

async function batchInsertProducts(rows) {
  if (rows.length === 0) return [];
  const results = [];
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    let retries = 3;
    while (retries > 0) {
      try {
        const res = await fetch(SUPABASE_URL + '/rest/v1/products?select=id,product_url', {
          method: 'POST',
          headers: { ...AUTH, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
          body: JSON.stringify(batch),
        });
        if (res.ok) {
          const created = await res.json();
          if (Array.isArray(created)) results.push(...created);
          break;
        } else {
          const err = await res.text();
          if (err.includes('duplicate key') || err.includes('unique constraint')) {
            // Fall back to individual inserts for this batch
            for (const item of batch) {
              try {
                const r = await fetch(SUPABASE_URL + '/rest/v1/products?select=id,product_url', {
                  method: 'POST',
                  headers: { ...AUTH, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
                  body: JSON.stringify([item]),
                });
                if (r.ok) {
                  const d = await r.json();
                  if (Array.isArray(d)) results.push(d[0]);
                }
              } catch {}
            }
            break;
          }
          retries--;
          await sleep(1000);
        }
      } catch (e) {
        retries--;
        await sleep(2000);
      }
    }
  }
  return results;
}

async function batchUpdateProducts(updates) {
  for (const item of updates) {
    try {
      await fetch(SUPABASE_URL + `/rest/v1/products?id=eq.${item.id}`, {
        method: 'PATCH',
        headers: { ...AUTH, 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
      });
    } catch {}
  }
}

async function batchInsertPrices(rows) {
  if (rows.length === 0) return 0;
  let inserted = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch(SUPABASE_URL + '/rest/v1/prices?select=id', {
        method: 'POST',
        headers: { ...AUTH, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
        body: JSON.stringify(batch),
      });
      if (res.ok) {
        const data = await res.json();
        inserted += Array.isArray(data) ? data.length : 0;
      }
    } catch {}
    // Small delay to avoid DB overload
    if (i + BATCH_SIZE < rows.length) await sleep(200);
  }
  return inserted;
}

async function batchInsertPriceHistory(rows) {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    try {
      await fetch(SUPABASE_URL + '/rest/v1/price_history', {
        method: 'POST',
        headers: { ...AUTH, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify(batch),
      });
    } catch {}
  }
}

// ------ STORE MANAGEMENT ------

async function findOrCreateStore(brandName, sepaId, sepaBrandId, comercioUrl) {
  // Check if store exists by sepa_id + sepa_brand_id in scraping_config
  const res = await fetch(
    SUPABASE_URL + `/rest/v1/stores?select=id,name,scraping_config&scraping_config->>sepa_id=eq.${sepaId}&scraping_config->>sepa_brand_id=eq.${sepaBrandId}&limit=1`,
    { headers: AUTH }
  );
  if (res.ok) {
    const data = await res.json();
    if (Array.isArray(data) && data.length > 0) {
      // Update last_scraped_at
      await fetch(SUPABASE_URL + `/rest/v1/stores?id=eq.${data[0].id}`, {
        method: 'PATCH',
        headers: { ...AUTH, 'Content-Type': 'application/json' },
        body: JSON.stringify({ last_scraped_at: new Date().toISOString() }),
      }).catch(() => {});
      return data[0].id;
    }
  }

  // Also check by name as fallback
  if (brandName) {
    const nameRes = await fetch(
      SUPABASE_URL + `/rest/v1/stores?select=id&name=eq.${encodeURIComponent(brandName)}&limit=1`,
      { headers: AUTH }
    );
    if (nameRes.ok) {
      const nameData = await nameRes.json();
      if (Array.isArray(nameData) && nameData.length > 0) {
        // Update with SEPA IDs
        const cfg = { sepa_id: sepaId, sepa_brand_id: sepaBrandId, platform_detected: 'SEPA', scrape_method: 'api_csv' };
        await fetch(SUPABASE_URL + `/rest/v1/stores?id=eq.${nameData[0].id}`, {
          method: 'PATCH',
          headers: { ...AUTH, 'Content-Type': 'application/json' },
          body: JSON.stringify({ scraping_config: cfg, last_scraped_at: new Date().toISOString() }),
        }).catch(() => {});
        return nameData[0].id;
      }
    }
  }

  // Create new store
  const newStore = {
    name: brandName.slice(0, 255),
    url: comercioUrl || 'https://www.preciosclaros.gob.ar',
    category: 'supermercados',
    scraping_enabled: true,
    scraping_config: {
      platform_detected: 'SEPA',
      scrape_method: 'api_csv',
      sepa_id: sepaId,
      sepa_brand_id: sepaBrandId,
      last_sepa_import: new Date().toISOString(),
    },
    last_scraped_at: new Date().toISOString(),
  };

  const createRes = await fetch(SUPABASE_URL + '/rest/v1/stores?select=id', {
    method: 'POST',
    headers: { ...AUTH, 'Content-Type': 'application/json', 'Prefer': 'return=representation' },
    body: JSON.stringify(newStore),
  });

  if (createRes.ok) {
    const created = await createRes.json();
    if (Array.isArray(created) && created.length > 0) return created[0].id;
  }

  return null;
}


async function processBrand(brandName, sepaId, sepaBrandId, comercioUrl, products) {
  console.log(`   Tienda: ${brandName}`);

  const storeId = await findOrCreateStore(brandName, sepaId, sepaBrandId, comercioUrl);
  if (!storeId) {
    console.log(`   Error: no se pudo crear/obtener store`);
    return { products: 0, inserted: 0 };
  }

  // Fetch existing products for this store
  const existingRes = await fetch(
    SUPABASE_URL + `/rest/v1/products?select=id,product_url,canonical_name&store_id=eq.${storeId}&limit=100000`,
    { headers: AUTH }
  );
  const existing = {};
  if (existingRes.ok) {
    const list = await existingRes.json();
    if (Array.isArray(list)) for (const p of list) existing[p.product_url] = p;
  }

  console.log(`   Productos existentes en DB: ${Object.keys(existing).length}`);
  console.log(`   Productos nuevos en SEPA:   ${products.length}`);

  // Separate into new and existing
  const toInsert = [];
  const toUpdate = [];
  const priceRows = [];
  const productData = [];
  const now = new Date().toISOString();

  for (const p of products) {
    const productRow = {
      canonical_name: (p.marca ? `${p.name} ${p.marca}` : p.name).trim().slice(0, 255),
      raw_name: p.name.slice(0, 255),
      store_id: storeId,
      product_url: '', // SEPA no provee URLs individuales de producto
      image_url: '',
      category: autoDetectCategory(p.name, null, p.marca) || 'supermercados',
    };

    const exist = existing[p.ean];
    if (exist) {
      productRow.id = exist.id;
      toUpdate.push(productRow);
      priceRows.push({ product_id: exist.id, store_id: storeId, price: p.price, price_original: p.price, currency: 'ARS', is_offer: false, scraped_at: now });
    } else {
      toInsert.push(productRow);
      productData.push({ price: p.price });
    }
  }

  // ---- Phase 1: Insert new products ----
  let inserted = 0;
  if (toInsert.length > 0) {
    const newProducts = await batchInsertProducts(toInsert);
    for (let idx = 0; idx < newProducts.length; idx++) {
      const np = newProducts[idx];
      if (np && np.id && idx < productData.length) {
        priceRows.push({ product_id: np.id, store_id: storeId, price: productData[idx].price, price_original: productData[idx].price, currency: 'ARS', is_offer: false, scraped_at: now });
        inserted++;
      }
    }
  }

  // ---- Phase 2: Update existing products ----
  let updated = 0;
  if (toUpdate.length > 0) {
    await batchUpdateProducts(toUpdate);
    updated = toUpdate.length;
  }

  // ---- Phase 3: Insert prices ----
  console.log(`   Precios a insertar: ${priceRows.length}`);
  const pricesInserted = await batchInsertPrices(priceRows);

  // ---- Phase 4: Price history ----
  await batchInsertPriceHistory(priceRows.map(r => ({
    product_id: r.product_id,
    store_id: storeId,
    price: r.price,
    currency: 'ARS',
    scraped_at: r.scraped_at,
  })));

  console.log(`   Resultado: ${inserted} nuevos, ${updated} actualizados, ${pricesInserted} precios`);
  return { products: products.length, inserted, updated, pricesInserted };
}

async function processProductosStream(filepath) {
  const brandMaps = new Map();
  let lineCount = 0;

  return new Promise((resolve, reject) => {
    const rl = createInterface({ input: createReadStream(filepath, 'utf-8') });
    let headers = [];

    rl.on('line', (line) => {
      lineCount++;
      if (lineCount === 1) {
        headers = line.split('|').map(h => h.trim().replace(/^\ufeff/, ''));
        return;
      }

      const values = line.split('|');
      if (values.length < headers.length) return;

      const brandId = String(values[headers.indexOf('id_bandera')] || '').trim();
      if (!brandId) return;

      const pid = String(values[headers.indexOf('id_producto')] || '').trim();
      if (!pid || pid === '0' || pid === '1') return;

      const price = parsePrice(values[headers.indexOf('productos_precio_lista')]);
      if (price <= 0) return;

      if (!brandMaps.has(brandId)) {
        brandMaps.set(brandId, new Map());
      }
      const map = brandMaps.get(brandId);

      const existing = map.get(pid);
      if (!existing || price < existing.price) {
        map.set(pid, {
          ean: pid,
          name: String(values[headers.indexOf('productos_descripcion')] || '').trim().slice(0, 255),
          price,
          marca: String(values[headers.indexOf('productos_marca')] || '').trim(),
        });
      }
    });

    rl.on('close', () => resolve({ brandMaps, totalRows: lineCount - 1 }));
    rl.on('error', (err) => reject(err));
  });
}

async function processInnerZip(zipPath) {
  const outDir = join(TMP_DIR, 'extracted');
  mkdirSync(outDir, { recursive: true });

  const res = spawnSync('unzip', ['-o', zipPath, '-d', outDir], { encoding: 'utf-8', timeout: 30000 });
  if (res.status !== 0) {
    console.log('   Error extrayendo:', res.stderr?.slice(0, 100));
    return null;
  }

  const comercioPath = join(outDir, 'comercio.csv');
  if (!existsSync(comercioPath)) return null;
  const comercioRows = parseCSV(readFileSync(comercioPath, 'utf-8'));
  if (comercioRows.length === 0) return null;

  const productosPath = join(outDir, 'productos.csv');
  if (!existsSync(productosPath)) return null;

  const rawBytes = readFileSync(productosPath).length;
  console.log('   Productos CSV:', (rawBytes / 1024 / 1024).toFixed(1), 'MB');

  const { brandMaps, totalRows } = await processProductosStream(productosPath);
  console.log('   Filas totales:', totalRows);
  if (totalRows === 0) return null;

  const results = [];
  for (const [brandId, productMap] of brandMaps) {
    const brandRow = comercioRows.find(r => String(r.id_bandera) === brandId);
    if (!brandRow) continue;

    const brandName = (brandRow.comercio_bandera_nombre || brandRow.comercio_razon_social || '').trim();
    const sepaId = String(brandRow.id_comercio || '').trim();
    const comercioUrl = (brandRow.comercio_bandera_url || '').trim();
    if (!brandName || !sepaId) continue;

    const products = Array.from(productMap.values());
    console.log('\n  ', brandName, '(bandera', brandId + '):', products.length, 'productos unicos');
    if (products.length === 0) continue;

    const result = await processBrand(brandName, sepaId, brandId, comercioUrl, products);
    results.push({ brandName, ...result });
  }

  rmSync(outDir, { recursive: true, force: true });
  return results;
}
// ------ FIND LATEST SEPA RESOURCE ------

async function findLatestResource() {
  for (let offset = 0; offset < 3; offset++) {
    const date = new Date();
    date.setDate(date.getDate() - offset);
    const days = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
    const actualDayName = days[date.getDay()];
    const uuid = RESOURCE_IDS[actualDayName];
    if (!uuid) continue;

    const url = `https://datos.produccion.gob.ar/dataset/${DATASET_ID}/resource/${uuid}/download/sepa_${actualDayName}.zip`;
    console.log(`   ${actualDayName} (${getDateStr(date)})...`);

    try {
      const ac = new AbortController();
      setTimeout(() => ac.abort(), 10000);
      const res = await fetch(url, { method: 'HEAD', signal: ac.signal });
      if (res.ok) return url;
    } catch {}
  }
  return null;
}

// ------ MAIN ------

async function main() {
  const startTime = Date.now();
  console.log('--- Scraper Precios Claros (SEPA) ---\n');

  // 1. Find latest ZIP
  console.log('Buscando último ZIP disponible...');
  const zipUrl = await findLatestResource();
  if (!zipUrl) {
    console.log('No se encontró ZIP SEPA');
    return;
  }
  console.log(`URL: ${zipUrl}\n`);

  // 2. Download
  ensureDir(TMP_DIR);
  const zipPath = join(TMP_DIR, 'sepa.zip');
  console.log('Descargando ZIP...');
  try {
    await downloadFile(zipUrl, zipPath);
    const bytes = readFileSync(zipPath).length;
    console.log(`Descargado: ${(bytes/1024/1024).toFixed(1)}MB\n`);
  } catch (e) {
    console.log(`Error descargando: ${e.message}`);
    return;
  }

  // 3. List inner ZIPs
  const listResult = spawnSync('unzip', ['-l', zipPath], { encoding: 'utf-8', timeout: 15000 });
  const innerZips = listResult.stdout.split('\n')
    .filter(line => line.includes('.zip'))
    .map(line => line.trim().split(/\s+/).pop())
    .filter(Boolean);
  console.log(`ZIPs internos: ${innerZips.length}\n`);

  // 4. Process each inner ZIP
  let totalStores = 0;
  let totalProducts = 0;
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalPrices = 0;

  for (let i = 0; i < innerZips.length; i++) {
    const innerName = innerZips[i];
    console.log(`[${i + 1}/${innerZips.length}] ${innerName.split('/').pop()}`);

    // Extract single inner ZIP from the main ZIP
    const innerDir = join(TMP_DIR, 'inner');
    mkdirSync(innerDir, { recursive: true });
    const extractRes = spawnSync('unzip', ['-o', zipPath, innerName, '-d', innerDir], { encoding: 'utf-8', timeout: 60000 });
    if (extractRes.status !== 0) {
      console.log(`   Error: ${extractRes.stderr?.slice(0, 100)}`);
      continue;
    }

    const innerPath = join(innerDir, innerName);
    if (!existsSync(innerPath)) continue;

    const results = await processInnerZip(innerPath);
    rmSync(innerDir, { recursive: true, force: true });

    if (results) {
      for (const r of results) {
        totalProducts += r.products || 0;
        totalInserted += r.inserted || 0;
        totalUpdated += r.updated || 0;
        totalPrices += r.pricesInserted || 0;
        if (r.brandName) totalStores++;
      }
    }
    console.log('');
    // Liberar memoria entre ZIPs
    global.gc?.();
  }

  // 5. Summary
  const elapsed = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log('--- RESUMEN ---');
  console.log(`Tiempo:          ${elapsed} min`);
  console.log(`ZIPs procesados: ${innerZips.length}`);
  console.log(`Tiendas:         ${totalStores}`);
  console.log(`Prod. únicos:    ${totalProducts}`);
  console.log(`Nuevos:          ${totalInserted}`);
  console.log(`Actualizados:    ${totalUpdated}`);
  console.log(`Precios:         ${totalPrices}`);

  // Cleanup
  rmSync(TMP_DIR, { recursive: true, force: true });
}

function ensureDir(dir) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

main().catch(e => {
  console.error('FATAL:', e);
  rmSync(TMP_DIR, { recursive: true, force: true });
});

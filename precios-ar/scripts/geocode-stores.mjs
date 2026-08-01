#!/usr/bin/env node
// geocode-stores.mjs — Geocodifica tiendas sin lat/lng usando OpenCage.
// Uso: node --env-file=.env.production scripts/geocode-stores.mjs
// Requiere OPENCAGE_API_KEY en el .env (server-side, nunca expuesta al cliente).
// Resumible: solo procesa stores donde lat es null.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENCAGE_KEY = process.env.OPENCAGE_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY en el .env');
  process.exit(1);
}
if (!OPENCAGE_KEY) {
  console.error('Falta OPENCAGE_API_KEY en el .env. Creá una clave gratis en https://opencagedata.com');
  process.exit(1);
}

const AUTH = { Authorization: `Bearer ${SUPABASE_KEY}`, apikey: SUPABASE_KEY };
const MIN_INTERVAL_MS = 1100; // free tier: 2500 req/día

let lastCall = 0;
function throttle() {
  const wait = Math.max(0, lastCall + MIN_INTERVAL_MS - Date.now());
  lastCall = Date.now() + wait;
  return new Promise((r) => setTimeout(r, wait));
}

function buildQuery(store) {
  const parts = [];
  if (store.address) parts.push(store.address);
  if (store.name) parts.push(store.name);
  if (store.city) parts.push(store.city);
  if (store.province) parts.push(store.province);
  parts.push('Argentina');
  return parts.filter(Boolean).join(', ');
}

async function geocode(query) {
  const url =
    `https://api.opencagedata.com/geocode/v1/json?q=${encodeURIComponent(query)}` +
    `&key=${OPENCAGE_KEY}&countrycode=ar&language=es&limit=1`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data.status?.code !== 200) throw new Error(`OpenCage: ${data.status?.message || 'error'}`);
  const first = data.results?.[0];
  if (!first) return null;
  return {
    lat: first.geometry?.lat ?? null,
    lng: first.geometry?.lng ?? null,
    type: first.components?._type ?? null,
  };
}

async function main() {
  console.log('--- Geocodificación de tiendas (OpenCage) ---');

  let stores;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/stores?select=id,name,address,city,province,url&lat=is.null&limit=1000`,
      { headers: AUTH }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    stores = await res.json();
  } catch (e) {
    console.error('Error leyendo stores:', e.message);
    process.exit(1);
  }

  if (!Array.isArray(stores) || stores.length === 0) {
    console.log('No hay tiendas sin lat/lng.');
    return;
  }
  console.log(`Tiendas a geocodificar: ${stores.length}`);

  let ok = 0;
  let skipped = 0;
  let failed = 0;
  for (let i = 0; i < stores.length; i++) {
    const s = stores[i];
    console.log(`[${i + 1}/${stores.length}] ${s.name}`);
    await throttle();
    try {
      const result = await geocode(buildQuery(s));
      if (!result || result.lat == null) {
        console.log('   Sin resultado');
        skipped++;
        continue;
      }
      const upd = await fetch(`${SUPABASE_URL}/rest/v1/stores?id=eq.${s.id}`, {
        method: 'PATCH',
        headers: { ...AUTH, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: result.lat,
          lng: result.lng,
          geocode_type: result.type,
        }),
      });
      if (upd.ok) {
        ok++;
        console.log(`   ${result.lat.toFixed(4)}, ${result.lng.toFixed(4)} (${result.type})`);
      } else {
        console.log(`   Error guardando (${upd.status})`);
        failed++;
      }
    } catch (e) {
      console.log(`   Error: ${e.message}`);
      failed++;
    }
  }

  console.log('--- RESUMEN ---');
  console.log(`OK: ${ok}   Sin resultado: ${skipped}   Errores: ${failed}`);
}

main().catch((e) => {
  console.error('FATAL:', e);
  process.exit(1);
});

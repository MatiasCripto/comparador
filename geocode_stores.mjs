// geocode_stores.mjs — Reverse-geocodificar todas las tiendas con lat/lng
// Obtiene provincia y ciudad via BigDataCloud, actualiza stores en Supabase
// Uso: node geocode_stores.mjs

const SUPABASE_URL = 'https://ygqfbbkjdiryilwjrpzh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlncWZiYmtqZGlyeWlsd2pycHpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDY1NDQ5NSwiZXhwIjoyMTAwMjMwNDk1fQ.6sfmLwuOJDfGzJjglHP8X_SQzdeUOd657CdEr_DVcTk';

const AUTH = { headers: { Authorization: 'Bearer ' + SUPABASE_KEY, apikey: SUPABASE_KEY } };

const PROVINCES = [
  "CABA", "Buenos Aires", "Catamarca", "Chaco", "Chubut", "Córdoba",
  "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja",
  "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan",
  "San Luis", "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán",
];

const ISO_TO_PROVINCE = {
  "AR-C": "CABA", "AR-B": "Buenos Aires", "AR-K": "Catamarca",
  "AR-H": "Chaco", "AR-U": "Chubut", "AR-X": "Córdoba", "AR-W": "Corrientes",
  "AR-E": "Entre Ríos", "AR-P": "Formosa", "AR-Y": "Jujuy", "AR-L": "La Pampa",
  "AR-F": "La Rioja", "AR-M": "Mendoza", "AR-N": "Misiones", "AR-Q": "Neuquén",
  "AR-R": "Río Negro", "AR-A": "Salta", "AR-J": "San Juan", "AR-D": "San Luis",
  "AR-Z": "Santa Cruz", "AR-S": "Santa Fe", "AR-G": "Santiago del Estero",
  "AR-V": "Tierra del Fuego", "AR-T": "Tucumán",
};

function matchProvince(subdivision, code) {
  if (code && ISO_TO_PROVINCE[code]) return ISO_TO_PROVINCE[code];
  if (!subdivision) return null;
  const n = subdivision.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (n.includes('ciudad autonoma')) return 'CABA';
  for (const p of PROVINCES) {
    if (n === p.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')) return p;
    if (n.includes(p.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) return p;
  }
  return null;
}

async function reverseGeocode(lat, lng) {
  try {
    const url = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=es`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return {
      province: matchProvince(data.principalSubdivision, data.principalSubdivisionCode),
      city: data.city || null,
    };
  } catch (e) {
    return null;
  }
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function g(path) {
  const r = await fetch(SUPABASE_URL + path, AUTH);
  if (!r.ok) { const t = await r.text(); throw new Error(`HTTP ${r.status}: ${t.slice(0, 200)}`); }
  return r.json();
}

async function main() {
  console.log('=== Geocodificando tiendas ===\n');

  // Get all stores with lat/lng
  const stores = await g('/rest/v1/stores?select=id,name,category,lat,lng,province,city,scraping_config&limit=300');
  if (!Array.isArray(stores)) { console.log('Error stores'); return; }

  const toGeo = stores.filter(s => s.lat && s.lng);
  console.log(`Tiendas totales: ${stores.length}`);
  console.log(`Tiendas con lat/lng: ${toGeo.length}`);
  console.log(`Tiendas sin provincia: ${toGeo.filter(s => !s.province).length}\n`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;
  const byProvince = {};

  for (let i = 0; i < toGeo.length; i++) {
    const s = toGeo[i];
    
    // Skipping already geocoded stores (with province AND city)
    if (s.province && s.city) { skipped++; continue; }

    const geo = await reverseGeocode(s.lat, s.lng);
    if (!geo) {
      errors++;
      console.log(`[${i + 1}/${toGeo.length}] ${s.name.slice(0, 40).padEnd(42)} ERROR: sin respuesta geocode`);
      continue;
    }
    if (!geo.province) {
      console.log(`[${i + 1}/${toGeo.length}] ${s.name.slice(0, 40).padEnd(42)} no se pudo determinar provincia`);
      continue;
    }

    // Decide if the store is national (supermercados grandes), local, or both
    const cat = (s.category || '').toLowerCase();
    let delivery_type;
    if (cat.includes('supermercado') || cat.includes('electronica') || cat.includes('electrodomestico') || cat.includes('fibras')) {
      delivery_type = 'national';
    } else {
      delivery_type = 'local';
    }

    try {
      const body = {
        province: geo.province,
        city: geo.city,
        scraping_config: {
          platform_detected: s.scraping_config?.platform_detected || null,
          scrape_method: s.scraping_config?.scrape_method || null,
          delivery_type,
          has_physical: true,
        },
        geocode_type: 'bigdatacloud',
      };
      const res = await fetch(SUPABASE_URL + `/rest/v1/stores?id=eq.${s.id}`, {
        method: 'PATCH',
        headers: { ...AUTH.headers, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        updated++;
        byProvince[geo.province] = (byProvince[geo.province] || 0) + 1;
        const status = geo.city ? geo.city.slice(0, 20) : '—';
        console.log(`[${i + 1}/${toGeo.length}] ${s.name.slice(0, 40).padEnd(42)} ${geo.province.padEnd(18)} ${delivery_type.padEnd(10)} ${status}`);
      } else {
        errors++;
        console.log(`[${i + 1}/${toStore.length}] ${s.name.slice(0, 40).padEnd(42)} ERROR DB: ${res.status}`);
      }
    } catch (e) {
      errors++;
      console.log(`[${i + 1}/${toGeo.length}] ${s.name.slice(0, 40).padEnd(42)} ERROR: ${e.message}`);
    }

    // Respect BigDataCloud rate limits (10 requests/minute free tier)
    if (i % 10 === 9) {
      await sleep(2000);
    } else {
      await sleep(100);
    }
  }

  console.log('\n=== RESUMEN ===');
  console.log('Tiendas procesadas: ' + toGeo.length);
  console.log('Actualizadas: ' + updated);
  console.log('Sin cambios: ' + skipped);
  console.log('Errores: ' + errors);
  console.log('\nProvincias detectadas:');
  Object.entries(byProvince).sort((a, b) => b[1] - a[1]).forEach(([p, c]) => {
    console.log('  ' + p + ': ' + c + ' tiendas');
  });
}

main().catch(e => console.error('FATAL:', e));
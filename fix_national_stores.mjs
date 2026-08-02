// fix_national_stores.mjs — Tiendas nacionales conocidas (SEPA/multisucursal)
// Asigna provincia + delivery_type correctos manualmente
// Uso: node fix_national_stores.mjs

const SUPABASE_URL = 'https://ygqfbbkjdiryilwjrpzh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlncWZiYmtqZGlyeWlsd2pycHpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDY1NDQ5NSwiZXhwIjoyMTAwMjMwNDk1fQ.6sfmLwuOJDfGzJjglHP8X_SQzdeUOd657CdEr_DVcTk';

const AUTH = { headers: { Authorization: 'Bearer ' + SUPABASE_KEY, apikey: SUPABASE_KEY } };

async function g(path) {
  const r = await fetch(SUPABASE_URL + path, AUTH);
  return r.json();
}

async function main() {
  const stores = await g('/rest/v1/stores?select=id,name,category,province,scraping_config&limit=300');
  if (!Array.isArray(stores)) { console.log('Error'); return; }

  const sinProv = stores.filter(s => !s.province);
  console.log('Stores sin provincia: ' + sinProv.length + '\n');

  // Fix stores that are national (supermercados) — mark as nationwide
  const nacionalKeywords = [
    'COTO', 'Carrefour', 'Changomas', 'SuperChangomas', 'HiperChangomas',
    'Jumbo', 'Disco', 'Vea', 'Comodin', 'Maxi Comodin', 'Maxi',
    'La Anonima', 'Anonima', 'Libertad', 'DIA', 'Diarco',
    'Mariano Max', 'Unicoop', 'FARMACITY', 'Express',
    'Market', 'mayorista', 'Mayorista', 'Cooperativa Obrera',
    'AGRODOLAR', 'Toledo', 'California', 'Simplicity',
  ];

  let fixed = 0;
  for (const s of sinProv) {
    let isNational = false;
    for (const kw of nacionalKeywords) {
      if (s.name.toLowerCase().includes(kw.toLowerCase())) {
        isNational = true;
        break;
      }
    }
    if (!isNational) continue;

    // Set as national without specific province
    try {
      const cfg = {
        platform_detected: 'SEPA',
        scrape_method: 'api_csv',
        delivery_type: 'national',
        has_physical: true,
      };
      const res = await fetch(SUPABASE_URL + `/rest/v1/stores?id=eq.${s.id}`, {
        method: 'PATCH',
        headers: { ...AUTH.headers, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ scraping_config: cfg, province: '' }),
      });
      if (res.ok) {
        fixed++;
        console.log('  ' + s.name.padEnd(45) + ' → national (envío a todo el país)');
      }
    } catch (e) {
      console.log('  ERROR: ' + s.name + ' — ' + e.message);
    }
  }

  console.log('\n=== RESULTADO ===');
  console.log('Tiendas nacionales marcadas:', fixed);
}

main().catch(e => console.error(e));
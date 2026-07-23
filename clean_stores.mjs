// clean_stores.mjs — Limpia URLs (saca /productos, /tienda, /catalogo, /shop)
// y marca scraping_enabled=false en tiendas sin plataforma detectable
// Uso: node clean_stores.mjs

const SUPABASE_URL = 'https://ygqfbbkjdiryilwjrpzh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlncWZiYmtqZGlyeWlsd2pycHpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDY1NDQ5NSwiZXhwIjoyMTAwMjMwNDk1fQ.6sfmLwuOJDfGzJjglHP8X_SQzdeUOd657CdEr_DVcTk';

const AUTH = { Authorization: 'Bearer ' + SUPABASE_KEY, apikey: SUPABASE_KEY };

const SUFFIXES = ['/productos', '/tienda', '/catalogo', '/shop', '/store'];

async function main() {
  console.log('--- Limpiando URLs y desactivando tiendas sin plataforma ---\n');

  const res = await fetch(SUPABASE_URL + '/rest/v1/stores?select=id,name,url,scraping_config,scraping_enabled', { headers: AUTH });
  const stores = await res.json();
  if (!Array.isArray(stores)) { console.log('Error obteniendo stores'); return; }
  console.log('Total tiendas:', stores.length, '\n');

  let cleaned = 0, disabled = 0, alreadyDisabled = 0, errors = [];

  for (let i = 0; i < stores.length; i++) {
    const store = stores[i];
    const updates = {};

    // 1) Limpiar URL: sacar sufijos de path
    try {
      const u = new URL(store.url);
      const base = u.origin;
      const path = u.pathname.replace(/\/$/, ''); // sacar trailing slash
      if (path && path !== '/' && SUFFIXES.includes(path)) {
        updates.url = base;
      }
    } catch (e) {
      errors.push({ id: store.id, name: store.name, error: e.message });
    }

    // 2) Desactivar tiendas sin plataforma detectable
    const cfg = store.scraping_config || {};
    if (!cfg.platform_detected && cfg.scrape_method === 'http_get_html') {
      if (store.scraping_enabled !== false) {
        updates.scraping_enabled = false;
        disabled++;
      } else {
        alreadyDisabled++;
      }
    }

    if (Object.keys(updates).length > 0) {
      try {
        await fetch(SUPABASE_URL + '/rest/v1/stores?id=eq.' + store.id, {
          method: 'PATCH',
          headers: { ...AUTH, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify(updates),
        });
        if (updates.url) {
          cleaned++;
          console.log(`  ${'URL'.padEnd(6)} ${store.name.slice(0, 40).padEnd(42)} ${store.url} → ${updates.url}`);
        } else if (updates.scraping_enabled === false) {
          console.log(`  ${'OFF'.padEnd(6)} ${store.name.slice(0, 40).padEnd(42)} sin plataforma detectable`);
        }
      } catch (e) {
        errors.push({ id: store.id, name: store.name, error: 'PATCH: ' + e.message });
      }
    }
  }

  console.log('\n--- RESUMEN ---');
  console.log('URLs limpiadas:       ' + cleaned);
  console.log('Tiendas desactivadas: ' + disabled);
  console.log('Ya desactivadas:      ' + alreadyDisabled);
  if (errors.length > 0) {
    console.log('Errores:              ' + errors.length);
    errors.forEach(e => console.log(`  ${e.name}: ${e.error}`));
  }
}

main().catch(e => console.error('FATAL:', e));

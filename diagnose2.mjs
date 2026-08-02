const U = 'https://ygqfbbkjdiryilwjrpzh.supabase.co';
const K = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlncWZiYmtqZGlyeWlsd2pycHpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NDY1NDQ5NSwiZXhwIjoyMTAwMjMwNDk1fQ.6sfmLwuOJDfGzJjglHP8X_SQzdeUOd657CdEr_DVcTk';

async function g(path) {
  const r = await fetch(U + path, { headers: { Authorization: 'Bearer ' + K, apikey: K } });
  return r.json();
}

async function main() {
  const stores = await g('/rest/v1/stores?select=id,name,category,province,city,lat,lng,url,scraping_config,scraping_enabled&limit=300');
  if (!Array.isArray(stores)) { console.log('Error'); return; }

  console.log('Total stores:', stores.length);
  
  const withProvince = stores.filter(s => s.province);
  const withLoving = stores.filter(s => s.lat && s.lng);
  const withCity = stores.filter(s => s.city);
  
  console.log('With province:', withProvince.length);
  console.log('With lat/lng:', withLoving.length);
  console.log('With city:', withCity.length);
  console.log('With address:', stores.filter(s => s.address).length);
  
  // Show all stores with province (grouped by province)
  console.log('\n=== Stores WITH province ===');
  const byProv = {};
  for (const s of withProvince) { byProv[s.province] = (byProv[s.province] || 0) + 1; }
  for (const [p, c] of Object.entries(byProv).sort((a, b) => b[1] - a[1])) {
    console.log('  ' + p + ': ' + c + ' stores');
  }
  
  // Show stores that have address (may contain city info)
  console.log('\n=== Scraping_config delivery types ===');
  let national = 0, local = 0, both = 0;
  for (const s of stores) {
    const dt = s.scraping_config?.delivery_type;
    if (dt === 'national') national++;
    else if (dt === 'local') local++;
    else if (dt === 'both') both++;
  }
  console.log('  national: ' + national + ', local: ' + local + ', both: ' + both + ', None: ' + (stores.length - national - local - both));
  
  // Show some stores with addresses (could geocode from there)
  const withAddr = stores.filter(s => s.address).slice(0, 8);
  console.log('\n=== Sample stores with address (geocodable) ===');
  withAddr.forEach(s => {
    console.log('  ' + s.name + ': ' + s.address + ' | province:' + (s.province || 'null') + ' | lat:' + (s.lat || 'null'));
  });
}

main().catch(e => console.error(e));
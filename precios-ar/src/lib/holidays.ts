// Feriados nacionales de Argentina vía Nager.Date (https://date.nager.at).
// Solo se usa del lado del servidor. Cache en memoria con TTL de 12h.
// Si Nager falla, devuelve false (nunca bloquea el scraper por un error de red).

interface NagerHoliday {
  date: string;
}

const TTL = 12 * 60 * 60 * 1000;
const cache: { year: number; dates: string[]; at: number } = {
  year: -1,
  dates: [],
  at: 0,
};

export async function isHolidayToday(date?: Date): Promise<boolean> {
  const d = date ?? new Date();
  const year = d.getFullYear();
  const now = Date.now();

  if (cache.year !== year || now - cache.at > TTL) {
    try {
      const res = await fetch(
        `https://date.nager.at/api/v3/PublicHolidays/${year}/AR`,
        {
          headers: { "User-Agent": "PreciosAR/1.0 (precios.nexoiarg.com)" },
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("respuesta inesperada");
      cache.year = year;
      cache.at = now;
      cache.dates = (data as NagerHoliday[])
        .map((h) => h.date)
        .filter(Boolean)
        .sort();
    } catch (err) {
      console.error(
        "[holidays] No se pudo obtener feriados de Nager.Date:",
        err instanceof Error ? err.message : err
      );
      // Reintentar en ~1 min en vez de esperar el TTL completo tras un fallo.
      cache.at = now - TTL + 60_000;
      return false;
    }
  }

  const today = d.toISOString().slice(0, 10);
  return cache.dates.includes(today);
}

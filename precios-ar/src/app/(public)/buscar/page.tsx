import { createAdminClient } from "@/lib/supabase/service";
import Header from "@/components/shared/Header";
import BuscarClient from "@/components/buscar/BuscarClient";
import { getUserLocation } from "@/lib/location-server";
import { searchProducts } from "@/lib/search/search-engine";
import type { LatestPrice } from "@/types/database";

interface SearchParams {
  q?: string;
  provincia?: string;
  categoria?: string;
  orden?: string;
  precio_min?: string;
  precio_max?: string;
}

async function getMatchingStoreIds(supabase: ReturnType<typeof createAdminClient>, userProvince: string | null): Promise<string[] | null> {
  if (!userProvince) return null;

  const { data: stores } = await supabase
    .from("stores")
    .select("id, scraping_config")
    .or(
      `scraping_config->>delivery_type.eq.national,province.eq.${userProvince}`
    );

  if (!stores || stores.length === 0) return [];
  return stores.map((s: { id: string }) => s.id);
}

async function getInitialResults(params: SearchParams): Promise<LatestPrice[]> {
  try {
    const { q, provincia, categoria, orden, precio_min, precio_max } = params;
    if (!q) return [];

    const userLocation = await getUserLocation();
    const effectiveProvincia = provincia || userLocation.province;
    const supabase = createAdminClient();
    const storeIds = effectiveProvincia ? await getMatchingStoreIds(supabase, effectiveProvincia) : null;

    const result = await searchProducts(q, {
      storeIds,
      province: effectiveProvincia || undefined,
      category: categoria,
      minPrice: precio_min ? parseFloat(precio_min) : undefined,
      maxPrice: precio_max ? parseFloat(precio_max) : undefined,
    });

    const products = result.products;
    switch (orden) {
      case "price_desc":
        products.sort((a, b) => b.price - a.price);
        break;
      case "price_asc":
        products.sort((a, b) => a.price - b.price);
        break;
    }

    return products.slice(0, 200);
  } catch {
    return [];
  }
}

async function getStoreCategories(): Promise<string[]> {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("stores")
      .select("scraping_config")
      .not("scraping_config", "is", null);
    if (!data) return [];
    const cats = new Set<string>();
    for (const row of data) {
      const cfg = row.scraping_config as Record<string, unknown> | null;
      const cat = cfg?.category as string | undefined;
      if (cat) cats.add(cat);
    }
    return Array.from(cats).sort();
  } catch {
    return [];
  }
}

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const q = params.q ?? "";
  const provincia = params.provincia;
  const categoria = params.categoria;
  const orden = params.orden;
  const precio_min = params.precio_min;
  const precio_max = params.precio_max;

  const [categories, results] = await Promise.all([
    getStoreCategories(),
    q ? getInitialResults(params) : [],
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <BuscarClient
        initialCategories={categories}
        initialQuery={q}
        initialProvince={provincia}
        initialCategory={categoria}
        initialSort={orden}
        initialMinPrice={precio_min}
        initialMaxPrice={precio_max}
        initialResults={results}
      />

      <footer className="border-t py-8 px-4 mt-auto">
        <div className="container mx-auto text-center space-y-2">
          <p className="text-sm text-gray-500">
            PreciosAR — Precios actualizados cada 6 horas
          </p>
          <div className="flex justify-center gap-4 text-xs text-gray-400">
            <a href="/" className="hover:text-gray-900">Inicio</a>
            <a href="/buscar" className="hover:text-gray-900">Buscar</a>
            <a href="/lista" className="hover:text-gray-900">Lista</a>
            <a href="/alertas" className="hover:text-gray-900">Mis alertas</a>
          </div>
          <p className="text-xs text-gray-400">
            Los precios pueden variar. Verificá siempre en la tienda.
          </p>
        </div>
      </footer>
    </div>
  );
}

import { createAdminClient } from "@/lib/supabase/service";
import BuscarClient from "@/components/buscar/BuscarClient";
import { getUserLocation } from "@/lib/location-server";
import { searchProducts } from "@/lib/search/search-engine";
import type { LatestPrice } from "@/types/database";
import type { SelectedProduct } from "@/types/search";

interface SearchParams {
  q?: string;
  pid?: string;
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
      .select("category")
      .not("category", "is", null);
    if (!data) return [];
    return Array.from(new Set(data.map((r) => r.category).filter(Boolean) as string[])).sort();
  } catch {
    return [];
  }
}

// Producto real seleccionado desde el autocomplete de la portada (pid exacto).
// Devuelve todas las filas de latest_prices de ESE producto junto con el
// SelectedProduct reconstruido.
async function getProductByPid(
  supabase: ReturnType<typeof createAdminClient>,
  pid: string
): Promise<{ product: SelectedProduct | null; prices: LatestPrice[] }> {
  const { data } = await supabase
    .from("latest_prices")
    .select("*")
    .eq("product_id", pid)
    .order("price", { ascending: true });

  if (!data || data.length === 0) return { product: null, prices: [] };

  const first = data[0] as LatestPrice;
  const product: SelectedProduct = {
    product_id: first.product_id,
    canonical_name: first.canonical_name,
    raw_name: first.raw_name,
    brand: first.brand,
    category: first.category,
    subcategory: null,
    unit: first.unit,
    quantity: first.quantity,
  };
  return { product, prices: data as LatestPrice[] };
}

export default async function BuscarPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const q = params.q ?? "";
  const pid = params.pid;
  const provincia = params.provincia;
  const categoria = params.categoria;
  const orden = params.orden;
  const precio_min = params.precio_min;
  const precio_max = params.precio_max;

  const supabase = createAdminClient();

  let initialProduct: SelectedProduct | null = null;
  let initialProductResults: LatestPrice[] = [];
  let results: LatestPrice[] = [];

  if (pid) {
    // Flujo de producto exacto (autocomplete de la portada): prioriza el pid
    const found = await getProductByPid(supabase, pid);
    initialProduct = found.product;
    initialProductResults = found.prices;
  } else if (q) {
    results = await getInitialResults(params);
  }

  const categories = await getStoreCategories();

  return (
      <BuscarClient
        initialCategories={categories}
        initialQuery={q}
        initialProvince={provincia}
        initialCategory={categoria}
        initialSort={orden}
        initialMinPrice={precio_min}
        initialMaxPrice={precio_max}
        initialResults={results}
        initialProduct={initialProduct ?? undefined}
        initialProductResults={initialProductResults}
      />
  );
}

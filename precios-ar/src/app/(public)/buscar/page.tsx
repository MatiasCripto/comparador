import { ArrowLeft, Search } from "lucide-react";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/service";
import Header from "@/components/shared/Header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import SearchFilters from "@/components/shared/search-filters";
import SearchResults from "@/components/shared/search-results";
import type { LatestPrice } from "@/types/database";
import { getUserLocation } from "@/lib/location-server";
import { searchProducts } from "@/lib/search/search-engine";

interface SearchParams {
  q?: string;
  provincia?: string;
  categoria?: string;
  orden?: string;
  precio_min?: string;
  precio_max?: string;
}

async function getMatchingStoreIds(supabase: ReturnType<typeof createAdminClient>, userProvince: string | null): Promise<string[] | null> {
  // If no user location, return null = no filter (show all)
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

async function searchProductsWithRelevance(params: SearchParams): Promise<LatestPrice[]> {
  try {
    const { q, provincia, categoria, orden, precio_min, precio_max } = params;

    if (!q) return [];

    // Apply location filter from cookie
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

    // Sort based on user preference (keep existing sort behavior)
    const products = result.products;
    switch (orden) {
      case "price_desc":
        products.sort((a, b) => b.price - a.price);
        break;
      case "price_asc":
        products.sort((a, b) => a.price - b.price);
        break;
      default:
        // Already sorted by relevance desc, price asc
        break;
    }

    return products.slice(0, 200);
  } catch (e) {
    console.error("[buscar] search error:", e);
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

  const results = q ? await searchProductsWithRelevance(params) : [];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-6">
        {!q ? (
          <div className="text-center py-20">
            <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Ingresá un término de búsqueda
            </h2>
            <p className="text-gray-500">
              Escribí lo que querés comprar para ver los mejores precios
            </p>
          </div>
        ) : (
          <div className="flex gap-8">
            {/* Sidebar */}
            <SearchFilters
              currentQuery={q}
              currentProvince={provincia}
              currentCategory={categoria}
              currentSort={orden}
              currentMinPrice={precio_min}
              currentMaxPrice={precio_max}
            />

            {/* Results */}
            <div className="flex-1 min-w-0 space-y-4">
              {/* Mobile filter button is inside SearchFilters */}
              <SearchResults
                results={results}
                query={q}
                provincia={provincia}
                categoria={categoria}
              />
            </div>
          </div>
        )}
      </main>

      <footer className="border-t py-8 px-4 mt-auto">
        <div className="container mx-auto text-center space-y-2">
          <p className="text-sm text-gray-500">
            PreciosAR — Precios actualizados cada 6 horas
          </p>
          <div className="flex justify-center gap-4 text-xs text-gray-400">
            <a href="/" className="hover:text-gray-900">
              Inicio
            </a>
            <a href="/buscar" className="hover:text-gray-900">
              Buscar
            </a>
            <a href="/lista" className="hover:text-gray-900">
              Lista
            </a>
            <a href="/alertas" className="hover:text-gray-900">
              Mis alertas
            </a>
          </div>
          <p className="text-xs text-gray-400">
            Los precios pueden variar. Verificá siempre en la tienda.
          </p>
        </div>
      </footer>
    </div>
  );
}

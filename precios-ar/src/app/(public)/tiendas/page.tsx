import Link from "next/link";
import { notFound } from "next/navigation";
import { Store, Package, Clock, ChevronRight } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/service";
import { slugify } from "@/lib/slug";
import { formatRelativeTime, formatPrice } from "@/lib/utils";
import type { LatestPrice } from "@/types/database";

interface StoreRow {
  id: string;
  name: string;
  url: string;
  category: string | null;
  city: string | null;
  province: string | null;
  last_scraped_at: string | null;
}

export const metadata = {
  title: "Tiendas",
  description: "Todas las tiendas disponibles en PreciosAR",
};

export default async function TiendasPage() {
  const supabase = createAdminClient();

  const { data: stores, error } = await supabase
    .from("stores")
    .select("id, name, url, category, city, province, last_scraped_at")
    .eq("scraping_enabled", true)
    .order("name");

  if (error || !stores) notFound();

  if (stores.length === 0) {
    return (
      <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-gray-50 to-white">
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Tiendas</h1>
          <p className="text-gray-500">No hay tiendas disponibles.</p>
        </div>
      </div>
    );
  }

  // Get product count per store
  const storeCounts = await Promise.all(
    stores.map(async (store) => {
      const { count } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("store_id", store.id);
      return { id: store.id, count: count ?? 0 };
    })
  );
  const countMap = Object.fromEntries(storeCounts.map((c) => [c.id, c.count]));

  // Get cheapest product per store (first from latest_prices)
  const { data: latestPrices } = (await supabase
    .from("latest_prices")
    .select("store_id, price")
    .in(
      "store_id",
      stores.map((s) => s.id)
    )
    .order("price", { ascending: true })) as { data: LatestPrice[] | null };
  const cheapestMap = new Map<string, number>();
  for (const lp of latestPrices ?? []) {
    if (!cheapestMap.has(lp.store_id)) {
      cheapestMap.set(lp.store_id, lp.price);
    }
  }

  // Group stores by category
  const grouped = new Map<string, StoreRow[]>();
  for (const store of stores) {
    const cat = store.category || "Sin categoría";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(store);
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-blue-100 mb-4">
            <Store className="h-6 w-6 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Tiendas</h1>
          <p className="text-sm text-gray-500 mt-1">
            {stores.length} tienda{stores.length !== 1 ? "s" : ""} disponibles
          </p>
        </div>

        {/* By category */}
        {Array.from(grouped.entries()).map(([category, catStores]) => (
          <section key={category} className="mb-10">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                {category}
              </span>
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">{catStores.length}</span>
            </div>

            <div className="space-y-3">
              {catStores.map((store) => {
                const productCount = countMap[store.id] ?? 0;
                const cheapest = cheapestMap.get(store.id);

                return (
                  <Link
                    key={store.id}
                    href={`/tiendas/${slugify(store.name)}`}
                    className="block rounded-xl border bg-white p-4 hover:shadow-md hover:border-blue-200 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                          {store.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-500">
                          <span className="flex items-center gap-1">
                            <Package className="h-3 w-3" />
                            {productCount} producto{productCount !== 1 ? "s" : ""}
                          </span>
                          {cheapest !== undefined && (
                            <span className="flex items-center gap-1">
                              Desde{" "}
                              <span className="font-medium text-gray-700">
                                {formatPrice(cheapest)}
                              </span>
                            </span>
                          )}
                          {store.last_scraped_at && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatRelativeTime(store.last_scraped_at)}
                            </span>
                          )}
                        </div>
                        {(store.city || store.province) && (
                          <p className="text-xs text-gray-400 mt-1">
                            {[store.city, store.province]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-blue-500 transition-colors shrink-0 ml-3" />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

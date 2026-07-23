import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Package, ExternalLink, Tag, Store } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/service";
import { slugify } from "@/lib/slug";
import { formatPrice, externalUrl } from "@/lib/utils";
import type { LatestPrice } from "@/types/database";

const ITEMS_PER_PAGE = 50;

export const metadata = {
  title: "Productos por tienda",
};

export default async function StorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createAdminClient();

  // Find store by slugifying names
  const { data: allStores } = await supabase
    .from("stores")
    .select("id, name, url, category, city, province, last_scraped_at")
    .eq("scraping_enabled", true);

  if (!allStores) notFound();

  const store = allStores.find((s) => slugify(s.name) === slug);
  if (!store) notFound();

  // Get product count
  const { count: productCount } = await supabase
    .from("products")
    .select("*", { count: "exact", head: true })
    .eq("store_id", store.id);

  // Get products with prices
  const { data: latestPrices } = await supabase
    .from("latest_prices")
    .select("*")
    .eq("store_id", store.id)
    .order("price", { ascending: true })
    .limit(ITEMS_PER_PAGE) as { data: LatestPrice[] | null };

  const products = latestPrices ?? [];

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Back link */}
        <Link
          href="/tiendas"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Todas las tiendas
        </Link>

        {/* Store header */}
        <div className="rounded-xl border bg-white p-6 mb-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
                  <Store className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
                    {store.name}
                  </h1>
                  {store.category && (
                    <span className="text-sm text-gray-500">
                      <Tag className="h-3 w-3 inline mr-1" />
                      {store.category}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mt-2">
                <span className="flex items-center gap-1">
                  <Package className="h-4 w-4" />
                  {productCount ?? 0} producto
                  {productCount !== 1 ? "s" : ""}
                </span>
                {store.city || store.province ? (
                  <span>
                    {[store.city, store.province].filter(Boolean).join(", ")}
                  </span>
                ) : null}
              </div>
            </div>

            {store.url && (
              <a
                href={externalUrl(store.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-blue-300 hover:text-blue-600 transition-all shrink-0"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Sitio original
              </a>
            )}
          </div>
        </div>

        {/* Products */}
        <div className="space-y-1">
          {products.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Package className="h-8 w-8 mx-auto mb-2" />
              <p className="text-sm">No hay productos disponibles</p>
            </div>
          ) : (
            <div className="rounded-xl border bg-white divide-y overflow-hidden">
              <div className="px-4 py-3 bg-gray-50/50 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Productos ({products.length}
                  {productCount && productCount > ITEMS_PER_PAGE
                    ? ` de ${productCount}`
                    : ""}
                  )
                </span>
                <span className="text-xs text-gray-400">Precio</span>
              </div>

              {products.map((product, i) => (
                <div
                  key={product.product_id}
                  className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <span className="text-xs text-gray-400 font-mono w-6 shrink-0">
                      {i + 1}.
                    </span>
                    <span className="text-sm text-gray-900 truncate">
                      {product.canonical_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-3">
                    <span className="text-sm font-semibold text-gray-900">
                      {formatPrice(product.price)}
                    </span>
                    {product.product_url && (
                      <a
                      href={externalUrl(product.product_url)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-gray-400 hover:text-blue-600 transition-colors"
                        title="Ver producto original"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

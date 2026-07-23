"use client";

import { useState, useCallback } from "react";
import { Search, Loader2, AlertCircle } from "lucide-react";
import CategorySelector from "@/components/lista/CategorySelector";
import ProductAutocomplete from "@/components/shared/ProductAutocomplete";
import SearchResults from "@/components/shared/search-results";
import SearchFilters from "@/components/shared/search-filters";
import type { SelectedProduct } from "@/types/search";
import type { LatestPrice } from "@/types/database";

export default function BuscarClient({
  initialCategories,
  initialQuery = "",
  initialProvince,
  initialCategory,
  initialSort,
  initialMinPrice,
  initialMaxPrice,
  initialResults,
}: {
  initialCategories: string[];
  initialQuery?: string;
  initialProvince?: string;
  initialCategory?: string;
  initialSort?: string;
  initialMinPrice?: string;
  initialMaxPrice?: string;
  initialResults?: LatestPrice[];
}) {
  const [selectedCategory, setSelectedCategory] = useState(initialCategory ?? "");
  const [selectedProduct, setSelectedProduct] = useState<SelectedProduct | null>(null);
  const [productResults, setProductResults] = useState<LatestPrice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleProductSelect = useCallback(async (product: SelectedProduct) => {
    setSelectedProduct(product);
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/lista", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: [product],
          store_category: selectedCategory || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al buscar precios");

      // Extract prices from the "Máximo ahorro" strategy
      const maxAhorro = data.strategies?.find(
        (s: { name: string }) => s.name === "Máximo ahorro"
      );

      if (maxAhorro && maxAhorro.stores?.length > 0) {
        // Build LatestPrice[] from strategy store items
        const prices: LatestPrice[] = maxAhorro.stores.flatMap(
          (store: { store_id: string; store_name: string; items: { name: string; price: number }[] }) =>
            store.items.map((item: { name: string; price: number }) => ({
              product_id: product.product_id,
              canonical_name: item.name,
              store_id: store.store_id,
              store_name: store.store_name,
              price: item.price,
              price_original: item.price,
              product_url: null,
              image_url: null,
              province: null,
              category: selectedCategory || null,
              subcategory: null,
              brand: product.brand || null,
              raw_name: product.raw_name || null,
              unit: null,
              quantity: null,
              is_offer: false,
              scraped_at: null,
            }))
        );
        setProductResults(prices);
      } else {
        setProductResults([]);
        if (data.items?.length > 0 && !data.items[0].matched) {
          setError(`No se encontraron precios para "${product.canonical_name}"`);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
      setProductResults([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory]);

  const handleCategoryChange = useCallback((cat: string) => {
    setSelectedCategory(cat);
    setSelectedProduct(null);
    setProductResults([]);
    setError(null);
  }, []);

  const hasProductSearch = selectedProduct && productResults.length > 0;
  const hasTextSearch = initialQuery && initialResults && initialResults.length > 0;

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 container mx-auto px-4 py-6">
        {/* Category selector + Product autocomplete section */}
        <div className="max-w-2xl mx-auto mb-8 space-y-4">
          {initialCategories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Categoría de tienda
              </label>
              <CategorySelector
                categories={initialCategories}
                selected={selectedCategory}
                onChange={handleCategoryChange}
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar producto
            </label>
            <ProductAutocomplete
              storeCategory={selectedCategory}
              onSelect={handleProductSelect}
              placeholder="Escribí un producto para ver sus precios..."
            />
          </div>

          {loading && (
            <div className="flex items-center justify-center gap-2 text-sm text-gray-500 py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Buscando precios...
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </div>

        {/* Results area */}
        {hasProductSearch && (
          <div className="flex gap-8">
            <SearchFilters
              currentQuery={selectedProduct.canonical_name}
              currentProvince={initialProvince}
              currentCategory={selectedCategory || undefined}
            />
            <div className="flex-1 min-w-0 space-y-4">
              <SearchResults
                results={productResults}
                query={selectedProduct.canonical_name}
                provincia={initialProvince}
                categoria={selectedCategory || undefined}
              />
            </div>
          </div>
        )}

        {/* Fallback: text search results from URL params */}
        {!hasProductSearch && hasTextSearch && (
          <div className="flex gap-8">
            <SearchFilters
              currentQuery={initialQuery}
              currentProvince={initialProvince}
              currentCategory={initialCategory}
              currentSort={initialSort}
              currentMinPrice={initialMinPrice}
              currentMaxPrice={initialMaxPrice}
            />
            <div className="flex-1 min-w-0 space-y-4">
              <SearchResults
                results={initialResults}
                query={initialQuery}
                provincia={initialProvince}
                categoria={initialCategory}
              />
            </div>
          </div>
        )}

        {/* Empty state: no search yet */}
        {!hasProductSearch && !hasTextSearch && !loading && (
          <div className="text-center py-20">
            <Search className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Seleccioná un producto
            </h2>
            <p className="text-gray-500">
              Escribí arriba lo que querés comprar y seleccioná un producto para ver los mejores precios
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

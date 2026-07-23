"use client";

import { useState, useCallback } from "react";
import { ShoppingCart, ArrowRight, Loader2, AlertCircle, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import CategorySelector from "./CategorySelector";
import ProductSearchInput from "./ProductSearchInput";
import ProductList from "./ProductList";
import StrategyResults from "./StrategyResults";

type Step = "category" | "products" | "results";

interface StrategyStore {
  store_id: string;
  store_name: string;
  items: { name: string; price: number; store_id: string; product_url: string | null }[];
  subtotal: number;
}

interface Strategy {
  name: string;
  description: string;
  total: number;
  savings: number;
  missing: string[];
  stores: StrategyStore[];
}

interface ListaResult {
  items: { term: string; matched: boolean; canonical_name: string | null; variants: number }[];
  strategies: Strategy[];
}

export default function ListaClient({
  initialCategories,
}: {
  initialCategories: string[];
}) {
  const [step, setStep] = useState<Step>(initialCategories.length > 0 ? "category" : "products");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [items, setItems] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [result, setResult] = useState<ListaResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addItem = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setItems(prev => prev.includes(trimmed) ? prev : [...prev, trimmed]);
  }, []);

  const removeItem = useCallback((term: string) => {
    setItems(prev => prev.filter(t => t !== term));
  }, []);

  const handleCategoryChange = useCallback((cat: string) => {
    setSelectedCategory(cat);
    if (cat && step === "category") {
      setStep("products");
    }
  }, [step]);

  const handleCompare = useCallback(async () => {
    if (items.length === 0) return;

    setComparing(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/lista", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          ...(selectedCategory ? { store_category: selectedCategory } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al comparar precios");
      }

      // Validate strategies
      const validStrats = (data.strategies ?? []).filter(
        (s: Strategy) => s.total > 0 || s.name === "Máximo ahorro"
      );

      if (validStrats.length === 0) {
        throw new Error("No se encontraron precios para los productos seleccionados");
      }

      setResult({ items: data.items ?? [], strategies: validStrats });
      setStep("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setComparing(false);
    }
  }, [items, selectedCategory]);

  const handleNewList = useCallback(() => {
    setItems([]);
    setResult(null);
    setError(null);
    setStep(initialCategories.length > 0 ? "category" : "products");
    setSelectedCategory("");
  }, [initialCategories.length]);

  const handleBackToCategory = useCallback(() => {
    setStep("category");
    setResult(null);
    setError(null);
  }, []);

  const unmatchedCount = result
    ? result.items.filter(i => !i.matched).length
    : 0;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Page header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-blue-100 mb-4">
            <ShoppingCart className="h-6 w-6 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            Armá tu lista de precios
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Compará precios entre distintas tiendas al instante
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[
            { key: "category" as Step, label: "Categoría" },
            { key: "products" as Step, label: "Productos" },
            { key: "results" as Step, label: "Resultados" },
          ].map((s, i) => {
            const active = step === s.key;
            const done = step === "results" && i < 2;
            return (
              <div key={s.key} className="flex items-center gap-2">
                {i > 0 && (
                  <div className={`h-px w-6 ${active || done ? "bg-blue-400" : "bg-gray-200"}`} />
                )}
                <span
                  className={`text-xs font-medium px-2 py-1 rounded-full transition-colors ${
                    active
                      ? "bg-blue-600 text-white"
                      : done
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Step 1: Category */}
        {step === "category" && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-1">
                Elegí una categoría para filtrar los productos
              </p>
            </div>
            <div className="flex justify-center">
              <CategorySelector
                categories={initialCategories}
                selected={selectedCategory}
                onChange={handleCategoryChange}
              />
            </div>
            <div className="text-center pt-4">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-gray-400"
                onClick={() => {
                  setSelectedCategory("");
                  setStep("products");
                }}
              >
                <Package className="h-3.5 w-3.5 mr-1" />
                Sin categoría (todas las tiendas)
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Products */}
        {step === "products" && (
          <div className="space-y-4">
            <ProductSearchInput
              storeCategory={selectedCategory}
              onAddProduct={addItem}
              existingItems={items}
              disabled={comparing}
            />

            <ProductList
              items={items}
              onRemove={removeItem}
              result={result}
              loading={comparing}
            />

            {/* Category badge */}
            {selectedCategory && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBackToCategory}
                  className="text-xs text-gray-400 hover:text-blue-600 transition-colors"
                >
                  Cambiar categoría
                </button>
                <span className="text-xs text-gray-300">·</span>
                <span className="text-xs text-gray-400">
                  Filtrando por: <strong>{selectedCategory}</strong>
                </span>
              </div>
            )}

            {/* Compare button */}
            <Button
              className="w-full h-12 text-base font-semibold mt-4"
              onClick={handleCompare}
              disabled={items.length === 0 || comparing}
            >
              {comparing ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Buscando mejores precios...
                </>
              ) : (
                <>
                  Encontrar mejor precio
                  <ArrowRight className="h-5 w-5 ml-2" />
                </>
              )}
            </Button>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Results */}
        {step === "results" && result && (
          <StrategyResults
            strategies={result.strategies}
            unmatchedCount={unmatchedCount}
            totalItems={result.items.length}
            onNewList={handleNewList}
          />
        )}
      </div>
    </div>
  );
}

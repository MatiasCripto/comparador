"use client";

import { useState, useCallback, useRef } from "react";
import { Plus, Trash2, ShoppingCart, Store, ExternalLink, Tag, ArrowLeft, SearchX, Sparkles, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import Header from "@/components/shared/Header";
import Link from "next/link";
import { formatPrice } from "@/lib/utils";

interface StoreItem {
  name: string;
  price: number;
  store_id: string;
  product_url: string | null;
}

interface StrategyStore {
  store_id: string;
  store_name: string;
  items: StoreItem[];
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

interface ItemInfo {
  term: string;
  matched: boolean;
  canonical_name: string | null;
  variants: number;
}

interface ListaResponse {
  items: ItemInfo[];
  strategies: Strategy[];
}

type Status = "idle" | "loading" | "success" | "error";

export default function ListaPage() {
  const [productList, setProductList] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<ListaResponse | null>(null);
  const [error, setError] = useState("");
  const [expandedStrategy, setExpandedStrategy] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const addProduct = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    if (productList.includes(trimmed)) {
      setInputValue("");
      return;
    }
    setProductList(prev => [...prev, trimmed]);
    setInputValue("");
    setResult(null);
    setStatus("idle");
    inputRef.current?.focus();
  }, [inputValue, productList]);

  const removeProduct = useCallback((term: string) => {
    setProductList(prev => prev.filter(t => t !== term));
    setResult(null);
    setStatus("idle");
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") addProduct();
  }, [addProduct]);

  const findBestPrices = useCallback(async () => {
    if (productList.length === 0) return;

    setStatus("loading");
    setError("");

    try {
      const res = await fetch("/api/lista", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: productList }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Error al buscar precios");
      }

      const data: ListaResponse = await res.json();
      setResult(data);
      setStatus("success");
      setExpandedStrategy(data.strategies[0]?.name || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al buscar precios");
      setStatus("error");
    }
  }, [productList]);

  const unmatchedCount = result?.items.filter(i => !i.matched).length ?? 0;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8 max-w-2xl">
        <div className="space-y-6">
          {/* Header */}
          <div>
            <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-blue-600 mb-2">
              <ArrowLeft className="h-3 w-3 mr-1" />
              Volver al inicio
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-blue-600" />
              Lista de compras inteligente
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Agregá productos uno por uno y encontrá la mejor combinación de tiendas para ahorrar
            </p>
          </div>

          {/* Input */}
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ej: leche, pan, huevos..."
              className="h-10 text-sm flex-1"
              disabled={status === "loading"}
            />
            <Button
              onClick={addProduct}
              disabled={!inputValue.trim() || status === "loading"}
              className="h-10"
            >
              <Plus className="h-4 w-4 mr-1" />
              Agregar
            </Button>
          </div>

          {/* Product list */}
          {productList.length > 0 && (
            <div className="rounded-lg border bg-white">
              <div className="px-4 py-3 border-b bg-gray-50/50">
                <p className="text-sm font-medium text-gray-700">
                  Tu lista ({productList.length} producto{productList.length !== 1 ? "s" : ""})
                </p>
              </div>
              <div className="divide-y">
                {productList.map((term, i) => {
                  const match = result?.items.find(m => m.term === term);
                  const isMatched = match?.matched;
                  return (
                    <div key={`${term}-${i}`} className="flex items-center justify-between px-4 py-2.5 group">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm text-gray-900 truncate">{term}</span>
                        {result && (
                          isMatched ? (
                            <Badge variant="secondary" className="text-[10px] bg-green-50 text-green-700 border-green-200 shrink-0">
                              {match!.variants > 1 ? `${match!.variants} vars.` : "ok"}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] bg-red-50 text-red-700 border-red-200 shrink-0">
                              sin resultado
                            </Badge>
                          )
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0 h-7 w-7 p-0 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeProduct(term)}
                        disabled={status === "loading"}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action button */}
          {productList.length > 0 && (
            <Button
              onClick={findBestPrices}
              disabled={status === "loading"}
              className="w-full h-12 text-base"
              size="lg"
            >
              {status === "loading" ? (
                "Buscando mejores precios..."
              ) : (
                <>
                  <Sparkles className="h-5 w-5 mr-2" />
                  Encontrar mejor precio
                </>
              )}
            </Button>
          )}

          {status === "loading" && (
            <div className="text-center py-8">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto" />
                <div className="h-4 bg-gray-200 rounded w-1/2 mx-auto" />
              </div>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Results */}
          {result && status === "success" && (
            <div className="space-y-4">
              {unmatchedCount > 0 && (
                <div className="text-sm text-amber-700 bg-amber-50 rounded-md px-3 py-2 flex items-center gap-2">
                  <SearchX className="h-4 w-4 shrink-0" />
                  {unmatchedCount} producto{unmatchedCount !== 1 ? "s" : ""} sin resultados. Intentá con términos más específicos.
                </div>
              )}

              {/* Strategies */}
              {result.strategies.map((strat) => (
                <div
                  key={strat.name}
                  className="rounded-xl border bg-white overflow-hidden"
                >
                  <button
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
                    onClick={() => setExpandedStrategy(expandedStrategy === strat.name ? null : strat.name)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
                        strat.name === "Máximo ahorro" ? "bg-green-100" :
                        strat.name === "Combinar 2 tiendas" ? "bg-blue-100" :
                        "bg-gray-100"
                      }`}>
                        {strat.name === "Máximo ahorro" ? (
                          <Sparkles className={`h-5 w-5 ${strat.name === "Máximo ahorro" ? "text-green-600" : "text-blue-600"}`} />
                        ) : strat.name === "Combinar 2 tiendas" ? (
                          <Store className="h-5 w-5 text-blue-600" />
                        ) : (
                          <Tag className="h-5 w-5 text-gray-600" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">{strat.name}</p>
                        <p className="text-xs text-gray-500 truncate">{strat.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="font-bold text-lg text-gray-900">{formatPrice(strat.total)}</p>
                        {strat.savings > 0 && (
                          <p className="text-xs text-green-600 font-medium">
                            Ahorrás {formatPrice(strat.savings)}
                          </p>
                        )}
                      </div>
                      {expandedStrategy === strat.name ? (
                        <ChevronUp className="h-5 w-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {expandedStrategy === strat.name && (
                    <div className="px-4 pb-4 space-y-3">
                      <Separator />

                      {strat.missing.length > 0 && (
                        <div className="text-xs text-amber-600 bg-amber-50 rounded-md px-3 py-2">
                          {strat.missing.length} producto{strat.missing.length !== 1 ? "s" : ""} no disponible{strat.missing.length !== 1 ? "s" : ""}: {strat.missing.join(", ")}
                        </div>
                      )}

                      {strat.stores.map((store, si) => (
                        <div key={store.store_id} className="rounded-lg border bg-gray-50/50 overflow-hidden">
                          <div className="px-3 py-2 bg-white border-b flex items-center justify-between">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Store className="h-3.5 w-3.5 text-gray-500 shrink-0" />
                              <span className="text-sm font-medium text-gray-900 truncate">{store.store_name}</span>
                            </div>
                            <span className="text-sm font-semibold text-gray-900 shrink-0 ml-2">
                              {formatPrice(store.subtotal)}
                            </span>
                          </div>
                          <div className="divide-y">
                            {store.items.map((item, ii) => (
                              <div key={`${si}-${ii}`} className="flex items-center justify-between px-3 py-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-xs text-gray-500 font-mono w-5 text-right shrink-0">
                                    {ii + 1}.
                                  </span>
                                  <span className="text-sm text-gray-700 truncate">{item.name}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                  <span className="text-sm font-medium text-gray-900">
                                    {formatPrice(item.price)}
                                  </span>
                                  {item.product_url && (
                                    <a
                                      href={item.product_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-gray-400 hover:text-blue-600 transition-colors"
                                    >
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {status === "success" && result!.strategies.length === 0 && (
            <div className="text-center py-12">
              <SearchX className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">
                No se encontraron precios para los productos de tu lista.
                Intentá con términos más específicos.
              </p>
            </div>
          )}
        </div>
      </main>

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

"use client";

import { useState } from "react";
import { Store, ExternalLink, ChevronDown, ChevronUp, SearchX, Sparkles, ShoppingCart, Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { formatPrice, externalUrl } from "@/lib/utils";

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

const STRATEGY_LABELS: Record<string, { label: string; icon: typeof Sparkles; color: string; bg: string; ring: string }> = {
  "Una sola tienda": { label: "Todo en una tienda", icon: ShoppingCart, color: "text-green-700", bg: "bg-green-50", ring: "ring-green-200" },
  "Combinar 2 tiendas": { label: "2 tiendas", icon: Store, color: "text-blue-700", bg: "bg-blue-50", ring: "ring-blue-200" },
  "Máximo ahorro": { label: "Máximo ahorro", icon: Sparkles, color: "text-purple-700", bg: "bg-purple-50", ring: "ring-purple-200" },
};

export default function StrategyResults({
  strategies,
  unmatchedCount,
  totalItems,
  onNewList,
}: {
  strategies: Strategy[];
  unmatchedCount: number;
  totalItems: number;
  onNewList: () => void;
}) {
  const [expanded, setExpanded] = useState<string>(strategies[0]?.name || "");

  const maxSavingsTotal = strategies.find(s => s.name === "Máximo ahorro")?.total || 0;

  return (
    <div className="space-y-4">
      {unmatchedCount > 0 && (
        <div className="text-sm text-amber-700 bg-amber-50 rounded-md px-3 py-2 flex items-center gap-2">
          <SearchX className="h-4 w-4 shrink-0" />
          {unmatchedCount} producto{unmatchedCount !== 1 ? "s" : ""} sin resultados. Intentá con términos más específicos.
        </div>
      )}

      {/* Option badge */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Resultados</span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {strategies.map((strat, index) => {
        const config = STRATEGY_LABELS[strat.name] || { label: strat.name, icon: Tag, color: "text-gray-700", bg: "bg-gray-50", ring: "ring-gray-200" };
        const Icon = config.icon;
        const isExpanded = expanded === strat.name;

        // Calculate savings
        const savingsDisplay = strat.savings > 0 ? strat.savings : 0;

        return (
          <div
            key={strat.name}
            className={`rounded-xl border bg-white overflow-hidden transition-all ${
              index === 0 ? `ring-2 ${config.ring} shadow-md` : "shadow-sm"
            }`}
          >
            <button
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-left"
              onClick={() => setExpanded(isExpanded ? "" : strat.name)}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${config.bg}`}>
                  <Icon className={`h-5 w-5 ${config.color}`} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-gray-900">{config.label}</p>
                    {index === 0 && (
                      <Badge className="text-[10px] bg-green-600 text-white px-1.5 py-0">
                        Recomendado
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">
                    {strat.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-right">
                  <p className="font-bold text-lg text-gray-900">{formatPrice(strat.total)}</p>
                  {index === 0 && savingsDisplay > 0 && (
                    <p className="text-xs text-green-600 font-medium">
                      Ahorrás {formatPrice(savingsDisplay)}
                    </p>
                  )}
                  {index > 0 && savingsDisplay > 0 && (
                    <p className="text-xs text-green-600 font-medium">
                      Ahorrás {formatPrice(savingsDisplay)}
                    </p>
                  )}
                </div>
                {isExpanded ? (
                  <ChevronUp className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                )}
              </div>
            </button>

            {isExpanded && (
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
                            <span className="text-xs text-gray-500 font-mono w-5 text-right shrink-0">{ii + 1}.</span>
                            <span className="text-sm text-gray-700 truncate">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-2">
                            <span className="text-sm font-medium text-gray-900">{formatPrice(item.price)}</span>
                            {item.product_url && (
                              <a
                                href={externalUrl(item.product_url)}
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
        );
      })}

      <div className="text-center pt-2">
        <Button
          variant="outline"
          size="sm"
          className="text-xs"
          onClick={onNewList}
        >
          Nueva lista
        </Button>
      </div>
    </div>
  );
}

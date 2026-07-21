"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import ProductCard from "./ProductCard";
import type { LatestPrice } from "@/types/database";

type GroupedResult = {
  canonical_name: string;
  products: LatestPrice[];
};

function formatPrice(price: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
}

function ProductGroupCard({
  group,
  index,
}: {
  group: GroupedResult;
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasMultiple = group.products.length > 1;
  const best = group.products[0];
  const rest = group.products.slice(1);

  return (
    <div key={`${group.canonical_name}-${index}`} className="space-y-2">
      <ProductCard product={best} isBestPrice />

      {hasMultiple && (
        <div className="pl-4">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-blue-600 h-8 hover:text-blue-700"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Ocultar otros precios
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Ver todos los precios ({group.products.length} tiendas) — desde{" "}
                {formatPrice(best.price)}
              </>
            )}
          </Button>

          {expanded && (
            <div className="mt-2 space-y-2 pl-4 border-l-2 border-gray-100">
              {rest.map((p, i) => (
                <ProductCard key={`${p.store_id}-${i}`} product={p} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SearchResults({
  results,
  query,
  provincia,
  categoria,
}: {
  results: LatestPrice[];
  query: string;
  provincia?: string;
  categoria?: string;
}) {
  if (results.length === 0) {
    return (
      <div className="text-center py-20">
        <SearchX className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          No encontramos resultados
        </h2>
        <p className="text-gray-500 max-w-md mx-auto">
          No encontramos productos para &ldquo;{query}&rdquo;. Intentá con otro
          término o revisá los filtros aplicados.
        </p>
      </div>
    );
  }

  // Group products by canonical_name
  const grouped = results.reduce<Map<string, LatestPrice[]>>((acc, p) => {
    const key = p.canonical_name;
    if (!acc.has(key)) acc.set(key, []);
    acc.get(key)!.push(p);
    return acc;
  }, new Map());

  const groups: GroupedResult[] = Array.from(grouped.entries())
    .map(([name, products]) => ({
      canonical_name: name,
      products: products.sort((a, b) => a.price - b.price),
    }))
    .sort((a, b) => a.products[0].price - b.products[0].price);

  const totalResults = results.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold text-gray-900">
          {totalResults} resultado{totalResults !== 1 ? "s" : ""} para
          &nbsp;&ldquo;{query}&rdquo;
        </h1>
        {provincia && (
          <Badge variant="secondary" className="text-xs">
            {provincia}
          </Badge>
        )}
        {categoria && (
          <Badge variant="secondary" className="text-xs">
            {categoria}
          </Badge>
        )}
      </div>

      {/* Results */}
      <div className="space-y-4">
        {groups.map((group, i) => (
          <ProductGroupCard key={group.canonical_name} group={group} index={i} />
        ))}
      </div>
    </div>
  );
}

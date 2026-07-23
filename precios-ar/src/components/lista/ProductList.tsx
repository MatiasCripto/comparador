"use client";

import { Trash2, BadgeCheck, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ItemInfo {
  term: string;
  matched: boolean;
  canonical_name: string | null;
  variants: number;
}

export default function ProductList({
  items,
  onRemove,
  result,
  loading,
}: {
  items: string[];
  onRemove: (term: string) => void;
  result?: { items: ItemInfo[] } | null;
  loading: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-lg border bg-white">
      <div className="px-4 py-3 border-b bg-gray-50/50 flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">
          Tu lista ({items.length} producto{items.length !== 1 ? "s" : ""})
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-red-500 h-7 hover:text-red-700"
          onClick={() => items.forEach(onRemove)}
          disabled={loading}
        >
          Limpiar todo
        </Button>
      </div>
      <div className="divide-y">
        {items.map((term, i) => {
          const match = result?.items.find(m => m.term === term);
          const isMatched = match?.matched;

          return (
            <div
              key={`${term}-${i}`}
              className="flex items-center justify-between px-4 py-2.5 group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm text-gray-900 truncate">{term}</span>
                {result && (
                  isMatched ? (
                    <Badge
                      variant="secondary"
                      className="text-[10px] bg-green-50 text-green-700 border-green-200 shrink-0"
                    >
                      <BadgeCheck className="h-3 w-3 mr-0.5 inline" />
                      {match!.variants > 1
                        ? `${match!.variants} vars.`
                        : "ok"}
                    </Badge>
                  ) : (
                    <Badge
                      variant="secondary"
                      className="text-[10px] bg-red-50 text-red-700 border-red-200 shrink-0"
                    >
                      <SearchX className="h-3 w-3 mr-0.5 inline" />
                      sin resultado
                    </Badge>
                  )
                )}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 h-7 w-7 p-0 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onRemove(term)}
                disabled={loading}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

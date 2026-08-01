"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProductAutocomplete from "@/components/shared/ProductAutocomplete";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PROVINCES } from "@/lib/location";
import type { SelectedProduct } from "@/types/search";

export default function HeroSearchForm() {
  const router = useRouter();
  const [typedQuery, setTypedQuery] = useState("");
  const [province, setProvince] = useState("");
  const [categories, setCategories] = useState<{ label: string; slug: string }[]>([]);

  useEffect(() => {
    fetch("/api/store-categories")
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.categories)) {
          setCategories(d.categories.map((cat: string) => ({
            label: cat.charAt(0).toUpperCase() + cat.slice(1),
            slug: cat.toLowerCase(),
          })));
        }
      })
      .catch(() => {});
  }, []);

  // Producto real seleccionado del autocomplete → /buscar con product_id exacto
  const handleProductSelect = useCallback(
    (product: SelectedProduct) => {
      const params = new URLSearchParams();
      params.set("pid", product.product_id);
      params.set("q", product.canonical_name);
      if (province) params.set("provincia", province);

      router.push(`/buscar?${params.toString()}`);
    },
    [province, router]
  );

  // Botón "Buscar": texto libre (sin selección de autocomplete)
  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = typedQuery.trim();
      if (!trimmed) return;

      const params = new URLSearchParams();
      params.set("q", trimmed);
      if (province) params.set("provincia", province);

      router.push(`/buscar?${params.toString()}`);
    },
    [typedQuery, province, router]
  );

  const handleCategoryClick = useCallback(
    (slug: string) => {
      const params = new URLSearchParams();
      params.set("categoria", slug);
      if (province) params.set("provincia", province);

      router.push(`/buscar?${params.toString()}`);
    },
    [province, router]
  );

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <ProductAutocomplete
          onSelect={handleProductSelect}
          onQueryChange={setTypedQuery}
          placeholder="Buscá un producto... (ej: cemento, pintura látex, yerba)"
          inputClassName="pl-12 h-14 text-base rounded-xl border-2 focus-visible:ring-blue-500"
        />

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex items-center gap-2 flex-1">
            <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
            <Select value={province} onValueChange={(v) => setProvince(v ?? "")}>
              <SelectTrigger className="flex-1 h-11 text-sm">
                <SelectValue placeholder="Todas las provincias" />
              </SelectTrigger>
              <SelectContent>
                {PROVINCES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            size="lg"
            className="h-11 px-8 text-base font-semibold bg-blue-600 hover:bg-blue-700"
          >
            Buscar
          </Button>
        </div>
      </form>

      {categories.length > 0 && (
        <div className="flex flex-wrap justify-center gap-2">
          {categories.map((cat) => (
            <Badge
              key={cat.slug}
              variant="secondary"
              className="cursor-pointer px-4 py-1.5 text-sm hover:bg-blue-100 hover:text-blue-700 transition-colors"
              onClick={() => handleCategoryClick(cat.slug)}
            >
              {cat.label}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

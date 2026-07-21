"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { Filter, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const PROVINCES = [
  "CABA",
  "Buenos Aires",
  "Catamarca",
  "Chaco",
  "Chubut",
  "Córdoba",
  "Corrientes",
  "Entre Ríos",
  "Formosa",
  "Jujuy",
  "La Pampa",
  "La Rioja",
  "Mendoza",
  "Misiones",
  "Neuquén",
  "Río Negro",
  "Salta",
  "San Juan",
  "San Luis",
  "Santa Cruz",
  "Santa Fe",
  "Santiago del Estero",
  "Tierra del Fuego",
  "Tucumán",
];

const CATEGORIES = [
  "Supermercado",
  "Pinturería",
  "Corralón",
  "Cerámica",
  "Ferretería",
  "Electrodomésticos",
  "Farmacia",
  "Indumentaria",
  "Otros",
];

export default function SearchFilters({
  currentQuery,
  currentProvince,
  currentCategory,
  currentSort,
  currentMinPrice,
  currentMaxPrice,
}: {
  currentQuery: string;
  currentProvince?: string;
  currentCategory?: string;
  currentSort?: string;
  currentMinPrice?: string;
  currentMaxPrice?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const buildUrl = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams();
      if (currentQuery) params.set("q", currentQuery);

      const province = "provincia" in updates ? (updates.provincia ?? undefined) : currentProvince;
      const category = "categoria" in updates ? (updates.categoria ?? undefined) : currentCategory;
      const sort = "orden" in updates ? (updates.orden ?? undefined) : currentSort;
      const minPrice = "precio_min" in updates ? (updates.precio_min ?? undefined) : currentMinPrice;
      const maxPrice = "precio_max" in updates ? (updates.precio_max ?? undefined) : currentMaxPrice;

      if (province) params.set("provincia", province);
      if (category) params.set("categoria", category);
      if (sort) params.set("orden", sort);
      if (minPrice) params.set("precio_min", minPrice);
      if (maxPrice) params.set("precio_max", maxPrice);

      router.push(`/buscar?${params.toString()}`);
    },
    [currentQuery, currentProvince, currentCategory, currentSort, currentMinPrice, currentMaxPrice, router]
  );

  const handleClear = useCallback(() => {
    router.push(`/buscar?q=${encodeURIComponent(currentQuery)}`);
  }, [currentQuery, router]);

  const hasFilters = currentProvince || currentCategory || currentSort || currentMinPrice || currentMaxPrice;

  const filterContent = (
    <div className="space-y-6">
      {/* Province */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Provincia</Label>
        <Select
          value={currentProvince ?? "todas"}
          onValueChange={(v) =>
            buildUrl({ provincia: v === "todas" ? undefined : v })
          }
        >
          <SelectTrigger className="h-10 text-sm">
            <SelectValue placeholder="Todas las provincias" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas las provincias</SelectItem>
            {PROVINCES.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Category */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Categoría de tienda</Label>
        <div className="space-y-1">
          {CATEGORIES.map((cat) => (
            <label
              key={cat}
              className="flex items-center gap-2 py-1.5 cursor-pointer text-sm hover:text-blue-600 transition-colors"
            >
              <input
                type="checkbox"
                checked={currentCategory === cat.toLowerCase()}
                onChange={() =>
                  buildUrl({
                    categoria:
                      currentCategory === cat.toLowerCase()
                        ? undefined
                        : cat.toLowerCase(),
                  })
                }
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              {cat}
            </label>
          ))}
        </div>
      </div>

      <Separator />

      {/* Price range */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Rango de precio</Label>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            placeholder="Desde"
            defaultValue={currentMinPrice ?? ""}
            onChange={(e) =>
              buildUrl({
                precio_min: e.target.value || undefined,
              })
            }
            className="h-9 text-sm"
          />
          <span className="text-gray-400">—</span>
          <Input
            type="number"
            placeholder="Hasta"
            defaultValue={currentMaxPrice ?? ""}
            onChange={(e) =>
              buildUrl({
                precio_max: e.target.value || undefined,
              })
            }
            className="h-9 text-sm"
          />
        </div>
      </div>

      <Separator />

      {/* Sort */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Ordenar por</Label>
        <Select
          value={currentSort ?? "price_asc"}
          onValueChange={(v) => buildUrl({ orden: v })}
        >
          <SelectTrigger className="h-10 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="price_asc">Menor precio</SelectItem>
            <SelectItem value="price_desc">Mayor precio</SelectItem>
            <SelectItem value="newest">Más reciente</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {hasFilters && (
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={handleClear}
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Limpiar filtros
        </Button>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden lg:block w-64 shrink-0">
        <div className="sticky top-20 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
            <Filter className="h-4 w-4" />
            Filtros
          </div>
          {filterContent}
        </div>
      </aside>

      {/* Mobile */}
      <Sheet>
        <SheetTrigger className="inline-flex items-center justify-center gap-1 rounded-md border border-input bg-background px-3 h-8 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors lg:hidden">
            <Filter className="h-4 w-4 mr-1" />
            Filtros
            {hasFilters && (
              <span className="ml-1 h-2 w-2 rounded-full bg-blue-600" />
            )}
          </SheetTrigger>
        <SheetContent side="left" className="w-80">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filtros
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6">{filterContent}</div>
        </SheetContent>
      </Sheet>
    </>
  );
}

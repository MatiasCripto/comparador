"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { Search, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

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
  { label: "Supermercados", slug: "supermercado" },
  { label: "Pinturerías", slug: "pintureria" },
  { label: "Corralones", slug: "corralon" },
  { label: "Cerámicas", slug: "ceramica" },
  { label: "Ferreterías", slug: "ferreteria" },
  { label: "Electrodomésticos", slug: "electrodomesticos" },
  { label: "Farmacias", slug: "farmacia" },
  { label: "Indumentaria", slug: "indumentaria" },
  { label: "Otros", slug: "otros" },
];

export default function HeroSearchForm() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [province, setProvince] = useState("");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = query.trim();
      if (!trimmed) return;

      const params = new URLSearchParams();
      params.set("q", trimmed);
      if (province) params.set("provincia", province);

      router.push(`/buscar?${params.toString()}`);
    },
    [query, province, router]
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
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscá un producto... (ej: cemento, pintura látex, yerba)"
            className="pl-12 h-14 text-base rounded-xl border-2 focus-visible:ring-blue-500"
          />
        </div>

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

      <div className="flex flex-wrap justify-center gap-2">
        {CATEGORIES.map((cat) => (
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
    </div>
  );
}

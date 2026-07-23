"use client";

import { ShoppingCart, Wrench, Palette, Box, Building2, Pill, Tv, BookOpen, Dog, Sparkles, Dumbbell, Gamepad2, Sofa, Shirt, Baby, Monitor, Beef, Wine, Package, type LucideIcon } from "lucide-react";

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  supermercado: ShoppingCart,
  supermercados: ShoppingCart,
  ferreteria: Wrench,
  herramientas: Wrench,
  pintureria: Palette,
  ceramicas: Box,
  corralon: Building2,
  construccion: Building2,
  farmacia: Pill,
  electrodomesticos: Tv,
  electronica: Monitor,
  libreria: BookOpen,
  mascotas: Dog,
  cosmeticos: Sparkles,
  deportes: Dumbbell,
  juguetes: Gamepad2,
  muebles: Sofa,
  ropa: Shirt,
  bebes: Baby,
  frigorifico: Beef,
  bebidas: Wine,
  generico: Package,
};

const CATEGORY_LABELS: Record<string, string> = {
  supermercado: "Supermercado",
  supermercados: "Supermercado",
  ferreteria: "Ferretería",
  herramientas: "Herramientas",
  pintureria: "Pinturería",
  ceramicas: "Cerámicas",
  corralon: "Corralón",
  construccion: "Construcción",
  farmacia: "Farmacia",
  electrodomesticos: "Electrodomésticos",
  electronica: "Electrónica",
  libreria: "Librería",
  mascotas: "Mascotas",
  cosmeticos: "Cosméticos",
  deportes: "Deportes",
  juguetes: "Juguetes",
  muebles: "Muebles",
  ropa: "Ropa",
  bebes: "Bebés",
  frigorifico: "Frigorífico",
  bebidas: "Bebidas",
  generico: "Varios",
};

export default function CategorySelector({
  categories,
  selected,
  onChange,
}: {
  categories: string[];
  selected: string;
  onChange: (cat: string) => void;
}) {
  // Filter duplicates and normalize
  const unique = [...new Set(categories)].sort();

  return (
    <div className="flex flex-wrap gap-2">
      {unique.map((cat) => {
        const Icon = CATEGORY_ICONS[cat] || Package;
        const isSelected = selected === cat;
        return (
          <button
            key={cat}
            onClick={() => onChange(isSelected ? "" : cat)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
              isSelected
                ? "bg-blue-600 text-white shadow-md ring-2 ring-blue-300"
                : "bg-white border border-gray-200 text-gray-700 hover:border-blue-300 hover:text-blue-600"
            }`}
          >
            <Icon className="h-4 w-4" />
            {CATEGORY_LABELS[cat] || cat}
          </button>
        );
      })}
    </div>
  );
}

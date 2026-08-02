"use client";

import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { Tag, Bell, Settings, ShoppingCart, Store } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ProductAutocomplete from "@/components/shared/ProductAutocomplete";
import {
  useLocationPicker,
  LocationDialog,
  LocationBadge,
} from "@/components/shared/LocationPicker";
import type { SelectedProduct } from "@/types/search";

export default function Header({ lastScraping }: { lastScraping?: string | null }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const loc = useLocationPicker();
  const [headerQuery, setHeaderQuery] = useState("");

  const handleHeaderSelect = useCallback(
    (product: SelectedProduct) => {
      const params = new URLSearchParams();
      params.set("pid", product.product_id);
      params.set("q", product.canonical_name);
      window.location.href = `/buscar?${params.toString()}`;
    },
    []
  );

  const handleHeaderSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = headerQuery.trim();
      if (!trimmed) return;
      window.location.href = `/buscar?q=${encodeURIComponent(trimmed)}`;
    },
    [headerQuery]
  );

  return (
    <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto px-4 h-16 flex items-center gap-4">
        {/* Logo */}
        <a href="/" className="flex items-center gap-2 shrink-0 group">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center group-hover:bg-blue-700 transition-colors">
            <Tag className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight">
            Precios<span className="text-blue-600">AR</span>
          </span>
        </a>

        {/* Search bar — only when not on home */}
        {!isHome && (
          <form
            onSubmit={handleHeaderSubmit}
            className="flex-1 max-w-md hidden sm:block"
          >
            <ProductAutocomplete
              onSelect={handleHeaderSelect}
              onQueryChange={setHeaderQuery}
              placeholder="Buscá un producto..."
              inputClassName="pl-9 h-9 text-sm rounded-lg"
            />
          </form>
        )}

        {/* Right nav */}
        <div className="flex items-center gap-3 ml-auto">
          {/* Location */}
          <LocationBadge province={loc.savedProvince} onChange={loc.change} />

          {lastScraping && (
            <Badge
              variant="secondary"
              className="bg-green-50 text-green-700 border-green-200 text-xs hidden md:inline-flex"
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5 animate-pulse" />
              Actualizado
            </Badge>
          )}

          <a
            href="/lista"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Lista</span>
          </a>

          <a
            href="/tiendas"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            <Store className="h-4 w-4" />
            <span className="hidden sm:inline">Tiendas</span>
          </a>

          <a
            href="/alertas"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Mis alertas</span>
          </a>

          <a
            href="/admin/tiendas"
            className="text-xs text-gray-300 hover:text-gray-500 transition-colors"
            title="Admin"
          >
            <Settings className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Location selection dialog */}
      <LocationDialog
        open={loc.open}
        province={loc.province}
        city={loc.city}
        setProvince={loc.setProvince}
        setCity={loc.setCity}
        save={loc.save}
        setOpen={loc.setOpen}
      />
    </header>
  );
}

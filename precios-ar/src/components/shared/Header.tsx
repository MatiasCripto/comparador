"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { Tag, Search, Bell, Settings, ShoppingCart, Store } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  useLocationPicker,
  LocationDialog,
  LocationBadge,
} from "@/components/shared/LocationPicker";

export default function Header({ lastScraping }: { lastScraping?: string | null }) {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const loc = useLocationPicker();

  return (
    <header className="sticky top-0 z-50 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="container mx-auto px-4 h-16 flex items-center gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0 group">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center group-hover:bg-blue-700 transition-colors">
            <Tag className="h-4 w-4 text-white" />
          </div>
          <span className="font-bold text-xl tracking-tight">
            Precios<span className="text-blue-600">AR</span>
          </span>
        </Link>

        {/* Search bar — only when not on home */}
        {!isHome && (
          <form
            action="/buscar"
            method="GET"
            className="flex-1 max-w-md hidden sm:block"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                name="q"
                placeholder="Buscá un producto..."
                className="pl-9 h-9 text-sm rounded-lg"
              />
            </div>
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

          <Link
            href="/lista"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Lista</span>
          </Link>

          <Link
            href="/tiendas"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            <Store className="h-4 w-4" />
            <span className="hidden sm:inline">Tiendas</span>
          </Link>

          <Link
            href="/alertas"
            className="flex items-center gap-1 text-sm text-gray-500 hover:text-blue-600 transition-colors"
          >
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Mis alertas</span>
          </Link>

          <Link
            href="/admin/tiendas"
            className="text-xs text-gray-300 hover:text-gray-500 transition-colors"
            title="Admin"
          >
            <Settings className="h-3.5 w-3.5" />
          </Link>
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

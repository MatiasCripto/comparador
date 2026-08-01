"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MapPin, ChevronRight } from "lucide-react";
import { useUserLocation } from "@/hooks/useUserLocation";
import { formatPrice } from "@/lib/utils";
import { slugify } from "@/lib/slug";

interface NearbyStore {
  id: string;
  name: string;
  url: string;
  category: string | null;
  province: string | null;
  city: string | null;
  productCount: number;
  cheapestPrice: number | null;
}

export default function StoreNearYou() {
  const { location, loading } = useUserLocation();
  const [stores, setStores] = useState<NearbyStore[] | null>(null);

  useEffect(() => {
    if (!location?.provincia) {
      setStores(null);
      return;
    }
    let cancelled = false;
    fetch(
      `/api/stores/nearby?provincia=${encodeURIComponent(location.provincia)}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setStores(data.stores ?? []);
      })
      .catch(() => {
        if (!cancelled) setStores([]);
      });
    return () => {
      cancelled = true;
    };
  }, [location?.provincia]);

  if (loading || !location?.provincia || stores === null || stores.length === 0) {
    return null;
  }

  return (
    <section className="pb-16 px-4">
      <div className="container mx-auto max-w-3xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-blue-600" />
            Tiendas cerca de vos
          </h2>
          <Link href="/tiendas" className="text-sm text-blue-600 hover:underline">
            Ver todas
          </Link>
        </div>
        <div className="space-y-3">
          {stores.map((s) => (
            <Link
              key={s.id}
              href={`/tiendas/${slugify(s.name)}`}
              className="block rounded-xl border bg-white p-4 hover:shadow-md hover:border-blue-200 transition-all group"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                    {s.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {s.category} · {s.productCount} productos
                    {s.city ? ` · ${s.city}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {s.cheapestPrice !== null && (
                    <span className="text-sm font-semibold text-green-700">
                      desde {formatPrice(s.cheapestPrice)}
                    </span>
                  )}
                  <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-blue-500 transition-colors shrink-0" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

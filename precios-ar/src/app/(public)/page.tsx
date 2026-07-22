"use client";

import { useState, useEffect } from "react";
import Header from "@/components/shared/Header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import HeroSearchForm from "@/components/shared/hero-search-form";

interface Stats {
  stores: number;
  products: number;
  lastUpdate: string | null;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "hace unos segundos";
  if (mins < 60) return `hace ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return "hace 1 hora";
  return `hace ${hours} horas`;
}

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setStats(data);
        }
      })
      .catch((e) => setError(e.message));
  }, []);

  return (
    <>
      <Header lastScraping={stats?.lastUpdate ?? null} />

      <main className="flex-1">
        {/* Hero */}
        <section className="py-16 md:py-24 text-center px-4">
          <div className="container mx-auto max-w-3xl space-y-6">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900">
              Compará precios en toda Argentina
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Supermercados, pinturerías, corralones, cerámicas y más — en
              tiempo real
            </p>

            <div className="pt-4">
              <HeroSearchForm />
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="pb-16 px-4">
          <div className="container mx-auto max-w-3xl">
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium text-center">
                  Última actualización
                </CardTitle>
                <CardDescription className="text-center">
                  {stats?.lastUpdate
                    ? timeAgo(stats.lastUpdate)
                    : error
                      ? `Error: ${error}`
                      : "Cargando..."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="space-y-1">
                    <p className="text-3xl font-bold text-blue-600">
                      {stats !== null ? stats.stores : error ? "—" : "..."}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Tiendas activas
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-3xl font-bold text-green-600">
                      {stats !== null ? stats.products : error ? "—" : "..."}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Productos indexados
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* About */}
        <section className="pb-20 px-4">
          <div className="container mx-auto max-w-3xl">
            <div className="grid md:grid-cols-3 gap-8 text-center">
              <div className="space-y-2">
                <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto">
                  <span className="text-2xl">📝</span>
                </div>
                <h3 className="font-semibold">Armá tu lista</h3>
                <p className="text-sm text-muted-foreground">
                  Escribí los productos que necesitás comprar
                </p>
              </div>
              <div className="space-y-2">
                <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center mx-auto">
                  <span className="text-2xl">🔍</span>
                </div>
                <h3 className="font-semibold">Comparamos</h3>
                <p className="text-sm text-muted-foreground">
                  Buscamos el precio en todas las tiendas
                </p>
              </div>
              <div className="space-y-2">
                <div className="h-12 w-12 rounded-xl bg-green-50 flex items-center justify-center mx-auto">
                  <span className="text-2xl">🏆</span>
                </div>
                <h3 className="font-semibold">Elegí la mejor</h3>
                <p className="text-sm text-muted-foreground">
                  Encontrá la tienda con el menor precio total
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 px-4 mt-auto">
        <div className="container mx-auto max-w-3xl text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            PreciosAR — Precios actualizados cada 6 horas
          </p>
          <div className="flex justify-center gap-4 text-xs text-muted-foreground">
            <a href="/" className="hover:text-gray-900">
              Inicio
            </a>
            <a href="/buscar" className="hover:text-gray-900">
              Buscar
            </a>
            <a href="/alertas" className="hover:text-gray-900">
              Mis alertas
            </a>
          </div>
          <p className="text-xs text-gray-400">
            Los precios pueden variar. Verificá siempre en la tienda.
          </p>
        </div>
      </footer>
    </>
  );
}

import { createAdminClient } from "@/lib/supabase/service";
import Header from "@/components/shared/Header";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let lastScraping: string | null = null;
  try {
    const supabase = createAdminClient();
    const { data: lastLog } = await supabase
      .from("scraping_logs")
      .select("scraped_at")
      .order("scraped_at", { ascending: false })
      .limit(1)
      .single();

    lastScraping = lastLog?.scraped_at ?? null;
  } catch {
    // Ignore error, continue rendering
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header lastScraping={lastScraping} />
      {children}
      <footer className="border-t py-8 px-4 mt-auto">
        <div className="container mx-auto text-center space-y-2">
          <p className="text-sm text-gray-500">
            PreciosAR — Precios actualizados cada 6 horas
          </p>
          <div className="flex justify-center gap-4 text-xs text-gray-400">
            <a href="/" className="hover:text-gray-900">
              Inicio
            </a>
            <a href="/buscar" className="hover:text-gray-900">
              Buscar
            </a>
            <a href="/lista" className="hover:text-gray-900">
              Lista
            </a>
            <a href="/tiendas" className="hover:text-gray-900">
              Tiendas
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
    </div>
  );
}

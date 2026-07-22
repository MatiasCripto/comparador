import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/service";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const [storesRes, productsRes, lastLogRes] = await Promise.all([
      supabase.from("stores").select("*", { count: "exact", head: true }),
      supabase.from("products").select("*", { count: "exact", head: true }),
      supabase
        .from("scraping_logs")
        .select("scraped_at")
        .order("scraped_at", { ascending: false })
        .limit(1)
        .single(),
    ]);

    console.log("[api/stats] stores:", storesRes.count, "products:", productsRes.count, "lastLog:", lastLogRes.data?.scraped_at);

    if (storesRes.error) console.error("[api/stats] stores error:", storesRes.error);
    if (productsRes.error) console.error("[api/stats] products error:", productsRes.error);
    if (lastLogRes.error) console.error("[api/stats] lastLog error:", lastLogRes.error);

    return NextResponse.json({
      stores: storesRes.count ?? 0,
      products: productsRes.count ?? 0,
      lastUpdate: lastLogRes.data?.scraped_at ?? null,
    });
  } catch (e) {
    console.error("[api/stats] exception:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

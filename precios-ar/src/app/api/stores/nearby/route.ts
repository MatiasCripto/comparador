import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/service";
import { PROVINCES } from "@/lib/location";
import type { LatestPrice } from "@/types/database";

export async function GET(request: NextRequest) {
  const provincia = request.nextUrl.searchParams.get("provincia") ?? "";
  if (!provincia || !(PROVINCES as readonly string[]).includes(provincia)) {
    return NextResponse.json({ stores: [] });
  }

  const supabase = createAdminClient();

  const { data: stores } = await supabase
    .from("stores")
    .select("id, name, url, category, province, city, last_scraped_at")
    .eq("scraping_enabled", true)
    .or(`province.eq.${provincia},province.is.null`)
    .limit(12);

  if (!stores || stores.length === 0) {
    return NextResponse.json({ stores: [] });
  }

  const storeIds = stores.map((s) => s.id);

  const countMap = new Map<string, number>();
  await Promise.all(
    stores.map(async (s) => {
      const { count } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("store_id", s.id);
      countMap.set(s.id, count ?? 0);
    })
  );

  const { data: latestPrices } = (await supabase
    .from("latest_prices")
    .select("store_id, price")
    .in("store_id", storeIds)
    .order("price", { ascending: true })) as { data: LatestPrice[] | null };

  const cheapestMap = new Map<string, number>();
  for (const lp of latestPrices ?? []) {
    if (!cheapestMap.has(lp.store_id)) {
      cheapestMap.set(lp.store_id, lp.price);
    }
  }

  return NextResponse.json({
    stores: stores.map((s) => ({
      id: s.id,
      name: s.name,
      url: s.url,
      category: s.category,
      province: s.province,
      city: s.city,
      productCount: countMap.get(s.id) ?? 0,
      cheapestPrice: cheapestMap.get(s.id) ?? null,
    })),
  });
}

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/service";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const storeCategory = searchParams.get("store_category") || "";

    if (!q || q.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    const supabase = createAdminClient();
    let query = supabase
      .from("latest_prices")
      .select("canonical_name, price, store_name, store_id, product_url")
      .ilike("canonical_name", `%${q}%`)
      .order("price", { ascending: true })
      .limit(20);

    if (storeCategory) {
      query = query.eq("category", storeCategory);
    }

    const { data } = await query;

    if (!data || data.length === 0) {
      return NextResponse.json({ suggestions: [] });
    }

    // Deduplicate by canonical_name, keep cheapest
    const seen = new Map<string, { canonical_name: string; price: number; store_name: string; store_id: string; product_url: string | null }>();
    for (const item of data) {
      if (!seen.has(item.canonical_name)) {
        seen.set(item.canonical_name, {
          canonical_name: item.canonical_name,
          price: item.price,
          store_name: item.store_name,
          store_id: item.store_id,
          product_url: item.product_url,
        });
      }
    }

    const suggestions = Array.from(seen.values()).slice(0, 10);

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}

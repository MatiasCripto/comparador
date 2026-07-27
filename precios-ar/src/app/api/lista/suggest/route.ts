import { NextRequest, NextResponse } from "next/server";
import { searchSuggestions } from "@/lib/search/search-engine";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const storeCategory = searchParams.get("store_category") || "";

    console.log('[suggest route] GET called:', { q, storeCategory });

    if (!q || q.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    const suggestions = await searchSuggestions(q, storeCategory || undefined);

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error('[suggest route] ERROR:', err);
    return NextResponse.json({ suggestions: [], error: String(err) }, { status: 500 });
  }
}

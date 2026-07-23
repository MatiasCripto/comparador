import { NextRequest, NextResponse } from "next/server";
import { searchSuggestions } from "@/lib/search/search-engine";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const storeCategory = searchParams.get("store_category") || "";

    if (!q || q.length < 2) {
      return NextResponse.json({ suggestions: [] });
    }

    const suggestions = await searchSuggestions(q, storeCategory || undefined);

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}

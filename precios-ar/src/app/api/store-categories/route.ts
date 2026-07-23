import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/service";

export async function GET() {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("stores")
      .select("category")
      .not("category", "is", null);

    if (!data) {
      return NextResponse.json({ categories: [] });
    }

    const categories = [...new Set(
      data.map(c => c.category).filter(Boolean) as string[]
    )].sort();

    return NextResponse.json({ categories });
  } catch {
    return NextResponse.json({ categories: [] });
  }
}

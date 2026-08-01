import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const productIds: unknown = body?.product_ids;

    if (
      !Array.isArray(productIds) ||
      productIds.length === 0 ||
      productIds.length > 100 ||
      productIds.some((id) => typeof id !== "string" || id.length === 0)
    ) {
      return NextResponse.json(
        { error: "product_ids: array de strings (1..100) requerido" },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("off_enrich_queue")
      .upsert(
        (productIds as string[]).map((id) => ({
          product_id: id,
          status: "pending",
        })),
        { onConflict: "product_id", ignoreDuplicates: true }
      );

    if (error) throw new Error(error.message);

    return NextResponse.json(
      { enqueued: (productIds as string[]).length },
      { status: 202 }
    );
  } catch (err) {
    console.error("[off/enqueue]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al encolar" },
      { status: 500 }
    );
  }
}

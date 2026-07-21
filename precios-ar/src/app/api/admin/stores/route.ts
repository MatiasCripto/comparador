import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/service";

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data: stores, error } = await supabase
      .from("stores")
      .select("*")
      .order("name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get product counts for all stores in one query
    const { data: counts, error: countError } = await supabase
      .from("products")
      .select("store_id, id");

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    const countMap = new Map<string, number>();
    for (const row of counts ?? []) {
      countMap.set(row.store_id, (countMap.get(row.store_id) ?? 0) + 1);
    }

    const result = (stores ?? []).map((store) => ({
      ...store,
      product_count: countMap.get(store.id) ?? 0,
    }));

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Error al obtener tiendas" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, url, category, province, city, scraping_enabled, scraping_config } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Nombre requerido" }, { status: 400 });
    }

    if (!url?.trim() || !url.startsWith("https://")) {
      return NextResponse.json({ error: "URL inválida (debe empezar con https://)" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("stores")
      .insert({
        name: name.trim(),
        url: url.trim(),
        category: category || null,
        province: province || null,
        city: city || null,
        scraping_enabled: scraping_enabled ?? true,
        scraping_config: scraping_config || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Error al crear tienda" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...fields } = body;

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const allowedFields = [
      "name", "url", "category", "province", "city",
      "scraping_enabled", "scraping_config", "logo_url",
    ];

    const updates: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in fields) {
        if (key === "name" && !fields[key]?.trim()) {
          return NextResponse.json({ error: "Nombre no puede estar vacío" }, { status: 400 });
        }
        if (key === "url" && fields[key] && !String(fields[key]).startsWith("https://")) {
          return NextResponse.json({ error: "URL debe empezar con https://" }, { status: 400 });
        }
        updates[key] = fields[key] ?? null;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No hay campos para actualizar" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("stores")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Error al actualizar tienda" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: "ID requerido" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { error } = await supabase
      .from("stores")
      .update({ scraping_enabled: false })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Error al desactivar tienda" }, { status: 500 });
  }
}

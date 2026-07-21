import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { store_id } = body;

    if (!store_id) {
      return NextResponse.json({ error: "store_id requerido" }, { status: 400 });
    }

    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    if (!webhookUrl) {
      return NextResponse.json(
        { error: "Webhook de n8n no configurado (N8N_WEBHOOK_URL)" },
        { status: 500 }
      );
    }

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ store_id }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      return NextResponse.json(
        { error: `n8n respondió con ${res.status}: ${text}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, store_id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Error al conectar con n8n" },
      { status: 500 }
    );
  }
}

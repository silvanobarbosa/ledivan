import { NextRequest, NextResponse } from "next/server";
import { handleWhatsappMessage } from "@/lib/whatsapp";

// Webhook do Evolution API. Configure no Evolution para enviar o evento
// "messages.upsert" para: https://SEU-DOMINIO/api/whatsapp
// (opcional) proteja com ?token=EVOLUTION_WEBHOOK_TOKEN
export async function POST(req: NextRequest) {
  try {
    const expected = process.env.EVOLUTION_WEBHOOK_TOKEN;
    if (expected) {
      const token = req.nextUrl.searchParams.get("token");
      if (token !== expected) return NextResponse.json({ ok: false }, { status: 401 });
    }

    const body = await req.json();

    // Aceita tanto evento único quanto formatos variados do Evolution (v1/v2)
    const event: string = body?.event || body?.type || "";
    if (event && !event.includes("messages.upsert") && !event.includes("messages")) {
      return NextResponse.json({ ok: true, ignored: event });
    }

    // data pode ser objeto ou array
    const items = Array.isArray(body?.data) ? body.data : [body?.data].filter(Boolean);

    for (const item of items) {
      const k = item?.key;
      if (!k || k.fromMe) continue;
      const jid: string = k.remoteJid || "";
      if (!jid || jid.includes("@g.us")) continue; // ignora grupos
      const from = jid.split("@")[0];

      const m = item?.message;
      const text: string =
        m?.conversation ||
        m?.extendedTextMessage?.text ||
        m?.imageMessage?.caption ||
        "";
      if (!text) continue;

      await handleWhatsappMessage(from, text);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Erro no webhook WhatsApp:", e);
    return NextResponse.json({ ok: false }, { status: 200 }); // 200 p/ evitar retries em loop
  }
}

// Alguns provedores validam o endpoint com GET
export async function GET() {
  return NextResponse.json({ ok: true, service: "ledivan-whatsapp-webhook" });
}

import { getBot } from "@/lib/telegram";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const secretToken = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
    
    if (secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) {
      console.warn("Unauthorized attempt to access Telegram Webhook");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    await getBot().handleUpdate(body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error in Telegram Webhook:", error);
    return NextResponse.json({ ok: false, error: "Webhook Error" }, { status: 500 });
  }
}

// Opcional: GET para verificar status
export async function GET() {
  return NextResponse.json({ status: "Bot is running with Webhooks" });
}

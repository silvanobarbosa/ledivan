import { type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { therapySessions } from "@/db/schema";
import { verifySession, type ConfirmAction } from "@/lib/messaging/confirm-token";
import { pushToTherapist } from "@/lib/push";

export const runtime = "nodejs";

// Página amigável (paciente clica do WhatsApp/e-mail/SMS — sem login).
function page(title: string, sub: string, ok: boolean) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
     <div style="font-family:system-ui;text-align:center;padding:56px 22px;color:#1a0f1f;background:#faf6f1;min-height:100vh">
       <div style="font-size:52px">${ok ? "✅" : "⚠️"}</div>
       <h2 style="color:#2b1830;margin:12px 0 6px">${title}</h2>
       <p style="color:#6b5b66">${sub}</p>
     </div>`,
    { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

// GET /api/sessions/confirm?s=<id>&a=confirm|reschedule&t=<hmac> — atualiza a sessão e avisa o terapeuta.
export async function GET(req: NextRequest) {
  const s = req.nextUrl.searchParams.get("s");
  const a = req.nextUrl.searchParams.get("a") as ConfirmAction | null;
  const t = req.nextUrl.searchParams.get("t");
  if (!s || !t || (a !== "confirm" && a !== "reschedule")) return page("Link inválido", "Confira o link do lembrete.", false);
  if (!verifySession(s, a, t)) return page("Link inválido ou expirado", "Peça um novo lembrete ao seu terapeuta.", false);

  const [sess] = await db.select().from(therapySessions).where(eq(therapySessions.id, s)).limit(1);
  if (!sess) return page("Sessão não encontrada", "Ela pode ter sido removida.", false);

  if (a === "confirm") {
    await db.update(therapySessions)
      .set({ patientConfirmedAt: new Date(), pendingConfirmation: false, rescheduleRequestedAt: null })
      .where(eq(therapySessions.id, s));
    await pushToTherapist(sess.userId, "Presença confirmada ✅", "Um paciente confirmou a sessão.", { type: "confirm", sessionId: s });
    return page("Presença confirmada!", "Obrigado 🌿 Até lá!", true);
  }
  await db.update(therapySessions)
    .set({ rescheduleRequestedAt: new Date() })
    .where(eq(therapySessions.id, s));
  await pushToTherapist(sess.userId, "Pedido de remarcação 🔁", "Um paciente pediu para remarcar.", { type: "reschedule", sessionId: s });
  return page("Pedido enviado", "Vou falar com você para remarcarmos. Obrigado!", true);
}

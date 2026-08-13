import { NextResponse } from "next/server";
import { todosTokens, enviarPush } from "@/lib/push";

export const dynamic = "force-dynamic";

/**
 * Dispara o push de ATUALIZAÇÃO do app para todos os aparelhos. Chamado após publicar um APK novo
 * (pelo script de release). Protegido pelo CRON_SECRET — não é rota de usuário.
 */
export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  let b: { version?: string; notes?: string };
  try { b = await req.json(); } catch { b = {}; }
  const version = b.version || process.env.APP_VERSION || "";
  const notes = b.notes || "Toque para baixar a nova versão.";

  const tokens = await todosTokens();
  const r = await enviarPush(
    tokens,
    version ? `Atualização disponível — v${version}` : "Atualização disponível",
    notes,
    { type: "app_update", version },
  );
  return NextResponse.json({ ok: true, ...r });
}

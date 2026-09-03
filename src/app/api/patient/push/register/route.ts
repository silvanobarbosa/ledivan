import { NextResponse } from "next/server";
import { db } from "@/db";
import { pushTokens } from "@/db/schema";
import { patientFromBearer } from "@/lib/patient-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/patient/push/register { token, platform?, appVersion? }
// O app do PACIENTE registra aqui o token Expo do aparelho. Upsert por token.
export async function POST(req: Request) {
  const p = patientFromBearer(req);
  if (!p) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  let b: { token?: string; platform?: string; appVersion?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Corpo inválido." }, { status: 400 }); }

  const token = String(b.token || "").trim();
  if (!token.startsWith("ExponentPushToken")) {
    return NextResponse.json({ error: "Token inválido." }, { status: 400 });
  }

  await db
    .insert(pushTokens)
    .values({ token, userId: p.userId, patientId: p.patientId, platform: b.platform ?? null, appVersion: b.appVersion ?? null })
    .onConflictDoUpdate({
      target: pushTokens.token,
      set: { userId: p.userId, patientId: p.patientId, platform: b.platform ?? null, appVersion: b.appVersion ?? null, updatedAt: new Date() },
    });

  return NextResponse.json({ ok: true });
}

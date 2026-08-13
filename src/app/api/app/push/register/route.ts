import { NextResponse } from "next/server";
import { db } from "@/db";
import { pushTokens } from "@/db/schema";
import { userFromBearer } from "@/lib/app-auth";

export const dynamic = "force-dynamic";

/** O app registra aqui o token Expo do aparelho (na primeira abertura logada). Upsert por token. */
export async function POST(req: Request) {
  const user = await userFromBearer(req);
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  let b: { token?: string; platform?: string; appVersion?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Corpo inválido." }, { status: 400 }); }

  const token = String(b.token || "").trim();
  if (!token.startsWith("ExponentPushToken")) {
    return NextResponse.json({ error: "Token inválido." }, { status: 400 });
  }

  await db
    .insert(pushTokens)
    .values({ token, userId: user.id, platform: b.platform ?? null, appVersion: b.appVersion ?? null })
    .onConflictDoUpdate({
      target: pushTokens.token,
      set: { userId: user.id, platform: b.platform ?? null, appVersion: b.appVersion ?? null, updatedAt: new Date() },
    });

  return NextResponse.json({ ok: true });
}

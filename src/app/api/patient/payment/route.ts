import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { patients } from "@/db/schema";
import { patientFromBearer } from "@/lib/patient-auth";
import { getPreferences } from "@/lib/preferences";
import { resolveFeature, parseOverrides } from "@/lib/features";
import { buildPixCode } from "@/lib/pix";
import { pushToTherapist } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ctx(userId: string, patientId: string) {
  const prefs = await getPreferences(userId);
  const [pat] = await db.select({ name: patients.name, fee: patients.sessionFee, ov: patients.featureOverrides })
    .from(patients).where(eq(patients.id, patientId)).limit(1);
  const enabled = resolveFeature(prefs.features?.payment, parseOverrides(pat?.ov).payment);
  return { prefs, pat, enabled };
}

// GET /api/patient/payment — Pix copia-e-cola com o valor da sessão do paciente.
export async function GET(req: Request) {
  const p = patientFromBearer(req);
  if (!p) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const { prefs, pat, enabled } = await ctx(p.userId, p.patientId);
  if (!enabled) return NextResponse.json({ ok: false, error: "Recurso indisponível." }, { status: 403 });

  const pix = prefs.pix as { key: string; name: string; city: string } | undefined;
  if (!pix?.key || !pix?.name || !pix?.city) {
    return NextResponse.json({ ok: true, configured: false });
  }

  const amount = Number(pat?.fee ?? 0);
  const code = buildPixCode({ key: pix.key, name: pix.name, city: pix.city, amount: amount > 0 ? amount : undefined, txid: "LEDIVAN" });
  return NextResponse.json({ ok: true, configured: true, amount, receiver: pix.name, code });
}

// POST /api/patient/payment — paciente avisa que fez o Pix. Notifica o terapeuta (confirmação manual).
export async function POST(req: Request) {
  const p = patientFromBearer(req);
  if (!p) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const { pat, enabled } = await ctx(p.userId, p.patientId);
  if (!enabled) return NextResponse.json({ ok: false, error: "Recurso indisponível." }, { status: 403 });

  const amount = Number(pat?.fee ?? 0);
  await pushToTherapist(
    p.userId,
    "Pagamento Pix informado 💸",
    `${pat?.name ?? "Paciente"} informou que pagou${amount > 0 ? ` R$ ${amount.toFixed(2)}` : ""} via Pix. Confira o recebimento no seu banco.`,
    { type: "payment" },
  );
  return NextResponse.json({ ok: true });
}

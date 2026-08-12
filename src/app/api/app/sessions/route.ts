import { NextResponse } from "next/server";
import { db } from "@/db";
import { patients, therapySessions } from "@/db/schema";
import { and, eq, like } from "drizzle-orm";
import { userFromBearer } from "@/lib/app-auth";

export const dynamic = "force-dynamic";

const STATUS_VALIDOS = ["realizada", "nao_realizada", "cancelada", "realocada", "agendada"];

/**
 * Registra uma sessão (o app envia daqui, inclusive as que ficaram na fila offline).
 *
 * Idempotência: o app manda um `clientId` (uuid gerado no device). Guardamos esse id como um
 * marcador `[cid:...]` no campo notes. Se já existe uma sessão com o mesmo marcador, não
 * duplicamos — a fila de sync pode reenviar sem medo quando a rede oscila.
 */
export async function POST(req: Request) {
  const user = await userFromBearer(req);
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  let b: {
    patientId?: string; date?: string; status?: string;
    chargeable?: boolean; notes?: string; clientId?: string;
  };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Corpo inválido." }, { status: 400 }); }

  if (!b.patientId || !b.date) {
    return NextResponse.json({ error: "patientId e date são obrigatórios." }, { status: 400 });
  }

  // paciente tem que ser do próprio profissional (não grava sessão em paciente de outro)
  const [pac] = await db
    .select({ id: patients.id, fee: patients.sessionFee })
    .from(patients)
    .where(and(eq(patients.id, b.patientId), eq(patients.userId, user.id)))
    .limit(1);
  if (!pac) return NextResponse.json({ error: "Paciente não encontrado." }, { status: 404 });

  const marcador = b.clientId ? `[cid:${b.clientId}]` : "";

  // dedup por clientId (reenvio da fila offline não duplica)
  if (marcador) {
    const [dup] = await db
      .select({ id: therapySessions.id })
      .from(therapySessions)
      .where(and(eq(therapySessions.userId, user.id), like(therapySessions.notes, `%${marcador}%`)))
      .limit(1);
    if (dup) return NextResponse.json({ ok: true, deduped: true, id: dup.id });
  }

  const status = STATUS_VALIDOS.includes(String(b.status)) ? String(b.status) : "realizada";
  const notes = [b.notes?.trim(), marcador].filter(Boolean).join(" ").trim() || null;

  const [novo] = await db
    .insert(therapySessions)
    .values({
      userId: user.id,
      patientId: b.patientId,
      date: new Date(b.date),
      fee: pac.fee,
      status: status as never,
      chargeable: b.chargeable ?? true,
      notes,
    })
    .returning({ id: therapySessions.id });

  return NextResponse.json({ ok: true, id: novo.id });
}

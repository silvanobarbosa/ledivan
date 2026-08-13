import { NextResponse } from "next/server";
import { db } from "@/db";
import { patients } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { userFromBearer } from "@/lib/app-auth";

export const dynamic = "force-dynamic";

const STATUS = ["ativo", "inativo", "prospect", "pausado"];

/** Edita campos básicos de um paciente do próprio profissional (app). */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await userFromBearer(req);
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const { id } = await params;
  let b: { name?: string; phone?: string; sessionFee?: string | number; patientStatus?: string; frequency?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ error: "Corpo inválido." }, { status: 400 }); }

  // só atualiza o que veio; ignora o resto
  const set: Record<string, unknown> = {};
  if (typeof b.name === "string" && b.name.trim()) set.name = b.name.trim();
  if (typeof b.phone === "string") set.phone = b.phone.replace(/\D/g, "") || null;
  if (b.sessionFee != null && !Number.isNaN(Number(b.sessionFee))) set.sessionFee = String(b.sessionFee);
  if (typeof b.patientStatus === "string" && STATUS.includes(b.patientStatus)) set.patientStatus = b.patientStatus;
  if (typeof b.frequency === "string") set.frequency = b.frequency.trim() || null;
  if (!Object.keys(set).length) return NextResponse.json({ error: "Nada para atualizar." }, { status: 400 });

  const [upd] = await db
    .update(patients)
    .set(set)
    .where(and(eq(patients.id, id), eq(patients.userId, user.id)))
    .returning({ id: patients.id });

  if (!upd) return NextResponse.json({ error: "Paciente não encontrado." }, { status: 404 });
  return NextResponse.json({ ok: true });
}

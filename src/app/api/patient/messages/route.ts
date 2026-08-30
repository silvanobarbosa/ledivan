import { NextResponse } from "next/server";
import { and, eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { messages, patients } from "@/db/schema";
import { patientFromBearer } from "@/lib/patient-auth";
import { pushToTherapist } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/patient/messages — conversa (entrada+saída) do paciente com o terapeuta.
export async function GET(req: Request) {
  const p = patientFromBearer(req);
  if (!p) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const rows = await db.select({ direction: messages.direction, text: messages.text, createdAt: messages.createdAt })
    .from(messages)
    .where(and(eq(messages.userId, p.userId), eq(messages.patientId, p.patientId)))
    .orderBy(asc(messages.createdAt)).limit(200);
  return NextResponse.json({ messages: rows.map((m) => ({ direction: m.direction, text: m.text, at: (m.createdAt as Date).toISOString() })) });
}

// POST /api/patient/messages { text } — paciente manda um recado; entra no inbox do terapeuta + push.
export async function POST(req: Request) {
  const p = patientFromBearer(req);
  if (!p) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  let b: { text?: string };
  try { b = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const text = (b.text || "").trim();
  if (!text) return NextResponse.json({ ok: false, error: "Mensagem vazia." }, { status: 400 });

  await db.insert(messages).values({ userId: p.userId, patientId: p.patientId, direction: "in", channel: "app", text: text.slice(0, 4000) }).catch(() => {});
  const [pat] = await db.select({ name: patients.name }).from(patients).where(eq(patients.id, p.patientId)).limit(1);
  await pushToTherapist(p.userId, "Novo recado 💬", `${pat?.name ?? "Paciente"}: ${text.slice(0, 80)}`, { type: "message" });
  return NextResponse.json({ ok: true });
}

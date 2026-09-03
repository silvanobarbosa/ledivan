import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { put } from "@vercel/blob";
import { db } from "@/db";
import { assignments, patients } from "@/db/schema";
import { patientFromBearer } from "@/lib/patient-auth";
import { pushToTherapist } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = [
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic",
  "audio/mpeg", "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/aac", "audio/wav", "audio/webm", "audio/ogg",
  "video/mp4", "video/quicktime", "video/webm",
];
const MAX = 50 * 1024 * 1024; // 50MB (vídeo curto)

// POST /api/patient/tasks/:id/upload (multipart: file, text?) — paciente responde com mídia.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const p = patientFromBearer(req);
  if (!p) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const { id } = await ctx.params;

  const [a] = await db.select().from(assignments)
    .where(and(eq(assignments.id, id), eq(assignments.patientId, p.patientId), eq(assignments.userId, p.userId))).limit(1);
  if (!a) return NextResponse.json({ ok: false, error: "Tarefa não encontrada." }, { status: 404 });

  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const file = form.get("file") as File | null;
  const text = ((form.get("text") as string) || "").trim();
  if (!file || file.size === 0) return NextResponse.json({ ok: false, error: "Envie um arquivo." }, { status: 400 });
  if (!ALLOWED.includes(file.type)) return NextResponse.json({ ok: false, error: "Formato não suportado." }, { status: 400 });
  if (file.size > MAX) return NextResponse.json({ ok: false, error: "Arquivo muito grande (máx. 50MB)." }, { status: 400 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({ ok: false, error: "Upload não configurado." }, { status: 500 });

  try {
    const safeName = (file.name || "resposta").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
    const blob = await put(`tarefas/${p.userId}/${p.patientId}/${id}/${safeName}`, file, {
      access: "private",
      addRandomSuffix: true,
    });
    await db.update(assignments).set({
      responseFileUrl: blob.pathname,
      responseFileType: file.type,
      ...(text ? { responseText: text.slice(0, 4000) } : {}),
      status: "respondida",
      respondedAt: new Date(),
    }).where(eq(assignments.id, id));

    const [pat] = await db.select({ name: patients.name }).from(patients).where(eq(patients.id, p.patientId)).limit(1);
    await pushToTherapist(p.userId, "Tarefa respondida 📎", `${pat?.name ?? "Paciente"} enviou um arquivo em "${a.title}".`, { type: "task", id });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("upload tarefa:", e);
    return NextResponse.json({ ok: false, error: "Falha ao enviar." }, { status: 500 });
  }
}

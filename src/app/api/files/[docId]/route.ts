import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { issueSignedToken, presignUrl } from "@vercel/blob";
import { db } from "@/db";
import { patientDocument } from "@/db/schema";
import { auth } from "@/auth";
import { patientFromBearer } from "@/lib/patient-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/files/<docId> — devolve uma URL assinada (curta) do arquivo privado no Blob.
// Autorizado para: o TERAPEUTA dono (sessão) OU o PACIENTE do documento (bearer do app).
export async function GET(req: Request, { params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(docId)) return NextResponse.json({ error: "Inválido." }, { status: 400 });

  const [doc] = await db.select().from(patientDocument).where(eq(patientDocument.id, docId)).limit(1);
  if (!doc || doc.kind !== "file") return NextResponse.json({ error: "Não encontrado." }, { status: 404 });

  // Autorização: sessão do terapeuta dono, ou token do próprio paciente.
  const s = await auth();
  let allowed = !!s?.user?.id && s.user.id === doc.userId;
  if (!allowed) {
    const p = patientFromBearer(req);
    allowed = !!p && p.userId === doc.userId && p.patientId === doc.patientId;
  }
  if (!allowed) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  try {
    // Token assinado escopado NESTE pathname, só leitura, válido por 5 min.
    const validUntil = Date.now() + 5 * 60_000;
    const token = await issueSignedToken({ pathname: doc.content, operations: ["get"], validUntil });
    const { presignedUrl } = await presignUrl(token, { operation: "get", pathname: doc.content, access: "private", validUntil });
    return NextResponse.json({ ok: true, url: presignedUrl, title: doc.title });
  } catch (e) {
    console.error("presign material:", e);
    return NextResponse.json({ error: "Falha ao gerar o link." }, { status: 500 });
  }
}

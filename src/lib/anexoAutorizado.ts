import "server-only";
import { eq } from "drizzle-orm";
import { issueSignedToken, presignUrl } from "@vercel/blob";
import { db } from "@/db";
import { patientDocument } from "@/db/schema";
import { auth } from "@/auth";
import { patientFromBearer } from "@/lib/patient-auth";

/**
 * Quem pode abrir UM arquivo anexado, e por onde ele sai.
 *
 * A regra de acesso é a mesma para o link assinado (`/api/files/<id>`) e para o arquivo servido
 * pelo nosso domínio (`/api/files/<id>/raw`, doc 63 — a impressora do anexo). Duas rotas lendo o
 * mesmo arquivo com duas cópias da autorização é uma delas afrouxando na primeira correção.
 */
export type AnexoLiberado = { titulo: string; pathname: string };
export type AnexoNegado = { error: string; status: 400 | 401 | 404 };

export async function anexoAutorizado(req: Request, docId: string): Promise<AnexoLiberado | AnexoNegado> {
  if (!/^[0-9a-f-]{36}$/i.test(docId)) return { error: "Inválido.", status: 400 };

  const [doc] = await db.select().from(patientDocument).where(eq(patientDocument.id, docId)).limit(1);
  if (!doc || doc.kind !== "file") return { error: "Não encontrado.", status: 404 };

  // Autorização: sessão do terapeuta dono, ou token do próprio paciente.
  const s = await auth();
  let allowed = !!s?.user?.id && s.user.id === doc.userId;
  if (!allowed) {
    const p = patientFromBearer(req);
    // Anexo do prontuário não é do paciente, mesmo que ele acerte o id do documento.
    if (!doc.compartilhado) return { error: "Não encontrado.", status: 404 };
    allowed = !!p && p.userId === doc.userId && p.patientId === doc.patientId;
  }
  if (!allowed) return { error: "Não autorizado.", status: 401 };

  return { titulo: doc.title, pathname: doc.content };
}

/** URL assinada, curta e só de leitura, do arquivo privado no Blob. */
export async function urlAssinada(pathname: string): Promise<string> {
  const validUntil = Date.now() + 5 * 60_000;
  const token = await issueSignedToken({ pathname, operations: ["get"], validUntil });
  const { presignedUrl } = await presignUrl(token, { operation: "get", pathname, access: "private", validUntil });
  return presignedUrl;
}

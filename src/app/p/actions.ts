"use server";

import { db } from "@/db";
import { assignments } from "@/db/schema";
import { eq } from "drizzle-orm";
import { put } from "@vercel/blob";
import { revalidatePath } from "next/cache";

// Resposta do paciente via link mágico (sem auth). Escopada ao token da tarefa.
export async function submitAssignmentResponse(token: string, formData: FormData) {
  const assignment = await db.query.assignments.findFirst({ where: eq(assignments.token, token) });
  if (!assignment) return { ok: false, error: "Tarefa não encontrada." };

  // Já respondida = não reabre. Antes, quem tivesse o link podia SOBRESCREVER a resposta
  // enviada (apagando a original) e reenviar arquivos de até 50MB no Blob indefinidamente
  // (custo). A tarefa é de uso único: uma resposta, e pronto.
  if (assignment.status === "respondida") {
    return { ok: false, error: "Esta tarefa já foi respondida." };
  }

  const text = ((formData.get("responseText") as string) || "").trim() || null;
  const file = formData.get("file") as File | null;

  let fileUrl: string | null = null;
  let fileType: string | null = null;

  if (file && file.size > 0) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return { ok: false, error: "Envio de arquivos ainda não está configurado. Responda em texto por enquanto." };
    }
    if (file.size > 50 * 1024 * 1024) {
      return { ok: false, error: "Arquivo muito grande (máx. 50MB)." };
    }
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60);
      // store PRIVADO: guardamos o pathname; o arquivo é servido só ao terapeuta dono (rota autorizada)
      const folder = crypto.randomUUID();
      const blob = await put(`tarefas/${folder}/${safeName}`, file, { access: "private", addRandomSuffix: true });
      fileUrl = blob.pathname;
      fileType = file.type;
    } catch (e) {
      console.error("Erro no upload:", e);
      return { ok: false, error: "Falha ao enviar o arquivo." };
    }
  }

  if (!text && !fileUrl) return { ok: false, error: "Escreva uma resposta ou anexe um arquivo." };

  await db.update(assignments)
    .set({ responseText: text, responseFileUrl: fileUrl, responseFileType: fileType, status: "respondida", respondedAt: new Date() })
    .where(eq(assignments.id, assignment.id));

  revalidatePath(`/dashboard/patients/${assignment.patientId}`);
  return { ok: true };
}

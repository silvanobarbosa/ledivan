"use server";

import { db } from "@/db";
import { patientActivities, patientDocument, patientRecords, patients } from "@/db/schema";
import { and, eq, desc, isNull } from "drizzle-orm";
import { auth } from "@/auth";
import { revalidatePath } from "next/cache";
import { put } from "@vercel/blob";

async function owns(userId: string, patientId: string) {
  const [p] = await db.select({ id: patients.id }).from(patients).where(and(eq(patients.id, patientId), eq(patients.userId, userId))).limit(1);
  return !!p;
}

export async function shareMaterial(patientId: string, title: string, kind: string, content: string): Promise<{ ok: boolean; error?: string }> {
  const s = await auth();
  if (!s?.user?.id) return { ok: false, error: "Sessão inválida." };
  if (!(await owns(s.user.id, patientId))) return { ok: false, error: "Sem acesso a este paciente." };
  const t = title.trim(), c = content.trim();
  if (!t || !c) return { ok: false, error: "Preencha título e conteúdo." };
  await db.insert(patientDocument).values({ userId: s.user.id, patientId, title: t.slice(0, 160), kind: kind === "link" ? "link" : "text", content: c.slice(0, 8000) });
  revalidatePath(`/dashboard/patients/${patientId}`);
  return { ok: true };
}

// Anexa um ARQUIVO (PDF/imagem) como material. Blob privado; leitura só via /api/files.
export async function uploadMaterialFile(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const s = await auth();
  if (!s?.user?.id) return { ok: false, error: "Sessão inválida." };
  const patientId = formData.get("patientId") as string;
  if (!patientId || !(await owns(s.user.id, patientId))) return { ok: false, error: "Sem acesso a este paciente." };

  const file = formData.get("file") as File | null;
  const title = ((formData.get("title") as string) || "").trim() || (file?.name ?? "Arquivo");
  if (!file || file.size === 0) return { ok: false, error: "Escolha um arquivo." };

  const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"];
  if (!ALLOWED.includes(file.type)) return { ok: false, error: "Envie PDF, JPG, PNG, WEBP ou GIF." };
  if (file.size > 15 * 1024 * 1024) return { ok: false, error: "Arquivo muito grande (máx. 15MB)." };
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { ok: false, error: "Upload não configurado." };

  try {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60) || "arquivo";
    const blob = await put(`materiais/${s.user.id}/${patientId}/${crypto.randomUUID()}/${safeName}`, file, {
      access: "private",
      addRandomSuffix: true,
    });
    await db.insert(patientDocument).values({
      userId: s.user.id, patientId, title: title.slice(0, 160), kind: "file", content: blob.pathname,
    });
    revalidatePath(`/dashboard/patients/${patientId}`);
    return { ok: true };
  } catch (e) {
    console.error("upload material:", e);
    return { ok: false, error: "Falha ao enviar o arquivo." };
  }
}

/**
 * Anexo do PRONTUÁRIO: arquivo do lado do terapeuta, que o paciente não vê.
 *
 * O dono pediu a aba de fotos do cadastro no prontuário, "como anexos, não necessariamente
 * fotos" — laudo, relatório escolar, encaminhamento. É o mesmo cofre dos materiais (Blob
 * privado, link assinado na hora de abrir), com a diferença que importa: `compartilhado: false`,
 * então ele não aparece no aplicativo do paciente.
 */
export async function uploadAnexoProntuario(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const s = await auth();
  if (!s?.user?.id) return { ok: false, error: "Sessão inválida." };
  const patientId = formData.get("patientId") as string;
  if (!patientId || !(await owns(s.user.id, patientId))) return { ok: false, error: "Sem acesso a este paciente." };

  const file = formData.get("file") as File | null;
  const title = ((formData.get("title") as string) || "").trim() || (file?.name ?? "Anexo");
  if (!file || file.size === 0) return { ok: false, error: "Escolha um arquivo." };

  const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"];
  if (!ALLOWED.includes(file.type)) return { ok: false, error: "Envie PDF, JPG, PNG, WEBP ou GIF." };
  if (file.size > 15 * 1024 * 1024) return { ok: false, error: "Arquivo muito grande (máx. 15MB)." };
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { ok: false, error: "Upload não configurado." };

  try {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60) || "arquivo";
    const blob = await put(`anexos/${s.user.id}/${patientId}/${crypto.randomUUID()}/${safeName}`, file, {
      access: "private",
      addRandomSuffix: true,
    });
    await db.insert(patientDocument).values({
      userId: s.user.id, patientId, title: title.slice(0, 160), kind: "file", content: blob.pathname,
      compartilhado: false,
    });
    revalidatePath(`/dashboard/patients/${patientId}`);
    return { ok: true };
  } catch (e) {
    console.error("upload anexo:", e);
    return { ok: false, error: "Falha ao enviar o arquivo." };
  }
}

/** Anexos internos do prontuário (o paciente não vê). */
export async function listAnexosProntuario(patientId: string) {
  const s = await auth();
  if (!s?.user?.id) return [];
  const rows = await db.select().from(patientDocument)
    .where(and(
      eq(patientDocument.userId, s.user.id),
      eq(patientDocument.patientId, patientId),
      eq(patientDocument.compartilhado, false),
      // anexo preso a um item aparece SÓ dentro dele (registro, doc 33; atividade, doc 9), nunca
      // também na lista geral — senão o mesmo arquivo passa a existir duas vezes na tela.
      isNull(patientDocument.recordId),
      isNull(patientDocument.activityId),
    ))
    .orderBy(desc(patientDocument.createdAt));
  return rows.map((r) => ({ id: r.id, title: r.title, kind: r.kind, content: r.content, at: (r.createdAt as Date).toISOString() }));
}

/** Anexos presos a UM registro do histórico terapêutico (prints 6.pdf, item 5). */
export async function listAnexosDoRegistro(recordId: string) {
  const s = await auth();
  if (!s?.user?.id) return [];
  const rows = await db.select().from(patientDocument)
    .where(and(eq(patientDocument.userId, s.user.id), eq(patientDocument.recordId, recordId)))
    .orderBy(desc(patientDocument.createdAt));
  return rows.map((r) => ({ id: r.id, title: r.title, kind: r.kind, content: r.content, at: (r.createdAt as Date).toISOString() }));
}

/** Anexos presos a UMA atividade (doc 9). */
export async function listAnexosDaAtividade(activityId: string) {
  const s = await auth();
  if (!s?.user?.id) return [];
  const rows = await db.select().from(patientDocument)
    .where(and(eq(patientDocument.userId, s.user.id), eq(patientDocument.activityId, activityId)))
    .orderBy(desc(patientDocument.createdAt));
  return rows.map((r) => ({ id: r.id, title: r.title, kind: r.kind, content: r.content, at: (r.createdAt as Date).toISOString() }));
}

/**
 * O anexo preso a um item do prontuário — registro (doc 33) ou atividade (doc 9).
 *
 * Um caminho só porque é uma regra só: mesmo cofre privado, mesmo limite de tamanho, mesma lista
 * de tipos e a mesma checagem de dono. O que muda é a qual item ele fica pendurado.
 */
async function anexarAoItem(
  formData: FormData,
  campo: "recordId" | "activityId",
  rotuloDoItem: string,
): Promise<{ ok: boolean; error?: string }> {
  const s = await auth();
  if (!s?.user?.id) return { ok: false, error: "Sessão inválida." };
  const patientId = formData.get("patientId") as string;
  const itemId = formData.get(campo) as string;
  if (!patientId || !(await owns(s.user.id, patientId))) return { ok: false, error: "Sem acesso a este paciente." };
  if (!itemId) return { ok: false, error: `${rotuloDoItem} inválido.` };
  // o item tem que ser deste profissional e deste paciente
  if (!(await itemEDoPaciente(s.user.id, patientId, itemId, campo))) return { ok: false, error: `${rotuloDoItem} não encontrado.` };

  const file = formData.get("file") as File | null;
  const title = ((formData.get("title") as string) || "").trim() || (file?.name ?? "Anexo");
  if (!file || file.size === 0) return { ok: false, error: "Escolha um arquivo." };
  const ALLOWED = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"];
  if (!ALLOWED.includes(file.type)) return { ok: false, error: "Envie PDF, JPG, PNG, WEBP ou GIF." };
  if (file.size > 15 * 1024 * 1024) return { ok: false, error: "Arquivo muito grande (máx. 15MB)." };
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { ok: false, error: "Upload não configurado." };

  try {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-60) || "arquivo";
    const blob = await put(`anexos/${s.user.id}/${patientId}/${crypto.randomUUID()}/${safeName}`, file, {
      access: "private",
      addRandomSuffix: true,
    });
    await db.insert(patientDocument).values({
      userId: s.user.id, patientId, title: title.slice(0, 160), kind: "file", content: blob.pathname,
      compartilhado: false, [campo]: itemId,
    });
    revalidatePath(`/dashboard/patients/${patientId}`);
    return { ok: true };
  } catch (e) {
    console.error(`upload anexo ${campo}:`, e);
    return { ok: false, error: "Falha ao enviar o arquivo." };
  }
}

/** O item existe, é deste profissional e é DESTE paciente — nunca só "existe". */
async function itemEDoPaciente(userId: string, patientId: string, itemId: string, campo: "recordId" | "activityId") {
  if (campo === "recordId") {
    const [r] = await db.select({ id: patientRecords.id }).from(patientRecords)
      .where(and(eq(patientRecords.id, itemId), eq(patientRecords.userId, userId), eq(patientRecords.patientId, patientId))).limit(1);
    return !!r;
  }
  const [a] = await db.select({ id: patientActivities.id }).from(patientActivities)
    .where(and(eq(patientActivities.id, itemId), eq(patientActivities.userId, userId), eq(patientActivities.patientId, patientId))).limit(1);
  return !!a;
}

/** Anexa um arquivo a um registro específico do histórico terapêutico. */
export async function uploadAnexoDoRegistro(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  return anexarAoItem(formData, "recordId", "Registro");
}

/** Anexa um arquivo a uma atividade específica (doc 9). */
export async function uploadAnexoDaAtividade(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  return anexarAoItem(formData, "activityId", "Atividade");
}

export async function listMaterials(patientId: string) {
  const s = await auth();
  if (!s?.user?.id) return [];
  const rows = await db.select().from(patientDocument)
    .where(and(
      eq(patientDocument.userId, s.user.id),
      eq(patientDocument.patientId, patientId),
      eq(patientDocument.compartilhado, true),
    ))
    .orderBy(desc(patientDocument.createdAt));
  return rows.map((r) => ({ id: r.id, title: r.title, kind: r.kind, content: r.content, at: (r.createdAt as Date).toISOString() }));
}

export async function deleteMaterial(id: string): Promise<{ ok: boolean }> {
  const s = await auth();
  if (!s?.user?.id) return { ok: false };
  await db.delete(patientDocument).where(and(eq(patientDocument.id, id), eq(patientDocument.userId, s.user.id)));
  return { ok: true };
}

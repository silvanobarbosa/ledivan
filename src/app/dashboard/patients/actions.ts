"use server";

import { db } from "@/db";
import { patients, patientStatusHistory, patientPriceHistory, patientContractHistory, patientRecords, assignments, scaleApplications, treatmentGoals } from "@/db/schema";
import { auth } from "@/auth";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { put } from "@vercel/blob";
import { sendWhatsappFromUser } from "@/lib/whatsappEvolution";
import { sendProEmail } from "@/lib/email";
import { escapeHtml } from "@/lib/html";

// Envia mensagem ao paciente pelo canal escolhido (WhatsApp do Ledivan, Telegram ou e-mail).
export async function sendPatientMessage(patientId: string, channel: string, text: string): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Não autorizado" };
  const userId = session.user.id;
  const msg = (text || "").trim();
  if (!msg) return { ok: false, error: "Escreva a mensagem." };

  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.userId, userId)),
  });
  if (!patient) return { ok: false, error: "Paciente não encontrado." };

  if (channel === "whatsapp") {
    if (!patient.phone) return { ok: false, error: "Paciente sem telefone cadastrado." };
    const ok = await sendWhatsappFromUser(userId, patient.phone, msg);
    return ok ? { ok: true } : { ok: false, error: "Conecte seu WhatsApp em Ajustes (e confira o número do paciente)." };
  }
  if (channel === "email") {
    if (!patient.email) return { ok: false, error: "Paciente sem e-mail cadastrado." };
    const r = await sendProEmail(userId, patient.email, "Mensagem do seu terapeuta", escapeHtml(msg).replace(/\n/g, "<br>"));
    return r.ok ? { ok: true } : { ok: false, error: "Configure seu e-mail em Ajustes para enviar." };
  }
  if (channel === "telegram") {
    return { ok: false, error: "Telegram ao paciente ainda não disponível (paciente precisa vincular o Telegram). Use WhatsApp ou e-mail." };
  }
  return { ok: false, error: "Canal inválido." };
}

// Upload de foto (terapeuta/paciente) → blob privado. Retorna o pathname,
// que o formulário guarda em campo oculto e a action persiste na coluna.
export async function uploadPhoto(formData: FormData): Promise<{ ok: boolean; pathname?: string; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Não autorizado" };
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ok: false, error: "Sem arquivo" };
  // Whitelist de tipos raster (SVG fica de fora: pode conter script/XSS)
  const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"];
  if (!ALLOWED.includes(file.type)) return { ok: false, error: "Envie uma imagem JPG, PNG, WEBP ou GIF." };
  if (file.size > 8 * 1024 * 1024) return { ok: false, error: "Imagem muito grande (máx. 8MB)." };
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { ok: false, error: "Upload não configurado." };
  try {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-50) || "foto.jpg";
    const blob = await put(`fotos/${session.user.id}/${crypto.randomUUID()}/${safeName}`, file, {
      access: "private",
      addRandomSuffix: true,
    });
    return { ok: true, pathname: blob.pathname };
  } catch (e) {
    console.error("Erro no upload de foto:", e);
    return { ok: false, error: "Falha ao enviar a imagem." };
  }
}

function num(v: FormDataEntryValue | null, fallback = "0") {
  if (v == null || v === "") return fallback;
  return String(v).replace(",", ".");
}

export async function createPatient(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;

  const name = formData.get("name") as string;
  if (!name?.trim()) throw new Error("Nome obrigatório");

  const startedAtRaw = formData.get("startedAt") as string;
  const sessionFee = num(formData.get("sessionFee"));

  const [created] = await db.insert(patients).values({
    userId,
    name: name.trim(),
    email: (formData.get("email") as string) || null,
    phone: (formData.get("phone") as string) || null,
    sessionFee,
    frequency: (formData.get("frequency") as string) || null,
    notes: (formData.get("notes") as string) || null,
    patientStatus: (formData.get("patientStatus") as string) || "ativo",
    prospectDate: (formData.get("patientStatus") as string) === "prospect" ? new Date() : null,
    startedAt: startedAtRaw ? new Date(startedAtRaw) : new Date(),
    address: (formData.get("address") as string) || null,
    emergencyName: (formData.get("emergencyName") as string) || null,
    emergencyPhone: (formData.get("emergencyPhone") as string) || null,
    emergencyRelationship: (formData.get("emergencyRelationship") as string) || null,
    paymentDay: formData.get("paymentDay") ? parseInt(formData.get("paymentDay") as string) : null,
    contractType: ((formData.get("contractType") as string) || "avulso") as "pacote" | "avulso",
    attendanceMode: (formData.get("attendanceMode") as string) || "presencial",
    attendanceLocation: (formData.get("attendanceLocation") as string) || null,
    sessionsInPacket: formData.get("sessionsInPacket")
      ? parseInt(formData.get("sessionsInPacket") as string)
      : null,
    deductPackageOnSession: formData.has("contractType") && (formData.get("contractType") as string) === "pacote"
      ? formData.get("deductPackageOnSession") === "on"
      : true,
    reminderEnabled: formData.get("reminderEnabled") === "on",
    reminderChannel: (formData.get("reminderChannel") as string) || "whatsapp",
    reminderLeadMinutes: formData.get("reminderLeadMinutes")
      ? parseInt(formData.get("reminderLeadMinutes") as string)
      : 60,
    photo3x4: (formData.get("photo3x4") as string) || null,
    photoExtra1: (formData.get("photoExtra1") as string) || null,
    photoExtra2: (formData.get("photoExtra2") as string) || null,
    photoExtra3: (formData.get("photoExtra3") as string) || null,
    tags: (formData.get("tags") as string)?.trim() || null,
  }).returning();

  // registra historico inicial
  await db.insert(patientStatusHistory).values({
    patientId: created.id,
    status: created.patientStatus,
  });
  await db.insert(patientPriceHistory).values({
    patientId: created.id,
    valor: sessionFee,
    dataEfetiva: created.startedAt ?? new Date(),
  });

  revalidatePath("/dashboard/patients");
  redirect(`/dashboard/patients/${created.id}`);
}

export async function updatePatient(patientId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");

  const existing = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.userId, session.user.id)),
  });
  if (!existing) throw new Error("Paciente não encontrado");

  const newFee = num(formData.get("sessionFee"), existing.sessionFee);
  const newStatus = (formData.get("patientStatus") as string) || existing.patientStatus;

  await db.update(patients).set({
    name: (formData.get("name") as string) || existing.name,
    email: (formData.get("email") as string) ?? existing.email,
    phone: (formData.get("phone") as string) ?? existing.phone,
    sessionFee: newFee,
    frequency: (formData.get("frequency") as string) ?? existing.frequency,
    notes: (formData.get("notes") as string) ?? existing.notes,
    patientStatus: newStatus,
    address: (formData.get("address") as string) ?? existing.address,
    emergencyName: (formData.get("emergencyName") as string) ?? existing.emergencyName,
    emergencyPhone: (formData.get("emergencyPhone") as string) ?? existing.emergencyPhone,
    emergencyRelationship: (formData.get("emergencyRelationship") as string) ?? existing.emergencyRelationship,
    paymentDay: formData.get("paymentDay") ? parseInt(formData.get("paymentDay") as string) : existing.paymentDay,
    contractType: ((formData.get("contractType") as string) || existing.contractType) as "pacote" | "avulso",
    attendanceMode: (formData.get("attendanceMode") as string) || existing.attendanceMode,
    attendanceLocation: (formData.get("attendanceLocation") as string) ?? existing.attendanceLocation,
    sessionsInPacket: formData.get("sessionsInPacket")
      ? parseInt(formData.get("sessionsInPacket") as string)
      : existing.sessionsInPacket,
    deductPackageOnSession: (formData.get("contractType") as string) === "pacote"
      ? formData.get("deductPackageOnSession") === "on"
      : existing.deductPackageOnSession,
    reminderEnabled: formData.get("reminderEnabled") === "on",
    reminderChannel: (formData.get("reminderChannel") as string) || existing.reminderChannel,
    reminderLeadMinutes: formData.get("reminderLeadMinutes")
      ? parseInt(formData.get("reminderLeadMinutes") as string)
      : existing.reminderLeadMinutes,
    photo3x4: (formData.get("photo3x4") as string) || existing.photo3x4,
    photoExtra1: (formData.get("photoExtra1") as string) || existing.photoExtra1,
    photoExtra2: (formData.get("photoExtra2") as string) || existing.photoExtra2,
    photoExtra3: (formData.get("photoExtra3") as string) || existing.photoExtra3,
    tags: (formData.get("tags") as string)?.trim() || null,
  }).where(and(eq(patients.id, patientId), eq(patients.userId, session.user.id)));

  // historico de mudancas
  if (newStatus !== existing.patientStatus) {
    await db.insert(patientStatusHistory).values({ patientId, status: newStatus });
  }
  if (newFee !== existing.sessionFee) {
    await db.insert(patientPriceHistory).values({ patientId, valor: newFee, dataEfetiva: new Date() });
  }

  revalidatePath(`/dashboard/patients/${patientId}`);
  revalidatePath("/dashboard/patients");
}

// Ajuste de valor da sessão: registra no histórico de preços, atualiza o valor
// atual e (opcional) define a data de vencimento p/ lembrar de reajustar.
export async function addPriceChange(patientId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;

  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.userId, userId)),
  });
  if (!patient) throw new Error("Paciente não encontrado");

  const valor = num(formData.get("valor"), patient.sessionFee);
  const efetivaRaw = formData.get("dataEfetiva") as string;
  const vencRaw = formData.get("priceReviewDate") as string;
  const dataEfetiva = efetivaRaw ? new Date(efetivaRaw) : new Date();

  await db.insert(patientPriceHistory).values({ patientId, valor, dataEfetiva });
  await db.update(patients)
    .set({ sessionFee: valor, priceReviewDate: vencRaw ? new Date(vencRaw) : null })
    .where(and(eq(patients.id, patientId), eq(patients.userId, userId)));

  revalidatePath(`/dashboard/patients/${patientId}`);
}

// Modelo financeiro do paciente (movido do cadastro base p/ a aba Financeiro):
// valor da sessão, tipo de contrato, qtd do pacote, abate por sessão, dia de pagamento.
export async function updateFinancialModel(patientId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;

  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.userId, userId)),
  });
  if (!patient) throw new Error("Paciente não encontrado");

  const newFee = num(formData.get("sessionFee"), patient.sessionFee);
  // Modalidade única: semanal | quinzenal | mensal | avulso | pacote
  const modalidade = (formData.get("billingModel") as string) || (patient.contractType === "pacote" ? "pacote" : patient.frequency || "avulso");
  const isPacote = modalidade === "pacote";
  const contractType = (isPacote ? "pacote" : "avulso") as "pacote" | "avulso";
  const frequency = isPacote ? patient.frequency : modalidade;

  // rótulo legível p/ histórico de modelo
  const MODEL_LABEL: Record<string, string> = { semanal: "Semanal", quinzenal: "Quinzenal", mensal: "Mensal", avulso: "Avulso", pacote: "Pacote" };
  const oldModel = patient.contractType === "pacote" ? "pacote" : (patient.frequency || "avulso");

  await db.update(patients).set({
    sessionFee: newFee,
    contractType,
    frequency,
    sessionsInPacket: formData.get("sessionsInPacket") ? parseInt(formData.get("sessionsInPacket") as string) : (isPacote ? patient.sessionsInPacket : null),
    deductPackageOnSession: isPacote ? formData.get("deductPackageOnSession") === "on" : true,
    paymentDay: formData.get("paymentDay") ? parseInt(formData.get("paymentDay") as string) : patient.paymentDay,
  }).where(and(eq(patients.id, patientId), eq(patients.userId, userId)));

  if (newFee !== patient.sessionFee) {
    await db.insert(patientPriceHistory).values({ patientId, valor: newFee, dataEfetiva: new Date() });
  }
  if (oldModel !== modalidade) {
    await db.insert(patientContractHistory).values({
      patientId, type: "model",
      from: MODEL_LABEL[oldModel] || oldModel,
      to: MODEL_LABEL[modalidade] || modalidade,
      description: `Modelo: ${MODEL_LABEL[oldModel] || oldModel} → ${MODEL_LABEL[modalidade] || modalidade}`,
    });
  }
  revalidatePath(`/dashboard/patients/${patientId}`);
}

// Renova o pacote: zera créditos usados, atualiza qtd/valor e registra no histórico.
export async function renewPackage(patientId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;

  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.userId, userId)),
  });
  if (!patient) throw new Error("Paciente não encontrado");

  const qty = formData.get("sessionsInPacket") ? parseInt(formData.get("sessionsInPacket") as string) : (patient.sessionsInPacket ?? 0);
  const fee = num(formData.get("valor"), patient.sessionFee);

  await db.update(patients)
    .set({ contractType: "pacote", sessionsInPacket: qty, packageCreditsUsed: 0, sessionFee: fee })
    .where(and(eq(patients.id, patientId), eq(patients.userId, userId)));

  await db.insert(patientContractHistory).values({
    patientId,
    type: "package_renew",
    from: `${patient.sessionsInPacket ?? 0}x · ${patient.sessionFee}`,
    to: `${qty}x · ${fee}`,
    description: "Renovação de pacote",
  });
  if (fee !== patient.sessionFee) {
    await db.insert(patientPriceHistory).values({ patientId, valor: fee, dataEfetiva: new Date() });
  }

  revalidatePath(`/dashboard/patients/${patientId}`);
}

// --- Prontuário (registros clínicos) ---

export async function createRecord(patientId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;

  // valida posse do paciente
  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.userId, userId)),
  });
  if (!patient) throw new Error("Paciente não encontrado");

  const content = (formData.get("content") as string)?.trim();
  if (!content) throw new Error("Conteúdo obrigatório");

  await db.insert(patientRecords).values({
    userId,
    patientId,
    type: (formData.get("type") as string) || "evolucao",
    title: (formData.get("title") as string) || null,
    content,
  });

  revalidatePath(`/dashboard/patients/${patientId}`);
}

export async function deleteRecord(recordId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;

  const rec = await db.query.patientRecords.findFirst({
    where: and(eq(patientRecords.id, recordId), eq(patientRecords.userId, userId)),
  });
  if (!rec) return;
  await db.delete(patientRecords).where(and(eq(patientRecords.id, recordId), eq(patientRecords.userId, userId)));
  revalidatePath(`/dashboard/patients/${rec.patientId}`);
}

// --- Plano terapêutico (objetivos) ---

export async function createTreatmentGoal(patientId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;
  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.userId, userId)),
  });
  if (!patient) throw new Error("Paciente não encontrado");
  const title = (formData.get("title") as string)?.trim();
  if (!title) throw new Error("Título obrigatório");
  const targetRaw = formData.get("targetDate") as string;
  await db.insert(treatmentGoals).values({
    userId,
    patientId,
    title,
    description: (formData.get("description") as string) || null,
    targetDate: targetRaw ? new Date(targetRaw) : null,
  });
  revalidatePath(`/dashboard/patients/${patientId}`);
}

export async function updateTreatmentGoal(goalId: string, progress: number, status: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;
  const g = await db.query.treatmentGoals.findFirst({
    where: and(eq(treatmentGoals.id, goalId), eq(treatmentGoals.userId, userId)),
  });
  if (!g) return;
  const clamped = Math.max(0, Math.min(100, Math.round(progress)));
  await db.update(treatmentGoals)
    .set({ progress: clamped, status: clamped >= 100 ? "atingido" : status })
    .where(and(eq(treatmentGoals.id, goalId), eq(treatmentGoals.userId, userId)));
  revalidatePath(`/dashboard/patients/${g.patientId}`);
}

export async function deleteTreatmentGoal(goalId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;
  const g = await db.query.treatmentGoals.findFirst({
    where: and(eq(treatmentGoals.id, goalId), eq(treatmentGoals.userId, userId)),
  });
  if (!g) return;
  await db.delete(treatmentGoals).where(and(eq(treatmentGoals.id, goalId), eq(treatmentGoals.userId, userId)));
  revalidatePath(`/dashboard/patients/${g.patientId}`);
}

// Cria uma aplicação de escala (PHQ-9/GAD-7) e gera o link do paciente.
export async function createScale(patientId: string, scaleType: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;
  if (scaleType !== "phq9" && scaleType !== "gad7") throw new Error("Escala inválida");

  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.userId, userId)),
  });
  if (!patient) throw new Error("Paciente não encontrado");

  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  await db.insert(scaleApplications).values({ userId, patientId, token, scaleType });
  revalidatePath(`/dashboard/patients/${patientId}`);
}

export async function deleteScale(scaleId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;
  const s = await db.query.scaleApplications.findFirst({
    where: and(eq(scaleApplications.id, scaleId), eq(scaleApplications.userId, userId)),
  });
  if (!s) return;
  await db.delete(scaleApplications).where(and(eq(scaleApplications.id, scaleId), eq(scaleApplications.userId, userId)));
  revalidatePath(`/dashboard/patients/${s.patientId}`);
}

// Gera (se ainda não houver) o token do diário de humor do paciente.
export async function ensureMoodToken(patientId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;
  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.userId, userId)),
  });
  if (!patient) throw new Error("Paciente não encontrado");
  if (!patient.moodToken) {
    const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    await db.update(patients).set({ moodToken: token }).where(and(eq(patients.id, patientId), eq(patients.userId, userId)));
  }
  revalidatePath(`/dashboard/patients/${patientId}`);
}

// --- Espaço do Paciente: tarefas (lição de casa) ---

export async function createAssignment(patientId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;

  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.userId, userId)),
  });
  if (!patient) throw new Error("Paciente não encontrado");

  const title = (formData.get("title") as string)?.trim();
  if (!title) throw new Error("Título obrigatório");

  const dueRaw = formData.get("dueDate") as string;
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);

  await db.insert(assignments).values({
    userId,
    patientId,
    token,
    title,
    instructions: (formData.get("instructions") as string) || null,
    responseType: (formData.get("responseType") as string) || "texto",
    dueDate: dueRaw ? new Date(dueRaw) : null,
  });

  revalidatePath(`/dashboard/patients/${patientId}`);
}

export async function deleteAssignment(assignmentId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;
  const a = await db.query.assignments.findFirst({
    where: and(eq(assignments.id, assignmentId), eq(assignments.userId, userId)),
  });
  if (!a) return;
  await db.delete(assignments).where(and(eq(assignments.id, assignmentId), eq(assignments.userId, userId)));
  revalidatePath(`/dashboard/patients/${a.patientId}`);
}

export async function commentAssignment(assignmentId: string, comment: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;
  const a = await db.query.assignments.findFirst({
    where: and(eq(assignments.id, assignmentId), eq(assignments.userId, userId)),
  });
  if (!a) return;
  await db.update(assignments).set({ therapistComment: comment }).where(and(eq(assignments.id, assignmentId), eq(assignments.userId, userId)));
  revalidatePath(`/dashboard/patients/${a.patientId}`);
}

export async function deletePatient(patientId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");

  await db.delete(patients).where(and(eq(patients.id, patientId), eq(patients.userId, session.user.id)));

  revalidatePath("/dashboard/patients");
  redirect("/dashboard/patients");
}

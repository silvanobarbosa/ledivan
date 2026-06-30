"use server";

import { db } from "@/db";
import { patients, patientStatusHistory, patientPriceHistory, patientContractHistory, patientRecords, assignments, scaleApplications, treatmentGoals, patientPackages, therapySessions } from "@/db/schema";
import { auth } from "@/auth";
import { and, eq, sql } from "drizzle-orm";
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

const DOW: Record<string, number> = { domingo: 0, segunda: 1, "terça": 2, terca: 2, quarta: 3, quinta: 4, sexta: 5, "sábado": 6, sabado: 6 };

// Recorrência de atendimento (Atendimento) → frequência + vezes por período.
function recorrenciaOf(formData: FormData): { frequency: string; timesPerPeriod: number } {
  const r = (formData.get("recorrencia") as string) || "semanal";
  if (r === "2x_semana") return { frequency: "semanal", timesPerPeriod: 2 };
  return { frequency: r, timesPerPeriod: 1 };
}

// Gênero: usa o texto livre quando "outro".
function genderOf(formData: FormData): string | null {
  const g = (formData.get("gender") as string) || "";
  if (g === "outro") return ((formData.get("genderOther") as string) || "").trim() || "outro";
  return g || null;
}

// Trava agenda: gera sessões semanais no dia/hora do paciente, entre as datas escolhidas.
async function maybeLockAgenda(userId: string, pf: { patientId: string; attendanceDay: string | null; attendanceTime: string | null; attendanceMode: string | null; attendanceLocation: string | null; sessionFee: string }, formData: FormData) {
  const lock = (formData.get("lockAgenda") as string) || "nao";
  if (lock === "nao") return;
  const day = (pf.attendanceDay || "").toLowerCase();
  const time = pf.attendanceTime || "";
  const startStr = formData.get("lockStart") as string;
  const endStr = formData.get("lockEnd") as string;
  const wd = DOW[day];
  if (wd === undefined || !time || !startStr || !endStr) return;
  const [hh, mm] = time.split(":").map((x) => parseInt(x) || 0);
  const end = new Date(`${endStr}T23:59:59`);
  const cur = new Date(`${startStr}T00:00:00`);
  while (cur.getDay() !== wd) cur.setDate(cur.getDate() + 1);
  const reserva = lock === "reservada";
  const isOnline = pf.attendanceMode === "online";
  const rows: typeof therapySessions.$inferInsert[] = [];
  let guard = 0;
  while (cur <= end && guard++ < 70) {
    const d = new Date(cur); d.setHours(hh, mm, 0, 0);
    rows.push({ userId, patientId: pf.patientId, date: d, duration: 50, fee: pf.sessionFee, status: "agendada", chargeable: true, isOnline, location: isOnline ? null : pf.attendanceLocation, pendingConfirmation: reserva });
    cur.setDate(cur.getDate() + 7);
  }
  if (rows.length) await db.insert(therapySessions).values(rows);
}

export async function createPatient(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;

  const name = formData.get("name") as string;
  if (!name?.trim()) throw new Error("Nome obrigatório");

  const startedAtRaw = formData.get("startedAt") as string;
  const sessionFee = num(formData.get("sessionFee"));
  const rec = recorrenciaOf(formData);

  const [created] = await db.insert(patients).values({
    userId,
    name: name.trim(),
    email: (formData.get("email") as string) || null,
    phone: (formData.get("phone") as string) || null,
    sessionFee,
    frequency: rec.frequency,
    timesPerPeriod: rec.timesPerPeriod,
    notes: (formData.get("notes") as string) || null,
    patientStatus: (formData.get("patientStatus") as string) || "ativo",
    prospectDate: (formData.get("patientStatus") as string) === "prospect" ? new Date() : null,
    startedAt: startedAtRaw ? new Date(startedAtRaw) : new Date(),
    birthDate: formData.get("birthDate") ? new Date(formData.get("birthDate") as string) : null,
    category: (formData.get("category") as string) || null,
    gender: genderOf(formData),
    cpf: (formData.get("cpf") as string) || null,
    guardianName: (formData.get("guardianName") as string) || null,
    guardianCpf: (formData.get("guardianCpf") as string) || null,
    guardianPhone: (formData.get("guardianPhone") as string) || null,
    guardianEmail: (formData.get("guardianEmail") as string) || null,
    spouseName: (formData.get("spouseName") as string) || null,
    spousePhone: (formData.get("spousePhone") as string) || null,
    spouseEmail: (formData.get("spouseEmail") as string) || null,
    spouseCpf: (formData.get("spouseCpf") as string) || null,
    emergencyEmail: (formData.get("emergencyEmail") as string) || null,
    attendanceDay: (formData.get("attendanceDay") as string) || null,
    attendanceTime: (formData.get("attendanceTime") as string) || null,
    paymentFormat: (formData.get("paymentFormat") as string) || "avulso",
    priceReviewDate: formData.get("priceReviewDate") ? new Date(formData.get("priceReviewDate") as string) : null,
    address: (formData.get("address") as string) || null,
    emergencyName: (formData.get("emergencyName") as string) || null,
    emergencyPhone: (formData.get("emergencyPhone") as string) || null,
    emergencyRelationship: (formData.get("emergencyRelationship") as string) || null,
    paymentDay: formData.get("paymentDay") ? parseInt(formData.get("paymentDay") as string) : null,
    contractType: ((formData.get("paymentFormat") as string) === "pacote" ? "pacote" : "avulso") as "pacote" | "avulso",
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

  await maybeLockAgenda(userId, { patientId: created.id, attendanceDay: created.attendanceDay, attendanceTime: created.attendanceTime, attendanceMode: created.attendanceMode, attendanceLocation: created.attendanceLocation, sessionFee: created.sessionFee }, formData);

  revalidatePath("/dashboard/patients");
  revalidatePath("/dashboard/agenda");
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
  const rec = formData.has("recorrencia") ? recorrenciaOf(formData) : { frequency: existing.frequency || "semanal", timesPerPeriod: existing.timesPerPeriod };
  const newFreq = rec.frequency;
  const newFormat = (formData.get("paymentFormat") as string) || existing.paymentFormat;
  const isPacote = newFormat === "pacote";

  await db.update(patients).set({
    name: (formData.get("name") as string) || existing.name,
    email: (formData.get("email") as string) ?? existing.email,
    phone: (formData.get("phone") as string) ?? existing.phone,
    sessionFee: newFee,
    frequency: newFreq,
    timesPerPeriod: rec.timesPerPeriod,
    notes: existing.notes, // editado no Prontuário
    patientStatus: newStatus,
    birthDate: formData.get("birthDate") ? new Date(formData.get("birthDate") as string) : existing.birthDate,
    category: (formData.get("category") as string) ?? existing.category,
    gender: formData.has("gender") ? genderOf(formData) : existing.gender,
    cpf: (formData.get("cpf") as string) ?? existing.cpf,
    guardianName: (formData.get("guardianName") as string) ?? existing.guardianName,
    guardianCpf: (formData.get("guardianCpf") as string) ?? existing.guardianCpf,
    guardianPhone: (formData.get("guardianPhone") as string) ?? existing.guardianPhone,
    guardianEmail: (formData.get("guardianEmail") as string) ?? existing.guardianEmail,
    spouseName: (formData.get("spouseName") as string) ?? existing.spouseName,
    spousePhone: (formData.get("spousePhone") as string) ?? existing.spousePhone,
    spouseEmail: (formData.get("spouseEmail") as string) ?? existing.spouseEmail,
    spouseCpf: (formData.get("spouseCpf") as string) ?? existing.spouseCpf,
    attendanceDay: (formData.get("attendanceDay") as string) ?? existing.attendanceDay,
    attendanceTime: (formData.get("attendanceTime") as string) ?? existing.attendanceTime,
    address: (formData.get("address") as string) ?? existing.address,
    emergencyName: (formData.get("emergencyName") as string) ?? existing.emergencyName,
    emergencyPhone: (formData.get("emergencyPhone") as string) ?? existing.emergencyPhone,
    emergencyEmail: (formData.get("emergencyEmail") as string) ?? existing.emergencyEmail,
    emergencyRelationship: (formData.get("emergencyRelationship") as string) ?? existing.emergencyRelationship,
    paymentDay: formData.get("paymentDay") ? parseInt(formData.get("paymentDay") as string) : existing.paymentDay,
    paymentFormat: newFormat,
    contractType: (isPacote ? "pacote" : "avulso") as "pacote" | "avulso",
    priceReviewDate: formData.get("priceReviewDate") ? new Date(formData.get("priceReviewDate") as string) : existing.priceReviewDate,
    attendanceMode: (formData.get("attendanceMode") as string) || existing.attendanceMode,
    attendanceLocation: (formData.get("attendanceLocation") as string) ?? existing.attendanceLocation,
    sessionsInPacket: isPacote
      ? (formData.get("sessionsInPacket") ? parseInt(formData.get("sessionsInPacket") as string) : existing.sessionsInPacket)
      : null,
    reminderEnabled: formData.get("reminderEnabled") === "on",
    reminderChannel: (formData.get("reminderChannel") as string) || existing.reminderChannel,
    reminderLeadMinutes: formData.get("reminderLeadMinutes")
      ? parseInt(formData.get("reminderLeadMinutes") as string)
      : existing.reminderLeadMinutes,
    photo3x4: (formData.get("photo3x4") as string) || existing.photo3x4,
    photoExtra1: (formData.get("photoExtra1") as string) || existing.photoExtra1,
    photoExtra2: (formData.get("photoExtra2") as string) || existing.photoExtra2,
    photoExtra3: (formData.get("photoExtra3") as string) || existing.photoExtra3,
    tags: existing.tags, // editado no Prontuário
  }).where(and(eq(patients.id, patientId), eq(patients.userId, session.user.id)));

  // historico de mudancas
  if (newStatus !== existing.patientStatus) {
    await db.insert(patientStatusHistory).values({ patientId, status: newStatus });
  }
  if (newFee !== existing.sessionFee) {
    const efetiva = formData.get("dataEfetiva") ? new Date(formData.get("dataEfetiva") as string) : new Date();
    await db.insert(patientPriceHistory).values({ patientId, valor: newFee, dataEfetiva: efetiva });
  }
  if ((existing.paymentFormat || "avulso") !== (newFormat || "avulso") || (existing.frequency || "") !== (newFreq || "")) {
    const FMT: Record<string, string> = { avulso: "Avulso", mensal: "Mensal", quinzenal: "Quinzenal", pacote: "Pacote" };
    await db.insert(patientContractHistory).values({
      patientId, type: "model",
      from: `${existing.frequency || "—"} · ${FMT[existing.paymentFormat || "avulso"] || existing.paymentFormat}`,
      to: `${newFreq || "—"} · ${FMT[newFormat || "avulso"] || newFormat}`,
      description: `Modelo: ${newFreq || "—"} · ${FMT[newFormat || "avulso"] || newFormat}`,
    });
  }

  await maybeLockAgenda(session.user.id, {
    patientId,
    attendanceDay: (formData.get("attendanceDay") as string) ?? existing.attendanceDay,
    attendanceTime: (formData.get("attendanceTime") as string) ?? existing.attendanceTime,
    attendanceMode: (formData.get("attendanceMode") as string) || existing.attendanceMode,
    attendanceLocation: (formData.get("attendanceLocation") as string) ?? existing.attendanceLocation,
    sessionFee: newFee,
  }, formData);

  revalidatePath(`/dashboard/patients/${patientId}`);
  revalidatePath("/dashboard/patients");
  revalidatePath("/dashboard/agenda");
}

// Ajuste: Incluir Pacote → cria um pacote numerado (P1, P2, ...) com N sessões.
export async function includePackage(patientId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;
  const patient = await db.query.patients.findFirst({ where: and(eq(patients.id, patientId), eq(patients.userId, userId)) });
  if (!patient) throw new Error("Paciente não encontrado");
  const qty = formData.get("sessionsInPacket") ? parseInt(formData.get("sessionsInPacket") as string) : 0;
  if (qty < 1) throw new Error("Quantidade inválida");
  // valor: traz o atual, com possibilidade de alterar (gera histórico de preço)
  const newFee = num(formData.get("fee"), patient.sessionFee);

  // próximo número de pacote do paciente
  const [{ maxSeq }] = await db.select({ maxSeq: sql<number>`coalesce(max(${patientPackages.seq}), 0)::int` }).from(patientPackages).where(eq(patientPackages.patientId, patientId));
  const seq = (maxSeq || 0) + 1;
  await db.insert(patientPackages).values({ userId, patientId, seq, sessions: qty, fee: newFee });
  await db.update(patients).set({ contractType: "pacote", paymentFormat: "pacote", sessionFee: newFee }).where(and(eq(patients.id, patientId), eq(patients.userId, userId)));
  if (newFee !== patient.sessionFee) {
    await db.insert(patientPriceHistory).values({ patientId, valor: newFee, dataEfetiva: new Date() });
  }
  await db.insert(patientContractHistory).values({ patientId, type: "model", from: patient.paymentFormat || "avulso", to: `Pacote P${seq}`, description: `Pacote P${seq} incluído: ${qty} sessões · ${newFee}` });
  revalidatePath(`/dashboard/patients/${patientId}`);
}

// Editar pacote (total de sessões e/ou usadas).
export async function editPackage(packageId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;
  const pkg = await db.query.patientPackages.findFirst({ where: and(eq(patientPackages.id, packageId), eq(patientPackages.userId, userId)) });
  if (!pkg) return;
  const sessions = formData.get("sessions") ? Math.max(1, parseInt(formData.get("sessions") as string)) : pkg.sessions;
  const usedRaw = formData.get("used") ? parseInt(formData.get("used") as string) : pkg.used;
  const used = Math.max(0, Math.min(usedRaw, sessions));
  await db.update(patientPackages).set({ sessions, used }).where(and(eq(patientPackages.id, packageId), eq(patientPackages.userId, userId)));
  revalidatePath(`/dashboard/patients/${pkg.patientId}`);
}

// Excluir pacote.
export async function deletePackage(packageId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;
  const pkg = await db.query.patientPackages.findFirst({ where: and(eq(patientPackages.id, packageId), eq(patientPackages.userId, userId)) });
  if (!pkg) return;
  await db.delete(patientPackages).where(and(eq(patientPackages.id, packageId), eq(patientPackages.userId, userId)));
  revalidatePath(`/dashboard/patients/${pkg.patientId}`);
}

// Editar / excluir um registro do histórico de valor (preço).
export async function editPriceHistory(historyId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const row = await db.query.patientPriceHistory.findFirst({ where: eq(patientPriceHistory.id, historyId) });
  if (!row) return;
  const owner = await db.query.patients.findFirst({ where: and(eq(patients.id, row.patientId), eq(patients.userId, session.user.id)) });
  if (!owner) return;
  const valor = num(formData.get("valor"), row.valor);
  const efetivaRaw = formData.get("dataEfetiva") as string;
  await db.update(patientPriceHistory).set({ valor, ...(efetivaRaw ? { dataEfetiva: new Date(efetivaRaw) } : {}) }).where(and(eq(patientPriceHistory.id, historyId), eq(patientPriceHistory.patientId, owner.id)));
  revalidatePath(`/dashboard/patients/${row.patientId}`);
}

export async function deletePriceHistory(historyId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const row = await db.query.patientPriceHistory.findFirst({ where: eq(patientPriceHistory.id, historyId) });
  if (!row) return;
  const owner = await db.query.patients.findFirst({ where: and(eq(patients.id, row.patientId), eq(patients.userId, session.user.id)) });
  if (!owner) return;
  await db.delete(patientPriceHistory).where(and(eq(patientPriceHistory.id, historyId), eq(patientPriceHistory.patientId, owner.id)));
  revalidatePath(`/dashboard/patients/${row.patientId}`);
}

// Etiquetas + observações (no cabeçalho do Prontuário). Gera histórico de alterações.
export async function updatePatientNotes(patientId: string, formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;
  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.userId, userId)),
  });
  if (!patient) throw new Error("Paciente não encontrado");

  const newTags = ((formData.get("tags") as string) || "").trim() || null;
  const newNotes = ((formData.get("notes") as string) || "").trim() || null;

  await db.update(patients).set({ tags: newTags, notes: newNotes }).where(and(eq(patients.id, patientId), eq(patients.userId, userId)));

  if ((patient.tags || null) !== newTags) {
    await db.insert(patientContractHistory).values({ patientId, type: "tags", from: patient.tags || "—", to: newTags || "—", description: "Etiquetas alteradas" });
  }
  if ((patient.notes || null) !== newNotes) {
    const trunc = (s: string | null) => (s ? (s.length > 80 ? s.slice(0, 80) + "…" : s) : "—");
    await db.insert(patientContractHistory).values({ patientId, type: "observacoes", from: trunc(patient.notes), to: trunc(newNotes), description: "Observações alteradas" });
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

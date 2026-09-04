"use server";

import { db } from "@/db";
import { users, patients, therapySessions } from "@/db/schema";
import { pushToTherapist } from "@/lib/push";
import { and, eq, or, gte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getPreferences } from "@/lib/preferences";

// Agendamento público (sem auth). Cria/usa um paciente (prospect) e agenda a sessão
// no espaço do terapeuta dono do slug. Escreve apenas no userId resolvido pelo slug.
export async function createPublicBooking(slug: string, formData: FormData) {
  // honeypot anti-bot (campo oculto que humanos deixam vazio)
  if (((formData.get("website") as string) || "").trim()) return { ok: true };

  const therapist = await db.query.users.findFirst({ where: eq(users.bookingSlug, slug) });
  if (!therapist) return { ok: false, error: "Link inválido." };
  const userId = therapist.id;

  const name = (formData.get("name") as string)?.trim();
  const phone = ((formData.get("phone") as string) || "").trim() || null;
  const email = ((formData.get("email") as string) || "").trim() || null;
  const dateRaw = formData.get("date") as string;
  const note = ((formData.get("note") as string) || "").trim() || null;
  const online = formData.get("online") === "on";

  if (!name) return { ok: false, error: "Informe seu nome." };
  if (!phone && !email) return { ok: false, error: "Informe telefone ou e-mail." };
  if (!dateRaw) return { ok: false, error: "Escolha data e horário." };

  // anti-spam: limita pedidos públicos por terapeuta (máx 10/hora)
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(therapySessions)
    .where(and(eq(therapySessions.userId, userId), gte(therapySessions.createdAt, hourAgo)));
  if (n >= 10) return { ok: false, error: "Muitas solicitações agora. Tente novamente em alguns minutos." };

  // tenta achar paciente existente por telefone/e-mail
  let patient = null;
  const conds = [];
  if (phone) conds.push(eq(patients.phone, phone));
  if (email) conds.push(eq(patients.email, email));
  if (conds.length) {
    patient = await db.query.patients.findFirst({
      where: and(eq(patients.userId, userId), conds.length === 1 ? conds[0] : or(...conds)),
    });
  }

  if (!patient) {
    // número de cadastro sequencial por terapeuta (antes o agendamento público nascia sem número)
    const [{ maxNum }] = await db.select({ maxNum: sql<number>`coalesce(max(${patients.registrationNumber}), 0)` })
      .from(patients).where(eq(patients.userId, userId));
    [patient] = await db.insert(patients).values({
      userId,
      registrationNumber: Number(maxNum) + 1,
      name,
      phone,
      email,
      patientStatus: "prospect",
      prospectDate: new Date(),
      prospectObservacoes: "Agendou pelo link público.",
      sessionFee: "0",
    }).returning();
  }

  const prefs = await getPreferences(userId);
  const auto = !!prefs.bookingAutoConfirm;

  const [created] = await db.insert(therapySessions).values({
    userId,
    patientId: patient.id,
    date: new Date(dateRaw),
    duration: 50,
    fee: patient.sessionFee,
    status: "agendada",
    isOnline: online,
    pendingConfirmation: !auto, // se não é automático, aguarda confirmação do terapeuta
    notes: note ? `Pedido via link público: ${note}` : "Agendado pelo link público.",
  }).returning();

  revalidatePath("/dashboard/agenda");
  revalidatePath("/dashboard/prospects");

  // Avisa o terapeuta no app (push) quando precisa confirmar um horário pedido pelo link público.
  if (!auto) {
    const quando = new Date(dateRaw).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
    await pushToTherapist(userId, "Novo agendamento 🗓️", `${name} pediu um horário (${quando}). Toque para confirmar.`, { type: "booking", sessionId: created.id });
  }

  // Link de vídeo do convidado (só faz sentido se online e confirmado automaticamente)
  const base = (process.env.APP_URL || "https://ledivan.com.br").replace(/\/$/, "");
  const meetingLink = auto && online ? `${base}/sala-convidado/${created.id}` : null;

  return { ok: true, mode: auto ? "auto" : "confirm", online, meetingLink };
}

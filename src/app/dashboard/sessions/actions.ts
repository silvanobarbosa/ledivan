"use server";

import { db } from "@/db";
import { therapySessions, patients } from "@/db/schema";
import { auth } from "@/auth";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getPreferences } from "@/lib/preferences";
import { createMeetLink } from "@/lib/googleCalendar";

type SessionStatus = "realizada" | "nao_realizada" | "cancelada" | "realocada" | "agendada";

export async function createSession(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;

  const patientId = formData.get("patientId") as string;
  if (!patientId) throw new Error("Paciente obrigatório");

  // valida posse do paciente
  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.userId, userId)),
  });
  if (!patient) throw new Error("Paciente não encontrado");

  const dateRaw = formData.get("date") as string;
  const fee = (formData.get("fee") as string)?.replace(",", ".") || patient.sessionFee;
  const isOnline = formData.get("isOnline") === "on";
  const date = dateRaw ? new Date(dateRaw) : new Date();
  const duration = formData.get("duration") ? parseInt(formData.get("duration") as string) : 50;

  // Se online e a preferência for Google Meet, tenta gerar o link no Calendar do profissional.
  let meetingUrl: string | null = null;
  if (isOnline) {
    const prefs = await getPreferences(userId);
    if (prefs.meetingProvider === "meet") {
      meetingUrl = await createMeetLink(userId, {
        summary: `Sessão — ${patient.name}`,
        startISO: date.toISOString(),
        durationMin: duration,
      });
    }
  }

  await db.insert(therapySessions).values({
    userId,
    patientId,
    date,
    duration,
    fee,
    status: ((formData.get("status") as string) || "agendada") as SessionStatus,
    notes: (formData.get("notes") as string) || null,
    chargeable: formData.get("chargeable") !== "false",
    isOnline,
    location: isOnline ? null : ((formData.get("location") as string) || patient.attendanceLocation || null),
    meetingUrl,
  });

  revalidatePath(`/dashboard/patients/${patientId}`);
  revalidatePath("/dashboard/agenda");
  redirect(`/dashboard/patients/${patientId}`);
}

// Cria sessão direto da Agenda (sem redirecionar). Retorna {ok}.
export async function createSessionFromAgenda(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Não autorizado" };
  const userId = session.user.id;

  const patientId = formData.get("patientId") as string;
  if (!patientId) return { ok: false, error: "Escolha o paciente." };
  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.userId, userId)),
  });
  if (!patient) return { ok: false, error: "Paciente não encontrado." };

  const dateRaw = formData.get("date") as string;
  if (!dateRaw) return { ok: false, error: "Escolha data e horário." };
  const date = new Date(dateRaw);
  const duration = formData.get("duration") ? parseInt(formData.get("duration") as string) : 50;
  const isOnline = formData.get("isOnline") === "on";

  let meetingUrl: string | null = null;
  if (isOnline) {
    const prefs = await getPreferences(userId);
    if (prefs.meetingProvider === "meet") {
      meetingUrl = await createMeetLink(userId, { summary: `Sessão — ${patient.name}`, startISO: date.toISOString(), durationMin: duration });
    }
  }

  await db.insert(therapySessions).values({
    userId,
    patientId,
    date,
    duration,
    fee: patient.sessionFee,
    status: ((formData.get("status") as string) || "agendada") as SessionStatus,
    chargeable: formData.get("chargeable") !== "false",
    isOnline,
    location: isOnline ? null : ((formData.get("location") as string) || patient.attendanceLocation || null),
    meetingUrl,
  });

  revalidatePath("/dashboard/agenda");
  revalidatePath(`/dashboard/patients/${patientId}`);
  return { ok: true };
}

// Converte a sessão entre online e presencial (mudança de planos no atendimento).
export async function setSessionOnline(sessionId: string, online: boolean): Promise<{ ok: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false };
  const userId = session.user.id;
  const s = await db.query.therapySessions.findFirst({
    where: and(eq(therapySessions.id, sessionId), eq(therapySessions.userId, userId)),
    with: { patient: { columns: { name: true } } },
  });
  if (!s) return { ok: false };

  let meetingUrl: string | null = null;
  if (online) {
    const prefs = await getPreferences(userId);
    if (prefs.meetingProvider === "meet") {
      meetingUrl = await createMeetLink(userId, { summary: `Sessão — ${s.patient?.name ?? ""}`, startISO: new Date(s.date as Date).toISOString(), durationMin: s.duration });
    }
  }
  // ao virar presencial, descarta o link (cancela o uso do sistema de reunião)
  await db.update(therapySessions)
    .set({ isOnline: online, meetingUrl: online ? meetingUrl : null })
    .where(and(eq(therapySessions.id, sessionId), eq(therapySessions.userId, userId)));

  revalidatePath(`/dashboard/agenda`);
  revalidatePath(`/atender/${sessionId}`);
  return { ok: true };
}

// Confirma um agendamento público que estava aguardando confirmação.
export async function confirmSession(sessionId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  await db.update(therapySessions)
    .set({ pendingConfirmation: false })
    .where(and(eq(therapySessions.id, sessionId), eq(therapySessions.userId, session.user.id)));
  revalidatePath("/dashboard/agenda");
}

export async function updateSessionStatus(sessionId: string, status: SessionStatus, justificativa?: string, chargeable?: boolean) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;

  const existing = await db.query.therapySessions.findFirst({
    where: and(eq(therapySessions.id, sessionId), eq(therapySessions.userId, userId)),
    with: { patient: true },
  });
  if (!existing) return;

  await db.update(therapySessions)
    .set({ status, justificativa: justificativa || null, ...(chargeable !== undefined ? { chargeable } : {}) })
    .where(and(eq(therapySessions.id, sessionId), eq(therapySessions.userId, userId)));

  // Abate/restaura crédito do pacote conforme transição p/ "realizada" (se a opção do paciente estiver ligada)
  const p = existing.patient;
  if (p?.contractType === "pacote" && p.deductPackageOnSession && p.sessionsInPacket) {
    const was = existing.status === "realizada";
    const now = status === "realizada";
    const used = p.packageCreditsUsed ?? 0;
    if (!was && now) await db.update(patients).set({ packageCreditsUsed: Math.min(used + 1, p.sessionsInPacket) }).where(eq(patients.id, p.id));
    else if (was && !now) await db.update(patients).set({ packageCreditsUsed: Math.max(used - 1, 0) }).where(eq(patients.id, p.id));
  }

  revalidatePath("/dashboard/agenda");
  revalidatePath(`/dashboard/patients/${existing.patientId}`);
}

// Gera um resumo pós-sessão em linguagem acolhedora para o paciente (IA), a partir das notas.
export async function generateSessionSummary(sessionId: string): Promise<{ ok: boolean; summary?: string; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Não autorizado" };
  const userId = session.user.id;

  const s = await db.query.therapySessions.findFirst({
    where: and(eq(therapySessions.id, sessionId), eq(therapySessions.userId, userId)),
    with: { patient: { columns: { name: true } } },
  });
  if (!s) return { ok: false, error: "Sessão não encontrada." };
  if (!s.notes || !s.notes.trim()) return { ok: false, error: "Adicione notas à sessão antes de gerar o resumo." };

  try {
    const OpenAI = (await import("openai")).default;
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Você escreve um resumo pós-sessão PARA O PACIENTE, em português, tom acolhedor e simples (2ª pessoa, 'você'). Sem jargão clínico, sem diagnóstico. Baseie-se apenas nas notas. Estruture em: o que conversamos, 1-2 pontos de cuidado/para refletir, e uma sugestão prática até a próxima sessão. Curto (até ~120 palavras).",
        },
        { role: "user", content: `Notas da sessão com ${s.patient?.name ?? "o paciente"}:\n${s.notes}` },
      ],
    });
    const summary = r.choices[0].message.content?.trim() || "";
    if (!summary) return { ok: false, error: "Não foi possível gerar." };

    await db.update(therapySessions).set({ patientSummary: summary }).where(and(eq(therapySessions.id, sessionId), eq(therapySessions.userId, userId)));
    revalidatePath(`/dashboard/patients/${s.patientId}`);
    return { ok: true, summary };
  } catch (e) {
    console.error("Erro no resumo pós-sessão:", e);
    return { ok: false, error: "Falha ao gerar o resumo." };
  }
}

export async function deleteSession(sessionId: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");

  const existing = await db.query.therapySessions.findFirst({
    where: and(eq(therapySessions.id, sessionId), eq(therapySessions.userId, session.user.id)),
  });
  if (!existing) return;

  await db.delete(therapySessions).where(and(eq(therapySessions.id, sessionId), eq(therapySessions.userId, session.user.id)));

  revalidatePath("/dashboard/agenda");
  revalidatePath(`/dashboard/patients/${existing.patientId}`);
}

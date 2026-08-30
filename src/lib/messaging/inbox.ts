// Inbox 2-via: grava a conversa com o paciente (entrada via webhook do Evolution + saída do motor).
import { db } from "@/db";
import { users, patients, messages } from "@/db/schema";
import { eq } from "drizzle-orm";

const digits = (s?: string | null) => (s || "").replace(/\D/g, "");
const last11 = (s?: string | null) => digits(s).slice(-11);

/** Mensagem RECEBIDA numa instância por-terapeuta (`ledivan_<userId>`). Casa terapeuta+paciente e grava. */
export async function recordInbound(instance: string, from: string, text: string): Promise<void> {
  if (!instance || !from || !text) return;
  const [therapist] = await db.select({ id: users.id }).from(users).where(eq(users.whatsappInstance, instance)).limit(1);
  if (!therapist) return;
  const pats = await db.select({ id: patients.id, phone: patients.phone }).from(patients).where(eq(patients.userId, therapist.id));
  const key = last11(from);
  const patient = pats.find((p) => p.phone && last11(p.phone) === key);
  await db.insert(messages).values({
    userId: therapist.id, patientId: patient?.id ?? null,
    direction: "in", channel: "whatsapp", contact: from, text: text.slice(0, 4000),
  }).catch(() => {});
}

/** Mensagem ENVIADA ao paciente (chamado pelo motor após entregar). */
export async function recordOutbound(userId: string, patientId: string | null | undefined, channel: string, text: string, contact?: string | null): Promise<void> {
  await db.insert(messages).values({
    userId, patientId: patientId ?? null, direction: "out", channel, contact: contact ?? null, text: text.slice(0, 4000),
  }).catch(() => {});
}

/** O número é de um terapeuta cadastrado? (pra decidir se roda o bot de comando dele). */
export async function isTherapistPhone(from: string): Promise<boolean> {
  const key = last11(from);
  if (key.length < 10) return false;
  const rows = await db.select({ w: users.whatsappId }).from(users);
  return rows.some((r) => r.w && last11(r.w) === key);
}

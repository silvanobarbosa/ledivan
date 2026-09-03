"use server";

import { db } from "@/db";
import { patients, users } from "@/db/schema";
import { auth } from "@/auth";
import { and, eq } from "drizzle-orm";
import { sendWhatsappFromUser } from "@/lib/whatsappEvolution";
import { getPreferences, setPreferences } from "@/lib/preferences";
import { revalidatePath } from "next/cache";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

// Mensagem padrão de cobrança (amigável, editável no futuro).
export function cobrancaTexto(nome: string, valor: number, mesIdx: number, terapeuta: string): string {
  const primeiro = nome.split(" ")[0];
  const mes = MESES[mesIdx] ?? "";
  return `Olá, ${primeiro}! 🌿 Passando para lembrar do pagamento${mes ? ` referente a ${mes}` : ""}` +
    `${valor > 0 ? ` — valor em aberto de R$ ${valor.toFixed(2).replace(".", ",")}` : ""}.` +
    ` Qualquer dúvida, é só me chamar. Obrigado(a)! — ${terapeuta.split(" ")[0]}`;
}

// Envia cobrança pelo WhatsApp do terapeuta a um paciente.
export async function cobrarPaciente(patientId: string, valor: number, mesIdx: number): Promise<{ ok: boolean; error?: string }> {
  const s = await auth();
  if (!s?.user?.id) return { ok: false, error: "Não autorizado" };
  const userId = s.user.id;

  const [pat] = await db.select({ name: patients.name, phone: patients.phone }).from(patients)
    .where(and(eq(patients.id, patientId), eq(patients.userId, userId))).limit(1);
  if (!pat) return { ok: false, error: "Paciente não encontrado" };
  if (!pat.phone) return { ok: false, error: "Paciente sem telefone cadastrado" };

  const [u] = await db.select({ name: users.name }).from(users).where(eq(users.id, userId)).limit(1);
  const texto = cobrancaTexto(pat.name, valor, mesIdx, u?.name || "Seu terapeuta");
  const ok = await sendWhatsappFromUser(userId, pat.phone, texto);
  return ok ? { ok: true } : { ok: false, error: "WhatsApp não conectado (configure em Ajustes)" };
}

// Liga/desliga a cobrança automática mensal (cron).
export async function setAutoCobranca(enabled: boolean): Promise<{ ok: boolean }> {
  const s = await auth();
  if (!s?.user?.id) return { ok: false };
  const prev = await getPreferences(s.user.id);
  await setPreferences(s.user.id, { ...prev, autoCobranca: enabled });
  revalidatePath("/dashboard/pagamentos");
  return { ok: true };
}

"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auth } from "@/auth";
import { patients } from "@/db/schema";
import { geralDoPaciente, type LinhaNaTela } from "@/lib/geralDoPaciente";
import { registrarCobrancaEnviada } from "@/app/dashboard/patients/[id]/geral-actions";
import { vencimentosNoDia, type CobrancaResolvida } from "@/lib/vencimentosDoDia";
import { resolverCobrancas } from "@/lib/resolverCobrancas";
import { pagamentosPorMes, type MesPagamentos, type ResumoAno } from "@/lib/pagamentosPorMes";

/** Os cadastros que entram nas contagens de cobrança: Paciente e Supervisionado (não prospectado). */
async function cadastrosCobraveis(userId: string) {
  return db
    .select({ id: patients.id, name: patients.name, phone: patients.phone, guardianPhone: patients.guardianPhone, paymentFormat: patients.paymentFormat, registrationNumber: patients.registrationNumber, status: patients.patientStatus })
    .from(patients)
    .where(eq(patients.userId, userId));
}

/**
 * Os vencimentos de uma data (doc 44): roda o motor de cobrança de cada cadastro e resolve as
 * cobranças que vencem no dia — sessões avulsas e pacotes. Sem persistir a data (o cliente manda).
 */
export async function vencimentosEm(diaISO: string): Promise<{ ok: boolean; avulsas?: CobrancaResolvida[]; pacotes?: CobrancaResolvida[]; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sessão inválida." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(diaISO)) return { ok: false, error: "Data inválida." };
  const userId = session.user.id;

  const lista = (await cadastrosCobraveis(userId)).filter((p) => p.status === "ativo");
  const todas: CobrancaResolvida[] = [];
  await Promise.all(lista.map(async (p) => {
    const geral = await geralDoPaciente(userId, p.id);
    if (!geral) return;
    todas.push(...resolverCobrancas(geral.linhas as LinhaNaTela[], p));
  }));

  const { avulsas, pacotes } = vencimentosNoDia(todas, diaISO);
  return { ok: true, avulsas, pacotes };
}

/**
 * Menu Pagamentos — "Por mês — todos os cadastros" (doc 46): roda o motor de cobrança de cada cadastro
 * (Paciente/Supervisionado, sem prospectado) e agrupa as cobranças do ano por mês de vencimento, com os
 * 3 cards de resumo. Mesma fonte do Vencimentos por dia e da guia Geral.
 */
export async function pagamentosPorMesDoAno(year: number): Promise<{ ok: boolean; meses?: MesPagamentos[]; resumo?: ResumoAno; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sessão inválida." };
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return { ok: false, error: "Ano inválido." };
  const userId = session.user.id;

  const lista = (await cadastrosCobraveis(userId)).filter((p) => p.status !== "prospect");
  const todas: CobrancaResolvida[] = [];
  await Promise.all(lista.map(async (p) => {
    const geral = await geralDoPaciente(userId, p.id);
    if (geral) todas.push(...resolverCobrancas(geral.linhas as LinhaNaTela[], p));
  }));

  const { meses, resumo } = pagamentosPorMes(todas, year);
  return { ok: true, meses, resumo };
}

/** Registra um acionamento de cobrança (doc 44/47: só após a confirmação explícita de envio). */
export async function registrarCobranca(cadastroId: string, cobrancaChave: string): Promise<{ ok: boolean; error?: string }> {
  return registrarCobrancaEnviada({ patientId: cadastroId, cobrancaChave });
}

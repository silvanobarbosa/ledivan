"use server";

import * as XLSX from "xlsx";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auth } from "@/auth";
import {
  patients, patientPaymentFormatHistory, patientPriceHistory, sessionPayments, therapySessions,
} from "@/db/schema";
import { ABAS, conferir, igual, resumo, type Leitura, type Problema } from "@/lib/importarPlanilha";
import { revalidatePath } from "next/cache";

/**
 * IMPORTAR A PLANILHA — conferir primeiro, gravar depois, e só com o "sim" dela.
 *
 * Duas portas, de propósito. `conferirPlanilha` não escreve NADA: lê o arquivo, devolve o que
 * encontrou e o que está errado, linha a linha. `aplicarPlanilha` recebe o MESMO arquivo e
 * confere tudo de novo antes de gravar — a conferência anterior é uma tela, e tela não é
 * fronteira. Mandar de volta as linhas já normalizadas seria deixar o cliente escolher o que
 * entra no banco.
 *
 * Tudo escopado ao `userId` da sessão: o nome do paciente vem de um arquivo de fora, e nome não
 * dá acesso a nada — quem decide de quem é o dado é a sessão, nunca a planilha.
 */

/** Teto do arquivo. Planilha de migração é pequena; o que passa disso é outra coisa. */
const TETO_DO_ARQUIVO = 5 * 1024 * 1024;

const entrada = z.object({
  arquivo: z.instanceof(File, { message: "Envie um arquivo .xlsx." }),
});

export type ResumoDaImportacao = {
  ok: true;
  resumo: ReturnType<typeof resumo>;
  problemas: Problema[];
  /** Quantas linhas já existem na base e seriam puladas. */
  repetidos: { pacientes: number; sessoes: number; pagamentos: number };
} | { ok: false; error: string };

export type ResultadoDaImportacao =
  | { ok: true; criados: { pacientes: number; sessoes: number; pagamentos: number }; pulados: number }
  | { ok: false; error: string };

/** Lê as abas do arquivo. Erro de leitura vira mensagem, nunca exceção que suba para a tela. */
function abrir(buf: ArrayBuffer): { Pacientes?: Record<string, unknown>[]; Agenda?: Record<string, unknown>[]; Pagamentos?: Record<string, unknown>[] } | null {
  try {
    const wb = XLSX.read(buf, { type: "array", cellDates: true });
    const out: Record<string, Record<string, unknown>[]> = {};
    for (const aba of ABAS) {
      const ws = wb.Sheets[aba];
      if (ws) out[aba] = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
    }
    return out;
  } catch { return null; }
}

/** O que a planilha precisa saber da base: os nomes que já existem. */
async function nomesJaCadastrados(userId: string): Promise<string[]> {
  const rows = await db.select({ nome: patients.name }).from(patients).where(eq(patients.userId, userId));
  return rows.map((r) => r.nome);
}

async function ler(userId: string, arquivo: File): Promise<{ leitura: Leitura } | { erro: string }> {
  if (arquivo.size <= 0) return { erro: "O arquivo chegou vazio." };
  if (arquivo.size > TETO_DO_ARQUIVO) return { erro: "Arquivo grande demais (máximo 5 MB)." };
  const abas = abrir(await arquivo.arrayBuffer());
  if (!abas) return { erro: "Não consegui abrir a planilha. Ela precisa ser um .xlsx." };
  if (!ABAS.some((a) => abas[a]?.length)) {
    return { erro: "Não achei nenhuma das abas Pacientes, Agenda ou Pagamentos com dados. Use a planilha modelo." };
  }
  return { leitura: conferir(abas, await nomesJaCadastrados(userId)) };
}

/** O que JÁ EXISTE na base e seria pulado — é o número que evita a importação em dobro. */
async function contarRepetidos(userId: string, l: Leitura) {
  const existentes = await db.select({ id: patients.id, nome: patients.name }).from(patients).where(eq(patients.userId, userId));
  const idDoNome = (nome: string) => existentes.find((e) => igual(e.nome, nome))?.id ?? null;

  const pacientes = l.pacientes.filter((p) => idDoNome(p.nome)).length;

  const sessoesExistentes = await db.select({ patientId: therapySessions.patientId, date: therapySessions.date })
    .from(therapySessions).where(eq(therapySessions.userId, userId));
  const chaveSessao = new Set(sessoesExistentes.map((s) => `${s.patientId}|${new Date(s.date).getTime()}`));
  const sessoes = l.sessoes.filter((s) => {
    const id = idDoNome(s.paciente);
    return id ? chaveSessao.has(`${id}|${s.quando.getTime()}`) : false;
  }).length;

  const pagExistentes = await db.select({ patientId: sessionPayments.patientId, date: sessionPayments.date, amount: sessionPayments.amount })
    .from(sessionPayments).where(eq(sessionPayments.userId, userId));
  const chavePag = new Set(pagExistentes.map((p) => `${p.patientId}|${new Date(p.date).toDateString()}|${Number(p.amount).toFixed(2)}`));
  const pagamentos = l.pagamentos.filter((p) => {
    const id = idDoNome(p.paciente);
    return id ? chavePag.has(`${id}|${p.quando.toDateString()}|${p.valor.toFixed(2)}`) : false;
  }).length;

  return { pacientes, sessoes, pagamentos };
}

export async function conferirPlanilha(formData: FormData): Promise<ResumoDaImportacao> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sessão inválida." };

  const parsed = entrada.safeParse({ arquivo: formData.get("arquivo") });
  if (!parsed.success) return { ok: false, error: "Envie um arquivo .xlsx." };

  const lido = await ler(session.user.id, parsed.data.arquivo);
  if ("erro" in lido) return { ok: false, error: lido.erro };

  return {
    ok: true,
    resumo: resumo(lido.leitura),
    // A tela mostra as primeiras; a conta inteira vai no resumo. Despejar 2.000 erros numa
    // página não ajuda ninguém a consertar a planilha.
    problemas: lido.leitura.problemas.slice(0, 50),
    repetidos: await contarRepetidos(session.user.id, lido.leitura),
  };
}

export async function aplicarPlanilha(formData: FormData): Promise<ResultadoDaImportacao> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sessão inválida." };
  const userId = session.user.id;

  const parsed = entrada.safeParse({ arquivo: formData.get("arquivo") });
  if (!parsed.success) return { ok: false, error: "Envie um arquivo .xlsx." };

  // Confere DE NOVO: a conferência anterior aconteceu numa tela, e tela não é fronteira.
  const lido = await ler(userId, parsed.data.arquivo);
  if ("erro" in lido) return { ok: false, error: lido.erro };
  const l = lido.leitura;

  let pulados = 0;
  const criados = { pacientes: 0, sessoes: 0, pagamentos: 0 };

  const existentes = await db.select({ id: patients.id, nome: patients.name }).from(patients).where(eq(patients.userId, userId));
  const porNome = new Map(existentes.map((e) => [e.nome.toLowerCase(), e.id]));
  const acharId = (nome: string) => {
    const direto = porNome.get(nome.toLowerCase());
    if (direto) return direto;
    for (const [k, v] of porNome) if (igual(k, nome)) return v;
    return null;
  };

  // ── Pacientes ──
  const [{ maxNum }] = await db.select({ maxNum: sql<number>`coalesce(max(${patients.registrationNumber}), 0)` })
    .from(patients).where(eq(patients.userId, userId));
  let numero = Number(maxNum);

  for (const p of l.pacientes) {
    if (acharId(p.nome)) { pulados++; continue; }
    numero += 1;
    const inicio = p.inicio ?? new Date();
    const [novo] = await db.insert(patients).values({
      userId,
      registrationNumber: numero,
      name: p.nome,
      birthDate: p.nascimento,
      cpf: p.cpf || null,
      phone: p.telefone || null,
      email: p.email || null,
      guardianName: p.responsavel || null,
      guardianPhone: p.responsavelTelefone || null,
      paymentFormat: p.formato,
      pacoteTipo: p.pacoteTipo,
      sessionFee: (p.valorSessao ?? 0).toFixed(2),
      sessionsInPacket: p.sessoesNoPacote,
      paymentDay: p.diaVencimento,
      startedAt: inicio,
      patientStatus: "ativo",
    }).returning({ id: patients.id });

    porNome.set(p.nome.toLowerCase(), novo.id);
    criados.pacientes++;

    /**
     * A VIGÊNCIA do formato e o PREÇO DE ENTRADA nascem junto do cadastro.
     *
     * Sem a vigência, o motor não sabe desde quando aquele combinado vale; sem a faixa de preço,
     * o valor do cadastro passaria a responder pelo passado — que é exatamente o defeito que o
     * doc 73 consertou. O preço entra como ENTRADA, nunca como reajuste.
     */
    await db.insert(patientPaymentFormatHistory).values({
      patientId: novo.id, formato: p.formato, pacoteTipo: p.pacoteTipo, dataEfetiva: inicio,
    });
    if ((p.valorSessao ?? 0) > 0) {
      await db.insert(patientPriceHistory).values({
        patientId: novo.id, valor: (p.valorSessao ?? 0).toFixed(2), dataEfetiva: inicio,
      });
    }
  }

  // ── Agenda ──
  const sessoesExistentes = await db.select({ patientId: therapySessions.patientId, date: therapySessions.date })
    .from(therapySessions).where(eq(therapySessions.userId, userId));
  const jaTem = new Set(sessoesExistentes.map((s) => `${s.patientId}|${new Date(s.date).getTime()}`));

  for (const s of l.sessoes) {
    const patientId = acharId(s.paciente);
    if (!patientId) { pulados++; continue; }
    const chave = `${patientId}|${s.quando.getTime()}`;
    if (jaTem.has(chave)) { pulados++; continue; }
    jaTem.add(chave);
    await db.insert(therapySessions).values({
      userId, patientId, date: s.quando, duration: s.duracao,
      status: s.status as typeof therapySessions.$inferInsert["status"],
      isOnline: s.online, sessionKind: "consulta", chargeable: true,
    });
    criados.sessoes++;
  }

  // ── Pagamentos ──
  const pagExistentes = await db.select({ patientId: sessionPayments.patientId, date: sessionPayments.date, amount: sessionPayments.amount })
    .from(sessionPayments).where(eq(sessionPayments.userId, userId));
  const jaPago = new Set(pagExistentes.map((p) => `${p.patientId}|${new Date(p.date).toDateString()}|${Number(p.amount).toFixed(2)}`));

  for (const p of l.pagamentos) {
    const patientId = acharId(p.paciente);
    if (!patientId) { pulados++; continue; }
    const chave = `${patientId}|${p.quando.toDateString()}|${p.valor.toFixed(2)}`;
    if (jaPago.has(chave)) { pulados++; continue; }
    jaPago.add(chave);
    /**
     * SEM `cobrancaChave` de propósito, e SEM transação no caixa.
     *
     * Pagamento que vem de outro sistema não conhece as chaves de cobrança daqui. O motor já
     * sabe lidar com isso: pagamento sem chave quita pela ordem de vencimento, da cobrança mais
     * antiga para a mais nova (ver `casarPagamentos`). É o caminho certo e já coberto por teste.
     *
     * E não entra no Caixa: é HISTÓRICO, dinheiro que entrou antes de o Ledivan existir para
     * ela. Lançá-lo como receita de hoje inventaria um faturamento que não aconteceu agora.
     */
    await db.insert(sessionPayments).values({
      userId, patientId, amount: p.valor.toFixed(2), date: p.quando,
      method: p.forma as typeof sessionPayments.$inferInsert["method"],
      status: "paid", pagoPor: p.pagoPor,
    });
    criados.pagamentos++;
  }

  revalidatePath("/dashboard/patients");
  revalidatePath("/dashboard/agenda");
  return { ok: true, criados, pulados };
}

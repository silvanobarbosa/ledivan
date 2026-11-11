"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { patientObservacoes, patientReajusteChanges, patients } from "@/db/schema";
import { comRegistro } from "@/lib/falhas";
import { vencimentoDoPreco } from "@/lib/reajuste";

/**
 * O FINANCEIRO que se salva sozinho (doc 63): as Observações e o próximo reajuste.
 *
 * As duas áreas ganharam botão próprio — "ao clicar em um botão salvar o mesmo deve salvar apenas o
 * da área correspondente a ele" —, e por isso saíram do formulão do cadastro. Elas não dependem de
 * mais nada do formulário, então são ações diretas, com o seu próprio recorte do que pode mudar.
 */

/** O dono, sempre: nenhuma destas ações toca paciente de outra conta. */
async function donoDoPaciente(patientId: string): Promise<{ userId: string } | { error: string }> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Não autorizado." };
  const [p] = await db
    .select({ id: patients.id })
    .from(patients)
    .where(and(eq(patients.id, patientId), eq(patients.userId, userId)))
    .limit(1);
  if (!p) return { error: "Paciente não encontrado." };
  return { userId };
}

export type Observacao = { id: string; assunto: string; observacao: string; at: string };

const Texto = z.object({
  patientId: z.string().uuid(),
  assunto: z.string().trim().min(1, "Escreva o assunto.").max(120),
  observacao: z.string().trim().min(1, "Escreva a observação.").max(4000),
});

export async function listarObservacoes(patientId: string): Promise<Observacao[]> {
  const ctx = await donoDoPaciente(patientId);
  if ("error" in ctx) return [];
  const linhas = await db
    .select({
      id: patientObservacoes.id,
      assunto: patientObservacoes.assunto,
      observacao: patientObservacoes.observacao,
      at: patientObservacoes.createdAt,
    })
    .from(patientObservacoes)
    .where(and(eq(patientObservacoes.patientId, patientId), eq(patientObservacoes.userId, ctx.userId)))
    .orderBy(desc(patientObservacoes.createdAt));
  return linhas.map((l) => ({ ...l, at: (l.at as Date).toISOString() }));
}

async function criarObservacaoInterno(entrada: unknown): Promise<{ ok: boolean; error?: string }> {
  const dados = Texto.safeParse(entrada);
  if (!dados.success) return { ok: false, error: dados.error.issues[0]?.message ?? "Dados inválidos." };
  const ctx = await donoDoPaciente(dados.data.patientId);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  await db.insert(patientObservacoes).values({
    userId: ctx.userId,
    patientId: dados.data.patientId,
    assunto: dados.data.assunto,
    observacao: dados.data.observacao,
  });
  revalidatePath(`/dashboard/patients/${dados.data.patientId}/edit`);
  return { ok: true };
}

/**
 * Editar NÃO cria registro novo — e a data mostrada passa a ser a da alteração, como o documento
 * pede ("salvas sem criar um novo registro e atualizando a data e o horário originais de criação").
 */
async function editarObservacaoInterno(entrada: unknown): Promise<{ ok: boolean; error?: string }> {
  const Editar = Texto.extend({ id: z.string().uuid() });
  const dados = Editar.safeParse(entrada);
  if (!dados.success) return { ok: false, error: dados.error.issues[0]?.message ?? "Dados inválidos." };
  const ctx = await donoDoPaciente(dados.data.patientId);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  await db
    .update(patientObservacoes)
    .set({ assunto: dados.data.assunto, observacao: dados.data.observacao, createdAt: new Date() })
    .where(and(eq(patientObservacoes.id, dados.data.id), eq(patientObservacoes.userId, ctx.userId)));
  revalidatePath(`/dashboard/patients/${dados.data.patientId}/edit`);
  return { ok: true };
}

/** Apaga UMA observação — o assunto e o texto dela, e nada mais. */
async function excluirObservacaoInterno(entrada: unknown): Promise<{ ok: boolean; error?: string }> {
  const Excluir = z.object({ patientId: z.string().uuid(), id: z.string().uuid() });
  const dados = Excluir.safeParse(entrada);
  if (!dados.success) return { ok: false, error: "Dados inválidos." };
  const ctx = await donoDoPaciente(dados.data.patientId);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  await db
    .delete(patientObservacoes)
    .where(and(eq(patientObservacoes.id, dados.data.id), eq(patientObservacoes.userId, ctx.userId)));
  revalidatePath(`/dashboard/patients/${dados.data.patientId}/edit`);
  return { ok: true };
}

const Reajuste = z.object({
  patientId: z.string().uuid(),
  /** Vazio limpa o lembrete: a terapeuta deixa de ser avisada deste paciente. */
  meses: z.number().int().min(1).max(60).nullable(),
  /** "A partir da data", em YYYY-MM-DD. Vazia cai nas referências antigas (início/retorno/reajuste). */
  aPartirDe: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
});

/**
 * SALVA só o próximo reajuste (doc 63).
 *
 * O que ele faz é LEMBRETE: grava de quantos em quantos meses avisar e a partir de quando contar, e
 * recalcula a data do aviso. "O sistema não deverá realizar nenhuma alteração automática nos
 * valores das sessões, pacotes ou cobranças" — então nada além destas três colunas é tocado, e
 * nenhum reajuste já registrado muda.
 *
 * A alteração entra no histórico de reajuste junto com as demais, pela mesma tabela de mudanças.
 */
async function salvarProximoReajusteInterno(entrada: unknown): Promise<{ ok: boolean; error?: string }> {
  const dados = Reajuste.safeParse(entrada);
  if (!dados.success) return { ok: false, error: "Informe de quantos em quantos meses lembrar." };
  const { patientId, meses, aPartirDe } = dados.data;

  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { ok: false, error: "Não autorizado." };
  const [antes] = await db
    .select({
      startedAt: patients.startedAt,
      returnedAt: patients.returnedAt,
      validadePrecoMeses: patients.validadePrecoMeses,
      reajusteAPartirDe: patients.reajusteAPartirDe,
    })
    .from(patients)
    .where(and(eq(patients.id, patientId), eq(patients.userId, userId)))
    .limit(1);
  if (!antes) return { ok: false, error: "Paciente não encontrado." };

  // Meio-dia hora de parede: a data não escorrega de dia em fuso nenhum do caminho.
  const base = aPartirDe ? new Date(`${aPartirDe}T12:00:00`) : null;

  await db
    .update(patients)
    .set({
      validadePrecoMeses: meses,
      reajusteAPartirDe: base,
      priceReviewDate: vencimentoDoPreco(antes.startedAt, antes.returnedAt, meses, null, base),
    })
    .where(and(eq(patients.id, patientId), eq(patients.userId, userId)));

  // "Qualquer tipo de alteração deve ser registrado na área do histórico de reajuste": o mesmo
  // registro das demais mudanças de configuração, com a vigência da data escolhida.
  const dia = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
  const mudancas = [
    { campo: "reajuste", de: antes.validadePrecoMeses?.toString() ?? null, para: meses?.toString() ?? null },
    { campo: "reajusteAPartirDe", de: dia(antes.reajusteAPartirDe as Date | null), para: dia(base) },
  ].filter((m) => m.de !== m.para && m.de != null);

  if (mudancas.length) {
    await db.insert(patientReajusteChanges).values(
      mudancas.map((m) => ({ userId, patientId, vigencia: base ?? new Date(), ...m })),
    );
  }

  revalidatePath(`/dashboard/patients/${patientId}/edit`);
  revalidatePath(`/dashboard/patients/${patientId}`);
  revalidatePath("/dashboard");
  return { ok: true };
}

/**
 * O QUE A PESSOA LÊ QUANDO ESTA TELA QUEBRA.
 *
 * Estas quatro ações conversam por `{ ok, error }`, mas só do erro que elas PREVEEM. O imprevisto —
 * banco fora, coluna que mudou, texto fora do tamanho — sobe como exceção, derruba a tela do
 * Financeiro no aviso genérico do navegador e leva embora o que estava digitado. Era essa a tela
 * que a dona fotografou, e não havia de onde tirar o motivo.
 *
 * Embrulhadas, o imprevisto volta como mensagem no lugar, com o formulário ainda preenchido, e o
 * motivo fica gravado em `app_falhas` com o mesmo código que a mensagem mostra.
 *
 * `listarObservacoes` fica de fora: ela é leitura, já devolve lista vazia no erro, e embrulhá-la
 * mudaria o tipo do retorno sem ninguém ganhar nada.
 */
const doPatientId = (entrada: unknown): string | null => {
  const e = entrada as { patientId?: unknown } | null;
  return typeof e?.patientId === "string" ? e.patientId : null;
};

export async function criarObservacao(entrada: unknown): Promise<{ ok: boolean; error?: string }> {
  return comRegistro({ acao: "criarObservacao", alvo: doPatientId(entrada) }, () => criarObservacaoInterno(entrada));
}

export async function editarObservacao(entrada: unknown): Promise<{ ok: boolean; error?: string }> {
  return comRegistro({ acao: "editarObservacao", alvo: doPatientId(entrada) }, () => editarObservacaoInterno(entrada));
}

export async function excluirObservacao(entrada: unknown): Promise<{ ok: boolean; error?: string }> {
  return comRegistro({ acao: "excluirObservacao", alvo: doPatientId(entrada) }, () => excluirObservacaoInterno(entrada));
}

export async function salvarProximoReajuste(entrada: unknown): Promise<{ ok: boolean; error?: string }> {
  return comRegistro({ acao: "salvarProximoReajuste", alvo: doPatientId(entrada) }, () => salvarProximoReajusteInterno(entrada));
}

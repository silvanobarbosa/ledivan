/**
 * SESSÃO FORA DA SEQUÊNCIA DO PACOTE.
 *
 * Regra do dono (15/09/2026): quando entra uma sessão nova no meio de uma sequência de pacote, o
 * profissional escolhe se ela SOMA à sequência ou fica de fora. Fora, pergunta se é cobrada:
 * cobrada vira AVUL com o valor informado; não cobrada vira GRAT.
 *
 * A extra não mexe na numeração, na contagem nem no valor do pacote — isso é do motor
 * (`cobrancas.ts`), que já a deixa de fora. Este arquivo decide só O QUE GRAVAR a partir do
 * formulário, e recusa em vez de adivinhar quando falta resposta.
 *
 * Função pura.
 */

import { usaPacote } from "./reajuste";
import { parseMoedaBR } from "./money";
import { STATUS_QUE_PAUSAM } from "./therapy";

type Formato = { formato: string | null | undefined; sessionKind?: string | null };

/**
 * A pergunta só existe onde existe sequência (dono, 16/09/2026): o formato fecha por pacote, não é
 * devolutiva (que já tem a dela, "abater do pacote"), E o paciente JÁ TEM uma sequência — não faz
 * sentido perguntar "entra na sequência?" para o primeiro agendamento, quando ainda não há sequência.
 *
 * `jaTemSequencia` é opcional e vale `true` por padrão: no servidor (extraParaGravar) a decisão vem do
 * que o formulário mandou; quem sabe se o paciente já tem sessões é a tela, e é lá que o gate importa.
 */
export function perguntaSeEntraNaSequencia(o: Formato, jaTemSequencia = true): boolean {
  return jaTemSequencia && usaPacote(o.formato) && o.sessionKind !== "devolutiva";
}

export type ExtraAGravar =
  | { ok: true; extra: "avul" | "grat" | null; valorExtra: string | null }
  | { ok: false; error: string };

const COMUM = { ok: true, extra: null, valorExtra: null } as const;

export function extraParaGravar(o: Formato & {
  /** "sim" = adicionar à sequência; "nao" = registrar separada. Vazio = como sempre foi: soma. */
  naSequencia: string | null | undefined;
  cobrada?: string | null;
  valor?: string | null;
}): ExtraAGravar {
  if (!perguntaSeEntraNaSequencia(o)) return COMUM;
  if (o.naSequencia !== "nao") return COMUM;

  if (o.cobrada === "nao") return { ok: true, extra: "grat", valorExtra: null };
  if (o.cobrada !== "sim") return { ok: false, error: "Diga se a sessão fora do pacote será cobrada." };

  const valor = parseMoedaBR(o.valor);
  if (valor == null || Number(valor) <= 0) return { ok: false, error: "Informe o valor da sessão avulsa." };
  return { ok: true, extra: "avul", valorExtra: valor };
}

/**
 * Quem já tem agendamento — a resposta que alimenta o `jaTemSequencia` da agenda.
 *
 * Existe como função própria porque foi exatamente aqui que a pergunta se perdeu: a tela procurava
 * o rótulo de pacote (`pkg`), que só existe para sessão criada com `packageId` — e a agenda nunca
 * grava esse campo. Resultado: a pergunta não aparecia para ninguém, e AVUL/GRAT ficaram fora de
 * alcance. Conta QUALQUER sessão do paciente: extra, gratuita, desmarcada ou de anos atrás.
 */
export function pacientesComAgendamento(sessoes: { patientId: string }[]): Set<string> {
  return new Set(sessoes.map((s) => s.patientId));
}

/**
 * As sessões desmarcadas que ainda não foram repostas — as que podem receber uma reposição.
 *
 * Uma desmarcada só aceita uma reposição: duas sessões repondo a mesma vaga cobrariam o mês por um
 * atendimento que não houve. Por isso quem já foi reposta sai da lista.
 *
 * Recebe o histórico inteiro do paciente e devolve na ordem do calendário, da mais recente para a
 * mais antiga — é a ordem em que a terapeuta pensa nelas ao marcar a próxima.
 */
export function desmarcadasSemReposicao<T extends { id: string; date: Date | string; status: string; repoeSessaoId?: string | null }>(
  sessoes: T[],
): T[] {
  const jaRepostas = new Set(sessoes.map((s) => s.repoeSessaoId).filter((x): x is string => !!x));
  return sessoes
    .filter((s) => STATUS_QUE_PAUSAM.has(s.status) && !jaRepostas.has(s.id))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

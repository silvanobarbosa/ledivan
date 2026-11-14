/**
 * OS DOIS FILTROS DO RELATÓRIO DE PACIENTES — independentes, combináveis (doc 71, 14/11/2026).
 *
 * O relatório já recortava por SITUAÇÃO (todos/ativo/inativo). O dono pediu um segundo recorte,
 * por TIPO DE CADASTRO (todos/pacientes/supervisionados), que não substitui o primeiro: combinados,
 * respondem "supervisionados inativos" e "pacientes ativos" sem uma tela nova para cada pergunta.
 *
 * Os dois moram aqui, e não dentro do componente, porque "quem entra no relatório" é regra: o
 * prospect, por exemplo, NUNCA entra em "Todos" — ele ainda não é paciente, e contá-lo mudaria o
 * número que a terapeuta leva para a declaração.
 *
 * Funções puras.
 */

/** Situação do cadastro, como o campo `patientStatus` guarda. */
export type SituacaoDoFiltro = "todos" | "ativo" | "inativo";
/** Tipo do cadastro (doc 42): paciente comum ou supervisionado. */
export type CadastroDoFiltro = "todos" | "pacientes" | "supervisionados";

export type LinhaFiltravel = { status: string; cadastroKind?: string | null };

export const SITUACOES: { valor: SituacaoDoFiltro; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "ativo", rotulo: "Ativo" },
  { valor: "inativo", rotulo: "Inativo" },
];

export const CADASTROS: { valor: CadastroDoFiltro; rotulo: string }[] = [
  { valor: "todos", rotulo: "Todos" },
  { valor: "pacientes", rotulo: "Pacientes" },
  { valor: "supervisionados", rotulo: "Supervisionados" },
];

/** O prospect não é paciente: fica de fora mesmo de "Todos". */
export function passaNaSituacao(l: LinhaFiltravel, situacao: SituacaoDoFiltro): boolean {
  if (l.status === "prospect") return false;
  return situacao === "todos" || l.status === situacao;
}

/**
 * Cadastro sem tipo gravado é PACIENTE — é o que todos eram antes do doc 42 criar o
 * supervisionado. Sem isso, "Pacientes" esconderia justamente os cadastros mais antigos.
 */
export function passaNoCadastro(l: LinhaFiltravel, cadastro: CadastroDoFiltro): boolean {
  if (cadastro === "todos") return true;
  const ehSupervisionado = l.cadastroKind === "supervisionado";
  return cadastro === "supervisionados" ? ehSupervisionado : !ehSupervisionado;
}

/** Os dois juntos — é assim que a tela filtra. */
export function passaNoRelatorio(l: LinhaFiltravel, situacao: SituacaoDoFiltro, cadastro: CadastroDoFiltro): boolean {
  return passaNaSituacao(l, situacao) && passaNoCadastro(l, cadastro);
}

/**
 * Extrato bancário / Movimentações (doc 50), puro.
 *
 * Reúne numa lista só, em ordem cronológica, as movimentações da clínica: despesas, receitas pessoais
 * e pagamentos de pacientes/supervisionados. Cada linha tem Data, Descrição e Valor:
 * - entrada efetivada → verde; saída efetivada → vermelho; previsto/pendente → sem valor (em branco).
 * - pagamento no cartão mostra o bruto e, abaixo, o líquido.
 *
 * A montagem (ler banco, rodar o motor de cobrança) fica no server action; aqui só o tipo e a ordenação,
 * para a regra poder ser conferida sozinha.
 */

export type Movimentacao = {
  /** Data que manda na linha (YYYY-MM-DD): a efetiva quando houve, senão a prevista/vencimento. */
  data: string;
  descricao: string;
  tipo: "entrada" | "saida";
  /** false = previsto/pendente → a coluna Valor fica vazia. */
  efetivado: boolean;
  /** Valor cheio (bruto). Só aparece quando efetivado. */
  bruto: number;
  /** Líquido após a taxa (= bruto, exceto pagamento de cartão). */
  liquido: number;
  /** Mostra o líquido abaixo do bruto (só pagamento de paciente no cartão). */
  temLiquido: boolean;
};

const dia = (iso: string | null | undefined): string => String(iso ?? "").slice(0, 10);

/** Ordena as movimentações em ordem cronológica (mais antiga primeiro), como o extrato do doc. */
export function ordenarExtrato(movs: Movimentacao[]): Movimentacao[] {
  return [...movs].sort((a, b) => dia(a.data).localeCompare(dia(b.data)));
}

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
  /**
   * De que ÁREA esta linha é (doc 64): sessão, supervisão, receita pessoal ou despesa.
   *
   * É o que o gráfico abaixo do extrato compara. Sai daqui, e não de uma consulta própria, para a
   * pizza e a lista nunca discordarem: mesma fonte, mesmo recorte, mesmo número.
   */
  categoria?: "sessao" | "supervisao" | "receita" | "despesa";
  /**
   * A sessão a que esta linha pertence (doc 62). Só o par pagamento↔estorno usa: é por ele que o
   * estorno vai parar logo abaixo do pagamento que ele desfez.
   */
  par?: string | null;
};

const dia = (iso: string | null | undefined): string => String(iso ?? "").slice(0, 10);

/**
 * Ordena as movimentações em ordem cronológica (mais antiga primeiro), como o extrato do doc.
 *
 * Com uma exceção, pedida pelo dono (doc 62): **o estorno fica logo abaixo da sessão referente**.
 * Dinheiro devolvido semanas depois cai longe do pagamento na ordem do calendário, e as duas pontas
 * do mesmo fato ficam em telas diferentes — é justamente lendo as duas juntas que se entende que o
 * mês não recebeu aquele valor. A data de cada linha continua sendo a verdadeira; o que muda é só
 * onde a saída é desenhada.
 */
export function ordenarExtrato(movs: Movimentacao[]): Movimentacao[] {
  const ordenadas = [...movs].sort((a, b) => dia(a.data).localeCompare(dia(b.data)));
  const estornos = ordenadas.filter((m) => m.tipo === "saida" && m.par);
  if (!estornos.length) return ordenadas;

  const out = ordenadas.filter((m) => !(m.tipo === "saida" && m.par));
  // Do fim para o começo: inserir um estorno não desloca a posição dos que ainda faltam colocar.
  for (const e of [...estornos].reverse()) {
    const i = out.findIndex((m) => m.tipo === "entrada" && m.par === e.par);
    // Sem o pagamento correspondente na lista, a saída volta para o lugar dela no calendário.
    if (i < 0) {
      const j = out.findIndex((m) => dia(m.data).localeCompare(dia(e.data)) > 0);
      out.splice(j < 0 ? out.length : j, 0, e);
      continue;
    }
    out.splice(i + 1, 0, e);
  }
  return out;
}

/**
 * A tabela anual de valores RECEBIDOS por mês (dono, 16/09/2026) — a mesma tabela do consolidado,
 * mas dentro do paciente e filtrada por ANO em vez de por paciente.
 *
 * Só pagamento com status "paid" conta como recebido. A data é hora de parede (texto sem fuso), lida
 * como local. Função pura.
 */

export const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

import { liquidoDoPagamento, FORMAS_COM_TAXA, type VigenciaTaxa } from "./taxaCartao";
import { FORMAS_RECEBIMENTO } from "./recebidoPorForma";

export type PagamentoAnual = {
  amount: string | number;
  date: string | Date;
  status: string;
  method?: string | null;
  /** null = dinheiro de verdade; "credito" = abatimento do saldo; "pacote" = crédito de pacote. */
  kind?: string | null;
  /** Preenchido = o pagamento foi desfeito. Virando CRÉDITO, o dinheiro não voltou para ninguém. */
  estornadoEm?: string | Date | null;
  /** Doc 64: este pagamento gerou um crédito — o valor ficou com o paciente, não voltou. */
  virouCredito?: boolean;
};

const isoDe = (d: string | Date): string => (d instanceof Date ? d.toISOString() : String(d));
const CURTO = new Map(FORMAS_RECEBIMENTO.map((f) => [f.metodo, f.curto]));
const COM_TAXA = new Set(FORMAS_COM_TAXA);

/**
 * DINHEIRO DE VERDADE, E SÓ ELE (doc 62).
 *
 * A tabela somava tudo o que tivesse status "paid", e três coisas entravam sem ser receita:
 *
 * - o pagamento ESTORNADO, que voltou para o paciente;
 * - o abatimento de CRÉDITO (`kind="credito"`), que é dinheiro já contado no dia em que entrou —
 *   contá-lo de novo dobra o mês, e era o que a tela da Marcela mostrava (R$ 110 de R$ 55);
 * - o crédito de PACOTE (`kind="pacote"`), que nunca foi receita.
 *
 * Era a mesma regra que `resolverCobrancas` já aplicava no Menu Pagamentos — aqui ela faltava.
 *
 * DOC 64: "valores que são créditos devem aparecer, já que foi um valor que entrou e que em nenhum
 * momento foi estornado."
 *
 * O dinheiro que vira crédito NÃO sai do caixa — ele fica com o paciente e é usado depois. Mas o
 * app marca o pagamento de origem como estornado (é assim que ele desfaz o vínculo com a cobrança),
 * e a tabela, lendo só a marca, apagava da vista um dinheiro que entrou e ficou. Era o caso da
 * Marcela: R$ 50,00 pagos no Pix, convertidos em crédito e usados numa sessão seguinte, e o ano
 * dela não mostrava esses R$ 50,00 em lugar nenhum.
 *
 * Então: estorno QUE VIROU CRÉDITO continua contando, no dia em que o dinheiro entrou. O abatimento
 * (`kind="credito"`) segue fora — ele é o mesmo dinheiro sendo gasto, e contá-lo de novo dobraria o
 * mês, que é exatamente o defeito que o doc 62 consertou. Uma entrada, uma contagem.
 */
export function ehDinheiroRecebido(p: PagamentoAnual): boolean {
  const saiu = !!p.estornadoEm && !p.virouCredito;
  return p.status === "paid" && !saiu && p.kind !== "credito" && p.kind !== "pacote";
}

/** Os anos que têm algum pagamento recebido, do mais recente para o mais antigo. */
export function anosComPagamento(pagamentos: PagamentoAnual[]): number[] {
  const anos = new Set<number>();
  for (const p of pagamentos) {
    if (!ehDinheiroRecebido(p)) continue;
    const d = new Date(p.date);
    if (!Number.isNaN(d.getTime())) anos.add(d.getFullYear());
  }
  return [...anos].sort((a, b) => b - a);
}

/** UM recebimento, como a tabela o lê: "R$ 50,00 Pix 27/10/26". */
export type RecebimentoAnual = {
  valor: number;
  liquido: number;
  /** Rótulo curto da forma (Pix, Deb, Cre, Din…). */
  curto: string;
  /** Data do recebimento em dd/mm/aa. */
  data: string;
  /** Mostra o líquido abaixo (só as formas que descontam taxa). */
  temTaxa: boolean;
  /** Doc 64: entrou e virou crédito do paciente — a linha diz isso, para a conta fechar na leitura. */
  virouCredito?: boolean;
};

/**
 * Uma linha da tabela anual. `valor` é o total LÍQUIDO do mês — o que entrou de verdade.
 * `recebimentos` é um por pagamento, na ordem em que entraram (doc 62): o dono pediu os valores
 * reais, um a um, com a forma e o dia — e não um agregado por forma, que escondia quantos
 * pagamentos havia e quando cada um caiu.
 */
export type LinhaAnual = { mes: string; valor: number; recebimentos: RecebimentoAnual[] };

const dois = (n: number) => String(n).padStart(2, "0");
const ddmmaa = (d: Date) => `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${dois(d.getFullYear() % 100)}`;

/**
 * Os doze meses do ano com o total recebido em cada um, mais o total do ano.
 * Doc 50: o recebido entra pelo valor LÍQUIDO (desconta a taxa do cartão vigente na data).
 */
export function recebidosPorAno(
  pagamentos: PagamentoAnual[],
  ano: number,
  vigencias: VigenciaTaxa[] = [],
): { meses: LinhaAnual[]; total: number } {
  const porMes: { quando: number; r: RecebimentoAnual }[][] = Array.from({ length: 12 }, () => []);
  for (const p of pagamentos) {
    if (!ehDinheiroRecebido(p)) continue;
    const d = new Date(p.date);
    if (Number.isNaN(d.getTime()) || d.getFullYear() !== ano) continue;
    const metodo = p.method || "pix";
    const valor = Number(p.amount) || 0;
    porMes[d.getMonth()].push({
      quando: d.getTime(),
      r: {
        valor,
        liquido: liquidoDoPagamento(valor, metodo, isoDe(p.date), vigencias),
        curto: CURTO.get(metodo) ?? metodo,
        data: ddmmaa(d),
        temTaxa: COM_TAXA.has(metodo),
        ...(p.estornadoEm && p.virouCredito ? { virouCredito: true } : {}),
      },
    });
  }

  const meses = porMes.map((lista, i) => {
    const recebimentos = lista.sort((a, b) => a.quando - b.quando).map((x) => x.r);
    return {
      mes: MESES[i],
      valor: Math.round(recebimentos.reduce((a, r) => a + r.liquido, 0) * 100) / 100,
      recebimentos,
    };
  });
  const total = Math.round(meses.reduce((a, m) => a + m.valor, 0) * 100) / 100;
  return { meses, total };
}

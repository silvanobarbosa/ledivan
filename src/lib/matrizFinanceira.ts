/**
 * Matriz financeira do relatório (doc 41): paciente × mês, por situação de pagamento.
 *
 * - **Pagos**: o que foi efetivamente pago, pelo mês do PAGAMENTO (exclui crédito do saldo, que não
 *   é dinheiro novo — já entrou quando houve a sobra).
 * - **Em aberto**: o que falta de cobranças ainda NÃO vencidas, pelo mês do VENCIMENTO.
 * - **Em atraso**: o que falta de cobranças VENCIDAS e não pagas, pelo mês do vencimento.
 * - **Todos**: pagos + em aberto + em atraso. Como "pago" conta a PARTE paga e "aberto/atraso" conta
 *   só a FALTA, um mesmo valor nunca é somado duas vezes.
 *
 * Função pura: recebe os dados já lidos do motor de cobranças e devolve a tabela + os totais.
 */
import { liquidoDoPagamento, type VigenciaTaxa } from "./taxaCartao";

export type SituacaoFiltro = "todos" | "pagos" | "aberto" | "atraso";

export type PagamentoFin = { data: string | null; valor: number; credito?: boolean; metodo?: string | null };
export type CobrancaFin = {
  vencimento: string | null; // YYYY-MM-DD (hora de parede)
  situacao: "pago" | "em_aberto" | "em_atraso";
  falta: number;
  pagamentos: PagamentoFin[];
};
export type PacienteFin = { id: string; nome: string; cobrancas: CobrancaFin[] };

export type LinhaMatriz = { id: string; nome: string; meses: number[]; total: number };
export type Matriz = { linhas: LinhaMatriz[]; totalMes: number[]; totalGeral: number; anos: number[] };

const r2 = (n: number) => Math.round(n * 100) / 100;

/** { ano, mes(0-11) } de um "YYYY-MM-DD" (ou ISO); null se não der. */
function anoMes(iso: string | null | undefined): { ano: number; mes: number } | null {
  if (!iso) return null;
  const [a, m] = String(iso).split("T")[0].split("-");
  const ano = Number(a); const mes = Number(m) - 1;
  if (!Number.isFinite(ano) || !Number.isFinite(mes) || mes < 0 || mes > 11) return null;
  return { ano, mes };
}

/** Os anos que aparecem nos dados (vencimentos e pagamentos), do mais recente ao mais antigo. */
export function anosDisponiveis(pacientes: PacienteFin[]): number[] {
  const set = new Set<number>();
  for (const p of pacientes) for (const c of p.cobrancas) {
    const v = anoMes(c.vencimento); if (v) set.add(v.ano);
    for (const pg of c.pagamentos) { const d = anoMes(pg.data); if (d) set.add(d.ano); }
  }
  return [...set].sort((a, b) => b - a);
}

export function matrizFinanceira(pacientes: PacienteFin[], ano: number, filtro: SituacaoFiltro, vigencias: VigenciaTaxa[] = []): Matriz {
  const linhas: LinhaMatriz[] = [];
  for (const p of pacientes) {
    const meses = new Array(12).fill(0);
    for (const c of p.cobrancas) {
      if (filtro === "pagos" || filtro === "todos") {
        for (const pg of c.pagamentos) {
          if (pg.credito) continue; // crédito do saldo não é dinheiro novo
          const d = anoMes(pg.data);
          // Doc 50: o recebido entra pelo valor LÍQUIDO (desconta a taxa do cartão vigente na data).
          if (d && d.ano === ano) meses[d.mes] += liquidoDoPagamento(pg.valor, pg.metodo, pg.data ?? "", vigencias);
        }
      }
      if (c.falta > 0.005) {
        const v = anoMes(c.vencimento);
        if (v && v.ano === ano) {
          if ((filtro === "aberto" || filtro === "todos") && c.situacao === "em_aberto") meses[v.mes] += c.falta;
          if ((filtro === "atraso" || filtro === "todos") && c.situacao === "em_atraso") meses[v.mes] += c.falta;
        }
      }
    }
    const arred = meses.map(r2);
    const total = r2(arred.reduce((a, b) => a + b, 0));
    if (total > 0.005) linhas.push({ id: p.id, nome: p.nome, meses: arred, total });
  }
  linhas.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
  const totalMes = new Array(12).fill(0);
  for (const l of linhas) for (let m = 0; m < 12; m++) totalMes[m] += l.meses[m];
  const totalMesR = totalMes.map(r2);
  const totalGeral = r2(totalMesR.reduce((a, b) => a + b, 0));
  return { linhas, totalMes: totalMesR, totalGeral, anos: anosDisponiveis(pacientes) };
}

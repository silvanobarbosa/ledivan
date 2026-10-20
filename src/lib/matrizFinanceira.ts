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

/**
 * Situação de UMA célula da matriz, para pintar o valor (doc 51).
 *
 * Com o filtro "Todos" a célula SOMA o mês inteiro, e o mesmo cadastro pode ter cobrança paga e
 * atrasada no mesmo mês — então nem sempre existe uma situação única. A regra é **o pior manda**:
 * atraso > aberto > pago. É o que precisa chamar atenção; esconder o atraso porque havia um
 * pagamento junto seria o erro caro.
 */
export type SituacaoCelula = "pago" | "aberto" | "atraso" | "vazio";

export type LinhaMatriz = {
  id: string; nome: string; meses: number[]; total: number;
  /** Situação de cada mês, na mesma ordem de `meses`. */
  mesesSituacao: SituacaoCelula[];
  /** Situação da coluna Total da linha. */
  totalSituacao: SituacaoCelula;
};
export type Matriz = {
  linhas: LinhaMatriz[]; totalMes: number[]; totalGeral: number; anos: number[];
  /** Situação de cada coluna do rodapé "Total mensal". */
  totalMesSituacao: SituacaoCelula[];
  totalGeralSituacao: SituacaoCelula;
};

/** Marcas do que entrou numa célula. Guardamos a PRESENÇA, não o valor: a cor não é proporcional. */
type Marcas = { pago: boolean; aberto: boolean; atraso: boolean };
const marcaVazia = (): Marcas => ({ pago: false, aberto: false, atraso: false });
const somarMarcas = (a: Marcas, b: Marcas): Marcas => ({
  pago: a.pago || b.pago, aberto: a.aberto || b.aberto, atraso: a.atraso || b.atraso,
});
/** O pior manda. */
const situacaoDe = (m: Marcas): SituacaoCelula =>
  m.atraso ? "atraso" : m.aberto ? "aberto" : m.pago ? "pago" : "vazio";

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
  // Marcas por linha, guardadas junto com os valores para derivar a cor de cada célula.
  const marcasPorLinha: Marcas[][] = [];
  for (const p of pacientes) {
    const meses = new Array(12).fill(0);
    const marcas: Marcas[] = Array.from({ length: 12 }, marcaVazia);
    for (const c of p.cobrancas) {
      if (filtro === "pagos" || filtro === "todos") {
        for (const pg of c.pagamentos) {
          if (pg.credito) continue; // crédito do saldo não é dinheiro novo
          const d = anoMes(pg.data);
          // Doc 50: o recebido entra pelo valor LÍQUIDO (desconta a taxa do cartão vigente na data).
          if (d && d.ano === ano) {
            const liq = liquidoDoPagamento(pg.valor, pg.metodo, pg.data ?? "", vigencias);
            meses[d.mes] += liq;
            if (liq > 0.005) marcas[d.mes].pago = true;
          }
        }
      }
      if (c.falta > 0.005) {
        const v = anoMes(c.vencimento);
        if (v && v.ano === ano) {
          if ((filtro === "aberto" || filtro === "todos") && c.situacao === "em_aberto") { meses[v.mes] += c.falta; marcas[v.mes].aberto = true; }
          if ((filtro === "atraso" || filtro === "todos") && c.situacao === "em_atraso") { meses[v.mes] += c.falta; marcas[v.mes].atraso = true; }
        }
      }
    }
    const arred = meses.map(r2);
    const total = r2(arred.reduce((a, b) => a + b, 0));
    if (total > 0.005) {
      // A célula zerada não tem cor, mesmo que algo tenha sido marcado e depois se anulado.
      const mesesSituacao = marcas.map((m, i) => (arred[i] > 0.005 ? situacaoDe(m) : "vazio"));
      linhas.push({
        id: p.id, nome: p.nome, meses: arred, total, mesesSituacao,
        totalSituacao: situacaoDe(marcas.reduce(somarMarcas, marcaVazia())),
      });
      marcasPorLinha.push(marcas);
    }
  }
  // A ordenação precisa levar as marcas junto, senão a cor descola da linha.
  const ordem = linhas.map((l, i) => i).sort((a, b) => linhas[a].nome.localeCompare(linhas[b].nome, "pt-BR"));
  const linhasOrd = ordem.map((i) => linhas[i]);
  const marcasOrd = ordem.map((i) => marcasPorLinha[i]);
  linhas.length = 0; linhas.push(...linhasOrd);

  const totalMes = new Array(12).fill(0);
  const marcasMes: Marcas[] = Array.from({ length: 12 }, marcaVazia);
  for (let i = 0; i < linhas.length; i++) {
    for (let m = 0; m < 12; m++) {
      totalMes[m] += linhas[i].meses[m];
      marcasMes[m] = somarMarcas(marcasMes[m], marcasOrd[i][m]);
    }
  }
  const totalMesR = totalMes.map(r2);
  const totalGeral = r2(totalMesR.reduce((a, b) => a + b, 0));
  return {
    linhas, totalMes: totalMesR, totalGeral, anos: anosDisponiveis(pacientes),
    totalMesSituacao: marcasMes.map((m, i) => (totalMesR[i] > 0.005 ? situacaoDe(m) : "vazio")),
    totalGeralSituacao: totalGeral > 0.005 ? situacaoDe(marcasMes.reduce(somarMarcas, marcaVazia())) : "vazio",
  };
}

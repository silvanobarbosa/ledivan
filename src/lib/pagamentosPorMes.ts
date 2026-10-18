import { type CobrancaResolvida, diaDe } from "./vencimentosDoDia";

export type LinhaPagamento = CobrancaResolvida & { atrasado: number; emAberto: number; pago: number };
export type MesPagamentos = { mes: string; rotulo: string; esperado: number; pago: number; aberto: number; cobrancas: LinhaPagamento[] };
export type ResumoAno = { atrasados: { qtd: number; total: number }; aberto: { qtd: number; total: number }; pagos: { qtd: number; total: number } };

const MES_PT = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Quanto cada cobrança representa em atrasado / em aberto / pago (doc 46/50).
 * Atrasado e Em aberto = o que falta receber (valor BRUTO contratado, o que é devido).
 * Pago = o que de fato entrou, pelo valor LÍQUIDO (desconta a taxa do cartão) — doc 50.
 */
function decompor(c: CobrancaResolvida): { atrasado: number; emAberto: number; pago: number } {
  const pago = r2(c.recebido?.totalLiquido ?? c.valor - c.falta);
  if (c.situacao === "pago") return { atrasado: 0, emAberto: 0, pago };
  if (c.situacao === "em_atraso") return { atrasado: c.falta, emAberto: 0, pago };
  return { atrasado: 0, emAberto: c.falta, pago };
}

/**
 * Agrupa as cobranças do ANO por mês de vencimento (doc 46): colunas Atrasado/Em aberto/Pago por
 * cadastro, totais por mês e os 3 cards de resumo do ano (Atrasados/Em aberto/Pagos, qtd+valor).
 * Meses em ordem decrescente de vencimento (mais recente primeiro); dentro do mês, idem.
 */
export function pagamentosPorMes(todas: CobrancaResolvida[], ano: number): { meses: MesPagamentos[]; resumo: ResumoAno } {
  const doAno = todas.filter((c) => { const d = diaDe(c.vencimento); return d && Number(d.slice(0, 4)) === ano; });
  const porMes = new Map<string, LinhaPagamento[]>();
  const resumo: ResumoAno = { atrasados: { qtd: 0, total: 0 }, aberto: { qtd: 0, total: 0 }, pagos: { qtd: 0, total: 0 } };

  for (const c of doAno) {
    const d = decompor(c);
    const linha: LinhaPagamento = { ...c, atrasado: d.atrasado, emAberto: d.emAberto, pago: d.pago };
    const mes = (diaDe(c.vencimento) as string).slice(0, 7);
    (porMes.get(mes) ?? porMes.set(mes, []).get(mes)!).push(linha);
    if (c.situacao === "em_atraso") { resumo.atrasados.qtd++; resumo.atrasados.total = r2(resumo.atrasados.total + c.falta); }
    else if (c.situacao === "em_aberto") { resumo.aberto.qtd++; resumo.aberto.total = r2(resumo.aberto.total + c.falta); }
    // Doc 50: "Pagos" = soma dos valores LÍQUIDOS recebidos (cartão desconta a taxa), não dos brutos.
    // Conta toda cobrança que recebeu algo (inclusive parciais), não só as quitadas.
    if (d.pago > 0.005) { resumo.pagos.qtd++; resumo.pagos.total = r2(resumo.pagos.total + d.pago); }
  }

  const meses: MesPagamentos[] = [...porMes.entries()]
    .sort((a, b) => b[0].localeCompare(a[0])) // mês mais recente primeiro
    .map(([mes, cobrancas]) => {
      cobrancas.sort((a, b) => (b.vencimento ?? "").localeCompare(a.vencimento ?? ""));
      return {
        mes,
        rotulo: MES_PT[Number(mes.slice(5, 7)) - 1],
        esperado: r2(cobrancas.reduce((s, c) => s + c.valor, 0)),
        pago: r2(cobrancas.reduce((s, c) => s + c.pago, 0)),
        aberto: r2(cobrancas.reduce((s, c) => s + c.atrasado + c.emAberto, 0)),
        cobrancas,
      };
    });
  return { meses, resumo };
}

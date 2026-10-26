import { describe, expect, it } from "vitest";
import { resumoDaGeral, linhasDaGeral, type EntradaDaGeral, type PagamentoDaGeral } from "@/lib/guiaGeral";
import type { SessaoDaCobranca } from "@/lib/cobrancas";

/**
 * O PAGAMENTO ESTORNADO FICA NO HISTÓRICO, MAS NÃO QUITA NADA (doc 57).
 *
 * Apagá-lo fazia o dinheiro sumir sem rastro — a entrada desaparecia do extrato e ninguém via que
 * houve pagamento e devolução. Mantê-lo quitando seria pior: a cobrança pareceria paga com um
 * dinheiro que já voltou para o paciente.
 *
 * E há uma armadilha de CONTA no meio: mostrar a saída do estorno sem manter a entrada tiraria do
 * mês um dinheiro que já não estava lá. É a duplicidade que o documento manda evitar.
 */

const FEE = 200;
const sessao = (extra: Partial<SessaoDaCobranca> = {}): SessaoDaCobranca =>
  ({ id: "s0", date: new Date(2026, 9, 23, 11, 0), status: "realizada", ...extra }) as SessaoDaCobranca;

const pagamento = (extra: Partial<PagamentoDaGeral> = {}): PagamentoDaGeral => ({
  id: "p1", valor: FEE, data: new Date(2026, 9, 24), status: "paid",
  metodo: "pix", pagoPor: null, cobrancaChave: "sessao:s0", ...extra,
});

const entrada = (pagamentos: PagamentoDaGeral[]): EntradaDaGeral => ({
  vigencias: [],
  reserva: { formato: "sessao", pacoteTipo: null },
  precos: [{ valor: FEE, desde: new Date(2024, 0, 1) }],
  valorDaSessao: FEE,
  tamanhos: [],
  sessoes: [sessao()],
  pagamentos,
  hoje: new Date(2026, 10, 30),
});

const situacao = (e: EntradaDaGeral) => {
  const l = linhasDaGeral(e).find((x) => x.tipo === "sessao");
  return l && l.tipo === "sessao" ? l.cobranca?.situacao : undefined;
};

describe("pagamento estornado", () => {
  it("antes do estorno a cobrança está paga", () => {
    expect(situacao(entrada([pagamento()]))).toBe("pago");
  });

  it("estornado, a cobrança volta a dever — o dinheiro não está mais lá", () => {
    expect(situacao(entrada([pagamento({ estornadoEm: new Date(2026, 10, 1) })]))).toBe("em_atraso");
  });

  it("e sai do total recebido", () => {
    const comEstorno = resumoDaGeral(entrada([pagamento({ estornadoEm: new Date(2026, 10, 1) })]));
    const sem = resumoDaGeral(entrada([pagamento()]));
    expect(sem.totalPago).toBe(FEE);
    expect(comEstorno.totalPago).toBe(0);
  });

  it("não é redistribuído para outra cobrança", () => {
    /**
     * É o risco de manter a linha: perdida a cobrança dela, um pagamento sem chave é distribuído
     * por vencimento — e pagaria uma sessão que ninguém pagou.
     */
    const e = entrada([pagamento({ cobrancaChave: "chave:que:nao:existe", estornadoEm: new Date(2026, 10, 1) })]);
    expect(situacao(e)).toBe("em_atraso");
    expect(resumoDaGeral(e).totalPago).toBe(0);
  });

  it("estorno de valor zero não é estorno: não muda nada", () => {
    expect(situacao(entrada([pagamento({ estornadoEm: null })]))).toBe("pago");
  });
});

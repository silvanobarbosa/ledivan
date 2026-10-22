import { describe, expect, it } from "vitest";
import { linhasDaGeral, type EntradaDaGeral } from "@/lib/guiaGeral";
import type { SessaoDaCobranca } from "@/lib/cobrancas";

/**
 * UMA COBRANÇA SEM VALOR NÃO VENCE (dono, 22/10/2026).
 *
 * A falta de um paciente gratuito respondida com "Sim, transformar em sessão paga" (doc 54) nasce
 * como AVUL de R$ 0,00 — o valor é lançado depois, na própria sessão. Até lá, a linha aparecia com
 * o selo vermelho "Em atraso", e com falta de R$ 0,00: um alarme de dívida numa cobrança que não
 * devia nada. "R$ 0,00 para não gerar cobrança/atraso", nas palavras do dono.
 *
 * O selo de atraso quer dizer "venceu sem pagar". Sem valor, não há o que pagar, e vencer não
 * significa nada — a cobrança fica em aberto, esperando o valor.
 */

const base = (hoje: Date, valorExtra: number | null): EntradaDaGeral => ({
  vigencias: [],
  reserva: { formato: "gratuito", pacoteTipo: null },
  precos: [{ valor: 0, desde: new Date(2024, 0, 1) }],
  valorDaSessao: 0,
  tamanhos: [],
  sessoes: [
    { id: "g0", date: new Date(2024, 7, 7, 11, 0), status: "nao_realizada", faltouConta: true, valorExtra },
  ] as SessaoDaCobranca[],
  pagamentos: [],
  hoje,
});

const daSessao = (e: EntradaDaGeral) => {
  const l = linhasDaGeral(e).find((x) => x.tipo === "sessao");
  if (!l || l.tipo !== "sessao") throw new Error("sem linha de sessão");
  return l;
};

describe("cobrança sem valor não vence", () => {
  it("falta do gratuito ainda sem valor: fica em aberto, nunca em atraso", () => {
    // Dois meses depois da sessão — passou de qualquer vencimento imaginável.
    const l = daSessao(base(new Date(2024, 9, 1), null));
    expect(l.rotulo).toBe("AVUL");
    expect(l.cobranca?.situacao).toBe("em_aberto");
    expect(l.cobranca?.falta).toBe(0);
  });

  it("lançado o valor, ela volta a vencer normalmente", () => {
    const l = daSessao(base(new Date(2024, 9, 1), 150));
    expect(l.cobranca?.valor).toBe(150);
    expect(l.cobranca?.situacao).toBe("em_atraso");
    expect(l.cobranca?.falta).toBe(150);
  });

  it("antes do vencimento com valor lançado, segue em aberto", () => {
    const l = daSessao(base(new Date(2024, 7, 6), 150));
    expect(l.cobranca?.situacao).toBe("em_aberto");
  });
});

/**
 * DOIS ZEROS DIFERENTES — o teste que impede juntá-los.
 *
 * Ao corrigir o alarme falso acima eu silenciei, por engano, uma cobrança de R$ 0,00 que DEVE
 * alarmar: a do paciente cujo preço não alcança a data da sessão. Ela nasce zerada por DEFEITO, e
 * o vermelho é o que faz alguém notar — regra antiga, em `statusDoPagamento.test.ts`.
 *
 * Os dois casos têm o mesmo valor e situações opostas. Quem os separa é a ORIGEM.
 */
describe("os dois zeros não são a mesma coisa", () => {
  it("zero POR DESENHO (falta do gratuito esperando valor): não vence", () => {
    expect(daSessao(base(new Date(2024, 9, 1), null)).cobranca?.situacao).toBe("em_aberto");
  });

  it("zero POR DEFEITO (preço não alcança a data): vence, e em vermelho", () => {
    const e: EntradaDaGeral = {
      vigencias: [],
      reserva: { formato: "sessao", pacoteTipo: null },
      precos: [], // nenhuma faixa de preço alcança a sessão
      valorDaSessao: 0,
      tamanhos: [],
      sessoes: [{ id: "s0", date: new Date(2024, 7, 7, 11, 0), status: "realizada" }] as SessaoDaCobranca[],
      pagamentos: [],
      hoje: new Date(2024, 9, 1),
    };
    const l = daSessao(e);
    expect(l.cobranca?.valor).toBe(0);
    expect(l.cobranca?.situacao).toBe("em_atraso");
  });
});

import { describe, it, expect } from "vitest";
import {
  cobra, diasParaReajuste, linhasDeReajuste, referenciaDoPreco, sessoesNoMes, valorDoMes,
  vencimentoDoPreco,
} from "@/lib/reajuste";

const dia = (d: number, m: number, a: number) => new Date(a, m - 1, d, 12, 0, 0);

describe("o que cobra", () => {
  it("gratuito não cobra", () => {
    expect(cobra("gratuito")).toBe(false);
  });
  it("os outros formatos cobram", () => {
    expect(cobra("sessao")).toBe(true);
    expect(cobra("mensal")).toBe(true);
    expect(cobra("quinzenal")).toBe(true);
  });
  it("sem formato, não cobra", () => {
    expect(cobra(null)).toBe(false);
    expect(cobra("")).toBe(false);
  });
});

describe("referência do preço", () => {
  it("sem retorno, vale o início", () => {
    expect(referenciaDoPreco(dia(1, 3, 2024), null)).toEqual(dia(1, 3, 2024));
  });

  // A regra que o dono escreveu à mão: quem parou e voltou conta do retorno.
  it("com retorno, vale o retorno", () => {
    expect(referenciaDoPreco(dia(1, 3, 2024), dia(1, 8, 2026))).toEqual(dia(1, 8, 2026));
  });

  it("retorno anterior ao início não vale (dado torto não vira regra)", () => {
    expect(referenciaDoPreco(dia(1, 3, 2026), dia(1, 1, 2024))).toEqual(dia(1, 3, 2026));
  });

  it("sem nada, não há referência", () => {
    expect(referenciaDoPreco(null, null)).toBeNull();
  });
});

describe("vencimento do preço", () => {
  it("conta os meses a partir da referência", () => {
    expect(vencimentoDoPreco(dia(10, 3, 2026), null, 6)).toEqual(dia(10, 9, 2026));
  });

  it("quem voltou conta do retorno, não do início", () => {
    expect(vencimentoDoPreco(dia(1, 1, 2020), dia(1, 8, 2026), 12)).toEqual(dia(1, 8, 2027));
  });

  // 31 de janeiro + 1 mês vira 3 de março no JavaScript.
  it("mês que não tem o dia cai no último dia do mês", () => {
    const v = vencimentoDoPreco(dia(31, 1, 2026), null, 1);
    expect(v?.getMonth()).toBe(1);      // fevereiro
    expect(v?.getDate()).toBe(28);
  });

  it("sem validade ou sem referência, não há vencimento", () => {
    expect(vencimentoDoPreco(dia(1, 1, 2026), null, null)).toBeNull();
    expect(vencimentoDoPreco(dia(1, 1, 2026), null, 0)).toBeNull();
    expect(vencimentoDoPreco(null, null, 6)).toBeNull();
  });

  it("conta os dias que faltam, e diz quando já passou", () => {
    expect(diasParaReajuste(dia(20, 9, 2026), dia(10, 9, 2026))).toBe(10);
    expect(diasParaReajuste(dia(1, 9, 2026), dia(10, 9, 2026))).toBe(-9);
    expect(diasParaReajuste(null)).toBeNull();
  });
});

describe("sessões no mês", () => {
  it("pacote completo é 4, o padrão", () => {
    expect(sessoesNoMes({ pacote: "completo" })).toBe(4);
    expect(sessoesNoMes({ pacote: null })).toBe(4);
  });

  it("fragmentado: o total vem das sessões marcadas na agenda", () => {
    expect(sessoesNoMes({ pacote: "fragmentado", sessoesAgendadas: 3 })).toBe(3);
    expect(sessoesNoMes({ pacote: "fragmentado", sessoesAgendadas: 6 })).toBe(6);
  });

  it("fragmentado sem sessão marcada é zero, não 4", () => {
    expect(sessoesNoMes({ pacote: "fragmentado", sessoesAgendadas: 0 })).toBe(0);
    expect(sessoesNoMes({ pacote: "fragmentado", sessoesAgendadas: null })).toBe(0);
  });
});

describe("valor do mês", () => {
  it("gratuito é zero, sempre", () => {
    expect(valorDoMes({ formato: "gratuito", valorSessao: 200 })).toBe(0);
  });

  it("a cada sessão cobra o valor da sessão, não do mês", () => {
    expect(valorDoMes({ formato: "sessao", valorSessao: 200 })).toBe(200);
  });

  it("mensal com pacote completo são quatro sessões", () => {
    expect(valorDoMes({ formato: "mensal", valorSessao: 200, pacote: "completo" })).toBe(800);
  });

  it("mensal fragmentado calcula pelas sessões do mês", () => {
    expect(valorDoMes({ formato: "mensal", valorSessao: 200, pacote: "fragmentado", sessoesAgendadas: 3 })).toBe(600);
    expect(valorDoMes({ formato: "mensal", valorSessao: 150, pacote: "fragmentado", sessoesAgendadas: 8 })).toBe(1200);
  });

  it("valor quebrado não acumula centavo perdido", () => {
    expect(valorDoMes({ formato: "mensal", valorSessao: 166.66, pacote: "completo" })).toBe(666.64);
  });
});

describe("histórico de reajuste", () => {
  const hist = [
    { valor: "200.00", dataEfetiva: dia(1, 1, 2025) },
    { valor: "250.00", dataEfetiva: dia(1, 1, 2026) },
    { valor: "230.00", dataEfetiva: dia(1, 6, 2025) },
  ];

  it("mostra data, valor anterior e valor novo, em ordem", () => {
    const l = linhasDeReajuste(hist);
    expect(l.map((x) => [x.anterior, x.novo])).toEqual([[null, 200], [200, 230], [230, 250]]);
  });

  // A primeira linha não é reajuste: é o preço de entrada.
  it("a primeira linha não tem valor anterior", () => {
    expect(linhasDeReajuste(hist)[0].anterior).toBeNull();
  });

  it("lista vazia não quebra", () => {
    expect(linhasDeReajuste([])).toEqual([]);
  });

  it("linha com data ou valor inválido é descartada", () => {
    expect(linhasDeReajuste([{ valor: "abc", dataEfetiva: dia(1, 1, 2025) }])).toEqual([]);
    expect(linhasDeReajuste([{ valor: "200", dataEfetiva: "não é data" }])).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import { faixasDaSequencia, precoNaData, precoCobravel, valorDoPacote } from "@/lib/preco";

const d = (s: string) => new Date(s + "T00:00:00");

describe("precoNaData", () => {
  it("retorna a faixa mais recente que alcança a data", () => {
    const h = [{ valor: 100, desde: d("2024-01-01") }, { valor: 130, desde: d("2025-06-01") }];
    expect(precoNaData(h, d("2024-09-20"))).toBe(100);
    expect(precoNaData(h, d("2025-07-01"))).toBe(130);
  });
});

describe("precoCobravel (Gratuito→Mensal: preço 0 não zera cobrança)", () => {
  it("entrada 0 do período gratuito cai no valor do cadastro", () => {
    const h = [{ valor: 0, desde: d("2024-01-01") }, { valor: 130, desde: d("2026-09-01") }];
    expect(precoCobravel(h, d("2024-09-20"), 130)).toBe(130);
  });
  it("preço real (>0) prevalece sobre a reserva", () => {
    expect(precoCobravel([{ valor: 130, desde: d("2024-01-01") }], d("2024-09-20"), 200)).toBe(130);
  });
  it("sem faixa que alcance a data, usa a reserva", () => {
    expect(precoCobravel([{ valor: 130, desde: d("2026-09-01") }], d("2024-09-20"), 130)).toBe(130);
  });
  it("sem mensalidade (reserva 0), fica 0", () => {
    expect(precoCobravel([{ valor: 0, desde: d("2024-01-01") }], d("2024-09-20"), 0)).toBe(0);
  });
});

describe("doc 69 — o preço novo sobre o pacote vigente ou sobre o próximo", () => {
  const ANTIGO = { valor: 100, desde: d("2026-01-01") };
  // O pacote de quatro: 03, 10, 17 e 24 de novembro. O aviso do aumento é dia 12.
  const DATAS = [d("2026-11-03"), d("2026-11-10"), d("2026-11-17"), d("2026-11-24")];
  const pacote = (historico: Parameters<typeof valorDoPacote>[0]) =>
    valorDoPacote(historico, { inicio: DATAS[0], competencia: DATAS[3], datas: DATAS, total: 4 });

  it("sem reajuste nenhum, o pacote é o tamanho contratado × o preço — como sempre foi", () => {
    expect(pacote([ANTIGO])).toBe(400);
  });

  it("VIGENTE: o pacote em andamento sai com DOIS valores", () => {
    const novo = { valor: 120, desde: d("2026-11-12"), aplicaEm: "vigente" as const };
    expect(pacote([ANTIGO, novo])).toBe(100 + 100 + 120 + 120);
  });

  it("PRÓXIMO A INICIAR: o pacote em andamento fica INTEIRO no valor antigo", () => {
    const novo = { valor: 120, desde: d("2026-11-12"), aplicaEm: "proximo_pacote" as const };
    expect(pacote([ANTIGO, novo])).toBe(400);
  });

  it("PRÓXIMO A INICIAR: e o pacote seguinte sai inteiro no valor novo", () => {
    const novo = { valor: 120, desde: d("2026-11-12"), aplicaEm: "proximo_pacote" as const };
    const seguintes = [d("2026-12-01"), d("2026-12-08"), d("2026-12-15"), d("2026-12-22")];
    expect(valorDoPacote([ANTIGO, novo], { inicio: seguintes[0], competencia: seguintes[3], datas: seguintes, total: 4 })).toBe(480);
  });

  it("a faixa que começa NO DIA da primeira sessão vale para esse pacote — ele é o próximo a iniciar", () => {
    const novo = { valor: 120, desde: d("2026-11-03"), aplicaEm: "proximo_pacote" as const };
    expect(pacote([ANTIGO, novo])).toBe(480);
  });

  it("faixa SEM resposta gravada não parte pacote nenhum — o passado não se repreciﬁca", () => {
    // Medido na base real: partir todas as faixas antigas mexia em 216 cobranças, muitas já pagas.
    // Sem resposta, vale a conta de sempre: preço da competência × tamanho contratado.
    const novo = { valor: 120, desde: d("2026-11-12") };
    expect(pacote([ANTIGO, novo])).toBe(480);
  });

  it("posição ainda sem sessão entra pelo preço da competência — o contratado continua sendo cobrado", () => {
    const duas = DATAS.slice(0, 2);
    expect(valorDoPacote([ANTIGO], { inicio: duas[0], competencia: duas[1], datas: duas, total: 4 })).toBe(400);
  });

  it("faixasDaSequencia tira só a faixa de 'próximo pacote' nascida DEPOIS do começo", () => {
    const depois = { valor: 120, desde: d("2026-11-12"), aplicaEm: "proximo_pacote" as const };
    const antes = { valor: 110, desde: d("2026-10-01"), aplicaEm: "proximo_pacote" as const };
    expect(faixasDaSequencia([ANTIGO, antes, depois], DATAS[0])).toEqual([ANTIGO, antes]);
  });
});

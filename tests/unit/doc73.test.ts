import { describe, it, expect } from "vitest";
import { precoNaData, precoNoMes, precoCobravel } from "@/lib/preco";
import { inicioDoPacoteIntocado, vigenciaDoProximoPacote, semStatusLancado } from "@/lib/pacoteIntocado";
import { perguntaDaFalta } from "@/lib/perguntaFalta";

/**
 * Doc 73 — o reajuste que mexia no passado, e os textos que o dono reescreveu.
 *
 * O caso medido na base real (paciente Roberta, usuária ana): faixas de R$ 50 (19/02/2025) e
 * R$ 65 (01/08/2025, "próximo pacote a iniciar"). O pacote de JANEIRO/2025 — fechado e pago por
 * R$ 200 — aparecia valendo R$ 260, porque é anterior à primeira faixa e o motor caía no valor do
 * CADASTRO, que é o preço de hoje. A dívida de R$ 60 inventada ali rolou por oito pacotes.
 */

describe("doc 73 — o cadastro não responde pelo passado", () => {
  const historico = [
    { valor: 50, desde: new Date(2025, 1, 19) },
    { valor: 65, desde: new Date(2025, 7, 1), aplicaEm: "proximo_pacote" },
  ];

  it("data anterior à primeira faixa vale o preço de ENTRADA, não o do cadastro", () => {
    // Era isto que reprecificava janeiro a cada reajuste: a reserva (cadastro) é o preço de hoje.
    expect(precoCobravel(historico, new Date(2025, 0, 16), 65)).toBe(50);
    expect(precoNaData(historico, new Date(2025, 0, 16), 65)).toBe(50);
  });

  it("e o pacote de janeiro volta a valer o que foi pago", () => {
    const quatroSessoes = 4 * precoCobravel(historico, new Date(2025, 0, 16), 65);
    expect(quatroSessoes).toBe(200);
  });

  it("as datas que as faixas alcançam não mudam nada", () => {
    expect(precoCobravel(historico, new Date(2025, 3, 10), 65)).toBe(50);
    expect(precoCobravel(historico, new Date(2025, 8, 10), 65)).toBe(65);
    expect(precoNoMes(historico, 2025, 2)).toBe(50);
  });

  it("sem histórico nenhum, o cadastro continua sendo a única resposta", () => {
    expect(precoCobravel([], new Date(2025, 0, 16), 65)).toBe(65);
    expect(precoNaData([], new Date(2025, 0, 16))).toBe(0);
  });

  it("faixa de valor zero (resíduo do gratuito) não vira preço de entrada", () => {
    const comZero = [{ valor: 0, desde: new Date(2025, 0, 1) }, { valor: 80, desde: new Date(2025, 5, 1) }];
    expect(precoCobravel(comZero, new Date(2024, 11, 1), 120)).toBe(80);
  });
});

describe("doc 73 — 'próximo pacote a iniciar' é o pacote SEM status lançado", () => {
  const s = (dia: number, mes: number, sequencia: number, status?: string) =>
    ({ date: new Date(2026, mes, dia), status, sequencia });

  it("acha o primeiro pacote em que nada foi lançado", () => {
    const sessoes = [
      s(5, 0, 0, "realizada"), s(12, 0, 0, "realizada"),
      s(19, 0, 1, "realizada"), s(26, 0, 1, "cancelada"),
      s(2, 1, 2), s(9, 1, 2),
      s(16, 1, 3), s(23, 1, 3),
    ];
    expect(inicioDoPacoteIntocado(sessoes)).toEqual(new Date(2026, 1, 2));
  });

  it("UM status lançado basta para o pacote não ser mais 'o próximo a iniciar'", () => {
    const sessoes = [s(2, 1, 2), s(9, 1, 2, "nao_realizada"), s(16, 1, 3), s(23, 1, 3)];
    expect(inicioDoPacoteIntocado(sessoes)).toEqual(new Date(2026, 1, 16));
  });

  it("todos os pacotes já tocados: não há próximo conhecido", () => {
    expect(inicioDoPacoteIntocado([s(5, 0, 0, "realizada"), s(12, 0, 0, "atestado")])).toBeNull();
    expect(inicioDoPacoteIntocado([])).toBeNull();
  });

  it("'agendada' e status vazio são a mesma coisa: nada lançado", () => {
    expect(semStatusLancado("agendada")).toBe(true);
    expect(semStatusLancado(null)).toBe(true);
    expect(semStatusLancado("")).toBe(true);
    expect(semStatusLancado("realizada")).toBe(false);
    expect(semStatusLancado("prof_desmarcou")).toBe(false);
  });

  it("a vigência é EMPURRADA para o começo do pacote intocado", () => {
    // O caso do dono: ele digita 01/08, retroativo, e o pacote intocado começa em fevereiro/2026.
    const sessoes = [s(5, 0, 0, "realizada"), s(2, 1, 1), s(9, 1, 1)];
    expect(vigenciaDoProximoPacote(new Date(2025, 7, 1), sessoes)).toEqual(new Date(2026, 1, 2));
  });

  it("mas NUNCA para trás — data mais à frente é escolha dela, e vale", () => {
    const sessoes = [s(5, 0, 0, "realizada"), s(2, 1, 1), s(9, 1, 1)];
    const láNaFrente = new Date(2026, 5, 1);
    expect(vigenciaDoProximoPacote(láNaFrente, sessoes)).toEqual(láNaFrente);
  });

  it("sem pacote intocado, fica a data escolhida", () => {
    const escolhida = new Date(2026, 0, 20);
    expect(vigenciaDoProximoPacote(escolhida, [s(5, 0, 0, "realizada")])).toEqual(escolhida);
  });
});

describe("doc 73 — os textos que o dono reescreveu", () => {
  it("a pergunta do pacote explica em uma linha", () => {
    const p = perguntaDaFalta("pacote");
    expect(p.explicaSim).toBe("A sessão será abatida do pacote, avançando a numeração.");
    expect(p.explicaNao).toBe("A sessão não será abatida, mantendo a numeração para o próximo atendimento.");
  });
});

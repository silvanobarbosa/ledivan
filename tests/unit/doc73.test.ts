import { describe, it, expect } from "vitest";
import { precoNaData, precoNoMes, precoCobravel } from "@/lib/preco";
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

// O bloco que ficava aqui — "'próximo pacote a iniciar' é o pacote SEM status lançado" — foi
// SUPERADO pelo doc 74, que é explícito: o pacote é identificado pela DATA DE INÍCIO e o que o
// desqualifica é PAGAMENTO lançado, não status. A regra nova e os exemplos do documento estão
// em `doc74.test.ts`.

describe("doc 73 — os textos que o dono reescreveu", () => {
  it("a pergunta do pacote explica em uma linha", () => {
    const p = perguntaDaFalta("pacote");
    expect(p.explicaSim).toBe("A sessão será abatida do pacote, avançando a numeração.");
    expect(p.explicaNao).toBe("A sessão não será abatida, mantendo a numeração para o próximo atendimento.");
  });
});

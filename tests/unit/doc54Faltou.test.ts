import { describe, expect, it } from "vitest";
import { cobrancasDoPaciente, rotulosDasSessoes, type SessaoDaCobranca } from "@/lib/cobrancas";

/**
 * FALTOU DENTRO DE UM PACOTE (doc 54, item 01).
 *
 * O documento usa um caso só, e os dois ramos dele: pacote mensal completo de 4 sessões, vencimento
 * dia 10, sessões semanais a partir de 07/08/2024. A primeira é marcada "Faltou", e a resposta à
 * pergunta "Abater esta sessão do pacote?" muda o que a tabela da guia Geral deve mostrar.
 *
 * O que o doc 54 ACRESCENTA ao doc 45: o "Não" PAUSA a sequência, em vez de tirar a sessão do
 * pacote. São coisas diferentes e a diferença aparece na tela — tirada do pacote, a sessão perde o
 * número (fica "—") e some do grupo de pagamento a que pertencia; pausada, ela mantém o número onde
 * a falta aconteceu e a próxima sessão assume aquela posição. É a mesma regra de Desmarcou,
 * Atestado e Prof. desm., que é como o dono pediu.
 *
 * "Nos formatos Mensal e Quinzenal, as sessões com status Faltou devem sempre permanecer no
 * conjunto de sessões daquele pagamento, independentemente de o usuário selecionar Sim ou Não."
 */

const FEE = 200;
const QUARTAS = [
  new Date(2024, 7, 7, 11, 0),
  new Date(2024, 7, 14, 11, 0),
  new Date(2024, 7, 21, 11, 0),
  new Date(2024, 7, 28, 11, 0),
  new Date(2024, 8, 4, 11, 0),
  new Date(2024, 8, 11, 11, 0),
  new Date(2024, 8, 18, 11, 0),
];

const mensal = (faltouConta: boolean | null) => {
  const sessoes: SessaoDaCobranca[] = QUARTAS.map((date, i) => ({
    id: `s${i}`,
    date,
    status: i === 0 ? "nao_realizada" : "realizada",
    ...(i === 0 ? { faltouConta } : {}),
  }));
  return {
    vigencias: [],
    reserva: { formato: "mensal", pacoteTipo: "completo" },
    precos: [{ valor: FEE, desde: new Date(2024, 0, 1) }],
    valorDaSessao: FEE,
    tamanhos: [],
    tamanhoPacote: 4,
    vezesPorSemana: 1,
    diaPagamento: 10,
    sessoes,
  };
};

const rotulos = (faltouConta: boolean | null) => {
  const e = mensal(faltouConta);
  const m = rotulosDasSessoes(e);
  return e.sessoes.map((s) => m.get(s.id));
};

describe('doc 54 — "Abater esta sessão do pacote?"', () => {
  it('Sim: a falta ocupa a posição e a sequência segue inteira (1/4..4/4, depois 1/4...)', () => {
    expect(rotulos(true)).toEqual(["1/4", "2/4", "3/4", "4/4", "1/4", "2/4", "3/4"]);
  });

  it("Sim é o padrão do registro antigo (faltouConta nulo se comporta como Sim)", () => {
    expect(rotulos(null)).toEqual(["1/4", "2/4", "3/4", "4/4", "1/4", "2/4", "3/4"]);
  });

  it('Não: a falta PAUSA — mantém o número dela e a próxima assume a posição (1/4, 1/4, 2/4...)', () => {
    expect(rotulos(false)).toEqual(["1/4", "1/4", "2/4", "3/4", "4/4", "1/4", "2/4"]);
  });

  it('Não: a sessão continua no grupo de pagamento do pacote dela', () => {
    const e = mensal(false);
    const primeira = cobrancasDoPaciente(e)[0];
    expect(primeira.ids).toContain("s0");
  });

  it("Não: pausar não encarece o pacote — ele cobra as 4 sessões contratadas", () => {
    expect(cobrancasDoPaciente(mensal(false))[0].valor).toBe(FEE * 4);
    expect(cobrancasDoPaciente(mensal(true))[0].valor).toBe(FEE * 4);
  });
});

/**
 * GRATUITO: "Transformar esta sessão em uma sessão paga?" (doc 54, item 01).
 *
 * O "Não" já funcionava — a sessão segue gratuita. O "Sim" não fazia nada: num paciente gratuito
 * nenhuma cobrança é gerada, e a resposta ficava guardada sem efeito na tela.
 *
 * O que o Sim faz agora é o que o doc descreve: a sessão é lançada como AVULSA, com cobrança
 * própria, e o valor é preenchido nela. Isso é DERIVADO da resposta, não gravado como "extra" no
 * banco — é o que torna a escolha desfazível remarcando "Faltou", como a janela promete.
 */
const gratuito = (faltouConta: boolean | null) => ({
  vigencias: [],
  reserva: { formato: "gratuito", pacoteTipo: null },
  precos: [{ valor: FEE, desde: new Date(2024, 0, 1) }],
  valorDaSessao: FEE,
  tamanhos: [],
  sessoes: [
    { id: "g0", date: QUARTAS[0], status: "nao_realizada", faltouConta, valorExtra: null },
    { id: "g1", date: QUARTAS[1], status: "realizada" },
  ] as SessaoDaCobranca[],
});

describe('doc 54 — "Transformar esta sessão em uma sessão paga?"', () => {
  it("Sim: a falta vira uma cobrança avulsa própria, e só ela", () => {
    const c = cobrancasDoPaciente(gratuito(true));
    expect(c.map((x) => [x.tipo, x.ids])).toEqual([["extra", ["g0"]]]);
  });

  it("Sim: nasce em zero — o valor é preenchido na própria sessão", () => {
    expect(cobrancasDoPaciente(gratuito(true))[0].valor).toBe(0);
  });

  it("Sim: o valor informado na sessão é o que ela cobra", () => {
    const e = gratuito(true);
    e.sessoes[0] = { ...e.sessoes[0], valorExtra: 150 };
    expect(cobrancasDoPaciente(e)[0].valor).toBe(150);
  });

  it("Sim: a sessão passa a ser AVUL na tabela", () => {
    expect(rotulosDasSessoes(gratuito(true)).get("g0")).toBe("AVUL");
  });

  it("Não: segue gratuita, sem cobrança nenhuma", () => {
    expect(cobrancasDoPaciente(gratuito(false))).toEqual([]);
  });

  it("registro antigo (sem resposta) não vira cobrança retroativa", () => {
    // Só o Sim EXPLÍCITO cobra. Um nulo herdado nunca criou dívida e não é agora que vai criar.
    expect(cobrancasDoPaciente(gratuito(null))).toEqual([]);
  });
});

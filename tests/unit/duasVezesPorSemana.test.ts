import { describe, expect, it } from "vitest";
import { posicoesDaSequencia, todasAsSequencias } from "@/lib/sequenciaPacote";
import { cobrancasDoPaciente, type SessaoDaCobranca } from "@/lib/cobrancas";
import { sessoesCobradas } from "@/lib/fechamento";

/**
 * 2x POR SEMANA — um pacote de oito, não dois de quatro (documento de 17/09).
 *
 * O que a terapeuta relatou: paciente atendida duas vezes por semana recebe DOIS pagamentos no mês,
 * de quatro sessões cada. Ela quer um só, de oito, e a marcação indo de 1/8 a 8/8.
 *
 * **A causa não é "são dois agendamentos".** A numeração não sabe de que repetição cada sessão veio:
 * varre todas as sessões do paciente por data e fecha a sequência quando a posição passa do total.
 * O total era `TAMANHO_PADRAO = 4`, fixo para todo pacote que não fosse fracionado — com uma
 * repetição só daria no mesmo. O que faltava era o pacote saber quantas sessões ele tem.
 *
 * É o cadastro que diz: `timesPerPeriod` (1x ou 2x por semana), que já existia e que nenhuma tela
 * preenchia.
 */

let n = 0;
const sessao = (dia: number, mes = 8): SessaoDaCobranca => ({
  id: `s${++n}`,
  date: new Date(2026, mes, dia, 11, 0, 0),
  status: "realizada",
});

/**
 * As oito do print do documento: terças e quintas de 12/11 a 08/12 — o pacote atravessa a virada
 * do mês, como qualquer pacote fechado.
 */
const oitoDoPacote = () =>
  [12, 17, 19, 24, 26, 1, 3, 8].map((d, i) => sessao(d, i < 5 ? 10 : 11));

const rotulos = (sessoes: SessaoDaCobranca[], vezesPorSemana: number) => {
  const p = posicoesDaSequencia(
    sessoes.map((s) => ({ id: s.id, date: s.date, status: s.status })),
    { pacoteTipo: "completo", vezesPorSemana },
  );
  return sessoes.map((s) => {
    const x = p.get(s.id)!;
    return `${x.index}/${x.total}`;
  });
};

describe("a numeração", () => {
  it("1x por semana continua 1/4 a 4/4", () => {
    const ss = [sessao(5), sessao(12), sessao(19), sessao(26)];
    expect(rotulos(ss, 1)).toEqual(["1/4", "2/4", "3/4", "4/4"]);
  });

  it("2x por semana vai de 1/8 a 8/8", () => {
    const ss = oitoDoPacote();
    expect(rotulos(ss, 2)).toEqual(["1/8", "2/8", "3/8", "4/8", "5/8", "6/8", "7/8", "8/8"]);
  });

  it("sem dizer nada, vale uma vez por semana — o combinado de sempre", () => {
    const ss = [sessao(5), sessao(12), sessao(19), sessao(26)];
    const p = posicoesDaSequencia(
      ss.map((s) => ({ id: s.id, date: s.date, status: s.status })),
      { pacoteTipo: "completo" },
    );
    expect(p.get(ss[3].id)!.total).toBe(4);
  });
});

describe("a cobrança", () => {
  const cobrar = (sessoes: SessaoDaCobranca[], vezesPorSemana: number) =>
    cobrancasDoPaciente({
      vigencias: [],
      reserva: { formato: "mensal", pacoteTipo: "completo" },
      precos: [{ valor: 90, desde: new Date(2026, 0, 1) }],
      valorDaSessao: 90,
      tamanhos: [],
      vezesPorSemana,
      sessoes,
    });

  it("oito sessões viram UMA cobrança de oito, e não duas de quatro", () => {
    const c = cobrar(oitoDoPacote(), 2);
    expect(c.map((x) => [x.sessoes, x.valor])).toEqual([[8, 720]]);
  });

  it("o mesmo caso a 1x por semana continua sendo dois pacotes de quatro", () => {
    // O comportamento de hoje, que segue certo para quem é atendido uma vez por semana.
    const c = cobrar(oitoDoPacote(), 1);
    expect(c.map((x) => [x.sessoes, x.valor])).toEqual([
      [4, 360],
      [4, 360],
    ]);
  });

  it("com sete sessões ainda é UM pacote de oito — não quebra em quatro + três", () => {
    // A cobrança do pacote em aberto existe desde sempre (é a linha que a guia Geral mostra antes
    // das sessões); quem segura até fechar é a Fechamento. O que importa aqui é que continua uma só.
    const c = cobrar(oitoDoPacote().slice(0, 7), 2);
    expect(c).toHaveLength(1);
    expect(c[0].sessoes).toBe(8);
  });

  it("a Fechamento só cobra o pacote de oito quando ele fecha", () => {
    const mes = { ano: 2026, mes: 11 }; // fecha em 08/12
    const sete = oitoDoPacote().slice(0, 7).map((s) => ({ id: s.id, date: s.date, status: s.status }));
    const oito = oitoDoPacote().map((s) => ({ id: s.id, date: s.date, status: s.status }));
    const conta = (ss: typeof sete) =>
      sessoesCobradas({ formato: "mensal", pacoteTipo: "completo", sessoes: ss, vezesPorSemana: 2, ...mes });
    expect(conta(sete)).toBe(0);
    expect(conta(oito)).toBe(8);
  });

  it("a sequência inteira é uma só, com as oito", () => {
    const ss = oitoDoPacote();
    const seqs = todasAsSequencias(
      ss.map((s) => ({ id: s.id, date: s.date, status: s.status })),
      { pacoteTipo: "completo", vezesPorSemana: 2 },
    );
    expect(seqs).toHaveLength(1);
    expect(seqs[0].total).toBe(8);
    expect(seqs[0].ids).toHaveLength(8);
  });
});

describe("o fracionado não muda", () => {
  it("havendo tamanho contratado, ele continua mandando", () => {
    const ss = [sessao(5), sessao(12), sessao(19)];
    const p = posicoesDaSequencia(
      ss.map((s) => ({ id: s.id, date: s.date, status: s.status })),
      { pacoteTipo: "fragmentado", tamanhos: [3], vezesPorSemana: 2 },
    );
    expect(p.get(ss[0].id)!.total).toBe(3);
  });
});

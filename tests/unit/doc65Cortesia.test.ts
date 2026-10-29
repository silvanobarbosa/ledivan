import { describe, expect, it } from "vitest";
import { cobrancasDoPaciente, type SessaoDaCobranca } from "@/lib/cobrancas";

/**
 * CORTESIA FORA DO PACOTE (doc 65).
 *
 * O dono pediu o checkbox "Este atendimento será uma cortesia" em todo agendamento — avulso,
 * mensal, quinzenal e gratuito. Oferecer a escolha só vale se ela fizer efeito: aqui está o efeito
 * nos dois caminhos que ficavam de fora.
 *
 * No pacote o efeito já era testado em doc54Cortesia (a sessão pausa a sequência e não é cobrada).
 */

const FEE = 100;
const base = (formato: string, sessoes: SessaoDaCobranca[]) => ({
  vigencias: [],
  reserva: { formato, pacoteTipo: "completo" },
  precos: [{ valor: FEE, desde: new Date(2026, 0, 1) }],
  valorDaSessao: FEE,
  tamanhos: [],
  tamanhoPacote: 4,
  vezesPorSemana: 1,
  diaPagamento: 10,
  diaPagamento2: 20,
  sessoes,
});

const total = (e: Parameters<typeof cobrancasDoPaciente>[0]) =>
  cobrancasDoPaciente(e).reduce((s, c) => s + c.valor, 0);

describe("doc 65 — a cortesia na cobrança a cada sessão", () => {
  const duas = (cortesiaNaSegunda: boolean): SessaoDaCobranca[] => [
    { id: "a", date: new Date(2026, 2, 3, 10, 0), status: "realizada" },
    { id: "b", date: new Date(2026, 2, 10, 10, 0), status: "realizada", ...(cortesiaNaSegunda ? { cortesia: true } : {}) },
  ];

  it("sem cortesia, as duas sessões são cobradas", () => {
    expect(total(base("sessao", duas(false)))).toBe(200);
  });

  it("com cortesia, a sessão marcada não gera cobrança", () => {
    const cobrancas = cobrancasDoPaciente(base("sessao", duas(true)));
    expect(cobrancas.map((c) => c.chave)).toEqual(["sessao:a"]);
    expect(total(base("sessao", duas(true)))).toBe(100);
  });
});

describe("doc 65 — a cortesia na sessão EXTRA", () => {
  const extra = (cortesia: boolean): SessaoDaCobranca[] => [
    { id: "x", date: new Date(2026, 2, 17, 10, 0), status: "realizada", extra: "avul", valorExtra: 80, ...(cortesia ? { cortesia: true } : {}) },
  ];

  it("a extra avulsa é cobrada pelo valor dela", () => {
    expect(total(base("mensal", extra(false)))).toBe(80);
  });

  /**
   * Era o achado do SuperQA de 22/10 ao contrário: o checkbox aparecia na extra e não fazia nada,
   * e a correção da época foi escondê-lo. Com o doc 65 a pergunta volta, então o efeito tem de
   * existir — senão a terapeuta marca cortesia e a cobrança continua lá, em silêncio.
   */
  it("marcada como cortesia, a extra não gera cobrança nenhuma", () => {
    expect(cobrancasDoPaciente(base("mensal", extra(true)))).toEqual([]);
  });
});

describe("doc 65 — a cortesia protege o paciente GRATUITO da falta cobrada", () => {
  const faltou = (cortesia: boolean): SessaoDaCobranca[] => [
    {
      id: "g", date: new Date(2026, 2, 24, 10, 0), status: "nao_realizada", faltouConta: true,
      valorExtra: 70, ...(cortesia ? { cortesia: true } : {}),
    },
  ];

  it("gratuito + Faltou + 'sim, cobrar' vira uma cobrança avulsa", () => {
    expect(total(base("gratuito", faltou(false)))).toBe(70);
  });

  it("a mesma falta, marcada como cortesia, não cobra", () => {
    expect(cobrancasDoPaciente(base("gratuito", faltou(true)))).toEqual([]);
  });
});

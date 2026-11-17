import { describe, expect, it } from "vitest";
import { foraDaContagemDoPacote, pacoteAceitaEscolha } from "@/lib/desmarcadaDoPacote";
import { posicoesDaSequencia } from "@/lib/sequenciaPacote";
import { cobrancasDoPaciente, type SessaoDaCobranca } from "@/lib/cobrancas";

/**
 * O "DESMARCOU" QUE ENCOLHE O PACOTE FRACIONADO (documento do dono, 17/11/2026).
 *
 * Os dois exemplos do documento estão aqui ao pé da letra: o pacote de quatro com a primeira
 * desmarcada vira 1/3 · 1/3 · 2/3 · 3/3, e o de três vira 1/2 · 1/2 · 2/2. O agendamento
 * desmarcado continua na agenda e continua exibindo onde parou; o que ele perde é a VAGA.
 */

const FEE = 130;
const precos = [{ valor: FEE, desde: new Date(2026, 0, 1) }];

let n = 0;
const sessao = (dia: number, extra: Partial<SessaoDaCobranca> = {}): SessaoDaCobranca => ({
  id: `s${++n}`,
  date: new Date(2026, 10, dia, 14, 0, 0),
  status: "realizada",
  ...extra,
});

const base = (extra: Record<string, unknown> = {}) => ({
  vigencias: [],
  reserva: { formato: "mensal", pacoteTipo: "fragmentado" },
  precos,
  valorDaSessao: FEE,
  tamanhos: [],
  diaPagamento: 5,
  diaPagamento2: 20,
  ...extra,
});

/**
 * As sessões de UM mês, a primeira desmarcada e fora da contagem.
 *
 * Todas em novembro de propósito: no fracionado quem agrupa é o mês do calendário, e uma data que
 * escorregasse para dezembro viraria outra sequência — o teste mediria outra coisa.
 */
const DIAS = [3, 5, 10, 12, 17, 19];
const mes = (quantas: number) => [
  sessao(DIAS[0], { status: "cancelada", desmarcouCobra: false }),
  ...DIAS.slice(1, quantas).map((d) => sessao(d)),
];

const naSequencia = (ss: SessaoDaCobranca[]) =>
  posicoesDaSequencia(
    ss.map((s) => ({
      id: s.id,
      date: s.date,
      status: s.status,
      foraDaCobranca: foraDaContagemDoPacote(s),
    })),
    { pacoteTipo: "fragmentado" },
  );

const texto = (ss: SessaoDaCobranca[]) => {
  const p = naSequencia(ss);
  return ss.map((s) => `${p.get(s.id)!.index}/${p.get(s.id)!.total}`);
};

describe("quem entra na regra", () => {
  it("mensal e quinzenal fracionados entram", () => {
    expect(pacoteAceitaEscolha("mensal", "fragmentado")).toBe(true);
    expect(pacoteAceitaEscolha("quinzenal", "fragmentado")).toBe(true);
  });

  it("pacote COMPLETO não entra: o tamanho dele é contratado, não deduzido do mês", () => {
    expect(pacoteAceitaEscolha("mensal", "completo")).toBe(false);
    expect(pacoteAceitaEscolha("quinzenal", "completo")).toBe(false);
  });

  it("avulso, gratuito e 'primeira do pacote' não entram", () => {
    expect(pacoteAceitaEscolha("sessao", "fragmentado")).toBe(false);
    expect(pacoteAceitaEscolha("gratuito", null)).toBe(false);
    expect(pacoteAceitaEscolha("primeira_pacote", "fragmentado")).toBe(false);
  });
});

describe("a resposta gravada", () => {
  it("só o 'Não' explícito tira a sessão da contagem", () => {
    expect(foraDaContagemDoPacote({ status: "cancelada", desmarcouCobra: false })).toBe(true);
    expect(foraDaContagemDoPacote({ status: "realocada", desmarcouCobra: false })).toBe(true);
  });

  it("o 'Sim' e o legado (null) continuam contando", () => {
    expect(foraDaContagemDoPacote({ status: "cancelada", desmarcouCobra: true })).toBe(false);
    expect(foraDaContagemDoPacote({ status: "cancelada", desmarcouCobra: null })).toBe(false);
    expect(foraDaContagemDoPacote({ status: "cancelada" })).toBe(false);
  });

  it("a marca só vale na DESMARCADA — faltou e atestado não encolhem pacote", () => {
    expect(foraDaContagemDoPacote({ status: "nao_realizada", desmarcouCobra: false })).toBe(false);
    expect(foraDaContagemDoPacote({ status: "atestado", desmarcouCobra: false })).toBe(false);
    expect(foraDaContagemDoPacote({ status: "prof_desmarcou", desmarcouCobra: false })).toBe(false);
  });
});

describe("a numeração, nos exemplos do documento", () => {
  it("exemplo 1 — pacote de 4 com a primeira desmarcada vira 1/3, 1/3, 2/3, 3/3", () => {
    expect(texto(mes(4))).toEqual(["1/3", "1/3", "2/3", "3/3"]);
  });

  it("exemplo 2 — pacote de 3 vira 1/2, 1/2, 2/2", () => {
    expect(texto(mes(3))).toEqual(["1/2", "1/2", "2/2"]);
  });

  it("serve para qualquer quantidade: o de 6 vira 5", () => {
    expect(texto(mes(6))).toEqual(["1/5", "1/5", "2/5", "3/5", "4/5", "5/5"]);
  });

  it("sem a resposta, nada muda: a desmarcada segura a posição e o mês continua /4", () => {
    const ss = [sessao(3, { status: "cancelada" }), sessao(10), sessao(17), sessao(24)];
    expect(texto(ss)).toEqual(["1/4", "1/4", "2/4", "3/4"]);
  });

  it("duas tiradas no mesmo mês encolhem duas vezes", () => {
    const ss = [
      sessao(3, { status: "cancelada", desmarcouCobra: false }),
      sessao(10, { status: "cancelada", desmarcouCobra: false }),
      sessao(17),
      sessao(24),
    ];
    expect(texto(ss)).toEqual(["1/2", "1/2", "1/2", "2/2"]);
  });
});

describe("o valor na guia Geral acompanha", () => {
  it("o pacote de 4 com uma tirada cobra 3 sessões", () => {
    const c = cobrancasDoPaciente({ ...base(), sessoes: mes(4) });
    const pacote = c.filter((x) => x.tipo === "pacote");
    expect(pacote).toHaveLength(1);
    expect(pacote[0].sessoes).toBe(3);
    expect(pacote[0].valor).toBe(3 * FEE);
  });

  it("sem a resposta, o mesmo pacote cobra 4 — o legado não encolhe sozinho", () => {
    const ss = [sessao(3, { status: "cancelada" }), sessao(10), sessao(17), sessao(24)];
    const pacote = cobrancasDoPaciente({ ...base(), sessoes: ss }).filter((x) => x.tipo === "pacote");
    expect(pacote[0].sessoes).toBe(4);
    expect(pacote[0].valor).toBe(4 * FEE);
  });

  it("no pacote COMPLETO a resposta não encolhe nada", () => {
    const ss = [
      sessao(3, { status: "cancelada", desmarcouCobra: false }),
      sessao(10),
      sessao(17),
      sessao(24),
      sessao(31),
    ];
    const c = cobrancasDoPaciente({
      ...base({ reserva: { formato: "mensal", pacoteTipo: "completo" }, tamanhoPacote: 4 }),
      sessoes: ss,
    });
    const pacote = c.filter((x) => x.tipo === "pacote");
    expect(pacote[0].sessoes).toBe(4);
    expect(pacote[0].valor).toBe(4 * FEE);
  });

  it("o QUINZENAL fracionado também encolhe — as duas metades somam 3 sessões", () => {
    const c = cobrancasDoPaciente({
      ...base({ reserva: { formato: "quinzenal", pacoteTipo: "fragmentado" } }),
      sessoes: mes(4),
    });
    const quinzenas = c.filter((x) => x.tipo === "quinzena");
    expect(quinzenas.length).toBeGreaterThan(0);
    expect(quinzenas.reduce((t, q) => t + q.sessoes, 0)).toBe(3);
    expect(quinzenas.reduce((t, q) => t + q.valor, 0)).toBe(3 * FEE);
  });

  it("a sessão tirada continua no pacote (o `ids` do doc 54), só não conta", () => {
    const ss = mes(4);
    const pacote = cobrancasDoPaciente({ ...base(), sessoes: ss }).filter((x) => x.tipo === "pacote");
    expect(pacote[0].ids).toContain(ss[0].id);
    expect(pacote[0].ids).toHaveLength(4);
  });
});

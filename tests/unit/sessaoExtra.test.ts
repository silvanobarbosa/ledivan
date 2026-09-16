import { describe, expect, it } from "vitest";
import { extraParaGravar, perguntaSeEntraNaSequencia } from "@/lib/sessaoExtra";
import { rotulosDasSessoes } from "@/lib/cobrancas";

/**
 * SESSÃO FORA DA SEQUÊNCIA DO PACOTE — regra do dono (15/09/2026):
 *
 * > Caso seja inserida uma nova sessão entre os atendimentos de uma sequência de pacote já
 * > existente, o sistema deverá permitir que o profissional escolha se deseja adicionar essa sessão
 * > à sequência ou registrá-la separadamente. [...] Se for cobrada: solicitar o valor e identificar
 * > a sessão como AVUL. Se não for cobrada: identificar a sessão como GRAT.
 */

describe("quando a pergunta aparece", () => {
  it("formato com pacote, consulta: pergunta", () => {
    expect(perguntaSeEntraNaSequencia({ formato: "mensal", sessionKind: "consulta" })).toBe(true);
    expect(perguntaSeEntraNaSequencia({ formato: "quinzenal" })).toBe(true);
    expect(perguntaSeEntraNaSequencia({ formato: "primeira_pacote" })).toBe(true);
    expect(perguntaSeEntraNaSequencia({ formato: "ultima_pacote" })).toBe(true);
  });

  it("formato sem pacote não tem sequência para perguntar", () => {
    expect(perguntaSeEntraNaSequencia({ formato: "sessao" })).toBe(false);
    expect(perguntaSeEntraNaSequencia({ formato: "gratuito" })).toBe(false);
    expect(perguntaSeEntraNaSequencia({ formato: null })).toBe(false);
  });

  it("devolutiva já tem a pergunta dela (abater do pacote)", () => {
    expect(perguntaSeEntraNaSequencia({ formato: "mensal", sessionKind: "devolutiva" })).toBe(false);
  });

  it("só pergunta se o paciente JÁ TEM sequência (dono, 16/09/2026)", () => {
    // Sem sequência ainda (primeiro agendamento) não pergunta; com sequência, pergunta.
    expect(perguntaSeEntraNaSequencia({ formato: "mensal", sessionKind: "consulta" }, false)).toBe(false);
    expect(perguntaSeEntraNaSequencia({ formato: "mensal", sessionKind: "consulta" }, true)).toBe(true);
  });
});

describe("o que gravar", () => {
  const pacote = { formato: "mensal", sessionKind: "consulta" };

  it("adicionar à sequência: sessão comum, nada de extra", () => {
    expect(extraParaGravar({ ...pacote, naSequencia: "sim" })).toEqual({ ok: true, extra: null, valorExtra: null });
  });

  it("sem resposta: comportamento de sempre (entra na sequência)", () => {
    expect(extraParaGravar({ ...pacote, naSequencia: null })).toEqual({ ok: true, extra: null, valorExtra: null });
  });

  it("fora da sequência e cobrada: AVUL com o valor informado", () => {
    expect(extraParaGravar({ ...pacote, naSequencia: "nao", cobrada: "sim", valor: "150" })).toEqual({ ok: true, extra: "avul", valorExtra: "150.00" });
  });

  it("valor com vírgula decimal é lido como o brasileiro escreve", () => {
    expect(extraParaGravar({ ...pacote, naSequencia: "nao", cobrada: "sim", valor: "1.130,50" })).toEqual({ ok: true, extra: "avul", valorExtra: "1130.50" });
    expect(extraParaGravar({ ...pacote, naSequencia: "nao", cobrada: "sim", valor: "R$ 130,5" })).toEqual({ ok: true, extra: "avul", valorExtra: "130.50" });
  });

  it("cobrada sem valor, valor zero ou lixo: recusa — o dono mandou pedir o valor", () => {
    for (const valor of ["", "0", "0,00", "abc", "-10", null]) {
      const r = extraParaGravar({ ...pacote, naSequencia: "nao", cobrada: "sim", valor });
      expect(r.ok).toBe(false);
    }
  });

  it("fora da sequência e não cobrada: GRAT, sem valor", () => {
    expect(extraParaGravar({ ...pacote, naSequencia: "nao", cobrada: "nao", valor: "150" })).toEqual({ ok: true, extra: "grat", valorExtra: null });
  });

  it("fora da sequência sem dizer se cobra: recusa em vez de adivinhar", () => {
    expect(extraParaGravar({ ...pacote, naSequencia: "nao", cobrada: null }).ok).toBe(false);
  });

  it("formato sem pacote ignora o que vier do formulário", () => {
    expect(extraParaGravar({ formato: "sessao", naSequencia: "nao", cobrada: "sim", valor: "150" })).toEqual({ ok: true, extra: null, valorExtra: null });
  });

  it("devolutiva ignora o que vier do formulário", () => {
    expect(extraParaGravar({ formato: "mensal", sessionKind: "devolutiva", naSequencia: "nao", cobrada: "nao" })).toEqual({ ok: true, extra: null, valorExtra: null });
  });
});

describe("a sessão extra no meio da sequência não mexe na sequência", () => {
  // Mensal completo, R$ 130. Quatro terças; uma extra na quinta entre a 2ª e a 3ª.
  const base = (extra: "avul" | "grat" | null) =>
    rotulosDasSessoes({
      vigencias: [{ formato: "mensal", pacoteTipo: "completo", desde: new Date(2026, 0, 1) }],
      reserva: { formato: "mensal", pacoteTipo: "completo" },
      precos: [{ valor: 130, desde: new Date(2026, 0, 1) }],
      sessoes: [
        { id: "a", date: new Date(2026, 8, 1, 9), status: "realizada" },
        { id: "b", date: new Date(2026, 8, 8, 9), status: "realizada" },
        { id: "x", date: new Date(2026, 8, 10, 9), status: "realizada", extra: extra ?? undefined, valorExtra: extra === "avul" ? 150 : undefined },
        { id: "c", date: new Date(2026, 8, 15, 9), status: "realizada" },
        { id: "d", date: new Date(2026, 8, 22, 9), status: "realizada" },
      ],
    });

  it("AVUL: a numeração continua 1/4..4/4 e a extra leva o rótulo dela", () => {
    const r = base("avul");
    expect([r.get("a"), r.get("b"), r.get("c"), r.get("d")]).toEqual(["1/4", "2/4", "3/4", "4/4"]);
    expect(r.get("x")).toBe("AVUL");
  });

  it("GRAT: idem", () => {
    const r = base("grat");
    expect([r.get("a"), r.get("b"), r.get("c"), r.get("d")]).toEqual(["1/4", "2/4", "3/4", "4/4"]);
    expect(r.get("x")).toBe("GRAT");
  });

  it("controle: adicionada à sequência, ela empurra a numeração (é o que a escolha evita)", () => {
    const r = base(null);
    expect(r.get("x")).toBe("3/4");
    expect(r.get("d")).not.toBe("4/4");
  });
});

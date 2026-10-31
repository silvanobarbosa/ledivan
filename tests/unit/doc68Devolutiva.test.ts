import { describe, it, expect } from "vitest";
import { devolutivaParaGravar, OPCOES_DA_DEVOLUTIVA, OPCOES_DO_ABATIMENTO, TITULO_DA_DEVOLUTIVA } from "@/lib/quadroDaDevolutiva";
import { entraNaSequenciaDoPacote, pacientesComSequencia } from "@/lib/sessaoExtra";
import { QUEIXAS } from "@/lib/queixas";

describe("doc 68 — o quadro da devolutiva", () => {
  it("fala a língua do documento", () => {
    expect(TITULO_DA_DEVOLUTIVA).toBe("Como esta devolutiva deve ser considerada?");
    expect(OPCOES_DA_DEVOLUTIVA.map((o) => o.rotulo)).toEqual(["Cobrar devolutiva", "Não cobrar devolutiva"]);
    expect(OPCOES_DO_ABATIMENTO.map((o) => o.rotulo)).toEqual([
      "Abater da sequência do pacote",
      "Não abater da sequência do pacote",
    ]);
  });

  it("cobrada vira EXTRA AVULSA com o valor informado — é o que a faz vencer na hora dela", () => {
    expect(devolutivaParaGravar({ escolha: "cobrar", valor: "150,00" })).toEqual({
      ok: true, chargeable: true, abaterDoPacote: false, extra: "avul", valorExtra: "150.00",
    });
  });

  it("cobrada sem valor é recusada — nada nasce no escuro", () => {
    for (const valor of [null, "", "0", "0,00"]) {
      const r = devolutivaParaGravar({ escolha: "cobrar", valor });
      expect(r.ok, String(valor)).toBe(false);
      if (!r.ok) expect(r.error).toMatch(/valor da devolutiva/i);
    }
  });

  it("não cobrada + abater: ocupa posição e a sequência avança", () => {
    expect(devolutivaParaGravar({ escolha: "nao_cobrar", abatimento: "abater" })).toEqual({
      ok: true, chargeable: false, abaterDoPacote: true, extra: null, valorExtra: null,
    });
  });

  it("não cobrada + não abater: a sequência NÃO avança", () => {
    const r = devolutivaParaGravar({ escolha: "nao_cobrar", abatimento: "nao_abater" });
    expect(r).toEqual({ ok: true, chargeable: false, abaterDoPacote: false, extra: null, valorExtra: null });
    // E o motor concorda: ela não pertence à sequência.
    if (r.ok) expect(entraNaSequenciaDoPacote({ sessionKind: "devolutiva", abaterDoPacote: r.abaterDoPacote })).toBe(false);
  });

  it("não cobrada sem dizer se abate é recusada", () => {
    const r = devolutivaParaGravar({ escolha: "nao_cobrar" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/abate/i);
  });

  it("sem escolha nenhuma, recusa", () => {
    const r = devolutivaParaGravar({ escolha: null });
    expect(r.ok).toBe(false);
  });

  it("a cobrada abate? NÃO — cobrar e ocupar posição eram o enigma das duas caixinhas", () => {
    const r = devolutivaParaGravar({ escolha: "cobrar", valor: "80,00" });
    if (r.ok) expect(r.abaterDoPacote).toBe(false);
  });
});

describe("doc 68 — 'Iniciar' até a sequência existir de verdade", () => {
  const base = { patientId: "p1" };

  it("uma consulta comum inicia a sequência", () => {
    expect(pacientesComSequencia([{ ...base }]).has("p1")).toBe(true);
  });

  it("extra avulsa ou gratuita NÃO inicia sequência nenhuma", () => {
    expect(pacientesComSequencia([{ ...base, extra: "avul" }]).has("p1")).toBe(false);
    expect(pacientesComSequencia([{ ...base, extra: "grat" }]).has("p1")).toBe(false);
  });

  it("devolutiva só inicia se ABATER do pacote", () => {
    expect(pacientesComSequencia([{ ...base, sessionKind: "devolutiva", abaterDoPacote: false }]).has("p1")).toBe(false);
    expect(pacientesComSequencia([{ ...base, sessionKind: "devolutiva", abaterDoPacote: true }]).has("p1")).toBe(true);
  });

  it("basta UMA sessão da sequência no meio das outras", () => {
    const com = pacientesComSequencia([
      { patientId: "p1", extra: "avul" },
      { patientId: "p1" },
      { patientId: "p2", extra: "grat" },
    ]);
    expect(com.has("p1")).toBe(true);
    expect(com.has("p2")).toBe(false);
  });
});

describe("doc 68 — a queixa principal em ordem alfabética", () => {
  const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  it("está ordenada, e o acento não joga 'Dependência' para o fim", () => {
    const ordenada = [...QUEIXAS].sort((a, b) => semAcento(a).localeCompare(semAcento(b)));
    expect([...QUEIXAS]).toEqual(ordenada);
  });

  it("não perdeu nem ganhou item no caminho", () => {
    expect(new Set(QUEIXAS).size).toBe(QUEIXAS.length);
    for (const q of ["Ansiedade", "Autoconhecimento", "Depressão", "Sono"]) {
      expect(QUEIXAS).toContain(q);
    }
  });
});

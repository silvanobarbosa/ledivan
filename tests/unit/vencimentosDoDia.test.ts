import { describe, it, expect } from "vitest";
import { vencimentosNoDia, mensagemAvulsa, mensagemPacote, diaDe, type CobrancaResolvida } from "@/lib/vencimentosDoDia";

function cob(over: Partial<CobrancaResolvida> & { chave: string }): CobrancaResolvida {
  return { cadastroId: "p", nome: "Fulano", telefone: "11999990000", grupo: "avulsa", vencimento: "2026-10-20T14:00:00", situacao: "em_aberto", valor: 100, falta: 100, enviosTotal: 0, ...over };
}

describe("vencimentosNoDia (doc 44)", () => {
  it("filtra pelo dia do vencimento e separa avulsas de pacotes", () => {
    const todas = [
      cob({ chave: "a", nome: "Ana", vencimento: "2026-10-20T08:00:00", horarioAtraso: "2026-10-20T08:00:00" }),
      cob({ chave: "b", nome: "Bia", grupo: "pacote", vencimento: "2026-10-20T00:00:00" }),
      cob({ chave: "c", nome: "Cao", vencimento: "2026-10-21T08:00:00" }), // outro dia
    ];
    const { avulsas, pacotes } = vencimentosNoDia(todas, "2026-10-20");
    expect(avulsas.map((x) => x.chave)).toEqual(["a"]);
    expect(pacotes.map((x) => x.chave)).toEqual(["b"]);
  });

  it("ordena avulsas pelo horário de atraso (menor primeiro)", () => {
    const todas = [
      cob({ chave: "tarde", horarioAtraso: "2026-10-20T18:00:00" }),
      cob({ chave: "cedo", horarioAtraso: "2026-10-20T07:00:00" }),
      cob({ chave: "meio", horarioAtraso: "2026-10-20T12:00:00" }),
    ];
    expect(vencimentosNoDia(todas, "2026-10-20").avulsas.map((x) => x.chave)).toEqual(["cedo", "meio", "tarde"]);
  });

  it("ignora cobrança sem vencimento", () => {
    expect(vencimentosNoDia([cob({ chave: "x", vencimento: null })], "2026-10-20").avulsas).toHaveLength(0);
  });

  it("diaDe extrai o dia sem fuso", () => {
    expect(diaDe("2026-10-20T23:30:00")).toBe("2026-10-20");
    expect(diaDe(null)).toBeNull();
  });
});

describe("mensagens de cobrança (doc 44)", () => {
  it("avulsa cita data da sessão e valor", () => {
    const m = mensagemAvulsa({ dataSessao: "2026-10-20T15:00:00", valor: 120 });
    expect(m).toContain("sessão de hoje (20/10/2026)");
    expect(m).toContain("R$ 120,00");
  });
  it("pacote dia específico, primeira e última têm textos próprios", () => {
    expect(mensagemPacote({ tipoVencimento: "dia", vencimento: "2026-10-20T00:00:00", primeiraSessao: "2026-10-01T00:00:00", valor: 400 }))
      .toContain("o vencimento do seu pacote é hoje (20/10/2026)");
    expect(mensagemPacote({ tipoVencimento: "primeira", primeiraSessao: "2026-10-20T00:00:00", valor: 400 }))
      .toContain("hoje (20/10/2026) inicia seu novo pacote");
    expect(mensagemPacote({ tipoVencimento: "ultima", ultimaSessao: "2026-10-20T00:00:00", valor: 400 }))
      .toContain("hoje (20/10/2026) finaliza seu pacote");
  });
});

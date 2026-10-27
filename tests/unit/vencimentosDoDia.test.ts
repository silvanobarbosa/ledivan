import { describe, it, expect } from "vitest";
import { vencimentosNoDia, mensagemAvulsa, mensagemPacote, mensagemDeCobranca, listaDeSessoes, diaDe, type CobrancaResolvida } from "@/lib/vencimentosDoDia";

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

describe("mensagemDeCobranca — atraso (doc 45)", () => {
  it("pacote em atraso usa o valor em aberto (saldo)", () => {
    const m = mensagemDeCobranca(cob({ chave: "p", grupo: "pacote", situacao: "em_atraso", vencimento: "2026-10-10T00:00:00", valor: 400, falta: 150 }));
    expect(m).toContain("o vencimento do seu pacote foi no dia 10/10/2026");
    expect(m).toContain("R$ 150,00");
    expect(m).not.toContain("R$ 400,00");
  });
  it("avulsa em atraso — Presente x Faltou", () => {
    const presente = mensagemDeCobranca(cob({ chave: "a", situacao: "em_atraso", dataSessao: "2026-10-10T15:00:00", vencimento: "2026-10-10T13:00:00", valor: 100, falta: 100, statusSessao: "realizada" }));
    expect(presente).toContain("sua sessão, realizada no dia 10/10/2026");
    const faltou = mensagemDeCobranca(cob({ chave: "a", situacao: "em_atraso", dataSessao: "2026-10-10T15:00:00", vencimento: "2026-10-10T13:00:00", valor: 100, falta: 100, statusSessao: "nao_realizada" }));
    expect(faltou).toContain("na qual não houve comparecimento");
  });
  it("em aberto (não atrasado) usa a mensagem normal", () => {
    expect(mensagemDeCobranca(cob({ chave: "a", situacao: "em_aberto", dataSessao: "2026-10-20T15:00:00", valor: 100, falta: 100 })))
      .toContain("sessão de hoje");
  });
});

describe("doc 63: a mensagem do pacote diz QUAIS sessões ela cobra", () => {
  const datas = ["2026-11-09T16:00:00", "2026-11-16T16:00:00", "2026-11-23T16:00:00", "2026-11-30T16:00:00"];

  it("lista os dias das sessões, com 'e' antes do último", () => {
    expect(listaDeSessoes(datas)).toBe("09/11/26, 16/11/26, 23/11/26 e 30/11/26");
  });

  it("uma sessão só não ganha vírgula nem 'e'", () => {
    expect(listaDeSessoes(["2026-11-09T16:00:00"])).toBe("09/11/26");
  });

  it("sem datas, a lista é vazia", () => {
    expect(listaDeSessoes([])).toBe("");
    expect(listaDeSessoes(null)).toBe("");
  });

  it("a cobrança de vencimento em dia fixo traz as sessões no texto", () => {
    const texto = mensagemPacote({ tipoVencimento: "dia", vencimento: "2026-11-01T00:00:00", primeiraSessao: datas[0], datasDasSessoes: datas, valor: 240 });
    expect(texto).toContain("o vencimento do seu pacote é hoje (01/11/2026)");
    expect(texto).toContain("referente às sessões de 09/11/26, 16/11/26, 23/11/26 e 30/11/26");
    expect(texto).toContain("no valor de R$ 240,00");
    // O texto velho, que dizia só o início, não pode sobrar junto.
    expect(texto).not.toContain("data de início");
  });

  it("sem saber as sessões, volta a falar do início do pacote", () => {
    const texto = mensagemPacote({ tipoVencimento: "dia", vencimento: "2026-11-01T00:00:00", primeiraSessao: datas[0], datasDasSessoes: [], valor: 240 });
    expect(texto).toContain("referente ao pacote com a data de início em (09/11/2026)");
  });
});

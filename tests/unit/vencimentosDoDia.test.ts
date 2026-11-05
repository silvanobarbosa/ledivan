import { describe, it, expect } from "vitest";
import { vencimentosNoDia, mensagemAvulsa, mensagemPacote, mensagemDeCobranca, diaDe, type CobrancaResolvida } from "@/lib/vencimentosDoDia";

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

/**
 * Doc 60: avulsa e pacote passaram a dizer as MESMAS palavras. O que muda é de onde sai o
 * vencimento — e é isso que estes casos prendem, porque é o que um refactor erra calado.
 */
describe("mensagens de cobrança em dia (doc 44, redação do doc 60)", () => {
  it("avulsa: o vencimento é o da cobrança, e a sessão do dia entra na lista", () => {
    const m = mensagemAvulsa({ nome: "Ana Souza", dataSessao: "2026-10-20T15:00:00", vencimento: "2026-10-22T00:00:00", valor: 120 });
    expect(m).toContain("Olá Ana!");
    expect(m).toContain("pagamento de R$ 120,00, com vencimento em 22/10/26");
    expect(m).toContain("Referente às sessões dos dias: 20/10/26.");
  });

  it("avulsa sem vencimento próprio usa o dia da sessão", () => {
    expect(mensagemAvulsa({ dataSessao: "2026-10-20T15:00:00", valor: 120 })).toContain("com vencimento em 20/10/26");
  });

  it("pacote: dia fixo, primeira e última mudam a DATA, não o texto", () => {
    expect(mensagemPacote({ tipoVencimento: "dia", vencimento: "2026-10-20T00:00:00", primeiraSessao: "2026-10-01T00:00:00", valor: 400 }))
      .toContain("com vencimento em 20/10/26");
    expect(mensagemPacote({ tipoVencimento: "primeira", primeiraSessao: "2026-10-20T00:00:00", valor: 400 }))
      .toContain("com vencimento em 20/10/26");
    expect(mensagemPacote({ tipoVencimento: "ultima", ultimaSessao: "2026-10-20T00:00:00", valor: 400 }))
      .toContain("com vencimento em 20/10/26");
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
      .toContain("Referente às sessões dos dias: 20/10/26.");
  });
});

describe("doc 63: a mensagem do pacote diz QUAIS sessões ela cobra", () => {
  const datas = ["2026-11-09T16:00:00", "2026-11-16T16:00:00", "2026-11-23T16:00:00", "2026-11-30T16:00:00"];

  it("a cobrança de vencimento em dia fixo traz as sessões no texto", () => {
    const texto = mensagemPacote({ nome: "Joyce", tipoVencimento: "dia", vencimento: "2026-11-01T00:00:00", primeiraSessao: datas[0], datasDasSessoes: datas, valor: 240 });
    expect(texto).toContain("com vencimento em 01/11/26");
    expect(texto).toContain("Referente às sessões dos dias: 09/11/26, 16/11/26, 23/11/26 e 30/11/26.");
    expect(texto).toContain("R$ 240,00");
    // O texto velho, que dizia só o início, não pode sobrar junto.
    expect(texto).not.toContain("data de início");
  });

  /**
   * Doc 60: sem saber as sessões, a linha some — ela NÃO volta a falar da data de início, que
   * era a saída do doc 63. Dizer "referente ao pacote com início em" ao lado de um vencimento
   * é dar duas datas para quem só precisa de uma.
   */
  it("sem saber as sessões, a linha some e o resto da mensagem fica inteiro", () => {
    const texto = mensagemPacote({ tipoVencimento: "dia", vencimento: "2026-11-01T00:00:00", primeiraSessao: datas[0], datasDasSessoes: [], valor: 240 });
    expect(texto).not.toContain("Referente às sessões");
    expect(texto).not.toContain("data de início");
    expect(texto).toContain("com vencimento em 01/11/26");
    expect(texto).toContain("Qualquer dúvida, estou à disposição!");
  });
});

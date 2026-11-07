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
 * Doc 61: quatro situações, quatro redações — e UMA fonte para a data.
 *
 * O que estes casos prendem é justamente o que um refactor erra calado: o caso escolhe o TEXTO,
 * mas a data sai sempre do campo do Financeiro, inclusive quando ele foi corrigido à mão.
 */
describe("mensagens de cobrança em dia (doc 44, redações do doc 61)", () => {
  const hoje = "2026-10-15";

  it("avulsa sem prazo combinado: fala da sessão do dia, não de vencimento", () => {
    const m = mensagemAvulsa({ nome: "Ana Souza", dataSessao: "2026-10-20T15:00:00", vencimento: "2026-10-20T13:00:00", valor: 120, hoje });
    expect(m).toContain("Olá Ana!");
    expect(m).toContain("você tem sessão hoje, 20/10/26, e que o pagamento avulso, no valor de R$ 120,00, ainda está pendente.");
    // Doc 19 tirou a linha "Conforme combinado, o pagamento deverá ser realizado até o momento
    // da sessão.": sem prazo combinado não há prazo a lembrar.
    expect(m).not.toContain("até o momento da sessão");
    expect(m).not.toContain("horas antes");
  });

  it("avulsa com prazo de pagamento: avisa o prazo e que o horário pode ser cedido", () => {
    const m = mensagemAvulsa({ nome: "Ana", dataSessao: "2026-10-20T15:00:00", valor: 120, horasAntes: 24, hoje });
    // Doc 19: "até às 24 horas" virou "até 24 horas" — o número é antecedência, não hora do relógio.
    expect(m).toContain("até 24 horas antes da sessão");
    expect(m).not.toContain("até às");
    expect(m).toContain("o horário poderá ser cedido a outro paciente");
    expect(m).not.toContain("até o momento da sessão.");
  });

  it("pacote no dia fixo: o lembrete padrão, com a data do Financeiro", () => {
    expect(mensagemPacote({ tipoVencimento: "dia", vencimento: "2026-10-20T00:00:00", valor: 400, hoje }))
      .toContain("pagamento de R$ 400,00, com vencimento em 20/10/26");
  });

  it("pacote que vence na PRIMEIRA sessão, ainda por vir: anuncia o pacote novo", () => {
    const m = mensagemPacote({ tipoVencimento: "primeira", vencimento: "2026-10-20T00:00:00", valor: 400, hoje });
    expect(m).toContain("estaremos iniciando um novo pacote de sessões.");
    expect(m).toContain("o pagamento deverá ser realizado até a primeira sessão, em 20/10/26.");
  });

  it("pacote que vence na ÚLTIMA sessão, ainda por vir: anuncia o fechamento", () => {
    const m = mensagemPacote({ tipoVencimento: "ultima", vencimento: "2026-10-20T00:00:00", valor: 400, hoje });
    expect(m).toContain("estamos finalizando o pacote de sessões.");
    expect(m).toContain("o pagamento deverá ser realizado no final deste pacote, em 20/10/26.");
  });

  it("primeira/última que JÁ PASSOU volta ao lembrete padrão — anunciar início é mentira", () => {
    for (const tipo of ["primeira", "ultima"] as const) {
      const m = mensagemPacote({ tipoVencimento: tipo, vencimento: "2026-10-10T00:00:00", valor: 400, hoje });
      expect(m).toContain("Passando para lembrar do pagamento de R$ 400,00, com vencimento em 10/10/26.");
      expect(m).not.toContain("novo pacote");
      expect(m).not.toContain("finalizando");
    }
  });

  /**
   * O defeito que o doc 61 veio corrigir: a mensagem recalculava a data a partir da primeira ou da
   * última sessão e ignorava o campo do Financeiro — justamente o que a terapeuta tinha corrigido.
   */
  it("a data vem do campo do Financeiro, mesmo quando ele foi editado à mão", () => {
    const m = mensagemPacote({
      tipoVencimento: "primeira",
      vencimento: "2026-10-25T00:00:00",
      datasDasSessoes: ["2026-10-20T15:00:00", "2026-10-27T15:00:00"],
      valor: 400,
      hoje,
    });
    expect(m).toContain("em 25/10/26.");
    expect(m).not.toContain("em 20/10/26.");
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
  it("em aberto (não atrasado) usa a mensagem em dia — no avulso, a do doc 61", () => {
    expect(mensagemDeCobranca(cob({ chave: "a", situacao: "em_aberto", dataSessao: "2026-10-20T15:00:00", valor: 100, falta: 100 })))
      .toContain("você tem sessão hoje, 20/10/26");
  });
});

describe("doc 63: a mensagem do pacote diz QUAIS sessões ela cobra", () => {
  const datas = ["2026-11-09T16:00:00", "2026-11-16T16:00:00", "2026-11-23T16:00:00", "2026-11-30T16:00:00"];

  it("a cobrança de vencimento em dia fixo traz as sessões no texto", () => {
    const texto = mensagemPacote({ nome: "Joyce", tipoVencimento: "dia", vencimento: "2026-11-01T00:00:00", datasDasSessoes: datas, valor: 240 });
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

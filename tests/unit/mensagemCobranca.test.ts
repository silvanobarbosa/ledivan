import { describe, it, expect } from "vitest";
import {
  listaDeSessoes,
  montarMensagemCobranca,
  MODELO_PADRAO_COBRANCA,
  MODELO_AVULSO,
  MODELO_AVULSO_PRAZO,
  MODELO_PRIMEIRA_SESSAO,
  MODELO_ULTIMA_SESSAO,
  modeloPadraoDa,
} from "@/lib/mensagemCobranca";

describe("mensagem de cobrança personalizável", () => {
  const dados = { nome: "Maria Silva", valor: "R$ 520,00", vencimento: "2026-10-05T00:00:00" };

  it("troca as variáveis pelo dado, usando o primeiro nome", () => {
    const msg = montarMensagemCobranca("Oi {nome}, são {valor} até {vencimento}.", dados);
    expect(msg).toBe("Oi Maria, são R$ 520,00 até 05/10/26.");
  });

  it("modelo vazio cai no padrão, também substituído", () => {
    const msg = montarMensagemCobranca("", { ...dados, sessoes: ["2026-11-09T16:00:00"] });
    expect(msg).toBe(
      MODELO_PADRAO_COBRANCA
        .replace("{nome}", "Maria")
        .replace("{valor}", "R$ 520,00")
        .replace("{vencimento}", "05/10/26")
        .replace("{sessoes}", "09/11/26"),
    );
  });

  it("null também cai no padrão", () => {
    expect(montarMensagemCobranca(null, dados)).toContain("Maria");
  });

  it("sem vencimento vira 'a combinar'", () => {
    expect(montarMensagemCobranca("{nome}: {vencimento}", { nome: "João", valor: "R$ 100", vencimento: null })).toBe("João: a combinar");
  });

  it("a mesma variável repetida é toda substituída", () => {
    expect(montarMensagemCobranca("{nome} {nome}", { nome: "Ana Paula", valor: "", vencimento: "" })).toBe("Ana Ana");
  });
});

/**
 * Os textos dos docs 60 e 61 são PEDIDO LITERAL do dono — inclusive as linhas em branco
 * ("respeitando quebra de linha e espaços em branco"). Testar o texto inteiro, e não pedaços
 * dele, é o que faz uma reescrita bem-intencionada reprovar em vez de passar.
 */
describe("doc 61: as quatro redações, palavra por palavra", () => {
  const sessoes = ["2026-11-09T16:00:00", "2026-11-16T16:00:00", "2026-11-23T16:00:00", "2026-11-30T16:00:00"];
  const base = { nome: "Joyce Ribeiro", valor: "R$ 360,00", vencimento: "2026-11-05T00:00:00", sessoes, hoje: "2026-11-01" };

  it("mensal no dia do vencimento", () => {
    expect(montarMensagemCobranca(null, base)).toBe(
      [
        "Olá Joyce!",
        "",
        "Passando para lembrar do pagamento de R$ 360,00, com vencimento em 05/11/26.",
        "",
        "Referente às sessões dos dias: 09/11/26, 16/11/26, 23/11/26 e 30/11/26.",
        "",
        "Após realizar o pagamento, por gentileza, envie o comprovante por aqui. 😊",
        "",
        "Qualquer dúvida, estou à disposição!",
      ].join("\n"),
    );
  });

  it("mensal que vence na primeira sessão do pacote", () => {
    expect(montarMensagemCobranca(null, { ...base, caso: "primeira" })).toBe(
      [
        "Olá Joyce!",
        "",
        "Passando para informar que estaremos iniciando um novo pacote de sessões.",
        "",
        "Conforme combinado, o pagamento deverá ser realizado até a primeira sessão, em 05/11/26.",
        "",
        "O pacote é referente às sessões dos dias: 09/11/26, 16/11/26, 23/11/26 e 30/11/26.",
        "",
        "Após realizar o pagamento, por gentileza, envie o comprovante por aqui. 😊",
        "",
        "Qualquer dúvida, estou à disposição!",
      ].join("\n"),
    );
  });

  it("mensal que vence na última sessão do pacote", () => {
    expect(montarMensagemCobranca(null, { ...base, caso: "ultima" })).toBe(
      [
        "Olá Joyce!",
        "",
        "Passando para informar que estamos finalizando o pacote de sessões.",
        "",
        "Conforme combinado, o pagamento deverá ser realizado no final deste pacote, em 05/11/26.",
        "",
        "O pacote é referente às sessões dos dias: 09/11/26, 16/11/26, 23/11/26 e 30/11/26.",
        "",
        "Após realizar o pagamento, por gentileza, envie o comprovante por aqui. 😊",
        "",
        "Qualquer dúvida, estou à disposição!",
      ].join("\n"),
    );
  });

  it("pagamento avulso, sem prazo combinado — doc 19 tirou a linha do 'conforme combinado'", () => {
    expect(montarMensagemCobranca(null, { ...base, caso: "avulso", sessao: "2026-11-09T16:00:00" })).toBe(
      [
        "Olá Joyce!",
        "",
        "Passando para lembrar que você tem sessão hoje, 09/11/26, e que o pagamento avulso, no valor de R$ 360,00, ainda está pendente.",
        "",
        "Após realizar o pagamento, por gentileza, envie o comprovante por aqui. 😊",
        "",
        "Qualquer dúvida, estou à disposição!",
      ].join("\n"),
    );
  });

  it("pagamento avulso com o campo 'pagar até' preenchido — sem o 'às' (doc 19)", () => {
    expect(montarMensagemCobranca(null, { ...base, caso: "avulso", sessao: "2026-11-09T16:00:00", horasAntes: 24 })).toBe(
      [
        "Olá Joyce!",
        "",
        "Passando para lembrar que você tem sessão hoje, 09/11/26, e que o pagamento avulso, no valor de R$ 360,00, ainda está pendente.",
        "",
        "Lembrando que o pagamento deve ser realizado até 24 horas antes da sessão. Caso contrário, a sessão será considerada desmarcada, e o horário poderá ser cedido a outro paciente, caso haja procura. 😉",
        "",
        "Após realizar o pagamento, por gentileza, envie o comprovante por aqui. 😊",
        "",
        "Qualquer dúvida, estou à disposição!",
      ].join("\n"),
    );
  });
});

describe("doc 61: qual redação vale", () => {
  const sessoes = ["2026-11-09T16:00:00"];

  it("primeira e última só anunciam o pacote enquanto a data não chegou", () => {
    const futuro = { valor: "R$ 1", vencimento: "2026-11-20T00:00:00", sessoes, hoje: "2026-11-01" } as const;
    expect(modeloPadraoDa({ ...futuro, caso: "primeira" })).toBe(MODELO_PRIMEIRA_SESSAO);
    expect(modeloPadraoDa({ ...futuro, caso: "ultima" })).toBe(MODELO_ULTIMA_SESSAO);

    const passado = { ...futuro, hoje: "2026-11-21" };
    expect(modeloPadraoDa({ ...passado, caso: "primeira" })).toBe(MODELO_PADRAO_COBRANCA);
    expect(modeloPadraoDa({ ...passado, caso: "ultima" })).toBe(MODELO_PADRAO_COBRANCA);
  });

  it("no DIA do vencimento ainda vale o texto do pacote — vencer é depois, não durante", () => {
    expect(modeloPadraoDa({ caso: "primeira", valor: "R$ 1", vencimento: "2026-11-20T00:00:00", hoje: "2026-11-20" }))
      .toBe(MODELO_PRIMEIRA_SESSAO);
  });

  it("o avulso não muda de texto por ter passado — muda por ter prazo combinado", () => {
    const venceu = { caso: "avulso", valor: "R$ 1", vencimento: "2026-11-01T00:00:00", hoje: "2026-11-10" } as const;
    expect(modeloPadraoDa(venceu)).toBe(MODELO_AVULSO);
    expect(modeloPadraoDa({ ...venceu, horasAntes: 12 })).toBe(MODELO_AVULSO_PRAZO);
  });
});

describe("a lista de sessões", () => {
  it("sem saber as sessões, a LINHA inteira sai — e não sobra linha em branco dupla", () => {
    const msg = montarMensagemCobranca(null, { nome: "Joyce", valor: "R$ 360,00", vencimento: "2026-11-05T00:00:00", sessoes: [] });
    expect(msg).not.toContain("Referente às sessões");
    expect(msg).not.toContain("\n\n\n");
    expect(msg).toContain("com vencimento em 05/11/26.");
    expect(msg).toContain("envie o comprovante");
  });

  it("sem nome, o 'Olá!' não fica com espaço solto", () => {
    expect(montarMensagemCobranca(null, { valor: "R$ 1", nome: null })).toContain("Olá!");
  });

  it("uma sessão só não ganha vírgula nem 'e'", () => {
    expect(listaDeSessoes(["2026-11-09T16:00:00"])).toBe("09/11/26");
  });

  it("sem datas, a lista é vazia", () => {
    expect(listaDeSessoes([])).toBe("");
    expect(listaDeSessoes(null)).toBe("");
  });
});

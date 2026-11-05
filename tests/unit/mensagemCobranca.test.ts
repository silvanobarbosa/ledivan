import { describe, it, expect } from "vitest";
import { listaDeSessoes, montarMensagemCobranca, MODELO_PADRAO_COBRANCA } from "@/lib/mensagemCobranca";

describe("mensagem de cobrança personalizável", () => {
  const dados = { nome: "Maria Silva", valor: "R$ 520,00", vencimento: "05/10" };

  it("troca as variáveis pelo dado, usando o primeiro nome", () => {
    const msg = montarMensagemCobranca("Oi {nome}, são {valor} até {vencimento}.", dados);
    expect(msg).toBe("Oi Maria, são R$ 520,00 até 05/10.");
  });

  it("modelo vazio cai no padrão, também substituído", () => {
    const msg = montarMensagemCobranca("", { ...dados, sessoes: ["2026-11-09T16:00:00"] });
    expect(msg).toBe(
      MODELO_PADRAO_COBRANCA
        .replace("{nome}", "Maria")
        .replace("{valor}", "R$ 520,00")
        .replace("{vencimento}", "05/10")
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
 * O texto do doc 60 é um PEDIDO LITERAL do dono — inclusive as linhas em branco ("respeitando
 * quebra de linha e espaços em branco"). Testar o texto inteiro, e não pedaços dele, é o que faz
 * uma reescrita bem-intencionada reprovar em vez de passar.
 */
describe("doc 60: a redação padrão, igual para todas", () => {
  const dados = {
    nome: "Joyce Ribeiro",
    valor: "R$ 360,00",
    vencimento: "05/11/26",
    sessoes: ["2026-11-09T16:00:00", "2026-11-16T16:00:00", "2026-11-23T16:00:00", "2026-11-30T16:00:00"],
  };

  it("sai exatamente como o documento pede, com as linhas em branco", () => {
    expect(montarMensagemCobranca(null, dados)).toBe(
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

  it("sem saber as sessões, a LINHA inteira sai — e não sobra linha em branco dupla", () => {
    const msg = montarMensagemCobranca(null, { ...dados, sessoes: [] });
    expect(msg).not.toContain("Referente às sessões");
    expect(msg).not.toContain("\n\n\n");
    expect(msg).toContain("com vencimento em 05/11/26.");
    expect(msg).toContain("envie o comprovante");
  });

  it("sem nome, o 'Olá!' não fica com espaço solto", () => {
    expect(montarMensagemCobranca(null, { ...dados, nome: null })).toContain("Olá!");
  });

  it("uma sessão só não ganha vírgula nem 'e'", () => {
    expect(listaDeSessoes(["2026-11-09T16:00:00"])).toBe("09/11/26");
  });

  it("sem datas, a lista é vazia", () => {
    expect(listaDeSessoes([])).toBe("");
    expect(listaDeSessoes(null)).toBe("");
  });
});

import { describe, it, expect } from "vitest";
import { montarMensagemCobranca, MODELO_PADRAO_COBRANCA } from "@/lib/mensagemCobranca";

describe("mensagem de cobrança personalizável", () => {
  const dados = { nome: "Maria Silva", valor: "R$ 520,00", vencimento: "05/10" };

  it("troca as variáveis pelo dado, usando o primeiro nome", () => {
    const msg = montarMensagemCobranca("Oi {nome}, são {valor} até {vencimento}.", dados);
    expect(msg).toBe("Oi Maria, são R$ 520,00 até 05/10.");
  });

  it("modelo vazio cai no padrão, também substituído", () => {
    const msg = montarMensagemCobranca("", dados);
    expect(msg).toBe(MODELO_PADRAO_COBRANCA.replace("{nome}", "Maria").replace("{valor}", "R$ 520,00").replace("{vencimento}", "05/10"));
    expect(msg).toContain("Maria");
    expect(msg).toContain("R$ 520,00");
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

import { describe, it, expect } from "vitest";
import { falhaDaEscuta, TETO_DO_MOTIVO } from "@/lib/motivoDoProvedor";

/**
 * O MOTIVO da falha de escuta.
 *
 * Por que isto existe: "Não consegui ouvir agora" escondeu por dias um 400 de dica longa demais
 * (01/11) e voltou a esconder outra coisa em 02/11 — e a conta é free, então não há log de runtime
 * na Vercel para consultar depois. O motivo técnico passou a viajar junto com o erro, para a tela
 * poder mostrá-lo. Ele é para ser LIDO, então não pode carregar segredo.
 */

describe("falhaDaEscuta", () => {
  it("chave recusada pelo provedor é acionável por ela, e o status viaja no motivo", () => {
    const f = falhaDaEscuta({ status: 401, message: "401 Invalid API Key" });
    expect(f.erro).toContain("chave de IA foi recusada");
    expect(f.motivo).toContain("401");
  });

  it("limite do provedor também é dela", () => {
    expect(falhaDaEscuta({ status: 429, message: "rate limit reached" }).erro).toContain("limitando");
  });

  it("o resto fica genérico na tela — e carrega o motivo embaixo", () => {
    const f = falhaDaEscuta({ status: 400, message: "400 prompt length must be 896 characters or fewer" });
    expect(f.erro).toBe("Não consegui ouvir agora. Tente de novo.");
    expect(f.motivo).toContain("prompt length must be 896");
  });

  it("CHAVE no texto do provedor nunca chega à tela", () => {
    const f = falhaDaEscuta({ status: 400, message: "key gsk_abc123DEF456ghi789 is invalid" });
    expect(f.motivo).not.toContain("gsk_abc123DEF456ghi789");
    expect(f.motivo).toContain("***");
    const g = falhaDaEscuta({ status: 400, message: "Incorrect API key provided: sk-proj-AAAABBBBCCCCDDDD" });
    expect(g.motivo).not.toContain("AAAABBBBCCCCDDDD");
  });

  it("motivo tem teto — mensagem de provedor pode vir com um JSON inteiro dentro", () => {
    const f = falhaDaEscuta({ status: 400, message: "x".repeat(900) });
    expect(f.motivo!.length).toBeLessThanOrEqual(TETO_DO_MOTIVO);
  });

  it("erro sem status (rede, timeout) ainda diz o que foi", () => {
    const f = falhaDaEscuta(new TypeError("fetch failed"));
    expect(f.erro).toBe("Não consegui ouvir agora. Tente de novo.");
    expect(f.motivo).toContain("fetch failed");
  });

  it("erro sem nada legível não inventa motivo", () => {
    expect(falhaDaEscuta(null).motivo).toBeNull();
    expect(falhaDaEscuta({}).motivo).toBeNull();
    expect(falhaDaEscuta("").motivo).toBeNull();
  });

  it("quebra de linha não vira três linhas na tela", () => {
    expect(falhaDaEscuta({ status: 500, message: "a\nb\n\nc" }).motivo).toBe("500 · a b c");
  });
});

import { describe, expect, it } from "vitest";
import { claimsDaSessao } from "@/lib/claimsDaSessao";

/**
 * O QUE UMA SESSÃO CARREGA — e por que a marca `demo` não pode depender de quem lembra dela.
 *
 * A conta de demonstração (Dr. Sócrates) é pública e compartilhada, e o que a protege é UM claim:
 * `demo` no token. O proxy recusa qualquer método de escrita quando ele está lá.
 *
 * O furo (achado em 13/11/2026): o claim era posto À MÃO em cada porta de entrada, e o login por
 * SENHA do site não o punha. A senha dessa conta está publicada no repositório — de propósito, é
 * uma conta de demonstração —, e o repositório é público. Quem lesse o repo entrava pelo site e
 * recebia uma sessão SEM a marca: escrita liberada na conta que todo visitante vê.
 *
 * Por isso a montagem dos claims passa a morar num lugar só. Porta nova que esqueça a marca é
 * porta que não compila com este helper — e este teste é o que trava a regra.
 */

describe("a marca da conta de demonstração", () => {
  it("acompanha o usuário, não a porta de entrada", () => {
    for (const via of ["senha", "codigo", "google"] as const) {
      expect(claimsDaSessao({ isDemo: true }, via)).toEqual({ via, demo: true });
    }
  });

  it("conta normal não vira demo por engano", () => {
    expect(claimsDaSessao({ isDemo: false }, "senha")).toEqual({ via: "senha", demo: false });
    expect(claimsDaSessao({}, "google")).toEqual({ via: "google", demo: false });
  });

  /** `null` vindo do banco é o caso comum de quem nunca foi marcado. */
  it("null no banco é conta normal", () => {
    expect(claimsDaSessao({ isDemo: null }, "codigo")).toEqual({ via: "codigo", demo: false });
  });

  /**
   * Só o `true` de verdade liga a marca. Um "true" de texto vindo de uma leitura frouxa não pode
   * trancar uma conta de verdade em somente-leitura — e nem o contrário.
   */
  it("exige o booleano, não um parecido", () => {
    expect(claimsDaSessao({ isDemo: "true" as unknown as boolean }, "senha").demo).toBe(false);
    expect(claimsDaSessao({ isDemo: 1 as unknown as boolean }, "senha").demo).toBe(false);
  });
});

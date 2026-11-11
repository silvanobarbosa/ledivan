import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * O par entre a tela e o banco.
 *
 * `registrarFalha` escreve o código no `digest` do erro antes de ele subir, porque é o `digest` que
 * a tela de erro recebe — e o Next respeita um digest já posto. Sem isso, a pessoa dita seis
 * caracteres que não existem em lugar nenhum. Era o estado em que esta função nasceu, e é o que
 * estes testes impedem de voltar.
 */
const inseridos: Array<Record<string, unknown>> = [];
let falharAoGravar = false;

vi.mock("@/db", () => ({
  db: {
    insert: () => ({
      values: async (v: Record<string, unknown>) => {
        if (falharAoGravar) throw new Error("banco fora");
        inseridos.push(v);
      },
    }),
  },
}));
vi.mock("@/db/schema", () => ({ appFalhas: {} }));

const { registrarFalha } = await import("@/lib/falhas");

beforeEach(() => {
  inseridos.length = 0;
  falharAoGravar = false;
});

describe("registrarFalha", () => {
  it("marca o erro com o mesmo código que grava", async () => {
    const erro = new Error("null value in column \"valor\"");
    const codigo = await registrarFalha({ acao: "updatePatient", erro, alvo: "abc" });
    expect(codigo).toMatch(/^[A-Z0-9]{6}$/);
    expect((erro as Error & { digest?: string }).digest).toBe(codigo);
    expect(inseridos[0]).toMatchObject({ acao: "updatePatient", alvo: "abc", codigo });
  });

  it("não sobrescreve digest que já existe", async () => {
    const erro = Object.assign(new Error("x"), { digest: "JAEXISTE" });
    await registrarFalha({ acao: "a", erro });
    expect((erro as Error & { digest?: string }).digest).toBe("JAEXISTE");
  });

  it("peneira o segredo antes de gravar", async () => {
    const erro = new Error("connect to postgres://u:S3nh4@host/db failed");
    await registrarFalha({ acao: "a", erro });
    expect(JSON.stringify(inseridos[0])).not.toContain("S3nh4");
  });

  it("NUNCA joga: banco fora ainda devolve código", async () => {
    falharAoGravar = true;
    const erro = new Error("x");
    const codigo = await registrarFalha({ acao: "a", erro });
    expect(codigo).toMatch(/^[A-Z0-9]{6}$/);
    expect(inseridos).toHaveLength(0);
  });

  it("aguenta o que não é Error", async () => {
    const codigo = await registrarFalha({ acao: "a", erro: "texto solto" });
    expect(codigo).toMatch(/^[A-Z0-9]{6}$/);
    expect(inseridos[0]).toMatchObject({ mensagem: "texto solto", pilha: null });
  });

  it("corta ação e alvo compridos em vez de estourar a coluna", async () => {
    await registrarFalha({ acao: "a".repeat(400), erro: new Error("x"), alvo: "b".repeat(400) });
    expect((inseridos[0].acao as string).length).toBe(120);
    expect((inseridos[0].alvo as string).length).toBe(120);
  });
});

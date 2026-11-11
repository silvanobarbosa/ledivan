import { describe, expect, it } from "vitest";
import { codigoDaFalha, peneirar } from "@/lib/peneiraDeSegredo";

/**
 * O que estes testes guardam não é o formato do texto: é a promessa de que o registro de falha não
 * vira vazamento. A mensagem de erro de um driver de banco carrega a string de conexão inteira, com
 * a senha — e esta tabela existe justamente para GUARDAR mensagens de erro.
 */
describe("peneirar", () => {
  it("come a string de conexão inteira, com a senha", () => {
    const erro =
      'error connecting to postgres://ledivan:S3nh4Sup3rS3cr3t4@ep-cool-123.us-east-2.aws.neon.tech/neondb?sslmode=require';
    const limpo = peneirar(erro);
    expect(limpo).not.toContain("S3nh4Sup3rS3cr3t4");
    expect(limpo).not.toContain("neon.tech");
    expect(limpo).toContain("postgres://[omitido]");
  });

  it("come chave de provedor de IA em qualquer caixa", () => {
    const limpo = peneirar("401 from provider (key sk-proj-AbCdEfGhIjKlMnOp e SK_LIVE_aBcDeFgHiJkL)");
    expect(limpo).not.toContain("AbCdEfGhIjKlMnOp");
    expect(limpo).not.toContain("aBcDeFgHiJkL");
  });

  it("come valor colado a palavra que se anuncia segredo", () => {
    const limpo = peneirar('{"password":"123456","token":"abc.def","authorization":"Bearer xyz"}');
    expect(limpo).not.toContain("123456");
    expect(limpo).not.toContain("abc.def");
    expect(limpo).toContain("[omitido]");
  });

  it("come sobra longa que não é palavra de gente", () => {
    const cookie = "a".repeat(45);
    expect(peneirar(`cookie=${cookie}`)).not.toContain(cookie);
  });

  it("deixa passar a mensagem que a investigação precisa ler", () => {
    const útil = 'null value in column "valor" of relation "patient_cobrancas" violates not-null constraint';
    expect(peneirar(útil)).toBe(útil);
  });

  it("trunca no limite pedido e aguenta vazio", () => {
    // Texto comprido de gente, não sobra longa: "x" repetido 5 mil vezes é uma palavra só, e a
    // peneira (com razão) a trata como chave e a come antes de haver o que truncar.
    expect(peneirar("falha ao salvar o cadastro ".repeat(300), 600)).toHaveLength(600);
    expect(peneirar(null)).toBe("");
    expect(peneirar(undefined)).toBe("");
    expect(peneirar("")).toBe("");
  });
});

describe("codigoDaFalha", () => {
  it("são sempre seis caracteres ditáveis", () => {
    for (let i = 0; i < 500; i++) {
      expect(codigoDaFalha()).toMatch(/^[A-Z0-9]{6}$/);
    }
  });

  it("não repete em volume de consultório", () => {
    const vistos = new Set(Array.from({ length: 2000 }, () => codigoDaFalha()));
    // 36^6 ≈ 2,2 bilhões: repetir em 2 mil sorteios seria sinal de gerador quebrado.
    expect(vistos.size).toBeGreaterThan(1995);
  });
});

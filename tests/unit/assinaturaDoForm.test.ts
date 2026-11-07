import { describe, it, expect } from "vitest";
import { assinaturaDoForm } from "@/lib/assinaturaDoForm";

/**
 * DOC 62 — "todas as alterações deverão permanecer exibidas na tela após clicar em Salvar".
 *
 * A assinatura é o que faz o formulário remontar quando — e só quando — o servidor devolve algo
 * diferente. Se ela mudar à toa, a pessoa perde o que está digitando; se não mudar quando deve, a
 * tela continua mostrando o valor antigo, que é o defeito.
 */
describe("doc 62: a assinatura do que o formulário mostra", () => {
  it("mesmo conteúdo, mesma assinatura — digitar não remonta nada", () => {
    const a = { nome: "Ana", valor: 150, dia: 10 };
    expect(assinaturaDoForm(a)).toBe(assinaturaDoForm({ ...a }));
  });

  it("a ordem das chaves não conta — o mesmo cadastro é o mesmo cadastro", () => {
    expect(assinaturaDoForm({ nome: "Ana", valor: 150 })).toBe(assinaturaDoForm({ valor: 150, nome: "Ana" }));
  });

  it("qualquer campo que mude, muda a assinatura", () => {
    const base = { nome: "Ana", valor: 150, dia: 10, reajuste: 6 };
    expect(assinaturaDoForm({ ...base, valor: 180 })).not.toBe(assinaturaDoForm(base));
    expect(assinaturaDoForm({ ...base, reajuste: 12 })).not.toBe(assinaturaDoForm(base));
    expect(assinaturaDoForm({ ...base, nome: "Ana Paula" })).not.toBe(assinaturaDoForm(base));
  });

  it("alcança o que está dentro de listas e objetos — o histórico também aparece na tela", () => {
    const base = { historico: [{ valor: 150, desde: "2026-09-01" }] };
    const outro = { historico: [{ valor: 150, desde: "2026-11-01" }] };
    expect(assinaturaDoForm(base)).not.toBe(assinaturaDoForm(outro));
  });

  it("null e ausente são a mesma coisa, mas null e vazio não", () => {
    expect(assinaturaDoForm({ a: null })).toBe(assinaturaDoForm({ a: undefined }));
    expect(assinaturaDoForm({ a: null })).not.toBe(assinaturaDoForm({ a: "" }));
  });

  it("é curta e sem caracteres que atrapalhem numa key", () => {
    const s = assinaturaDoForm({ nome: "Ana", acento: "José da Silva Ç" });
    expect(s).toMatch(/^[0-9a-z]{1,8}$/);
  });
});

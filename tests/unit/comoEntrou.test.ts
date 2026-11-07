import { describe, it, expect } from "vitest";
import { pedeSenhaAtual } from "@/lib/senhaAtual";

/**
 * DOC 19 — QUEM ENTROU SEM SENHA NÃO PRECISA DA SENHA PARA TROCAR A SENHA.
 *
 * O Ledivan tem três portas e só uma passa pela senha: senha, código no e-mail/Telegram (doc 55)
 * e Google. Quem entra pelas outras muitas vezes não sabe a senha — ou nunca definiu nenhuma — e
 * ficava numa volta fechada: para trocar a senha era preciso saber a senha. Como o app deixa
 * entrar sem senha de propósito, a trava não protegia uma porta; só emperrava o conserto dela.
 *
 * A trava continua valendo para quem entrou COM a senha: aí ela é o que ela sempre foi — a defesa
 * contra alguém que senta num navegador já logado e troca a senha da terapeuta.
 */
describe("doc 19: a senha atual só é exigida de quem entrou com ela", () => {
  it("entrou pelo Google: não pede a senha atual, mesmo já tendo uma", () => {
    expect(pedeSenhaAtual(true, "google")).toBe(false);
  });

  it("entrou pelo código do e-mail: idem — provou quem é por outro caminho", () => {
    expect(pedeSenhaAtual(true, "codigo")).toBe(false);
  });

  it("entrou com a senha: continua pedindo a atual", () => {
    expect(pedeSenhaAtual(true, "senha")).toBe(true);
  });

  it("sessão antiga, sem o claim, continua pedindo — quem não sabe não afrouxa regra", () => {
    expect(pedeSenhaAtual(true, null)).toBe(true);
  });

  it("quem nunca teve senha nunca precisa informar uma — por nenhum caminho", () => {
    for (const via of ["senha", "codigo", "google", null] as const) {
      expect(pedeSenhaAtual(false, via)).toBe(false);
    }
  });
});

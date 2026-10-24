import { describe, expect, it } from "vitest";
import { categoriaDoCadastro, contagemDeCadastros } from "@/lib/contagemDeCadastros";

/**
 * O painel classifica em DUAS caixas: Ativos e Inativos (dono, 23/10/2026). O status Pausado
 * continua existindo no cadastro, mas no painel cada pausado cai numa das duas — pela agenda.
 */

const p = (status: string, temAgendaFutura?: boolean) => ({ status, temAgendaFutura });

describe("categoriaDoCadastro", () => {
  it("ativo e inativo caem onde o nome diz", () => {
    expect(categoriaDoCadastro(p("ativo"))).toBe("ativo");
    expect(categoriaDoCadastro(p("inativo"))).toBe("inativo");
  });

  it("pausado COM sessão marcada à frente é ativo — ele volta semana que vem", () => {
    expect(categoriaDoCadastro(p("pausado", true))).toBe("ativo");
  });

  it("pausado SEM nada marcado é inativo — não está sendo atendido", () => {
    expect(categoriaDoCadastro(p("pausado", false))).toBe("inativo");
    expect(categoriaDoCadastro(p("pausado"))).toBe("inativo");
  });

  it("prospect não entra em nenhuma das duas: ainda não é paciente", () => {
    expect(categoriaDoCadastro(p("prospect", true))).toBeNull();
  });

  it("status desconhecido não é chutado para nenhum lado", () => {
    expect(categoriaDoCadastro(p("arquivado"))).toBeNull();
    expect(categoriaDoCadastro(p(""))).toBeNull();
  });

  it("não se importa com maiúscula nem espaço em volta", () => {
    expect(categoriaDoCadastro(p(" Pausado ", true))).toBe("ativo");
    expect(categoriaDoCadastro(p("ATIVO"))).toBe("ativo");
  });
});

describe("contagemDeCadastros", () => {
  it('"No cadastro" é ativos + inativos, e só', () => {
    const c = contagemDeCadastros([p("ativo"), p("ativo"), p("inativo"), p("prospect")]);
    expect(c).toEqual({ noCadastro: 3, ativos: 2, inativos: 1 });
  });

  it("o caso real da base: 31 ativos, 42 inativos e 18 pausados sem agenda futura", () => {
    // Medido em 23/10/2026: nenhum dos 18 pausados tinha sessão marcada à frente.
    const base = [
      ...Array.from({ length: 31 }, () => p("ativo")),
      ...Array.from({ length: 42 }, () => p("inativo")),
      ...Array.from({ length: 18 }, () => p("pausado", false)),
      ...Array.from({ length: 12 }, () => p("prospect")),
    ];
    expect(contagemDeCadastros(base)).toEqual({ noCadastro: 91, ativos: 31, inativos: 60 });
  });

  it("um pausado que remarcou volta a contar como ativo", () => {
    const c = contagemDeCadastros([p("pausado", true), p("pausado", false)]);
    expect(c).toEqual({ noCadastro: 2, ativos: 1, inativos: 1 });
  });

  it("as partes sempre somam o todo", () => {
    const c = contagemDeCadastros([p("ativo"), p("pausado", true), p("pausado", false), p("inativo"), p("prospect")]);
    expect(c.ativos + c.inativos).toBe(c.noCadastro);
  });

  it("lista vazia é tudo zero", () => {
    expect(contagemDeCadastros([])).toEqual({ noCadastro: 0, ativos: 0, inativos: 0 });
  });
});

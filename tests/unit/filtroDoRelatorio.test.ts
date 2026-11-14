import { describe, it, expect } from "vitest";
import {
  passaNaSituacao,
  passaNoCadastro,
  passaNoRelatorio,
  SITUACOES,
  CADASTROS,
} from "@/lib/filtroDoRelatorio";

/**
 * Doc 71: dois filtros independentes no relatório. O que se testa aqui é a COMBINAÇÃO — é dela
 * que vem o pedido ("supervisionados inativos") e é nela que um `&&` trocado passa despercebido.
 */
const ativo = { status: "ativo", cadastroKind: "paciente" };
const inativo = { status: "inativo", cadastroKind: "paciente" };
const supAtivo = { status: "ativo", cadastroKind: "supervisionado" };
const supInativo = { status: "inativo", cadastroKind: "supervisionado" };
const antigo = { status: "ativo", cadastroKind: null };
const prospect = { status: "prospect", cadastroKind: "paciente" };

describe("filtro de situação", () => {
  it("prospect fica de fora até de 'Todos' — ainda não é paciente", () => {
    expect(passaNaSituacao(prospect, "todos")).toBe(false);
    expect(passaNaSituacao(prospect, "ativo")).toBe(false);
  });

  it("'Todos' pega ativo e inativo", () => {
    expect(passaNaSituacao(ativo, "todos")).toBe(true);
    expect(passaNaSituacao(inativo, "todos")).toBe(true);
  });

  it("ativo e inativo não se misturam", () => {
    expect(passaNaSituacao(ativo, "inativo")).toBe(false);
    expect(passaNaSituacao(inativo, "ativo")).toBe(false);
  });
});

describe("filtro de cadastro", () => {
  it("cadastro sem tipo gravado conta como PACIENTE", () => {
    expect(passaNoCadastro(antigo, "pacientes")).toBe(true);
    expect(passaNoCadastro(antigo, "supervisionados")).toBe(false);
  });

  it("supervisionado só entra em 'Supervisionados' e em 'Todos'", () => {
    expect(passaNoCadastro(supAtivo, "supervisionados")).toBe(true);
    expect(passaNoCadastro(supAtivo, "pacientes")).toBe(false);
    expect(passaNoCadastro(supAtivo, "todos")).toBe(true);
  });
});

describe("os dois combinados — o pedido do doc 71", () => {
  it("supervisionados inativos: só o supervisionado inativo", () => {
    const todas = [ativo, inativo, supAtivo, supInativo, antigo, prospect];
    expect(todas.filter((l) => passaNoRelatorio(l, "inativo", "supervisionados"))).toEqual([supInativo]);
  });

  it("pacientes ativos: o paciente ativo e o cadastro antigo sem tipo", () => {
    const todas = [ativo, inativo, supAtivo, supInativo, antigo, prospect];
    expect(todas.filter((l) => passaNoRelatorio(l, "ativo", "pacientes"))).toEqual([ativo, antigo]);
  });

  it("um filtro não mexe no outro: 'Todos' × 'Todos' é tudo menos prospect", () => {
    const todas = [ativo, inativo, supAtivo, supInativo, antigo, prospect];
    expect(todas.filter((l) => passaNoRelatorio(l, "todos", "todos")).length).toBe(5);
  });
});

describe("as opções da tela", () => {
  it("são as que o doc 71 nomeia, nessa ordem", () => {
    expect(SITUACOES.map((s) => s.rotulo)).toEqual(["Todos", "Ativo", "Inativo"]);
    expect(CADASTROS.map((c) => c.rotulo)).toEqual(["Todos", "Pacientes", "Supervisionados"]);
  });
});

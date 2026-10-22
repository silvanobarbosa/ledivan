import { describe, expect, it } from "vitest";
import { contagemDeCadastros } from "@/lib/contagemDeCadastros";

/**
 * O painel do dashboard dizia 73 e a lista de pacientes dizia 91, para a mesma terapeuta. A
 * diferença eram os 18 PAUSADOS, que o painel não contava. Decisão do dono: eles entram.
 */

const pacientes = (n: Record<string, number>) =>
  Object.entries(n).flatMap(([status, q]) => Array.from({ length: q }, () => ({ status })));

describe("contagemDeCadastros", () => {
  it('"No cadastro" soma ativos, pausados e inativos', () => {
    const c = contagemDeCadastros(pacientes({ ativo: 31, inativo: 42, pausado: 18 }));
    expect(c).toEqual({ noCadastro: 91, ativos: 31, pausados: 18, inativos: 42 });
  });

  it("o caso real que motivou a mudança: o painel dizia 73, a lista dizia 91", () => {
    // Conta de demonstração em 22/10/2026 — os números são estes mesmos.
    const todos = pacientes({ inativo: 42, ativo: 31, pausado: 18, prospect: 12 });
    expect(todos).toHaveLength(103);
    expect(contagemDeCadastros(todos).noCadastro).toBe(91); // era 73
  });

  it("prospect fica de fora: ainda não é paciente, e tem painel próprio", () => {
    const c = contagemDeCadastros(pacientes({ ativo: 2, prospect: 50 }));
    expect(c.noCadastro).toBe(2);
  });

  it("status desconhecido não entra em conta nenhuma — e não quebra a tela", () => {
    const c = contagemDeCadastros(pacientes({ ativo: 1, arquivado: 9, "": 3 }));
    expect(c).toEqual({ noCadastro: 1, ativos: 1, pausados: 0, inativos: 0 });
  });

  it("não se importa com maiúscula nem espaço em volta", () => {
    expect(contagemDeCadastros([{ status: " Pausado " }, { status: "ATIVO" }]).noCadastro).toBe(2);
  });

  it("lista vazia é tudo zero", () => {
    expect(contagemDeCadastros([])).toEqual({ noCadastro: 0, ativos: 0, pausados: 0, inativos: 0 });
  });

  it("as partes sempre somam o todo", () => {
    const c = contagemDeCadastros(pacientes({ ativo: 7, pausado: 3, inativo: 5, prospect: 11 }));
    expect(c.ativos + c.pausados + c.inativos).toBe(c.noCadastro);
  });
});

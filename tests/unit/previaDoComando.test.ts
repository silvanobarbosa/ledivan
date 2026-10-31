import { describe, it, expect } from "vitest";
import { previaDoComando } from "@/lib/previaDoComando";

const PACIENTES = [
  { id: "1", nome: "Thais Alves" },
  { id: "2", nome: "Thais Duarte" },
  { id: "5", nome: "Marcela Damaceno" },
];
const AGORA = new Date(2026, 10, 4, 11, 0, 0); // quarta, 04/11/2026

const SESSOES: Record<string, { id: string; quando: Date }[]> = {
  "5": [
    { id: "s1", quando: new Date(2026, 10, 5, 16, 0) },
    { id: "s2", quando: new Date(2026, 10, 5, 18, 0) },
    { id: "s3", quando: new Date(2026, 10, 12, 16, 0) },
  ],
};
const sessoesDoPaciente = (id: string) => SESSOES[id] ?? [];
const previa = (fala: string) => previaDoComando(fala, PACIENTES, { agora: AGORA, sessoesDoPaciente });

describe("a prévia do comando — nada acontece sem ela ver", () => {
  it("anotar com tudo entendido fica PRONTO para confirmar", () => {
    const p = previa("anota na Marcela: relatou melhora do sono")!;
    expect(p.acao).toBe("anotar");
    expect(p.paciente.tipo).toBe("um");
    expect(p.texto).toBe("relatou melhora do sono");
    expect(p.faltando).toEqual([]);
  });

  it("anotar sem conteúdo NÃO fica pronto", () => {
    const p = previa("anota na Marcela")!;
    expect(p.faltando.length).toBeGreaterThan(0);
    expect(p.faltando.join(" ")).toMatch(/o que anotar/i);
  });

  it("nome ambíguo trava e devolve os candidatos", () => {
    const p = previa("anota na Thais: ok")!;
    expect(p.paciente.tipo).toBe("varios");
    expect(p.faltando.join(" ")).toMatch(/mais de um paciente/i);
    if (p.paciente.tipo === "varios") expect(p.paciente.candidatos.length).toBe(2);
  });

  it("paciente que não existe trava", () => {
    const p = previa("anota na Joaquina: ok")!;
    expect(p.paciente.tipo).toBe("nenhum");
    expect(p.faltando.length).toBeGreaterThan(0);
  });

  it("reservar entende o quando e devolve por extenso", () => {
    const p = previa("marca a Marcela quinta às 16h")!;
    expect(p.acao).toBe("reservar");
    expect(p.quando?.porExtenso).toBe("quinta-feira, 05/11, às 16h");
    expect(p.faltando).toEqual([]);
  });

  it("reservar sem hora NÃO fica pronto — horário presumido é sessão na hora errada", () => {
    const p = previa("marca a Marcela quinta")!;
    expect(p.quando).toBeNull();
    expect(p.faltando.join(" ")).toMatch(/dia e a hora/i);
  });

  it("cancelar: um atendimento no dia resolve", () => {
    const p = previa("cancela a sessão da Marcela dia 12")!;
    expect(p.acao).toBe("cancelar");
    expect(p.sessoes?.length).toBe(1);
    expect(p.sessoes?.[0].porExtenso).toContain("12/11");
    expect(p.faltando).toEqual([]);
  });

  it("cancelar: DOIS atendimentos no mesmo dia travam e aparecem os dois", () => {
    const p = previa("cancela a sessão da Marcela amanhã")!;
    expect(p.sessoes?.length).toBe(2);
    expect(p.faltando.join(" ")).toMatch(/mais de um atendimento/i);
  });

  it("cancelar num dia sem atendimento trava, em vez de pegar outro", () => {
    const p = previa("cancela a sessão da Marcela dia 20")!;
    expect(p.sessoes).toEqual([]);
    expect(p.faltando.join(" ")).toMatch(/não achei/i);
  });

  it("cancelar sem dizer o dia oferece o PRÓXIMO, e só ele", () => {
    const p = previa("cancela a sessão da Marcela")!;
    expect(p.sessoes?.length).toBe(1);
    expect(p.sessoes?.[0].porExtenso).toContain("05/11");
  });

  it("pergunta de navegação não vira prévia de comando", () => {
    expect(previa("quem está devendo?")).toBeNull();
  });
});

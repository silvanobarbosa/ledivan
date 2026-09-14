import { describe, expect, it } from "vitest";
import {
  apareceHoje,
  mensagemPara,
  mesQueVem,
  MODELO_PADRAO_DO_LEMBRETE,
  pacientesALembrar,
  ultimoDiaDoMes,
} from "@/lib/lembrarAgendamento";

const dia = (ano: number, mes: number, d: number) => new Date(ano, mes - 1, d, 12, 0, 0);

describe("quando a lista aparece", () => {
  it("nos três últimos dias de um mês de 30", () => {
    expect(apareceHoje(dia(2026, 9, 27))).toBe(false);
    expect(apareceHoje(dia(2026, 9, 28))).toBe(true);
    expect(apareceHoje(dia(2026, 9, 29))).toBe(true);
    expect(apareceHoje(dia(2026, 9, 30))).toBe(true);
  });

  it("num mês de 31, os três últimos são outros números", () => {
    // A conta sai do MÊS, não de um número fixo.
    expect(apareceHoje(dia(2026, 10, 28))).toBe(false);
    expect(apareceHoje(dia(2026, 10, 29))).toBe(true);
    expect(apareceHoje(dia(2026, 10, 31))).toBe(true);
  });

  it("fevereiro comum acaba no dia 28", () => {
    expect(ultimoDiaDoMes(dia(2026, 2, 1))).toBe(28);
    expect(apareceHoje(dia(2026, 2, 25))).toBe(false);
    expect(apareceHoje(dia(2026, 2, 26))).toBe(true);
    expect(apareceHoje(dia(2026, 2, 28))).toBe(true);
  });

  it("fevereiro bissexto acaba no 29, e a lista acompanha", () => {
    expect(ultimoDiaDoMes(dia(2028, 2, 1))).toBe(29);
    expect(apareceHoje(dia(2028, 2, 26))).toBe(false);
    expect(apareceHoje(dia(2028, 2, 27))).toBe(true);
    expect(apareceHoje(dia(2028, 2, 29))).toBe(true);
  });

  it("no começo do mês não aparece: ainda há mês pela frente", () => {
    expect(apareceHoje(dia(2026, 9, 1))).toBe(false);
    expect(apareceHoje(dia(2026, 9, 15))).toBe(false);
  });
});

describe("o mês que vem", () => {
  it("de setembro é outubro inteiro", () => {
    const { inicio, fim } = mesQueVem(dia(2026, 9, 29));
    expect(inicio.getMonth()).toBe(9);
    expect(inicio.getDate()).toBe(1);
    expect(fim.getMonth()).toBe(9);
    expect(fim.getDate()).toBe(31);
  });

  it("de dezembro é janeiro do ano seguinte", () => {
    const { inicio, fim } = mesQueVem(dia(2026, 12, 30));
    expect(inicio.getFullYear()).toBe(2027);
    expect(inicio.getMonth()).toBe(0);
    expect(fim.getDate()).toBe(31);
  });
});

describe("quem entra na lista", () => {
  const hoje = dia(2026, 9, 29);
  const mensais = [
    { id: "a", nome: "Ana Lima", ultimaSessao: dia(2026, 9, 2) },
    { id: "b", nome: "Bruno Sá", ultimaSessao: dia(2026, 9, 20) },
    { id: "c", nome: "Carla Reis", ultimaSessao: null },
  ];

  it("todo mensal sem data no mês que vem entra", () => {
    const l = pacientesALembrar({ mensais, sessoes: [], hoje });
    expect(l.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("quem já marcou outubro SAI da lista sozinho", () => {
    // É o que faz a lista se esvaziar à medida que a pessoa trabalha, sem ninguém marcar nada
    // como concluído — lista que exige ser concluída é lista que fica desatualizada.
    const l = pacientesALembrar({ mensais, sessoes: [{ pacienteId: "b", data: dia(2026, 10, 14) }], hoje });
    expect(l.map((x) => x.id)).toEqual(["a", "c"]);
  });

  it("data no MÊS ATUAL não tira ninguém da lista", () => {
    // A pergunta é sobre o mês que vem. Ter sessão amanhã não resolve outubro.
    const l = pacientesALembrar({ mensais, sessoes: [{ pacienteId: "a", data: dia(2026, 9, 30) }], hoje });
    expect(l.map((x) => x.id)).toContain("a");
  });

  it("data em novembro também não conta: a lista é sobre o mês seguinte", () => {
    const l = pacientesALembrar({ mensais, sessoes: [{ pacienteId: "a", data: dia(2026, 11, 5) }], hoje });
    expect(l.map((x) => x.id)).toContain("a");
  });

  it("quem está há mais tempo sem sessão vem primeiro", () => {
    const l = pacientesALembrar({ mensais, sessoes: [], hoje });
    expect(l[0].id).toBe("a");
    expect(l[0].diasSemSessao).toBe(27);
    expect(l[1].id).toBe("b");
  });

  it("sem última sessão conhecida, vai para o fim em vez de sumir", () => {
    const l = pacientesALembrar({ mensais, sessoes: [], hoje });
    expect(l[l.length - 1].id).toBe("c");
    expect(l[l.length - 1].diasSemSessao).toBeNull();
  });

  it("data inválida não derruba a lista", () => {
    const l = pacientesALembrar({
      mensais: [{ id: "a", nome: "Ana", ultimaSessao: "nada" }],
      sessoes: [{ pacienteId: "a", data: "nada" }],
      hoje,
    });
    expect(l).toHaveLength(1);
    expect(l[0].diasSemSessao).toBeNull();
  });

  it("virada de ano: quem marcou janeiro sai da lista de dezembro", () => {
    const l = pacientesALembrar({
      mensais: [{ id: "a", nome: "Ana", ultimaSessao: dia(2026, 12, 3) }],
      sessoes: [{ pacienteId: "a", data: dia(2027, 1, 8) }],
      hoje: dia(2026, 12, 30),
    });
    expect(l).toHaveLength(0);
  });
});

describe("a mensagem", () => {
  it("troca {nome} pelo primeiro nome", () => {
    expect(mensagemPara("Oi {nome}, tudo bem?", "Ana Lima Souza")).toBe("Oi Ana, tudo bem?");
  });

  it("troca todas as ocorrências", () => {
    expect(mensagemPara("{nome}, {nome}!", "Bruno Sá")).toBe("Bruno, Bruno!");
  });

  it("modelo vazio cai no padrão", () => {
    expect(mensagemPara("", "Ana")).toBe(MODELO_PADRAO_DO_LEMBRETE.replace("{nome}", "Ana"));
  });
});

import { describe, expect, it } from "vitest";
import {
  canalParaGravar,
  ehMensal,
  ehOnline,
  geraRepeticoes,
  horasAntesParaGravar,
  modalidadesDe,
  pedeHorasAntes,
  pedeLocal,
  pedeRepetirAte,
  repeticoesDe,
} from "@/lib/agendamentoNovo";

const valores = (lista: { valor: string }[]) => lista.map((x) => x.valor);

describe("as modalidades que cada tipo oferece", () => {
  it("a consulta oferece as três", () => {
    expect(valores(modalidadesDe("consulta"))).toEqual(["presencial", "online", "misto"]);
  });

  it("a devolutiva não oferece misto", () => {
    // Misto é um combinado de longo prazo com o paciente; a devolutiva é um encontro único com os
    // responsáveis. Ou é numa sala, ou é numa chamada.
    expect(valores(modalidadesDe("devolutiva"))).toEqual(["presencial", "online"]);
  });
});

describe("as repetições que a janela oferece", () => {
  it("a consulta comum oferece as quatro", () => {
    expect(valores(repeticoesDe({ tipo: "consulta" }))).toEqual(["pontual", "semanal", "quinzenal", "mensal"]);
  });

  it("a devolutiva não se repete", () => {
    expect(valores(repeticoesDe({ tipo: "devolutiva" }))).toEqual(["pontual"]);
  });

  it("o slot intercalado Q não oferece semanal", () => {
    // Se o novo paciente ocupasse todas as semanas, o horário deixaria de ser intercalado e o
    // quinzenal original perderia o lugar dele.
    const lista = valores(repeticoesDe({ tipo: "consulta", slotIntercalado: true }));
    expect(lista).not.toContain("semanal");
    expect(lista).toEqual(["pontual", "mes", "quinzenal"]);
  });
});

describe("o que é mensal", () => {
  it("mensal e 1x no mês são a mesma coisa com dois nomes", () => {
    expect(ehMensal("mensal")).toBe(true);
    expect(ehMensal("mes")).toBe(true);
  });

  it("o resto não é", () => {
    for (const r of ["pontual", "semanal", "quinzenal", null]) expect(ehMensal(r), String(r)).toBe(false);
  });

  it("nenhum mensal gera sessões — os dois vão para a lista de lembrar", () => {
    expect(geraRepeticoes("mensal")).toBe(false);
    expect(geraRepeticoes("mes")).toBe(false);
  });
});

describe("o que gera sessões automaticamente", () => {
  it("semanal e quinzenal geram", () => {
    expect(geraRepeticoes("semanal")).toBe(true);
    expect(geraRepeticoes("quinzenal")).toBe(true);
  });

  it("MENSAL não gera — o paciente vai para a lista de lembrar agendamento", () => {
    // Decisão delas: quem atende uma vez por mês combina a data na própria sessão, e uma agenda
    // cheia de datas presumidas atrapalha mais do que ajuda.
    expect(geraRepeticoes("mensal")).toBe(false);
  });

  it("não repetir não gera", () => {
    expect(geraRepeticoes("pontual")).toBe(false);
    expect(geraRepeticoes(null)).toBe(false);
  });

  it("quem gera é exatamente quem pede data final", () => {
    for (const r of ["pontual", "semanal", "quinzenal", "mensal", null]) {
      expect(pedeRepetirAte(r), String(r)).toBe(geraRepeticoes(r));
    }
  });
});

describe("confirmar sessão", () => {
  it("as horas só são pedidas quando há canal", () => {
    expect(pedeHorasAntes("whatsapp")).toBe(true);
    expect(pedeHorasAntes("email")).toBe(true);
    expect(pedeHorasAntes("nenhum")).toBe(false);
    expect(pedeHorasAntes(null)).toBe(false);
  });

  it('"não confirmar" grava ausência, não o texto', () => {
    expect(canalParaGravar("nenhum")).toBeNull();
    expect(canalParaGravar(null)).toBeNull();
    expect(canalParaGravar("whatsapp")).toBe("whatsapp");
  });

  it("sem canal, não há horas a gravar", () => {
    expect(horasAntesParaGravar("nenhum", 24)).toBeNull();
  });

  it("as horas ficam dentro do que faz sentido", () => {
    // Menos de uma hora não dá tempo de responder; mais de uma semana, o paciente esquece.
    expect(horasAntesParaGravar("whatsapp", 0)).toBe(1);
    expect(horasAntesParaGravar("whatsapp", -5)).toBe(1);
    expect(horasAntesParaGravar("whatsapp", 999)).toBe(168);
    expect(horasAntesParaGravar("whatsapp", 24)).toBe(24);
  });

  it("valor sem sentido vira o padrão de 24 horas, em vez de gravar lixo", () => {
    expect(horasAntesParaGravar("email", "abc")).toBe(24);
    expect(horasAntesParaGravar("email", null)).toBe(24);
    expect(horasAntesParaGravar("email", "")).toBe(24);
    expect(horasAntesParaGravar("email", undefined)).toBe(24);
  });
});

describe("a modalidade e o resto da tela", () => {
  it("só online é online", () => {
    expect(ehOnline("online")).toBe(true);
    expect(ehOnline("misto")).toBe(false);
    expect(ehOnline("presencial")).toBe(false);
  });

  it("misto também pede local: parte dos encontros é na sala", () => {
    expect(pedeLocal("presencial")).toBe(true);
    expect(pedeLocal("misto")).toBe(true);
    expect(pedeLocal("online")).toBe(false);
  });
});

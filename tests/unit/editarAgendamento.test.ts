import { describe, expect, it } from "vitest";
import { deslocamento, horarioOcupado, podeEditar, sessoesAlcancadas } from "@/lib/editarAgendamento";

/**
 * O ALCANCE de "este e os próximos". É a parte do lote que mais custa errar: um alcance errado
 * apaga em bloco sessões que ninguém mandou apagar, e a tela só mostra o que sobrou.
 */

const em = (id: string, iso: string, pacienteId = "p1") => ({ id, data: new Date(iso), pacienteId });

// Quartas às 8h, mais um encaixe numa sexta e uma sessão de outro paciente no mesmo horário.
const agenda = [
  em("q1", "2026-09-02T08:00:00"),
  em("q2", "2026-09-09T08:00:00"),
  em("sexta", "2026-09-11T15:00:00"),
  em("q3", "2026-09-16T08:00:00"),
  em("q4", "2026-09-23T08:00:00"),
  em("outro", "2026-09-16T08:00:00", "p2"),
];

describe("apenas esta", () => {
  it("alcança só a escolhida", () => {
    expect(sessoesAlcancadas({ escolhida: agenda[1], todas: agenda, alcance: "apenas_esta" })).toEqual(["q2"]);
  });
});

describe("este e os próximos, todos", () => {
  it("pega tudo do paciente daqui para a frente, inclusive o encaixe da sexta", () => {
    const r = sessoesAlcancadas({ escolhida: agenda[1], todas: agenda, alcance: "todas" });
    expect(r).toEqual(["q2", "sexta", "q3", "q4"]);
  });

  it("NÃO pega o passado: sessão que já aconteceu é histórico", () => {
    const r = sessoesAlcancadas({ escolhida: agenda[1], todas: agenda, alcance: "todas" });
    expect(r).not.toContain("q1");
  });

  it("NUNCA atravessa para outro paciente, mesmo no mesmo horário", () => {
    const r = sessoesAlcancadas({ escolhida: agenda[1], todas: agenda, alcance: "todas" });
    expect(r).not.toContain("outro");
  });
});

describe("este e os próximos, mesmos dias e horários", () => {
  it("pega só as quartas às 8h, deixando o encaixe da sexta em paz", () => {
    // Quem marcou às quartas às 8h e criou um encaixe numa sexta espera que mexer no combinado das
    // quartas não leve a sexta junto — ela foi marcada à parte, de propósito.
    const r = sessoesAlcancadas({ escolhida: agenda[1], todas: agenda, alcance: "mesmos_dias" });
    expect(r).toEqual(["q2", "q3", "q4"]);
    expect(r).not.toContain("sexta");
  });

  it("mesmo dia da semana em horário diferente não entra", () => {
    const comOutraHora = [...agenda, em("q_tarde", "2026-09-16T14:00:00")];
    const r = sessoesAlcancadas({ escolhida: agenda[1], todas: comOutraHora, alcance: "mesmos_dias" });
    expect(r).not.toContain("q_tarde");
  });

  it("a escolhida entra sempre", () => {
    const r = sessoesAlcancadas({ escolhida: agenda[2], todas: agenda, alcance: "mesmos_dias" });
    expect(r[0]).toBe("sexta");
  });
});

describe("o horário de destino", () => {
  it("ocupado quando outra sessão começa no mesmo instante", () => {
    expect(horarioOcupado({ destino: "2026-09-16T08:00:00", todas: agenda })).toBe(true);
  });

  it("livre quando ninguém começa ali", () => {
    expect(horarioOcupado({ destino: "2026-09-16T11:00:00", todas: agenda })).toBe(false);
  });

  it("a própria sessão não conta contra ela mesma", () => {
    // Senão salvar sem mudar o horário seria recusado.
    expect(horarioOcupado({ destino: "2026-09-09T08:00:00", todas: agenda, ignorar: ["q2"] })).toBe(false);
  });

  it("o bloco inteiro que está sendo movido é ignorado junto", () => {
    expect(horarioOcupado({ destino: "2026-09-16T08:00:00", todas: agenda, ignorar: ["q3", "outro"] })).toBe(false);
  });

  it("data inválida não acusa ocupação falsa", () => {
    expect(horarioOcupado({ destino: "nada", todas: agenda })).toBe(false);
  });
});

describe("o deslocamento", () => {
  it("mover um dia para a frente mexe todas as seguintes um dia, mantendo o intervalo", () => {
    // Copiar a data nova para todas empilharia a série inteira num único dia — que é o jeito de
    // transformar uma edição em perda de agenda.
    const r = deslocamento({
      de: "2026-09-09T08:00:00",
      para: "2026-09-10T08:00:00",
      sessoes: [em("q2", "2026-09-09T08:00:00"), em("q3", "2026-09-16T08:00:00")],
    });
    expect(r.map((x) => x.data.toISOString().slice(0, 10))).toEqual(["2026-09-10", "2026-09-17"]);
  });

  it("mudar só a hora mexe só a hora de todas", () => {
    const r = deslocamento({
      de: "2026-09-09T08:00:00",
      para: "2026-09-09T10:00:00",
      sessoes: [em("q2", "2026-09-09T08:00:00"), em("q3", "2026-09-16T08:00:00")],
    });
    expect(r.map((x) => x.data.getHours())).toEqual([10, 10]);
    expect(r[1].data.toISOString().slice(0, 10)).toBe("2026-09-16");
  });

  it("sem mudança, não há o que deslocar", () => {
    expect(deslocamento({ de: "2026-09-09T08:00:00", para: "2026-09-09T08:00:00", sessoes: agenda })).toEqual([]);
  });

  it("data inválida devolve lista vazia em vez de espalhar NaN pela agenda", () => {
    expect(deslocamento({ de: "nada", para: "2026-09-09T08:00:00", sessoes: agenda })).toEqual([]);
  });
});

describe("os campos que a janela deixa mexer", () => {
  it("data, duração, modalidade, local e lembrete", () => {
    for (const c of ["date", "duration", "modality", "location", "confirmChannel", "confirmLeadHours"]) {
      expect(podeEditar(c), c).toBe(true);
    }
  });

  it("paciente, tipo e repetição ficam inativos — trocar isso é outro agendamento", () => {
    for (const c of ["patientId", "sessionKind", "freq", "status"]) {
      expect(podeEditar(c), c).toBe(false);
    }
  });
});

import { describe, expect, it } from "vitest";
import {
  LEGENDA_DA_AGENDA,
  SESSION_STATUS_LABELS,
  STATUS_OFERECIDOS,
  STATUS_QUE_AVANCAM,
  STATUS_QUE_PAUSAM,
  STATUS_QUE_PODEM_COBRAR,
  riskFromSessions,
  sessionColorClasses,
} from "@/lib/therapy";
import { numeracaoDoPacote, sessoesDoMes } from "@/lib/pacoteMes";

/**
 * OS CINCO STATUS DO LOTE, e o que cada regra faz com os dois que nasceram agora.
 *
 * A pergunta mudou: não é mais "a sessão aconteceu?", e sim "de quem foi a ausência?" — porque é
 * disso que depende o paciente perder ou não perder a sessão. Estes testes fixam as consequências
 * dessa mudança nos três lugares que leem status e decidem alguma coisa: o risco de falta, a
 * contagem do pacote e a cor da célula.
 */

const ontem = () => {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d;
};

describe("os dois conjuntos", () => {
  it("todo status oferecido sabe avançar ou pausar, nunca os dois", () => {
    for (const st of STATUS_OFERECIDOS) {
      const avanca = STATUS_QUE_AVANCAM.has(st);
      const pausa = STATUS_QUE_PAUSAM.has(st);
      expect(avanca || pausa, `${st} não está em nenhum dos dois`).toBe(true);
      expect(avanca && pausa, `${st} está nos dois`).toBe(false);
    }
  });

  it("Presente, Faltou e sem status fazem avançar", () => {
    expect(STATUS_QUE_AVANCAM.has("realizada")).toBe(true);
    expect(STATUS_QUE_AVANCAM.has("nao_realizada")).toBe(true);
    expect(STATUS_QUE_AVANCAM.has("agendada")).toBe(true);
  });

  it("Desmarcou, Prof. desm. e Atestado pausam", () => {
    expect(STATUS_QUE_PAUSAM.has("cancelada")).toBe(true);
    expect(STATUS_QUE_PAUSAM.has("prof_desmarcou")).toBe(true);
    expect(STATUS_QUE_PAUSAM.has("atestado")).toBe(true);
  });

  it("o legado realocada pausa, como sempre pausou", () => {
    expect(STATUS_QUE_PAUSAM.has("realocada")).toBe(true);
  });
});

describe("quem cobra", () => {
  it("Faltou cobra: o paciente perdeu a sessão dele", () => {
    expect(STATUS_QUE_PODEM_COBRAR.has("nao_realizada")).toBe(true);
  });

  it("o que o profissional desmarcou não cobra", () => {
    expect(STATUS_QUE_PODEM_COBRAR.has("prof_desmarcou")).toBe(false);
  });

  it("atestado não cobra", () => {
    expect(STATUS_QUE_PODEM_COBRAR.has("atestado")).toBe(false);
  });

  it("ninguém que pausa a sequência cobra", () => {
    for (const st of STATUS_QUE_PAUSAM) {
      expect(STATUS_QUE_PODEM_COBRAR.has(st), `${st} não podia cobrar`).toBe(false);
    }
  });
});

describe("risco de falta", () => {
  const sessao = (status: string) => ({ status, date: ontem() });

  it("atestado NÃO é falta — quem adoeceu não é paciente de risco", () => {
    const so_atestados = riskFromSessions([sessao("atestado"), sessao("atestado"), sessao("atestado"), sessao("realizada")]);
    expect(so_atestados.faltas).toBe(0);
    expect(so_atestados.level).toBe("baixo");
  });

  it("sessão desmarcada pelo profissional NÃO é falta do paciente", () => {
    const r = riskFromSessions([sessao("prof_desmarcou"), sessao("prof_desmarcou"), sessao("prof_desmarcou"), sessao("realizada")]);
    expect(r.faltas).toBe(0);
  });

  it("desmarcar com aviso não é o mesmo que não aparecer", () => {
    const desmarcou = riskFromSessions([sessao("cancelada"), sessao("cancelada"), sessao("realizada"), sessao("realizada")]);
    const faltou = riskFromSessions([sessao("nao_realizada"), sessao("nao_realizada"), sessao("realizada"), sessao("realizada")]);
    expect(desmarcou.faltas).toBe(0);
    expect(faltou.faltas).toBe(2);
  });

  it("quem falta de verdade continua sendo apontado", () => {
    const r = riskFromSessions([
      sessao("nao_realizada"), sessao("nao_realizada"), sessao("nao_realizada"), sessao("nao_realizada"),
      sessao("realizada"),
    ]);
    expect(r.faltas).toBe(4);
    expect(r.level).toBe("alto");
  });
});

describe("a contagem do pacote", () => {
  const em = (dia: number, status: string) => ({ id: `s${dia}`, date: new Date(2026, 8, dia), status });

  it("atestado e prof. desm. saem da conta do mês, como já saíam cancelada e realocada", () => {
    const sessoes = [em(2, "realizada"), em(9, "atestado"), em(16, "prof_desmarcou"), em(23, "realizada")];
    expect(sessoesDoMes(sessoes, 2026, 8)).toBe(2);
  });

  it("a sessão pausada não ocupa posição: a seguinte assume a que ficou parada", () => {
    const mapa = numeracaoDoPacote(
      [em(2, "realizada"), em(9, "atestado"), em(16, "realizada"), em(23, "realizada")],
      "completo",
    );
    expect(mapa.get("s2")).toEqual({ index: 1, total: 4 });
    expect(mapa.get("s16")).toEqual({ index: 2, total: 4 });
    expect(mapa.get("s23")).toEqual({ index: 3, total: 4 });
  });

  it("Faltou ocupa a posição: o paciente perdeu aquela sessão", () => {
    const mapa = numeracaoDoPacote(
      [em(2, "realizada"), em(9, "nao_realizada"), em(16, "realizada")],
      "completo",
    );
    expect(mapa.get("s9")).toEqual({ index: 2, total: 4 });
    expect(mapa.get("s16")).toEqual({ index: 3, total: 4 });
  });
});

describe("a cor da célula", () => {
  it("sem status a célula fica transparente", () => {
    expect(sessionColorClasses("agendada")).toContain("bg-transparent");
  });

  it("a recorrência não pinta mais a célula — quem diz isso agora é (M) e (Q)", () => {
    expect(sessionColorClasses("agendada", false, true)).toBe(sessionColorClasses("agendada", false, false));
  });

  it("a reserva não pinta mais a célula — quem diz isso é a ampulheta", () => {
    expect(sessionColorClasses("agendada", true, false)).toBe(sessionColorClasses("agendada", false, false));
  });

  it("cada status da legenda tem uma cor própria", () => {
    const cores = LEGENDA_DA_AGENDA.map((st) => sessionColorClasses(st));
    expect(new Set(cores).size).toBe(LEGENDA_DA_AGENDA.length);
  });
});

describe("os rótulos", () => {
  it("os nomes são os que elas usam", () => {
    expect(SESSION_STATUS_LABELS.realizada).toBe("Presente");
    expect(SESSION_STATUS_LABELS.nao_realizada).toBe("Faltou");
    expect(SESSION_STATUS_LABELS.cancelada).toBe("Desmarcou");
    expect(SESSION_STATUS_LABELS.prof_desmarcou).toBe("Prof. desm.");
    expect(SESSION_STATUS_LABELS.atestado).toBe("Atestado");
  });

  it("realocada aparece como Desmarcou, mas não é oferecido de novo", () => {
    expect(SESSION_STATUS_LABELS.realocada).toBe("Desmarcou");
    expect(STATUS_OFERECIDOS).not.toContain("realocada");
  });

  it("todo status oferecido tem nome", () => {
    for (const st of STATUS_OFERECIDOS) {
      expect(SESSION_STATUS_LABELS[st], `${st} sem rótulo`).toBeTruthy();
    }
  });
});

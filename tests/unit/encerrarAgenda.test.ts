import { describe, expect, it } from "vitest";
import { encerraAgenda, sessoesAEncerrar } from "@/lib/encerrarAgenda";

/**
 * O EXEMPLO DELAS, com as datas que escreveram: paciente alterado para inativo em 20/10.
 *
 *   16/10 Presente   → permanece
 *   18/10 Faltou     → permanece
 *   20/10 Desmarcou  → permanece
 *   21/10 sem status → excluir
 *   28/10 sem status → excluir
 *   04/11 sem status → excluir
 */

const em = (id: string, iso: string, status = "agendada") => ({ id, data: new Date(iso), status });
const vinteDeOutubro = new Date("2026-10-20T18:00:00");

describe("o exemplo que elas escreveram", () => {
  const agenda = [
    em("a", "2026-10-16T09:00:00", "realizada"),
    em("b", "2026-10-18T09:00:00", "nao_realizada"),
    em("c", "2026-10-20T09:00:00", "cancelada"),
    em("d", "2026-10-21T09:00:00"),
    em("e", "2026-10-28T09:00:00"),
    em("f", "2026-11-04T09:00:00"),
  ];

  it("apaga exatamente as três futuras sem status", () => {
    expect(sessoesAEncerrar({ sessoes: agenda, quando: vinteDeOutubro })).toEqual(["d", "e", "f"]);
  });

  it("as que têm status permanecem, mesmo as de antes", () => {
    const apagar = sessoesAEncerrar({ sessoes: agenda, quando: vinteDeOutubro });
    for (const id of ["a", "b", "c"]) expect(apagar, id).not.toContain(id);
  });
});

describe("o que fica", () => {
  it("sessão futura que JÁ tem status não sai", () => {
    // Apagar seria reescrever o histórico do paciente para arrumar a agenda.
    const futuras = [
      em("presente", "2026-10-28T09:00:00", "realizada"),
      em("atestado", "2026-11-04T09:00:00", "atestado"),
      em("prof", "2026-11-11T09:00:00", "prof_desmarcou"),
    ];
    expect(sessoesAEncerrar({ sessoes: futuras, quando: vinteDeOutubro })).toEqual([]);
  });

  it("o passado nunca sai, tenha status ou não", () => {
    const passado = [em("velha", "2026-09-01T09:00:00")];
    expect(sessoesAEncerrar({ sessoes: passado, quando: vinteDeOutubro })).toEqual([]);
  });
});

describe("a fronteira é o instante, não o dia", () => {
  it("a sessão da manhã do dia do encerramento fica", () => {
    // Quem encerra às 15h de uma terça não quer perder a sessão das 9h daquela mesma terça, que já
    // aconteceu e pode estar sem status só porque ninguém teve tempo de marcar.
    const mesmoDia = [em("manha", "2026-10-20T09:00:00"), em("tarde", "2026-10-20T20:00:00")];
    const r = sessoesAEncerrar({ sessoes: mesmoDia, quando: vinteDeOutubro });
    expect(r).toEqual(["tarde"]);
  });
});

describe("quando a agenda é encerrada", () => {
  it("só ao virar inativo", () => {
    expect(encerraAgenda("ativo", "inativo")).toBe(true);
    expect(encerraAgenda("pausado", "inativo")).toBe(true);
    expect(encerraAgenda("prospect", "inativo")).toBe(true);
  });

  it("pausar NÃO encerra: quem pausa pretende voltar", () => {
    // Apagar a agenda de quem pausou obrigaria a remarcar tudo na volta — e é justamente a
    // diferença entre pausado e inativo.
    expect(encerraAgenda("ativo", "pausado")).toBe(false);
  });

  it("voltar a ser ativo não encerra nada", () => {
    expect(encerraAgenda("inativo", "ativo")).toBe(false);
  });

  it("continuar inativo não apaga de novo", () => {
    expect(encerraAgenda("inativo", "inativo")).toBe(false);
  });
});

describe("dado torto não derruba nada", () => {
  it("data inválida é ignorada em vez de virar exclusão", () => {
    const r = sessoesAEncerrar({ sessoes: [{ id: "ruim", data: "nada", status: "agendada" }], quando: vinteDeOutubro });
    expect(r).toEqual([]);
  });

  it("lista vazia devolve vazio", () => {
    expect(sessoesAEncerrar({ sessoes: [], quando: vinteDeOutubro })).toEqual([]);
  });
});

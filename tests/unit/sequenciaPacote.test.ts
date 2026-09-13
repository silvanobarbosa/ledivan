import { describe, expect, it } from "vitest";
import { posicoesDaSequencia, sequenciasFechadasNoMes, tamanhosDasSequencias } from "@/lib/sequenciaPacote";

/**
 * A SEQUÊNCIA X/X, com os exemplos que as beta testers escreveram.
 *
 * Cada bloco daqui saiu do documento delas, com as datas e os números que elas usaram. É de
 * propósito: quando a regra mudar de novo, a discussão volta a ser sobre o exemplo, não sobre a
 * minha leitura dele.
 */

const s = (dia: string, status = "agendada") => ({ id: dia, date: new Date(`${dia}T09:00:00`), status });
const posicoes = (sessoes: ReturnType<typeof s>[], opts: Parameters<typeof posicoesDaSequencia>[1] = {}) =>
  posicoesDaSequencia(sessoes, opts);
const rotulo = (m: Map<string, { index: number; total: number }>, id: string) => {
  const p = m.get(id);
  return p ? `${p.index}/${p.total}` : "—";
};

describe("pacote completo: quatro sessões, e recomeça", () => {
  it("o exemplo delas: 16/09 a 04/11, sem status nenhum", () => {
    const dias = ["2026-09-16", "2026-09-23", "2026-09-30", "2026-10-07", "2026-10-14", "2026-10-21", "2026-10-28", "2026-11-04"];
    const p = posicoes(dias.map((d) => s(d)), { pacoteTipo: "completo" });
    expect(dias.map((d) => rotulo(p, d))).toEqual(["1/4", "2/4", "3/4", "4/4", "1/4", "2/4", "3/4", "4/4"]);
  });

  it("a sequência atravessa a virada do mês sem reiniciar", () => {
    const p = posicoes([s("2026-09-30"), s("2026-10-07")], { pacoteTipo: "completo" });
    expect(rotulo(p, "2026-10-07")).toBe("2/4");
  });
});

describe("o que faz avançar", () => {
  it("Presente e Faltou avançam — o exemplo delas", () => {
    // 16/09 1/4 Presente · 23/09 2/4 Presente · 30/09 3/4 Faltou · 07/10 4/4 Presente · 14/10 1/4
    const sessoes = [
      s("2026-09-16", "realizada"),
      s("2026-09-23", "realizada"),
      s("2026-09-30", "nao_realizada"),
      s("2026-10-07", "realizada"),
      s("2026-10-14"),
      s("2026-10-21"),
      s("2026-10-28"),
    ];
    const p = posicoes(sessoes, { pacoteTipo: "completo" });
    expect(sessoes.map((x) => rotulo(p, x.id))).toEqual(["1/4", "2/4", "3/4", "4/4", "1/4", "2/4", "3/4"]);
  });

  it("sem status também avança: o lugar já está ocupado", () => {
    const p = posicoes([s("2026-09-16"), s("2026-09-23")], { pacoteTipo: "completo" });
    expect(rotulo(p, "2026-09-23")).toBe("2/4");
  });
});

describe("o que pausa", () => {
  it("Desmarcou e Prof. desm. seguram a posição — o exemplo delas", () => {
    // 16/09 1/4 Presente · 23/09 2/4 Desmarcou (pausa) · 30/09 2/4 Presente · 07/10 3/4 Presente
    // 14/10 4/4 Prof. desm. (pausa) · 21/10 4/4 · 28/10 1/4
    const sessoes = [
      s("2026-09-16", "realizada"),
      s("2026-09-23", "cancelada"),
      s("2026-09-30", "realizada"),
      s("2026-10-07", "realizada"),
      s("2026-10-14", "prof_desmarcou"),
      s("2026-10-21"),
      s("2026-10-28"),
    ];
    const p = posicoes(sessoes, { pacoteTipo: "completo" });
    expect(sessoes.map((x) => rotulo(p, x.id))).toEqual(["1/4", "2/4", "2/4", "3/4", "4/4", "4/4", "1/4"]);
  });

  it("a sessão pausada MOSTRA onde parou, em vez de ficar muda", () => {
    // É a diferença que elas pediram: antes a desmarcada saía da conta e não exibia número nenhum.
    const p = posicoes([s("2026-09-16", "realizada"), s("2026-09-23", "atestado")], { pacoteTipo: "completo" });
    expect(rotulo(p, "2026-09-23")).toBe("2/4");
  });

  it("atestado também pausa", () => {
    const p = posicoes(
      [s("2026-09-16", "realizada"), s("2026-09-23", "atestado"), s("2026-09-30", "realizada")],
      { pacoteTipo: "completo" },
    );
    expect(rotulo(p, "2026-09-30")).toBe("2/4");
  });

  it("pausa em cima de pausa não anda", () => {
    const p = posicoes(
      [s("2026-09-16", "cancelada"), s("2026-09-23", "atestado"), s("2026-09-30", "prof_desmarcou"), s("2026-10-07")],
      { pacoteTipo: "completo" },
    );
    expect(rotulo(p, "2026-10-07")).toBe("1/4");
  });
});

describe("pacote fracionado: cada sequência tem o seu tamanho", () => {
  it("o exemplo delas: 3 em setembro, 4 em outubro", () => {
    const sessoes = ["2026-09-16", "2026-09-23", "2026-09-30", "2026-10-07", "2026-10-14", "2026-10-21", "2026-10-28"].map((d) => s(d));
    const p = posicoes(sessoes, { pacoteTipo: "fragmentado", tamanhos: [3, 4] });
    expect(sessoes.map((x) => rotulo(p, x.id))).toEqual(["1/3", "2/3", "3/3", "1/4", "2/4", "3/4", "4/4"]);
  });

  it("a sequência de setembro pode TERMINAR em outubro quando houve pausa", () => {
    // 16/09 1/3 Presente · 23/09 2/3 Desmarcou · 30/09 2/3 Presente · 07/10 3/3 Presente
    // e só então outubro começa. É o ponto em que o mês do calendário deixa de ser o agrupador.
    const sessoes = [
      s("2026-09-16", "realizada"),
      s("2026-09-23", "cancelada"),
      s("2026-09-30", "realizada"),
      s("2026-10-07", "realizada"),
      s("2026-10-14"),
      s("2026-10-21"),
      s("2026-10-28"),
    ];
    const p = posicoes(sessoes, { pacoteTipo: "fragmentado", tamanhos: [3, 3] });
    expect(sessoes.map((x) => rotulo(p, x.id))).toEqual(["1/3", "2/3", "2/3", "3/3", "1/3", "2/3", "3/3"]);
  });

  it("acabando a lista de tamanhos, o último vale para as seguintes", () => {
    const sessoes = ["2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22", "2026-09-29", "2026-10-06"].map((d) => s(d));
    const p = posicoes(sessoes, { pacoteTipo: "fragmentado", tamanhos: [2] });
    expect(sessoes.map((x) => rotulo(p, x.id))).toEqual(["1/2", "2/2", "1/2", "2/2", "1/2", "2/2"]);
  });

  it("sem tamanho nenhum, cai no pacote de quatro", () => {
    const p = posicoes([s("2026-09-16")], { pacoteTipo: "fragmentado" });
    expect(rotulo(p, "2026-09-16")).toBe("1/4");
  });
});

describe("inserir, excluir e alterar recalculam tudo que vem depois", () => {
  const base = [
    s("2026-09-16", "realizada"),
    s("2026-09-23", "cancelada"),
    s("2026-09-30"),
    s("2026-10-07"),
    s("2026-10-14"),
  ];

  it("o encaixe do meio entra na posição pausada — o exemplo delas", () => {
    // Com 16/09 Presente e 23/09 Desmarcou, o novo 25/09 entra como 2/4.
    const com = [...base, s("2026-09-25")].sort((a, b) => a.date.getTime() - b.date.getTime());
    const p = posicoes(com, { pacoteTipo: "completo" });
    expect(rotulo(p, "2026-09-25")).toBe("2/4");
    expect(rotulo(p, "2026-09-30")).toBe("3/4");
    expect(rotulo(p, "2026-10-07")).toBe("4/4");
    expect(rotulo(p, "2026-10-14")).toBe("1/4");
  });

  it("tirar uma do meio puxa as seguintes para trás", () => {
    const sem = base.filter((x) => x.id !== "2026-09-30");
    const p = posicoes(sem, { pacoteTipo: "completo" });
    expect(rotulo(p, "2026-10-07")).toBe("2/4");
  });

  it("mudar um status para pausa devolve a posição à seguinte", () => {
    const antes = posicoes(base, { pacoteTipo: "completo" });
    expect(rotulo(antes, "2026-10-07")).toBe("3/4");

    const depois = posicoes(
      base.map((x) => (x.id === "2026-09-30" ? { ...x, status: "atestado" } : x)),
      { pacoteTipo: "completo" },
    );
    expect(rotulo(depois, "2026-10-07")).toBe("2/4");
  });

  it("a ordem de entrada não importa: quem manda é a data", () => {
    const baralhado = [...base].reverse();
    const a = posicoes(base, { pacoteTipo: "completo" });
    const b = posicoes(baralhado, { pacoteTipo: "completo" });
    for (const x of base) expect(rotulo(b, x.id)).toBe(rotulo(a, x.id));
  });
});

describe("a cobrança segue a sequência, não o calendário", () => {
  it("a sequência de setembro que fechou em outubro cobra em OUTUBRO", () => {
    // Decisão do dono: cobra por sequência. A sequência fecha na data da última sessão dela.
    const sessoes = [
      s("2026-09-16", "realizada"),
      s("2026-09-23", "cancelada"),
      s("2026-09-30", "realizada"),
      s("2026-10-07", "realizada"),
    ];
    const fechadas = sequenciasFechadasNoMes(sessoes, { pacoteTipo: "fragmentado", tamanhos: [3] }, 2026, 9);
    expect(fechadas).toHaveLength(1);
    expect(fechadas[0].total).toBe(3);
    expect(fechadas[0].fechouEm?.toISOString().slice(0, 10)).toBe("2026-10-07");
  });

  it("setembro não cobra nada dessa sequência, porque ela não fechou lá", () => {
    const sessoes = [
      s("2026-09-16", "realizada"),
      s("2026-09-23", "cancelada"),
      s("2026-09-30", "realizada"),
      s("2026-10-07", "realizada"),
    ];
    expect(sequenciasFechadasNoMes(sessoes, { pacoteTipo: "fragmentado", tamanhos: [3] }, 2026, 8)).toHaveLength(0);
  });

  it("sequência ainda aberta não cobra", () => {
    const sessoes = [s("2026-09-16", "realizada"), s("2026-09-23", "realizada")];
    expect(sequenciasFechadasNoMes(sessoes, { pacoteTipo: "completo" }, 2026, 8)).toHaveLength(0);
  });

  it("duas sequências fechadas no mesmo mês cobram as duas", () => {
    const dias = ["2026-09-02", "2026-09-09", "2026-09-16", "2026-09-23"];
    const sessoes = dias.map((d) => s(d, "realizada"));
    const fechadas = sequenciasFechadasNoMes(sessoes, { pacoteTipo: "fragmentado", tamanhos: [2, 2] }, 2026, 8);
    expect(fechadas).toHaveLength(2);
    expect(fechadas.reduce((t, f) => t + f.total, 0)).toBe(4);
  });

  it("o pacote completo cobra quatro, mesmo com uma pausa no meio", () => {
    const sessoes = [
      s("2026-09-02", "realizada"),
      s("2026-09-09", "atestado"),
      s("2026-09-16", "realizada"),
      s("2026-09-23", "realizada"),
      s("2026-09-30", "realizada"),
    ];
    const fechadas = sequenciasFechadasNoMes(sessoes, { pacoteTipo: "completo" }, 2026, 8);
    expect(fechadas).toHaveLength(1);
    expect(fechadas[0].total).toBe(4);
  });
});

describe("de onde saem os tamanhos", () => {
  it("os pacotes contratados, na ordem", () => {
    expect(tamanhosDasSequencias([{ seq: 2, sessions: 7 }, { seq: 1, sessions: 3 }])).toEqual([3, 7]);
  });

  it("sem pacote nenhum, a lista é vazia e o motor usa o padrão", () => {
    expect(tamanhosDasSequencias([])).toEqual([]);
  });

  it("tamanho inválido é descartado em vez de virar 0/0 na tela", () => {
    expect(tamanhosDasSequencias([{ seq: 1, sessions: 0 }, { seq: 2, sessions: 4 }])).toEqual([4]);
  });
});

describe("casos que não podem derrubar a agenda", () => {
  it("lista vazia", () => {
    expect(posicoes([], { pacoteTipo: "completo" }).size).toBe(0);
  });

  it("data inválida é ignorada, e o resto continua numerado", () => {
    const ruim = { id: "ruim", date: new Date("nada"), status: "agendada" };
    const p = posicoesDaSequencia([ruim, s("2026-09-16")], { pacoteTipo: "completo" });
    expect(p.has("ruim")).toBe(false);
    expect(rotulo(p, "2026-09-16")).toBe("1/4");
  });

  it("duas sessões no mesmo instante recebem posições diferentes", () => {
    const a = { id: "a", date: new Date("2026-09-16T09:00:00"), status: "agendada" };
    const b = { id: "b", date: new Date("2026-09-16T09:00:00"), status: "agendada" };
    const p = posicoesDaSequencia([a, b], { pacoteTipo: "completo" });
    expect(p.get("a")!.index).not.toBe(p.get("b")!.index);
  });
});

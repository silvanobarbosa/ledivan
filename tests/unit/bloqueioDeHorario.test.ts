import { describe, expect, it } from "vitest";
import { datasDaRepeticao, emRotulo, horariosLivres, notaParaGravar, textoDoBloqueio, TETO_DA_REPETICAO, TEXTO_PADRAO_DO_BLOQUEIO } from "@/lib/bloqueioDeHorario";

const livres = (ocupados: { inicio: number; duracao: number }[], extra = {}) =>
  horariosLivres({ ocupados, primeiraHora: 6, ultimaHora: 21, ...extra }).map((h) => h.rotulo);

const hora = (h: number, m = 0) => h * 60 + m;

describe("os horários que a janela oferece", () => {
  it("dia vazio oferece a grade inteira, das 6h às 20h", () => {
    const l = livres([]);
    expect(l).toHaveLength(15);
    expect(l[0]).toBe("06:00");
    expect(l[l.length - 1]).toBe("20:00");
  });

  it("horário com paciente não aparece: bloquear em cima dele seria engano fácil", () => {
    expect(livres([{ inicio: hora(9), duracao: 50 }])).not.toContain("09:00");
  });

  it("a sessão das 8h30 atravessa as 9h, e as 9h deixam de estar livres", () => {
    // Ocupar é encostar, não coincidir. Meia hora de sobreposição já tira o horário da lista.
    const l = livres([{ inicio: hora(8, 30), duracao: 60 }]);
    expect(l).not.toContain("09:00");
    expect(l).not.toContain("08:00");
  });

  it("sessão que termina exatamente na hora cheia não rouba a hora seguinte", () => {
    // 9h–10h e 10h são vizinhos, não concorrentes.
    expect(livres([{ inicio: hora(9), duracao: 60 }])).toContain("10:00");
  });

  it("vários compromissos tiram vários horários", () => {
    const l = livres([
      { inicio: hora(8), duracao: 50 },
      { inicio: hora(14), duracao: 50 },
      { inicio: hora(19), duracao: 50 },
    ]);
    expect(l).not.toContain("08:00");
    expect(l).not.toContain("14:00");
    expect(l).not.toContain("19:00");
    expect(l).toContain("09:00");
    expect(l).toHaveLength(12);
  });

  it("dia cheio não oferece nada", () => {
    const cheio = Array.from({ length: 15 }, (_, i) => ({ inicio: hora(6 + i), duracao: 60 }));
    expect(livres(cheio)).toHaveLength(0);
  });

  it("a grade pode oferecer de meia em meia hora", () => {
    const l = livres([], { passoMinutos: 30, duracaoMinutos: 30 });
    expect(l).toContain("06:30");
    expect(l).toHaveLength(30);
  });

  it("dado torto é descartado em vez de sumir com a lista", () => {
    const l = livres([{ inicio: NaN, duracao: 50 }]);
    expect(l).toHaveLength(15);
  });
});

describe("o texto da célula preta", () => {
  it("sem texto, diz HORÁRIO BLOQUEADO", () => {
    expect(textoDoBloqueio(null)).toBe(TEXTO_PADRAO_DO_BLOQUEIO);
    expect(textoDoBloqueio("")).toBe(TEXTO_PADRAO_DO_BLOQUEIO);
    expect(textoDoBloqueio("   ")).toBe(TEXTO_PADRAO_DO_BLOQUEIO);
  });

  it("com texto, diz o que foi escrito", () => {
    expect(textoDoBloqueio("Supervisão")).toBe("Supervisão");
  });
});

describe("o que vai para o banco", () => {
  it("texto vazio não vira linha em branco", () => {
    expect(notaParaGravar("   ")).toBeNull();
    expect(notaParaGravar(null)).toBeNull();
  });

  it("texto comprido é cortado antes de entrar", () => {
    expect(notaParaGravar("x".repeat(300))).toHaveLength(120);
  });

  it("espaço em volta some", () => {
    expect(notaParaGravar("  Médico  ")).toBe("Médico");
  });
});

describe("o rótulo do horário", () => {
  it("escreve com dois dígitos", () => {
    expect(emRotulo(hora(6))).toBe("06:00");
    expect(emRotulo(hora(14, 30))).toBe("14:30");
  });
});

describe("doc 69 — repetir o bloqueio até uma data", () => {
  // Uma quarta-feira.
  const QUARTA = new Date(2026, 10, 4);

  it("sem limite, é só o próprio dia — bloquear uma vez não pode depender de mais um campo", () => {
    expect(datasDaRepeticao(QUARTA, null)).toHaveLength(1);
  });

  it("repete de sete em sete, no mesmo dia da semana", () => {
    const datas = datasDaRepeticao(QUARTA, new Date(2026, 10, 25));
    expect(datas.map((d) => d.getDate())).toEqual([4, 11, 18, 25]);
    expect(new Set(datas.map((d) => d.getDay()))).toEqual(new Set([3]));
  });

  it("o limite entra quando cai no dia certo, e não entra quando cai no meio da semana", () => {
    expect(datasDaRepeticao(QUARTA, new Date(2026, 10, 24)).map((d) => d.getDate())).toEqual([4, 11, 18]);
  });

  it("limite antes do dia escolhido não apaga o bloqueio do dia", () => {
    expect(datasDaRepeticao(QUARTA, new Date(2026, 9, 1))).toHaveLength(1);
  });

  it("ano digitado errado não vira cinco mil linhas no banco", () => {
    expect(datasDaRepeticao(QUARTA, new Date(2126, 0, 1))).toHaveLength(TETO_DA_REPETICAO);
  });

  it("atravessa a virada do mês e do ano sem perder o dia da semana", () => {
    const datas = datasDaRepeticao(new Date(2026, 11, 23), new Date(2027, 0, 13));
    expect(datas.map((d) => `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`)).toEqual([
      "23/12/2026", "30/12/2026", "6/1/2027", "13/1/2027",
    ]);
  });
});

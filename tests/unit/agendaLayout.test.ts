import { describe, expect, it } from "vitest";
import { geometriaDaFaixa, posicoesDoDia, type BlocoNaAgenda } from "@/lib/agendaLayout";

/**
 * Duas sessões no mesmo horário existem na agenda de verdade — a conta de demonstração tem quatro
 * casos numa única semana. Enquanto o bloco tinha fundo opaco isso passava batido: a de baixo
 * simplesmente sumia. Com o fundo transparente do lote, os textos passaram a se sobrepor.
 */

const bloco = (id: string, hora: number, minuto = 0, duracao = 50): BlocoNaAgenda => ({
  id,
  inicio: hora * 60 + minuto,
  duracao,
});

describe("quem não divide horário com ninguém", () => {
  it("ocupa a coluna inteira", () => {
    const p = posicoesDoDia([bloco("a", 9), bloco("b", 14), bloco("c", 16)]);
    for (const id of ["a", "b", "c"]) {
      expect(p.get(id)).toEqual({ faixa: 0, faixas: 1 });
    }
  });

  it("dia vazio não quebra", () => {
    expect(posicoesDoDia([]).size).toBe(0);
  });

  it("sessão colada na anterior é vizinha, não concorrente", () => {
    // 9h–10h e 10h–11h não se sobrepõem: a segunda começa quando a primeira acabou.
    const p = posicoesDoDia([bloco("a", 9, 0, 60), bloco("b", 10, 0, 60)]);
    expect(p.get("a")?.faixas).toBe(1);
    expect(p.get("b")?.faixas).toBe(1);
  });
});

describe("duas no mesmo horário", () => {
  it("dividem a coluna em duas faixas, cada uma na sua", () => {
    const p = posicoesDoDia([bloco("a", 15), bloco("b", 15)]);
    expect(p.get("a")).toEqual({ faixa: 0, faixas: 2 });
    expect(p.get("b")).toEqual({ faixa: 1, faixas: 2 });
  });

  it("sobreposição parcial também divide", () => {
    const p = posicoesDoDia([bloco("a", 9, 0, 60), bloco("b", 9, 30, 60)]);
    expect(p.get("a")?.faixas).toBe(2);
    expect(p.get("b")?.faixas).toBe(2);
    expect(p.get("a")?.faixa).not.toBe(p.get("b")?.faixa);
  });

  it("nenhuma das duas fica escondida atrás da outra", () => {
    const p = posicoesDoDia([bloco("a", 20), bloco("b", 20)]);
    const faixas = [p.get("a")!.faixa, p.get("b")!.faixa];
    expect(new Set(faixas).size).toBe(2);
  });
});

describe("o encadeamento", () => {
  it("A cruza com B e B cruza com C: as três entram no mesmo grupo", () => {
    // A 9h–10h, B 9h45–10h45, C 10h30–11h30. Se só A×B e B×C fossem considerados em separado, B
    // acabaria por cima de alguém.
    const p = posicoesDoDia([
      bloco("a", 9, 0, 60),
      bloco("b", 9, 45, 60),
      bloco("c", 10, 30, 60),
    ]);
    // Duas faixas bastam, e é o certo: A e C não se tocam, então reaproveitam a mesma. Abrir uma
    // terceira estreitaria a coluna em um terço sem ninguém precisar.
    expect(p.get("a")?.faixas).toBe(2);
    expect(p.get("a")?.faixa).toBe(p.get("c")?.faixa);
    expect(p.get("b")?.faixa).not.toBe(p.get("a")?.faixa);
  });

  it("a invariante: quem se sobrepõe no tempo nunca divide a mesma faixa", () => {
    // É a única coisa que precisa ser sempre verdade. O resto é economia de largura.
    const dia = [
      bloco("a", 8, 0, 90),
      bloco("b", 8, 30, 30),
      bloco("c", 9, 0, 120),
      bloco("d", 9, 15, 45),
      bloco("e", 14, 0, 50),
      bloco("f", 14, 0, 50),
      bloco("g", 14, 0, 50),
    ];
    const p = posicoesDoDia(dia);
    const fim = (b: (typeof dia)[number]) => b.inicio + b.duracao;

    for (const x of dia) {
      for (const y of dia) {
        if (x.id >= y.id) continue;
        const cruzam = x.inicio < fim(y) && y.inicio < fim(x);
        if (!cruzam) continue;
        expect(
          p.get(x.id)!.faixa,
          `${x.id} e ${y.id} se sobrepõem e caíram na mesma faixa`,
        ).not.toBe(p.get(y.id)!.faixa);
      }
    }
  });

  it("grupos separados não estreitam um ao outro", () => {
    const p = posicoesDoDia([bloco("a", 9), bloco("b", 9), bloco("c", 15)]);
    expect(p.get("a")?.faixas).toBe(2);
    expect(p.get("c")?.faixas).toBe(1);
  });
});

describe("a geometria", () => {
  it("sozinha ocupa tudo", () => {
    expect(geometriaDaFaixa({ faixa: 0, faixas: 1 })).toEqual({ left: "0%", width: "100%" });
  });

  it("duas dividem ao meio, sem se encavalar", () => {
    const esquerda = geometriaDaFaixa({ faixa: 0, faixas: 2 });
    const direita = geometriaDaFaixa({ faixa: 1, faixas: 2 });
    expect(esquerda.left).toBe("0%");
    expect(direita.left).toBe("50%");
    expect(esquerda.width).toBe(direita.width);
  });

  it("sem posição, ocupa a coluna inteira em vez de sumir", () => {
    expect(geometriaDaFaixa(undefined)).toEqual({ left: "0%", width: "100%" });
  });
});

describe("dado torto não derruba a tela", () => {
  it("duração zero ainda recebe faixa", () => {
    const p = posicoesDoDia([{ id: "a", inicio: 540, duracao: 0 }, bloco("b", 9)]);
    expect(p.get("a")).toBeDefined();
    expect(p.get("b")).toBeDefined();
  });

  it("horário inválido é ignorado, e o resto continua", () => {
    const p = posicoesDoDia([{ id: "ruim", inicio: NaN, duracao: 50 }, bloco("ok", 11)]);
    expect(p.has("ruim")).toBe(false);
    expect(p.get("ok")).toEqual({ faixa: 0, faixas: 1 });
  });
});

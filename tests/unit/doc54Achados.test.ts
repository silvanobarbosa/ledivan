import { describe, expect, it } from "vitest";
import { podeSerCortesia } from "@/lib/cortesia";
import { maisRecenteDoHistorico } from "@/lib/reajuste";

/**
 * Achados do SuperQA sobre o lote do doc 54 (22/10/2026).
 */

describe("cortesia não é oferecida em sessão que já está FORA do pacote", () => {
  /**
   * A cortesia abre uma vaga DENTRO da sequência numerada. Uma sessão extra (`avul`/`grat`) já
   * acontece fora dela: marcar cortesia ali não tira posição nenhuma, e a avulsa continua sendo
   * cobrada pelo caminho das extras. O checkbox aparecia e não fazia nada — promessa falsa, que é
   * pior do que não oferecer.
   */
  it("avulsa encaixada: a pergunta não aparece", () => {
    expect(podeSerCortesia({ formato: "mensal", pacoteTipo: "completo", extra: "avul" })).toBe(false);
  });

  it("extra gratuita: também não — ela já não cobra", () => {
    expect(podeSerCortesia({ formato: "mensal", pacoteTipo: "completo", extra: "grat" })).toBe(false);
  });

  it("sessão comum do pacote continua oferecendo", () => {
    expect(podeSerCortesia({ formato: "mensal", pacoteTipo: "completo", extra: null })).toBe(true);
    expect(podeSerCortesia({ formato: "quinzenal", pacoteTipo: "completo" })).toBe(true);
  });
});

describe("maisRecenteDoHistorico — qual registro vale depois de apagar um reajuste", () => {
  /**
   * Apagar um reajuste reconcilia o cadastro com o que sobrou. A escolha do "último" ordenava só
   * por data de vigência, e as leituras do banco não têm `ORDER BY` — então, com vários registros
   * na MESMA vigência, o escolhido era qualquer um deles, e duas execuções iguais podiam gravar
   * formatos diferentes no cadastro.
   *
   * Isso virou comum justamente por causa do doc 54: ele existe para permitir várias alterações na
   * mesma vigência. O desempate aqui é o mesmo de `entradaDoHistorico`, pela ponta oposta.
   */
  const reg = (id: string, dia: number, criadoEm: string) => ({
    id, dataEfetiva: new Date(2024, 7, dia), dataCriacao: new Date(criadoEm),
  });

  it("empate na vigência: vale o gravado por ÚLTIMO, não um qualquer", () => {
    const baralhado = [
      reg("b", 9, "2026-10-21T23:58:02Z"),
      reg("c", 9, "2026-10-21T23:58:03Z"),
      reg("a", 9, "2026-10-21T23:58:01Z"),
    ];
    expect(maisRecenteDoHistorico(baralhado)?.id).toBe("c");
  });

  it("a resposta não depende da ordem em que o banco devolveu", () => {
    const base = [reg("a", 9, "2026-10-21T23:58:01Z"), reg("b", 9, "2026-10-21T23:58:02Z"), reg("c", 9, "2026-10-21T23:58:03Z")];
    const escolhas = new Set([
      maisRecenteDoHistorico(base)?.id,
      maisRecenteDoHistorico([...base].reverse())?.id,
      maisRecenteDoHistorico([base[1], base[2], base[0]])?.id,
    ]);
    expect([...escolhas]).toEqual(["c"]);
  });

  it("vigências diferentes: manda a data, como sempre mandou", () => {
    const xs = [reg("velho", 9, "2026-10-21T23:58:09Z"), reg("novo", 20, "2026-10-21T23:58:01Z")];
    expect(maisRecenteDoHistorico(xs)?.id).toBe("novo");
  });

  it("lista vazia não tem último", () => {
    expect(maisRecenteDoHistorico([])).toBeNull();
  });
});

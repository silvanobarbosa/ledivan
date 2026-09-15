import { describe, expect, it } from "vitest";
import { formatoNaData, periodosDeVigencia, separarPorVigencia } from "@/lib/vigenciaDoFormato";

/**
 * O FORMATO DE PAGAMENTO GANHA DATA DE VIGÊNCIA.
 *
 * Regra do dono (15/09/2026): "a alteração da forma de cobrança deve valer somente a partir da data
 * definida, sem modificar os atendimentos anteriores. Gratuito é gratuito enquanto essa modalidade
 * estiver vigente."
 *
 * É o mesmo modelo que o preço já tinha (`patient_price_history.dataEfetiva`) e que faltava ao
 * formato — sem ele, trocar o formato hoje reescrevia o que agosto cobrou.
 */

const d = (dia: number, mes = 8) => new Date(2026, mes, dia, 12, 0, 0);
const reserva = { formato: "mensal", pacoteTipo: "completo" };

describe("os períodos", () => {
  it("sem histórico, um período só, com o formato do cadastro, valendo sempre", () => {
    const p = periodosDeVigencia([], reserva);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatchObject({ formato: "mensal", pacoteTipo: "completo", inicio: null, fim: null });
  });

  it("uma troca parte a história em dois", () => {
    const p = periodosDeVigencia(
      [
        { formato: "gratuito", desde: d(1, 6) },
        { formato: "sessao", desde: d(10) },
      ],
      reserva,
    );
    expect(p.map((x) => x.formato)).toEqual(["gratuito", "sessao"]);
    // O primeiro vale para trás também: sessão marcada antes do primeiro registro não fica sem regra.
    expect(p[0].inicio).toBeNull();
    // A fronteira é o INÍCIO do dia da troca, não a hora em que ela foi digitada.
    const meiaNoite = new Date(2026, 8, 10).getTime();
    expect(p[0].fim?.getTime()).toBe(meiaNoite);
    expect(p[1].inicio?.getTime()).toBe(meiaNoite);
    expect(p[1].fim).toBeNull();
  });

  it("a ordem é a da data, não a da inserção", () => {
    const p = periodosDeVigencia(
      [
        { formato: "sessao", desde: d(10) },
        { formato: "gratuito", desde: d(1, 6) },
      ],
      reserva,
    );
    expect(p.map((x) => x.formato)).toEqual(["gratuito", "sessao"]);
  });

  it("duas trocas no MESMO dia: vale a última registrada", () => {
    const p = periodosDeVigencia(
      [
        { formato: "sessao", desde: d(10), criadoEm: new Date(2026, 8, 10, 9) },
        { formato: "mensal", desde: d(10), criadoEm: new Date(2026, 8, 10, 11) },
      ],
      reserva,
    );
    expect(p).toHaveLength(1);
    expect(p[0].formato).toBe("mensal");
  });

  it("repetir o mesmo formato não cria período novo", () => {
    const p = periodosDeVigencia(
      [
        { formato: "sessao", desde: d(1, 6) },
        { formato: "sessao", desde: d(10) },
      ],
      reserva,
    );
    expect(p).toHaveLength(1);
  });

  it("trocar só completo ↔ fragmentado também é troca", () => {
    const p = periodosDeVigencia(
      [
        { formato: "mensal", pacoteTipo: "completo", desde: d(1, 6) },
        { formato: "mensal", pacoteTipo: "fragmentado", desde: d(10) },
      ],
      reserva,
    );
    expect(p.map((x) => x.pacoteTipo)).toEqual(["completo", "fragmentado"]);
  });

  it("linha com data inválida é descartada em vez de derrubar a conta", () => {
    const p = periodosDeVigencia([{ formato: "sessao", desde: "nada" }], reserva);
    expect(p[0].formato).toBe("mensal");
  });
});

describe("o formato de um dia", () => {
  const vig = [
    { formato: "gratuito", desde: d(1, 6) },
    { formato: "sessao", desde: d(10) },
  ];

  it("antes da troca, gratuito", () => {
    expect(formatoNaData(vig, d(5), reserva).formato).toBe("gratuito");
  });

  it("no próprio dia da troca, já vale o novo", () => {
    expect(formatoNaData(vig, new Date(2026, 8, 10, 0, 0, 1), reserva).formato).toBe("sessao");
  });

  it("depois, o novo", () => {
    expect(formatoNaData(vig, d(20), reserva).formato).toBe("sessao");
  });

  it("a troca vale a partir do DIA, não da hora: sessão às 8h no dia da troca registrada ao meio-dia já é do novo", () => {
    const manha = new Date(2026, 8, 10, 8, 0, 0);
    expect(formatoNaData([{ formato: "gratuito", desde: d(1, 6) }, { formato: "sessao", desde: d(10) }], manha, reserva).formato).toBe("sessao");
  });
});

describe("separar as sessões pelo período em que aconteceram", () => {
  it("cada sessão cai no período do seu dia", () => {
    const periodos = periodosDeVigencia(
      [
        { formato: "gratuito", desde: d(1, 6) },
        { formato: "sessao", desde: d(10) },
      ],
      reserva,
    );
    const sessoes = [3, 8, 10, 17].map((dia) => ({ id: `s${dia}`, date: d(dia) }));
    const grupos = separarPorVigencia(sessoes, periodos);
    expect(grupos.map((g) => [g.periodo.formato, g.sessoes.map((s) => s.id)])).toEqual([
      ["gratuito", ["s3", "s8"]],
      ["sessao", ["s10", "s17"]],
    ]);
  });

  it("período sem sessão continua na lista, vazio — ninguém some por não ter sido atendido", () => {
    const periodos = periodosDeVigencia(
      [
        { formato: "gratuito", desde: d(1, 6) },
        { formato: "sessao", desde: d(10) },
      ],
      reserva,
    );
    const grupos = separarPorVigencia([{ id: "a", date: d(20) }], periodos);
    expect(grupos).toHaveLength(2);
    expect(grupos[0].sessoes).toEqual([]);
  });
});

import { describe, it, expect } from "vitest";
import { linhasDaGeral } from "@/lib/guiaGeral";

/**
 * Doc 67: a sessão vira avulsa e passa a dever NA HORA DELA.
 *
 * Duas portas levam ao mesmo lugar e o dono pediu as duas:
 *  - a sessão marcada como AVUL fora da guia Financeiro (as janelas "Esta sessão será cobrada?
 *    Sim (AVUL)" e "Qual o valor desta sessão?");
 *  - o paciente que paga a cada sessão e NÃO tem nada no campo "pagar até".
 *
 * Em ambos, o limite é o instante do atendimento — 13h do dia da sessão —, não o fim daquele dia.
 */
const SESSAO = new Date(2026, 9, 31, 13, 0, 0); // 31/10/2026, 13:00

const base = {
  vigencias: [],
  precos: [{ valor: 100, desde: new Date(2020, 0, 1) }],
  valorDaSessao: 100,
  pagamentos: [],
  tamanhos: [],
};

/** As situações de todas as cobranças que a Geral desenhou — na linha da sessão ou na própria. */
const situacoes = (e: Parameters<typeof linhasDaGeral>[0]): string[] => {
  const out: string[] = [];
  for (const l of linhasDaGeral(e)) {
    if (l.tipo === "sessao" && l.cobranca) out.push(l.cobranca.situacao);
    if (l.tipo === "pagamento") out.push(l.situacao);
  }
  return out;
};

describe("doc 67 — a avulsa vence no horário da sessão", () => {
  const cenario = (hoje: Date, extra: "avul" | null, formato: string) => ({
    ...base,
    reserva: { formato },
    sessoes: [{
      id: "s1", date: SESSAO, status: "realizada",
      ...(extra ? { extra, valorExtra: 85 } : {}),
    }],
    hoje,
  }) as unknown as Parameters<typeof linhasDaGeral>[0];

  it("extra AVUL: em aberto às 12h, em atraso às 13h01", () => {
    expect(situacoes(cenario(new Date(2026, 9, 31, 12, 0), "avul", "mensal"))).toContain("em_aberto");
    expect(situacoes(cenario(new Date(2026, 9, 31, 13, 1), "avul", "mensal"))).toContain("em_atraso");
  });

  it("não espera o fim do dia: às 23h do mesmo dia já está em atraso", () => {
    expect(situacoes(cenario(new Date(2026, 9, 31, 23, 0), "avul", "mensal"))).toContain("em_atraso");
  });

  it("'a cada sessão' sem 'pagar até' segue a mesma régua", () => {
    expect(situacoes(cenario(new Date(2026, 9, 31, 12, 0), null, "sessao"))).toContain("em_aberto");
    expect(situacoes(cenario(new Date(2026, 9, 31, 13, 1), null, "sessao"))).toContain("em_atraso");
  });

  it("com 'pagar até' de 24 horas antes, o limite ANDA PARA TRÁS, nunca para a frente", () => {
    const e = { ...cenario(new Date(2026, 9, 30, 14, 0), null, "sessao"), horasAntesPagamento: 24 };
    expect(situacoes(e as unknown as Parameters<typeof linhasDaGeral>[0])).toContain("em_atraso");
  });
});

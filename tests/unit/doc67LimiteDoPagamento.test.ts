import { describe, it, expect } from "vitest";
import { limiteDoPagamento, pagamentoAtrasado, prazoDoPagamento } from "@/lib/pagamentoSessao";

const SESSAO = new Date(2026, 9, 31, 13, 0, 0); // 31/10/2026, 13:00

describe("doc 67 — o limite do pagamento de uma sessão", () => {
  it("sem 'pagar até', o limite é o horário da PRÓPRIA sessão", () => {
    expect(limiteDoPagamento(SESSAO, null)?.getTime()).toBe(SESSAO.getTime());
    expect(limiteDoPagamento(SESSAO, 0)?.getTime()).toBe(SESSAO.getTime());
  });

  it("com 'pagar até', o limite anda para TRÁS — nunca para a frente", () => {
    expect(limiteDoPagamento(SESSAO, 24)?.getTime()).toBe(SESSAO.getTime() - 24 * 3600000);
  });

  it("o aviso ao PACIENTE continua sem prazo quando nada foi combinado", () => {
    // Deliberado: mudar isto faria o app escrever para paciente que ninguém mandou escrever.
    expect(prazoDoPagamento(SESSAO, null)).toBeNull();
    expect(limiteDoPagamento(SESSAO, null)).not.toBeNull();
  });

  it("sem 'pagar até': em dia às 12h59, atrasada às 13h01", () => {
    const comum = { dataSessao: SESSAO, horasAntes: null, pago: false };
    expect(pagamentoAtrasado({ ...comum, agora: new Date(2026, 9, 31, 12, 59) })).toBe(false);
    expect(pagamentoAtrasado({ ...comum, agora: new Date(2026, 9, 31, 13, 1) })).toBe(true);
  });

  it("paga não atrasa, e status que pausa também não", () => {
    const tarde = new Date(2026, 9, 31, 23, 0);
    expect(pagamentoAtrasado({ agora: tarde, dataSessao: SESSAO, horasAntes: null, pago: true })).toBe(false);
    for (const status of ["cancelada", "realocada", "falta"]) {
      expect(pagamentoAtrasado({ agora: tarde, dataSessao: SESSAO, horasAntes: null, pago: false, status })).toBe(false);
    }
  });
});

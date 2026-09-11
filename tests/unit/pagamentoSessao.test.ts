import { describe, expect, it } from "vitest";
import { avisoPagamentoTexto, deveAvisar, pagamentoAtrasado, prazoDoPagamento } from "@/lib/pagamentoSessao";

const sessao = new Date(2026, 8, 16, 8, 0); // quarta, 16/09/2026, 8h

describe("prazoDoPagamento", () => {
  it("tira as horas combinadas da hora da sessão", () => {
    expect(prazoDoPagamento(sessao, 24)).toEqual(new Date(2026, 8, 15, 8, 0));
  });

  it("sem horas combinadas, não há prazo", () => {
    expect(prazoDoPagamento(sessao, null)).toBeNull();
    expect(prazoDoPagamento(sessao, 0)).toBeNull();
  });
});

describe("deveAvisar", () => {
  const base = { dataSessao: sessao, horasAntes: 24, jaAvisado: false, pago: false };

  it("avisa quando o prazo está dentro da próxima rodada do cron", () => {
    expect(deveAvisar({ ...base, agora: new Date(2026, 8, 14, 12, 0) })).toBe(true);
  });

  it("não avisa cedo demais", () => {
    expect(deveAvisar({ ...base, agora: new Date(2026, 8, 10, 12, 0) })).toBe(false);
  });

  it("é UMA mensagem só: já avisado não avisa de novo", () => {
    expect(deveAvisar({ ...base, agora: new Date(2026, 8, 15, 7, 0), jaAvisado: true })).toBe(false);
  });

  it("quem já pagou não recebe cobrança", () => {
    expect(deveAvisar({ ...base, agora: new Date(2026, 8, 15, 7, 0), pago: true })).toBe(false);
  });

  it("sessão que já aconteceu não gera aviso", () => {
    expect(deveAvisar({ ...base, agora: new Date(2026, 8, 16, 9, 0) })).toBe(false);
  });

  it("sem prazo combinado, não avisa", () => {
    expect(deveAvisar({ ...base, agora: new Date(2026, 8, 15, 7, 0), horasAntes: null })).toBe(false);
  });

  it("com cron de 15 minutos, respeita a antecedência de verdade", () => {
    const opts = { ...base, intervaloMin: 15 };
    expect(deveAvisar({ ...opts, agora: new Date(2026, 8, 15, 7, 0) })).toBe(false);
    expect(deveAvisar({ ...opts, agora: new Date(2026, 8, 15, 7, 50) })).toBe(true);
  });
});

describe("pagamentoAtrasado", () => {
  const base = { dataSessao: sessao, horasAntes: 24, pago: false };

  it("passou do prazo e não pagou: atrasado", () => {
    expect(pagamentoAtrasado({ ...base, agora: new Date(2026, 8, 15, 20, 0) })).toBe(true);
  });

  it("dentro do prazo não é atraso", () => {
    expect(pagamentoAtrasado({ ...base, agora: new Date(2026, 8, 15, 7, 0) })).toBe(false);
  });

  it("pago não atrasa", () => {
    expect(pagamentoAtrasado({ ...base, agora: new Date(2026, 8, 16, 7, 0), pago: true })).toBe(false);
  });

  it("sessão cancelada ou falta não cobra", () => {
    expect(pagamentoAtrasado({ ...base, agora: new Date(2026, 8, 16, 7, 0), status: "cancelada" })).toBe(false);
    expect(pagamentoAtrasado({ ...base, agora: new Date(2026, 8, 16, 7, 0), status: "falta" })).toBe(false);
  });

  it("sem prazo combinado não existe atraso", () => {
    expect(pagamentoAtrasado({ ...base, agora: new Date(2026, 8, 16, 7, 0), horasAntes: null })).toBe(false);
  });
});

describe("avisoPagamentoTexto", () => {
  const texto = avisoPagamentoTexto("Maria Silva de Souza", 200, sessao, new Date(2026, 8, 15, 8, 0), "Ledivan Barbosa");

  it("chama pelo primeiro nome e diz dia, hora, valor e prazo", () => {
    expect(texto).toContain("Maria");
    expect(texto).not.toContain("Silva");
    expect(texto).toContain("16/09");
    expect(texto).toContain("08:00");
    expect(texto).toContain("R$ 200,00");
    expect(texto).toContain("15/09");
  });

  it("não ameaça: nada de cancelamento automático no texto", () => {
    expect(texto.toLowerCase()).not.toContain("cancel");
    expect(texto.toLowerCase()).not.toContain("bloque");
  });

  it("sem valor combinado, não inventa número", () => {
    expect(avisoPagamentoTexto("João", 0, sessao, new Date(2026, 8, 15, 8, 0), "Ledivan")).not.toContain("R$");
  });
});

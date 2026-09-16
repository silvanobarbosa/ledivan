import { describe, it, expect } from "vitest";
import { rotuloFinanceiro, rotuloFrequencia, situacaoDaLista, ROTULO_SITUACAO_LISTA } from "@/lib/rotulosPaciente";

describe("rótulo financeiro da lista", () => {
  it("gratuito e a cada sessão falam por si", () => {
    expect(rotuloFinanceiro("gratuito", null)).toBe("Gratuito");
    expect(rotuloFinanceiro("sessao", null)).toBe("A cada sessão");
  });

  it("mensal e quinzenal dizem pacote ou fragmentado", () => {
    expect(rotuloFinanceiro("mensal", "completo")).toBe("Mensal pacote");
    expect(rotuloFinanceiro("mensal", "fragmentado")).toBe("Mensal fragmentado");
    expect(rotuloFinanceiro("quinzenal", "completo")).toBe("Quinzenal pacote");
    expect(rotuloFinanceiro("quinzenal", "fragmentado")).toBe("Quinzenal fragmentado");
    expect(rotuloFinanceiro("mensal", null)).toBe("Mensal pacote"); // sem tipo = pacote (o padrão)
  });

  it("primeira e última do pacote", () => {
    expect(rotuloFinanceiro("primeira_pacote", null)).toBe("Na primeira sessão do pacote");
    expect(rotuloFinanceiro("ultima_pacote", null)).toBe("Na última sessão do pacote");
  });

  it("valores legados avulso/pacote", () => {
    expect(rotuloFinanceiro("avulso", null)).toBe("A cada sessão");
    expect(rotuloFinanceiro("pacote", "completo")).toBe("Mensal pacote");
  });
});

describe("rótulo de frequência da lista", () => {
  it("não repetir vira 'Sem recorrência'", () => {
    expect(rotuloFrequencia("nao_repetir")).toBe("Sem recorrência");
    expect(rotuloFrequencia("pontual")).toBe("Sem recorrência");
    expect(rotuloFrequencia(null)).toBe("Sem recorrência");
    expect(rotuloFrequencia("")).toBe("Sem recorrência");
  });

  it("semanal mostra dia e hora", () => {
    expect(rotuloFrequencia("semanal", "segunda", "09:00")).toBe("Segunda 09:00");
    expect(rotuloFrequencia("semanal", "terca", "14:30")).toBe("Terça 14:30");
    expect(rotuloFrequencia("semanal", null, null)).toBe("Semanal");
  });

  it("quinzenal marca o quinzenal com o dia e a hora", () => {
    expect(rotuloFrequencia("quinzenal", "quarta", "10:00")).toBe("Quinzenal · Quarta 10:00");
    expect(rotuloFrequencia("quinzenal", null, null)).toBe("Quinzenal");
  });

  it("mensal é só 'Mensal'", () => {
    expect(rotuloFrequencia("mensal", "segunda", "09:00")).toBe("Mensal");
  });
});

describe("situação da lista", () => {
  it("atrasado manda sobre em aberto", () => {
    expect(situacaoDaLista(2, 1)).toBe("atrasado");
    expect(situacaoDaLista(0, 3)).toBe("atrasado");
  });
  it("em aberto sem atraso", () => {
    expect(situacaoDaLista(2, 0)).toBe("em_aberto");
  });
  it("sem pendência é em dia", () => {
    expect(situacaoDaLista(0, 0)).toBe("em_dia");
  });
  it("os rótulos existem", () => {
    expect(ROTULO_SITUACAO_LISTA.atrasado).toBe("Atrasado");
    expect(ROTULO_SITUACAO_LISTA.em_aberto).toBe("Em aberto");
    expect(ROTULO_SITUACAO_LISTA.em_dia).toBe("Em dia");
  });
});

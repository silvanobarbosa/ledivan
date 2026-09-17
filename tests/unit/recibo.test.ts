import { describe, it, expect } from "vitest";
import { dataBR, descricaoValida, montarRecibo, porExtenso, valorBR } from "@/lib/recibo";

const dia = (d: number, m: number, a: number) => new Date(a, m - 1, d, 12);

describe("o valor por extenso", () => {
  it("escreve o exemplo do documento", () => {
    expect(porExtenso(520)).toBe("quinhentos e vinte reais");
  });

  it("um real é singular", () => {
    expect(porExtenso(1)).toBe("um real");
    expect(porExtenso(2)).toBe("dois reais");
  });

  it("cem é cem, cento e um é cento e um", () => {
    expect(porExtenso(100)).toBe("cem reais");
    expect(porExtenso(101)).toBe("cento e um reais");
  });

  it("milhares", () => {
    expect(porExtenso(1000)).toBe("mil reais");
    expect(porExtenso(1200)).toBe("mil e duzentos reais");
    expect(porExtenso(2500)).toBe("dois mil e quinhentos reais");
  });

  it("centavos entram quando existem", () => {
    expect(porExtenso(10.5)).toBe("dez reais e cinquenta centavos");
    expect(porExtenso(0.01)).toBe("zero reais e um centavo");
  });

  it("valor redondo não ganha centavo à toa", () => {
    expect(porExtenso(300)).not.toContain("centavo");
  });
});

describe("data e valor no formato do recibo", () => {
  /** `toLocaleDateString` já fez data andar um dia neste app; aqui a data é montada à mão. */
  it("a data sai em dd/mm/aaaa, sem andar", () => {
    expect(dataBR(dia(14, 9, 2026))).toBe("14/09/2026");
    expect(dataBR(dia(1, 1, 2026))).toBe("01/01/2026");
  });

  it("o valor sai em reais", () => {
    expect(valorBR(520)).toContain("520,00");
  });
});

describe("a descrição do atendimento muda a palavra do recibo", () => {
  /**
   * Não é enfeite: "atendimentos psicológicos" num recibo de quem não é psicóloga é declaração
   * errada num documento que vai para o imposto de renda do paciente.
   */
  const base = {
    responsavel: "Ana Raquel Bassi",
    paciente: "Teste Completo 04",
    datas: [dia(14, 9, 2026), dia(21, 9, 2026)],
    valorTotal: 520,
    dataPagamento: dia(5, 10, 2026),
    terapeuta: "Ledivan de Souza",
    terapeutaCpf: "123.456.789-00",
  };

  it("terapia", () => {
    expect(montarRecibo({ ...base, descricao: "terapia" })).toContain("atendimentos terapêuticos");
  });

  it("psicanálise", () => {
    expect(montarRecibo({ ...base, descricao: "psicanalise" })).toContain("atendimentos psicanalíticos");
  });

  it("psicologia", () => {
    expect(montarRecibo({ ...base, descricao: "psicologia" })).toContain("atendimentos psicológicos");
  });

  it("escolha desconhecida cai em terapia, nunca numa profissão que a pessoa não tem", () => {
    expect(descricaoValida(null)).toBe("terapia");
    expect(descricaoValida("psicologa")).toBe("terapia");
    expect(descricaoValida("psicanalise")).toBe("psicanalise");
  });
});

describe("o recibo inteiro", () => {
  const base = {
    responsavel: "Ana Raquel Bassi",
    paciente: "Teste Completo 04",
    datas: [dia(14, 9, 2026), dia(21, 9, 2026), dia(28, 9, 2026), dia(5, 10, 2026)],
    valorTotal: 520,
    dataPagamento: dia(5, 10, 2026),
    terapeuta: "Ledivan de Souza",
    descricao: "psicanalise" as const,
  };

  it("traz o valor, o extenso, as datas e o pagamento", () => {
    const texto = montarRecibo({ ...base, responsavelCpf: "111.222.333-44", terapeutaCpf: "555.666.777-88" });
    expect(texto).toContain("RECIBO DE PAGAMENTO");
    expect(texto).toContain("Recebi de Ana Raquel Bassi, CPF 111.222.333-44");
    expect(texto).toContain("(quinhentos e vinte reais)");
    expect(texto).toContain("- 14/09/2026");
    expect(texto).toContain("- 05/10/2026");
    expect(texto).toContain("Data do pagamento: 05/10/2026.");
    expect(texto).toContain("Terapeuta: Ledivan de Souza");
    expect(texto).toContain("CPF: 555.666.777-88");
  });

  it("CPF do responsável sem informação simplesmente não aparece", () => {
    const texto = montarRecibo(base);
    expect(texto).toContain("Recebi de Ana Raquel Bassi, o valor");
    expect(texto).not.toContain("CPF ,");
    expect(texto).not.toContain("undefined");
  });

  it("sem CPF do terapeuta, a linha do CPF não fica vazia na folha", () => {
    const texto = montarRecibo(base);
    expect(texto.trimEnd().endsWith("Terapeuta: Ledivan de Souza")).toBe(true);
  });

  it("todas as datas do pagamento aparecem, na ordem", () => {
    const texto = montarRecibo(base);
    const ordem = ["14/09/2026", "21/09/2026", "28/09/2026", "05/10/2026"].map((d) => texto.indexOf(d));
    expect(ordem).toEqual([...ordem].sort((a, b) => a - b));
  });
});

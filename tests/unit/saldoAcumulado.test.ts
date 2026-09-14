import { describe, expect, it } from "vitest";
import { eventosDeCobranca, linhaDoFechamento, precoNaData } from "@/lib/fechamento";

/**
 * O SALDO ACUMULADO.
 *
 * A tela comparava o que foi cobrado num mês com o que foi pago NAQUELE MESMO MÊS. Um pacote que
 * fecha em 30/08 e é pago em 05/09 aparecia como "a receber" em agosto para sempre, e como "pagou
 * a mais" em setembro — nenhum dos dois números errado sozinho, errada a comparação.
 *
 * Medido na base de demonstração: **28 de 31 pacientes ativos alternavam** entre dever e ter pago
 * a mais. Só 3 deviam de verdade.
 *
 * A pergunta que a terapeuta faz é "quanto o fulano me deve", não "quanto ele me deve de agosto".
 */

const s = (dia: number, mes: number, status = "realizada") => ({
  id: `${mes}-${dia}`,
  date: new Date(2026, mes - 1, dia, 9, 0, 0),
  status,
});

const precos = [{ valor: 200, desde: new Date(2025, 0, 1) }];

describe("o pagamento que cruza o mês", () => {
  // Pacote de 4 fechando em 26/08, pago em 05/09.
  const sessoes = [s(5, 8), s(12, 8), s(19, 8), s(26, 8)];
  const pagamentos = [{ pacienteId: "p1", valor: 800, data: new Date(2026, 8, 5), status: "paid" }];
  const paciente = { id: "p1", nome: "Ana", formato: "mensal", pacoteTipo: "completo" };

  it("em agosto o saldo mostra a dívida, porque o pagamento ainda não entrou", () => {
    const l = linhaDoFechamento({ paciente, sessoes, precos, pagamentos, ano: 2026, mes: 7 });
    expect(l.cobradoNoMes).toBe(800);
    expect(l.saldo).toBe(800);
    expect(l.situacao).toBe("a_receber");
  });

  it("em setembro o saldo ZERA — e antes acusava 'pagou a mais'", () => {
    const l = linhaDoFechamento({ paciente, sessoes, precos, pagamentos, ano: 2026, mes: 8 });
    expect(l.cobradoNoMes).toBe(0);
    expect(l.pagoNoMes).toBe(800);
    expect(l.saldo).toBe(0);
    expect(l.situacao).toBe("pago");
  });

  it("o mês continua visível: o que aconteceu em agosto não some", () => {
    const agosto = linhaDoFechamento({ paciente, sessoes, precos, pagamentos, ano: 2026, mes: 7 });
    expect(agosto.sessoes).toBe(4);
    expect(agosto.pagoNoMes).toBe(0);
  });
});

describe("o saldo é a posição real, não a foto do mês", () => {
  const paciente = { id: "p1", nome: "Ana", formato: "mensal", pacoteTipo: "completo" };

  it("dívida pequena que se repete ACUMULA em vez de parecer desprezível", () => {
    // O caso do Otávio na demonstração: R$ 83 de sobra todo mês pareciam nada, e somavam 5.200.
    const sessoes = [s(5, 7), s(12, 7), s(19, 7), s(26, 7), s(5, 8), s(12, 8), s(19, 8), s(26, 8)];
    const pagamentos = [
      { pacienteId: "p1", valor: 700, data: new Date(2026, 6, 28), status: "paid" },
      { pacienteId: "p1", valor: 700, data: new Date(2026, 7, 28), status: "paid" },
    ];
    const l = linhaDoFechamento({ paciente, sessoes, precos, pagamentos, ano: 2026, mes: 7 });
    // Dois pacotes de 800, dois pagamentos de 700: a sobra de 100 por mês soma 200.
    expect(l.saldo).toBe(200);
  });

  it("quem pagou adiantado aparece com crédito, e não como devedor no mês seguinte", () => {
    const sessoes = [s(5, 8), s(12, 8), s(19, 8), s(26, 8)];
    const pagamentos = [{ pacienteId: "p1", valor: 1000, data: new Date(2026, 7, 1), status: "paid" }];
    const l = linhaDoFechamento({ paciente, sessoes, precos, pagamentos, ano: 2026, mes: 7 });
    expect(l.saldo).toBe(-200);
    expect(l.situacao).toBe("pago_a_mais");
  });

  it("olhar um mês ANTIGO mostra a posição daquela época, não a de hoje", () => {
    const sessoes = [s(5, 7), s(12, 7), s(19, 7), s(26, 7), s(5, 8), s(12, 8), s(19, 8), s(26, 8)];
    const pagamentos = [{ pacienteId: "p1", valor: 1600, data: new Date(2026, 8, 10), status: "paid" }];
    // Em julho só um pacote tinha fechado, e nada estava pago.
    const julho = linhaDoFechamento({ paciente, sessoes, precos, pagamentos, ano: 2026, mes: 6 });
    expect(julho.saldo).toBe(800);
    // Em setembro tudo foi cobrado e tudo foi pago.
    const setembro = linhaDoFechamento({ paciente, sessoes, precos, pagamentos, ano: 2026, mes: 8 });
    expect(setembro.saldo).toBe(0);
  });
});

describe("a reserva de preço", () => {
  it("sem histórico de preço, usa o valor do cadastro em vez de cobrar zero", () => {
    // Na demonstração são 12 de 103 pacientes. Cobrar zero faria a receita deles sumir sem aviso —
    // o mesmo tipo de erro da dívida inventada, na direção contrária.
    const l = linhaDoFechamento({
      paciente: { id: "p1", nome: "Ana", formato: "mensal", pacoteTipo: "completo", valorDaSessao: 180 },
      sessoes: [s(5, 8), s(12, 8), s(19, 8), s(26, 8)],
      precos: [],
      pagamentos: [],
      ano: 2026,
      mes: 7,
    });
    expect(l.cobradoNoMes).toBe(720);
  });

  it("o histórico manda quando alcança a data", () => {
    const l = linhaDoFechamento({
      paciente: { id: "p1", nome: "Ana", formato: "mensal", pacoteTipo: "completo", valorDaSessao: 999 },
      sessoes: [s(5, 8), s(12, 8), s(19, 8), s(26, 8)],
      precos,
      pagamentos: [],
      ano: 2026,
      mes: 7,
    });
    expect(l.cobradoNoMes).toBe(800);
  });

  it("sem histórico e sem valor no cadastro, é zero mesmo", () => {
    expect(precoNaData([], new Date(2026, 7, 1))).toBe(0);
  });
});

describe("os eventos de cobrança", () => {
  it("o pacote gera um evento na data em que fecha", () => {
    const e = eventosDeCobranca({
      formato: "mensal",
      pacoteTipo: "completo",
      sessoes: [s(5, 8), s(12, 8), s(19, 8), s(26, 8)],
    });
    expect(e).toHaveLength(1);
    expect(e[0].sessoes).toBe(4);
    expect(e[0].data.getDate()).toBe(26);
  });

  it("quem paga a cada sessão gera um evento por sessão", () => {
    const e = eventosDeCobranca({ formato: "sessao", pacoteTipo: null, sessoes: [s(5, 8), s(12, 8)] });
    expect(e).toHaveLength(2);
    expect(e.every((x) => x.sessoes === 1)).toBe(true);
  });

  it("sessão que pausa não gera cobrança", () => {
    const e = eventosDeCobranca({ formato: "sessao", pacoteTipo: null, sessoes: [s(5, 8), s(12, 8, "atestado")] });
    expect(e).toHaveLength(1);
  });

  it("gratuito não gera evento nenhum", () => {
    const e = eventosDeCobranca({ formato: "gratuito", pacoteTipo: "completo", sessoes: [s(5, 8), s(12, 8), s(19, 8), s(26, 8)] });
    expect(e).toEqual([]);
  });

  it("pacote incompleto ainda não gera evento", () => {
    const e = eventosDeCobranca({ formato: "mensal", pacoteTipo: "completo", sessoes: [s(5, 8), s(12, 8)] });
    expect(e).toEqual([]);
  });
});

describe("o preço de cada evento é o da data dele", () => {
  const historico = [
    { valor: 200, desde: new Date(2026, 0, 1) },
    { valor: 250, desde: new Date(2026, 7, 1) },
  ];

  it("antes do reajuste, o preço antigo", () => {
    expect(precoNaData(historico, new Date(2026, 6, 15))).toBe(200);
  });

  it("depois do reajuste, o novo", () => {
    expect(precoNaData(historico, new Date(2026, 8, 15))).toBe(250);
  });

  it("cada pacote é cobrado pelo preço que valia quando fechou", () => {
    // Sem isto, o acumulado recalcularia o passado inteiro com o preço de hoje — e a dívida de um
    // ano atrás cresceria sozinha a cada reajuste.
    const paciente = { id: "p1", nome: "Ana", formato: "mensal", pacoteTipo: "completo" };
    const sessoes = [s(5, 7), s(12, 7), s(19, 7), s(26, 7), s(5, 8), s(12, 8), s(19, 8), s(26, 8)];
    const l = linhaDoFechamento({ paciente, sessoes, precos: historico, pagamentos: [], ano: 2026, mes: 7 });
    // Julho fechou a 200 (800) e agosto a 250 (1000).
    expect(l.saldo).toBe(1800);
  });
});

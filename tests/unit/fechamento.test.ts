import { describe, it, expect } from "vitest";
import {
  linhaDoFechamento,
  mesPorExtenso,
  mesQueSeFecha,
  ordemDoFechamento,
  pagoNoMes,
  precoNoMes,
  resumoDoFechamento,
  sessoesCobradas,
  type LinhaDoFechamento,
} from "@/lib/fechamento";

// Setembro de 2026 tem quatro quartas (2, 9, 16, 23, 30 → cinco, na verdade); usamos agosto,
// que é o mês que se fecha em setembro.
const sessao = (dia: number, status = "realizada", mes = 7) => ({
  id: `s-${mes}-${dia}`,
  date: new Date(2026, mes, dia),
  status,
});

describe("o preço que valia naquele mês", () => {
  const historico = [
    { valor: 150, desde: new Date(2025, 0, 10) },
    { valor: 180, desde: new Date(2026, 8, 1) }, // reajuste em setembro
  ];

  it("fecha agosto com o preço de agosto, não com o de hoje", () => {
    // Cobrar agosto a 180 seria aplicar o reajuste para trás, e ninguém percebe olhando a tela.
    expect(precoNoMes(historico, 2026, 7)).toBe(150);
  });

  it("setembro em diante já usa o preço novo", () => {
    expect(precoNoMes(historico, 2026, 8)).toBe(180);
    expect(precoNoMes(historico, 2026, 11)).toBe(180);
  });

  it("sem histórico, o preço é zero — e a tela mostra zero em vez de inventar", () => {
    expect(precoNoMes([], 2026, 7)).toBe(0);
  });

  it("mês anterior ao primeiro preço também é zero", () => {
    expect(precoNoMes(historico, 2024, 5)).toBe(0);
  });
});

describe("quantas sessões o combinado cobra", () => {
  it("pacote completo cobra quatro, mesmo com três na agenda", () => {
    expect(sessoesCobradas("mensal", "completo", 3)).toBe(4);
    expect(sessoesCobradas("mensal", "completo", 5)).toBe(4);
  });

  it("fragmentado cobra o que a agenda marcou", () => {
    expect(sessoesCobradas("mensal", "fragmentado", 3)).toBe(3);
    expect(sessoesCobradas("mensal", "fragmentado", 0)).toBe(0);
  });

  it("quem paga a cada sessão deve a soma dos atendimentos do mês", () => {
    expect(sessoesCobradas("sessao", null, 4)).toBe(4);
  });

  it("mês sem sessão nenhuma não cobra, nem no pacote completo", () => {
    // O paciente não foi atendido uma vez sequer: não estava em tratamento naquele mês. Cobrar
    // quatro sessões dele é inventar dívida, e enche a tela de vermelho falso.
    expect(sessoesCobradas("mensal", "completo", 0)).toBe(0);
    expect(sessoesCobradas("sessao", null, 0)).toBe(0);
  });

  it("gratuito não cobra nada, nunca", () => {
    expect(sessoesCobradas("gratuito", "completo", 4)).toBe(0);
    expect(sessoesCobradas("gratuito", null, 9)).toBe(0);
  });
});

describe("o que entrou no mês", () => {
  const pagamentos = [
    { pacienteId: "p1", valor: 300, data: new Date(2026, 7, 5), status: "paid" },
    { pacienteId: "p1", valor: 150, data: new Date(2026, 7, 20), status: "paid" },
    { pacienteId: "p1", valor: 150, data: new Date(2026, 7, 22), status: "pending" },
    { pacienteId: "p1", valor: 999, data: new Date(2026, 8, 2), status: "paid" },
    { pacienteId: "p2", valor: 500, data: new Date(2026, 7, 9), status: "paid" },
  ];

  it("soma só o que foi pago, do paciente certo, no mês certo", () => {
    expect(pagoNoMes(pagamentos, "p1", 2026, 7)).toBe(450);
  });

  it("pagamento pendente não conta como entrada", () => {
    // Se contasse, o fechamento diria que o mês está quitado sem o dinheiro ter entrado.
    const soPendente = [{ pacienteId: "p3", valor: 400, data: new Date(2026, 7, 3), status: "pending" }];
    expect(pagoNoMes(soPendente, "p3", 2026, 7)).toBe(0);
  });

  it("sem pagamento nenhum, zero", () => {
    expect(pagoNoMes(pagamentos, "p9", 2026, 7)).toBe(0);
  });
});

describe("a linha do paciente", () => {
  const precos = [{ valor: 200, desde: new Date(2025, 0, 1) }];

  it("mensal fragmentado: três sessões em agosto viram três × o preço", () => {
    const l = linhaDoFechamento({
      paciente: { id: "p1", nome: "Ana", formato: "mensal", pacoteTipo: "fragmentado" },
      sessoes: [sessao(5), sessao(12), sessao(19)],
      precos,
      pagamentos: [],
      ano: 2026,
      mes: 7,
    });
    expect(l.sessoes).toBe(3);
    expect(l.valorDoMes).toBe(600);
    expect(l.saldo).toBe(600);
    expect(l.situacao).toBe("a_receber");
  });

  it("cancelada e realocada saem da conta", () => {
    const l = linhaDoFechamento({
      paciente: { id: "p1", nome: "Ana", formato: "mensal", pacoteTipo: "fragmentado" },
      sessoes: [sessao(5), sessao(12, "cancelada"), sessao(19, "realocada"), sessao(26)],
      precos,
      pagamentos: [],
      ano: 2026,
      mes: 7,
    });
    // Duas sessões de verdade: o paciente não paga por atendimento que não houve.
    expect(l.sessoes).toBe(2);
    expect(l.valorDoMes).toBe(400);
  });

  it("pacote completo cobra quatro mesmo com três na agenda", () => {
    const l = linhaDoFechamento({
      paciente: { id: "p2", nome: "Bruno", formato: "mensal", pacoteTipo: "completo" },
      sessoes: [sessao(3), sessao(10), sessao(17)],
      precos,
      pagamentos: [],
      ano: 2026,
      mes: 7,
    });
    expect(l.sessoes).toBe(3);
    expect(l.sessoesCobradas).toBe(4);
    expect(l.valorDoMes).toBe(800);
  });

  it("quitado fica quitado, e um centavo de diferença não vira dívida", () => {
    const l = linhaDoFechamento({
      paciente: { id: "p3", nome: "Célia", formato: "sessao" },
      sessoes: [sessao(4), sessao(11)],
      precos,
      pagamentos: [{ pacienteId: "p3", valor: 400, data: new Date(2026, 7, 15), status: "paid" }],
      ano: 2026,
      mes: 7,
    });
    expect(l.situacao).toBe("pago");
    expect(l.saldo).toBe(0);
  });

  it("quem pagou a mais aparece como pagou a mais, e não como quitado", () => {
    const l = linhaDoFechamento({
      paciente: { id: "p4", nome: "Davi", formato: "sessao" },
      sessoes: [sessao(4)],
      precos,
      pagamentos: [{ pacienteId: "p4", valor: 500, data: new Date(2026, 7, 15), status: "paid" }],
      ano: 2026,
      mes: 7,
    });
    expect(l.situacao).toBe("pago_a_mais");
    expect(l.saldo).toBe(-300);
  });

  it("gratuito nunca tem valor, mesmo com sessões", () => {
    const l = linhaDoFechamento({
      paciente: { id: "p5", nome: "Eva", formato: "gratuito" },
      sessoes: [sessao(4), sessao(11), sessao(18)],
      precos,
      pagamentos: [],
      ano: 2026,
      mes: 7,
    });
    expect(l.sessoes).toBe(3);
    expect(l.valorDoMes).toBe(0);
    expect(l.situacao).toBe("sem_cobranca");
  });

  it("pacote completo sem sessão no mês não vira dívida de quatro sessões", () => {
    const l = linhaDoFechamento({
      paciente: { id: "p8", nome: "Hélio", formato: "mensal", pacoteTipo: "completo" },
      sessoes: [],
      precos,
      pagamentos: [],
      ano: 2026,
      mes: 7,
    });
    expect(l.sessoesCobradas).toBe(0);
    expect(l.valorDoMes).toBe(0);
    expect(l.situacao).toBe("sem_sessoes");
  });

  it("quem não teve sessão no mês não vira dívida", () => {
    const l = linhaDoFechamento({
      paciente: { id: "p6", nome: "Fábio", formato: "mensal", pacoteTipo: "fragmentado" },
      sessoes: [sessao(4, "realizada", 5)], // junho, não agosto
      precos,
      pagamentos: [],
      ano: 2026,
      mes: 7,
    });
    expect(l.situacao).toBe("sem_sessoes");
    expect(l.valorDoMes).toBe(0);
  });

  it("sessão de outro mês não entra na conta", () => {
    const l = linhaDoFechamento({
      paciente: { id: "p7", nome: "Gil", formato: "sessao" },
      sessoes: [sessao(30), sessao(1, "realizada", 8)],
      precos,
      pagamentos: [],
      ano: 2026,
      mes: 7,
    });
    expect(l.sessoes).toBe(1);
  });
});

describe("os números do alto da tela", () => {
  const linhas: LinhaDoFechamento[] = [
    { pacienteId: "a", nome: "Ana", formato: "mensal", sessoes: 4, sessoesCobradas: 4, precoDaSessao: 200, valorDoMes: 800, pago: 0, saldo: 800, situacao: "a_receber" },
    { pacienteId: "b", nome: "Bruno", formato: "sessao", sessoes: 2, sessoesCobradas: 2, precoDaSessao: 200, valorDoMes: 400, pago: 400, saldo: 0, situacao: "pago" },
    { pacienteId: "c", nome: "Célia", formato: "sessao", sessoes: 1, sessoesCobradas: 1, precoDaSessao: 200, valorDoMes: 200, pago: 500, saldo: -300, situacao: "pago_a_mais" },
    { pacienteId: "d", nome: "Davi", formato: "gratuito", sessoes: 3, sessoesCobradas: 0, precoDaSessao: 0, valorDoMes: 0, pago: 0, saldo: 0, situacao: "sem_cobranca" },
  ];

  it("a receber conta só quem falta pagar", () => {
    // Quem pagou a mais NÃO abate a dívida de quem não pagou: são pessoas diferentes.
    const r = resumoDoFechamento(linhas);
    expect(r.aReceber).toBe(800);
    expect(r.previsto).toBe(1400);
    expect(r.recebido).toBe(900);
    expect(r.pacientesAReceber).toBe(1);
  });

  it("a ordem põe quem deve primeiro, do maior para o menor", () => {
    const ordenadas = ordemDoFechamento(linhas);
    expect(ordenadas[0].nome).toBe("Ana");
    expect(ordenadas[ordenadas.length - 1].situacao).toBe("sem_cobranca");
  });
});

describe("o mês da tela", () => {
  it("abre no mês que se fecha, que é o anterior", () => {
    expect(mesQueSeFecha(new Date(2026, 8, 13))).toEqual({ ano: 2026, mes: 7 });
  });

  it("em janeiro, o mês que se fecha é dezembro do ano passado", () => {
    expect(mesQueSeFecha(new Date(2026, 0, 5))).toEqual({ ano: 2025, mes: 11 });
  });

  it("o mês aparece como a pessoa fala", () => {
    expect(mesPorExtenso(2026, 7)).toBe("agosto de 2026");
  });
});

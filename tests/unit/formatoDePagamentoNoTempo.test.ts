import { describe, expect, it } from "vitest";
import { linhaDoFechamento, type PrecoVigente, type SessaoDoPacote } from "@/lib/fechamento";

/**
 * A TROCA DE FORMATO NÃO REESCREVE O PASSADO — agora na Fechamento de verdade.
 *
 * O defeito, medido em 15/09/2026: `patients.payment_format` era um valor sem data e a Fechamento o
 * aplicava a todos os meses. Trocar de gratuito para "a cada sessão" fazia agosto — atendido de
 * graça — virar R$ 800 de dívida; trocar de pago para gratuito apagava agosto e deixava R$ 800 de
 * crédito que a tela chamava de "sem cobrança". No banco, o paciente de teste alternou o formato
 * quatro vezes, que é o que alguém faz quando a troca "parece" não pegar.
 *
 * A regra do dono, no mesmo dia:
 *
 * > A alteração da forma de cobrança deve valer somente a partir da data definida, sem modificar os
 * > atendimentos anteriores. [...] O sistema nunca deve apagar, criar ou modificar cobranças
 * > passadas apenas porque você alterou o financeiro do paciente.
 *
 * Estes testes eram a prova do defeito; agora são a prova da regra.
 */

const preco: PrecoVigente[] = [{ valor: 200, desde: new Date(2026, 0, 1) }];

const sessoes: SessaoDoPacote[] = [
  ...[4, 11, 18, 25].map((dia) => ({ id: `ago${dia}`, date: new Date(2026, 7, dia, 9), status: "realizada" })),
  ...[1, 8].map((dia) => ({ id: `set${dia}`, date: new Date(2026, 8, dia, 9), status: "realizada" })),
];

const linha = (
  mes: number,
  vigencias: { formato: string; desde: Date }[],
  pagamentos: { valor: number; data: Date }[] = [],
  formatoDoCadastro = vigencias.at(-1)?.formato ?? "sessao",
) =>
  linhaDoFechamento({
    paciente: { id: "p1", nome: "Paciente", formato: formatoDoCadastro, valorDaSessao: 200 },
    sessoes,
    precos: preco,
    pagamentos: pagamentos.map((p) => ({ pacienteId: "p1", status: "paid", ...p })),
    vigencias,
    ano: 2026,
    mes,
  });

const AGOSTO = 7;
const SETEMBRO = 8;

describe("gratuito → a cada sessão, a partir de 01/09", () => {
  const vig = [
    { formato: "gratuito", desde: new Date(2026, 0, 1) },
    { formato: "sessao", desde: new Date(2026, 8, 1) },
  ];

  it("agosto continua gratuito: não cobra nada", () => {
    expect(linha(AGOSTO, vig).cobradoNoMes).toBe(0);
  });

  it("agosto não vira dívida", () => {
    const l = linha(AGOSTO, vig);
    expect(l.saldo).toBe(0);
    expect(l.situacao).not.toBe("a_receber");
  });

  it("setembro cobra só o que aconteceu a partir da troca", () => {
    const l = linha(SETEMBRO, vig);
    expect(l.cobradoNoMes).toBe(400);
    expect(l.saldo).toBe(400);
  });
});

describe("a cada sessão → gratuito, a partir de 01/09", () => {
  const vig = [
    { formato: "sessao", desde: new Date(2026, 0, 1) },
    { formato: "gratuito", desde: new Date(2026, 8, 1) },
  ];
  const pagoAgosto = [{ valor: 800, data: new Date(2026, 7, 30) }];

  it("a cobrança de agosto PERMANECE", () => {
    expect(linha(AGOSTO, vig).cobradoNoMes).toBe(800);
  });

  it("o que foi pago em agosto continua quitando agosto — não vira crédito", () => {
    const l = linha(SETEMBRO, vig, pagoAgosto);
    expect(l.saldo).toBe(0);
    expect(l.situacao).toBe("pago");
  });

  it("setembro, já gratuito, não cobra", () => {
    expect(linha(SETEMBRO, vig, pagoAgosto).cobradoNoMes).toBe(0);
  });
});

describe("salvar o cadastro sem mudar nada não muda nada", () => {
  it("o mesmo formato registrado duas vezes dá a mesma conta que uma vez só", () => {
    const uma = linha(SETEMBRO, [{ formato: "sessao", desde: new Date(2026, 0, 1) }]);
    const duas = linha(SETEMBRO, [
      { formato: "sessao", desde: new Date(2026, 0, 1) },
      { formato: "sessao", desde: new Date(2026, 8, 5) },
    ]);
    expect(duas).toEqual(uma);
  });
});

describe("crédito não some da tela", () => {
  it("gratuito com dinheiro a devolver aparece como pago a mais, não como 'sem cobrança'", () => {
    // Paciente sem histórico, cadastro gratuito, com um pagamento feito. Antes a situação escondia o
    // crédito atrás de "sem cobrança".
    const l = linha(SETEMBRO, [], [{ valor: 800, data: new Date(2026, 7, 30) }], "gratuito");
    expect(l.saldo).toBe(-800);
    expect(l.situacao).toBe("pago_a_mais");
  });

  it("gratuito sem nada a acertar continua 'sem cobrança'", () => {
    expect(linha(SETEMBRO, [], [], "gratuito").situacao).toBe("sem_cobranca");
  });
});

describe("o preço já respeitava a data — é o modelo que o formato passou a seguir", () => {
  it("reajuste em setembro não muda o que agosto cobrou", () => {
    const agosto = linhaDoFechamento({
      paciente: { id: "p1", nome: "Paciente", formato: "sessao", valorDaSessao: 200 },
      sessoes,
      precos: [
        { valor: 200, desde: new Date(2026, 0, 1) },
        { valor: 300, desde: new Date(2026, 8, 1) },
      ],
      pagamentos: [],
      ano: 2026,
      mes: AGOSTO,
    });
    expect(agosto.cobradoNoMes).toBe(800);
  });
});

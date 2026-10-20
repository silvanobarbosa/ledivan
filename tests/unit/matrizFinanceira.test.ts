import { describe, expect, it } from "vitest";
import { matrizFinanceira, anosDisponiveis, type PacienteFin } from "@/lib/matrizFinanceira";

const pacientes: PacienteFin[] = [
  {
    id: "a", nome: "Paciente A",
    cobrancas: [
      // Jan: pago 200. Fev: pago 150. Mar: pago 200.
      { vencimento: "2026-01-05", situacao: "pago", falta: 0, pagamentos: [{ data: "2026-01-05", valor: 200 }] },
      { vencimento: "2026-02-05", situacao: "pago", falta: 0, pagamentos: [{ data: "2026-02-05", valor: 150 }] },
      { vencimento: "2026-03-05", situacao: "pago", falta: 0, pagamentos: [{ data: "2026-03-05", valor: 200 }] },
    ],
  },
  {
    id: "b", nome: "Paciente B",
    cobrancas: [
      { vencimento: "2026-01-05", situacao: "pago", falta: 0, pagamentos: [{ data: "2026-01-05", valor: 100 }] },
      { vencimento: "2026-02-05", situacao: "pago", falta: 0, pagamentos: [{ data: "2026-02-05", valor: 200 }] },
      // Mar em atraso 100 (não pago)
      { vencimento: "2026-03-05", situacao: "em_atraso", falta: 100, pagamentos: [] },
    ],
  },
];

describe("matriz financeira (doc 41)", () => {
  it("filtro Pagos: exemplo do doc (Jan/Fev/Mar + total)", () => {
    const m = matrizFinanceira(pacientes, 2026, "pagos");
    const a = m.linhas.find((l) => l.id === "a")!;
    expect([a.meses[0], a.meses[1], a.meses[2], a.total]).toEqual([200, 150, 200, 550]);
    const b = m.linhas.find((l) => l.id === "b")!;
    expect([b.meses[0], b.meses[1], b.meses[2], b.total]).toEqual([100, 200, 0, 300]);
    // Totais mensais e geral
    expect([m.totalMes[0], m.totalMes[1], m.totalMes[2]]).toEqual([300, 350, 200]);
    expect(m.totalGeral).toBe(850);
  });

  it("filtro Em atraso: só a falta vencida, pelo mês do vencimento", () => {
    const m = matrizFinanceira(pacientes, 2026, "atraso");
    expect(m.linhas.map((l) => l.id)).toEqual(["b"]); // A não tem atraso
    expect(m.linhas[0].meses[2]).toBe(100);
    expect(m.totalGeral).toBe(100);
  });

  it("filtro Todos: pago + atraso, sem somar o mesmo valor duas vezes", () => {
    const m = matrizFinanceira(pacientes, 2026, "todos");
    // Total geral = 850 (pagos) + 100 (atraso) = 950.
    expect(m.totalGeral).toBe(950);
  });

  it("respeita o ano: 2027 vazio", () => {
    const m = matrizFinanceira(pacientes, 2027, "pagos");
    expect(m.linhas).toHaveLength(0);
    expect(m.totalGeral).toBe(0);
  });

  it("crédito do saldo não conta como pago", () => {
    const comCredito: PacienteFin[] = [{ id: "c", nome: "C", cobrancas: [
      { vencimento: "2026-04-05", situacao: "pago", falta: 0, pagamentos: [{ data: "2026-04-05", valor: 80 }, { data: "2026-04-05", valor: 20, credito: true }] },
    ] }];
    const m = matrizFinanceira(comCredito, 2026, "pagos");
    expect(m.linhas[0].meses[3]).toBe(80); // só o dinheiro, não o crédito
  });

  it("anos disponíveis, do mais recente ao mais antigo", () => {
    expect(anosDisponiveis(pacientes)).toEqual([2026]);
  });
});

/**
 * Doc 51: a cor do valor passa a vir da PRÓPRIA célula, não do filtro selecionado.
 * O caso que decide o desenho é a célula que mistura — e ela existe de verdade: basta o
 * cadastro ter uma cobrança paga e outra atrasada no mesmo mês.
 */
describe("situação por célula (doc 51) — a cor sai do valor, não do filtro", () => {
  const misto: PacienteFin[] = [
    {
      id: "m", nome: "Mistura",
      cobrancas: [
        // Jan: uma cobrança paga (200) E outra em atraso (100), no mesmo mês.
        { vencimento: "2026-01-05", situacao: "pago", falta: 0, pagamentos: [{ data: "2026-01-10", valor: 200 }] },
        { vencimento: "2026-01-20", situacao: "em_atraso", falta: 100, pagamentos: [] },
        // Fev: só em aberto.
        { vencimento: "2026-02-05", situacao: "em_aberto", falta: 50, pagamentos: [] },
        // Mar: só pago.
        { vencimento: "2026-03-05", situacao: "pago", falta: 0, pagamentos: [{ data: "2026-03-05", valor: 300 }] },
      ],
    },
  ];

  it("célula de um status só recebe aquele status", () => {
    const m = matrizFinanceira(misto, 2026, "todos");
    const l = m.linhas[0];
    expect(l.mesesSituacao[1]).toBe("aberto"); // Fev
    expect(l.mesesSituacao[2]).toBe("pago");   // Mar
  });

  it("célula MISTA (pago + atraso no mesmo mês) fica como ATRASO — o pior manda", () => {
    // Esconder o atraso porque havia um pagamento junto seria o erro caro: o valor somado
    // apareceria azul e ninguém iria atrás da dívida.
    const m = matrizFinanceira(misto, 2026, "todos");
    expect(m.linhas[0].meses[0]).toBe(300);          // 200 pago + 100 em atraso
    expect(m.linhas[0].mesesSituacao[0]).toBe("atraso");
  });

  it("mês sem valor não tem cor", () => {
    const m = matrizFinanceira(misto, 2026, "todos");
    expect(m.linhas[0].meses[5]).toBe(0);
    expect(m.linhas[0].mesesSituacao[5]).toBe("vazio");
  });

  it("o Total da linha também segue o pior status presente no ano", () => {
    const m = matrizFinanceira(misto, 2026, "todos");
    expect(m.linhas[0].totalSituacao).toBe("atraso");
  });

  it("o filtro não dita mais a cor: filtrando Pagos, as células pagas são 'pago'", () => {
    const m = matrizFinanceira(misto, 2026, "pagos");
    expect(m.linhas[0].mesesSituacao[0]).toBe("pago"); // só o pago entrou no recorte
    expect(m.linhas[0].mesesSituacao[2]).toBe("pago");
  });

  it("o rodapé Total mensal agrega o pior status da coluna", () => {
    const m = matrizFinanceira(misto, 2026, "todos");
    expect(m.totalMesSituacao[0]).toBe("atraso");
    expect(m.totalMesSituacao[1]).toBe("aberto");
    expect(m.totalMesSituacao[2]).toBe("pago");
    expect(m.totalMesSituacao[5]).toBe("vazio");
  });

  it("a ordenação por nome não descola a cor da linha", () => {
    // Regressão: as marcas são calculadas antes do sort; se não forem reordenadas junto,
    // a linha de um cadastro passa a exibir a cor de outro.
    const dois: PacienteFin[] = [
      { id: "z", nome: "Zara", cobrancas: [{ vencimento: "2026-01-05", situacao: "em_atraso", falta: 10, pagamentos: [] }] },
      { id: "a", nome: "Ana", cobrancas: [{ vencimento: "2026-01-05", situacao: "pago", falta: 0, pagamentos: [{ data: "2026-01-05", valor: 10 }] }] },
    ];
    const m = matrizFinanceira(dois, 2026, "todos");
    expect(m.linhas.map((l) => l.nome)).toEqual(["Ana", "Zara"]);
    expect(m.linhas[0].mesesSituacao[0]).toBe("pago");   // Ana
    expect(m.linhas[1].mesesSituacao[0]).toBe("atraso"); // Zara
  });
});

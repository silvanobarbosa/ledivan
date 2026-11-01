import { describe, it, expect } from "vitest";
import { valorDaFala } from "@/lib/valorDaFala";
import { comandoDaFala } from "@/lib/falaDoDiva";
import { previaDoComando, type CobrancaParaPagar } from "@/lib/previaDoComando";
import { tarefaDaFala, TAREFAS } from "@/lib/diva";

/**
 * PAGAMENTO POR VOZ — a 4ª ação, nascida de um caso real (01/11/2026).
 *
 * A terapeuta ditou "dar entrada em um pagamento para a paciente Talita". O Whisper acertou, o
 * Divã entendeu, abriu a tela de pagamentos — e nada foi lançado, porque pagamento não estava
 * entre as ações que a voz executa. Estes testes travam as duas correções: a fala agora vira um
 * comando, e a fala INCOMPLETA avisa que só navega, em vez de rebaixar em silêncio.
 */

const PACIENTES = [
  { id: "p1", nome: "Talita Cruz Dick" },
  { id: "p2", nome: "Marcela Nunes" },
  { id: "p3", nome: "Thais Oliveira" },
  { id: "p4", nome: "Thais Moreira" },
];

const cobranca = (chave: string, dia: number, mes: number, falta: number): CobrancaParaPagar =>
  ({ chave, vencimento: new Date(2026, mes, dia), falta, ano: 2026 });

const previa = (fala: string, cobrancas: CobrancaParaPagar[] = [cobranca("sessao:s1", 10, 9, 300)]) =>
  previaDoComando(fala, PACIENTES, { agora: new Date(2026, 10, 1, 12), cobrancasDoPaciente: () => cobrancas });

describe("o dinheiro que ela disse", () => {
  it("dígito cru, com reais, e com R$", () => {
    expect(valorDaFala("300").valor).toBe(300);
    expect(valorDaFala("300 reais").valor).toBe(300);
    expect(valorDaFala("R$ 300").valor).toBe(300);
  });

  it("centavos pela VÍRGULA e milhar pelo PONTO — trocar os dois vira R$ 1,20", () => {
    expect(valorDaFala("300,50 reais").valor).toBe(300.5);
    expect(valorDaFala("1.200 reais").valor).toBe(1200);
  });

  it("por extenso NÃO vira número: chutar o valor é errar dinheiro com cara de acerto", () => {
    expect(valorDaFala("trezentos reais").valor).toBeNull();
  });

  it("zero não é pagamento", () => {
    expect(valorDaFala("0 reais").valor).toBeNull();
  });

  it("a forma sai da fala quando ela diz", () => {
    expect(valorDaFala("300 no pix").forma).toBe("pix");
    expect(valorDaFala("300 em dinheiro").forma).toBe("cash");
    expect(valorDaFala("300 no cartão de crédito").forma).toBe("credito");
    expect(valorDaFala("300 no débito").forma).toBe("debito");
    expect(valorDaFala("300 por transferência").forma).toBe("transfer");
  });

  it("“cartão” sozinho não escolhe entre crédito e débito — os dois mudam o líquido no caixa", () => {
    const r = valorDaFala("300 no cartão");
    expect(r.forma).toBeNull();
    expect(r.resto).not.toMatch(/cartao/);
  });

  it("o que sobra leva o nome e nada de dinheiro", () => {
    // Sobram conectivos ("da", "de") de propósito: `pacienteDaFala` já os descarta como palavras
    // vazias. O que não pode sobrar é número, moeda ou forma — isso, sim, vira nome fantasma.
    const resto = valorDaFala("um pagamento da Talita de 300 reais no pix").resto;
    expect(resto).toContain("talita");
    expect(resto).not.toMatch(/\d|reais|pix|pagamento/);
  });
});

describe("a fala vira um pedido de pagamento", () => {
  const FALAS = [
    "Dar entrada em um pagamento para a paciente Talita, 300 reais",
    "lançar um pagamento da Talita de 300 reais",
    "lança o pagamento da Talita, 300",
    "dar baixa no pagamento da Talita de 300 reais",
    "registrar o pagamento da Talita, 300 reais",
    "recebi 300 da Talita",
    "a Talita pagou 300 reais",
  ];

  it.each(FALAS)("“%s” é ação de pagar, não navegação", (fala) => {
    expect(comandoDaFala(fala)?.acao).toBe("pagar");
  });

  it("a prévia junta paciente, valor e a cobrança que vai quitar", () => {
    const p = previa("lança o pagamento da Talita, 300 reais no pix");
    expect(p?.acao).toBe("pagar");
    expect(p?.paciente).toMatchObject({ tipo: "um", paciente: { id: "p1" } });
    expect(p?.valor).toBe(300);
    expect(p?.forma).toBe("pix");
    expect(p?.cobranca).toMatchObject({ chave: "sessao:s1", falta: 300 });
    expect(p?.faltando).toEqual([]);
  });

  it("a cobrança escolhida é a MAIS ANTIGA em aberto — a mesma ordem do motor", () => {
    const p = previa("recebi 300 da Talita", [
      cobranca("sessao:nova", 20, 10, 300),
      cobranca("sessao:velha", 5, 8, 300),
    ]);
    expect(p?.cobranca?.chave).toBe("sessao:velha");
  });

  it("cobrança já paga não entra na escolha", () => {
    const p = previa("recebi 300 da Talita", [cobranca("sessao:paga", 5, 8, 0), cobranca("sessao:aberta", 20, 10, 300)]);
    expect(p?.cobranca?.chave).toBe("sessao:aberta");
  });

  it("sem cobrança em aberto, ela é avisada e nada abre", () => {
    const p = previa("recebi 300 da Talita", []);
    expect(p?.cobranca).toBeNull();
    expect(p?.faltando.join(" ")).toMatch(/não tem cobrança em aberto/i);
  });

  it("sem valor, a tela pede — a voz não inventa quanto entrou", () => {
    const p = previa("lança o pagamento da Talita");
    expect(p?.valor).toBeNull();
    expect(p?.faltando.join(" ")).toMatch(/valor/i);
  });

  it("nome que serve a duas pessoas para para perguntar", () => {
    const p = previa("recebi 300 da Thais");
    expect(p?.paciente.tipo).toBe("varios");
    expect(p?.faltando.length).toBeGreaterThan(0);
  });

  it("a prévia por extenso diz quando vence e quanto falta", () => {
    const p = previa("recebi 300 da Talita");
    expect(p?.cobranca?.porExtenso).toMatch(/vence em 10\/10/);
    expect(p?.cobranca?.porExtenso).toMatch(/300,00/);
  });
});

describe("anotar e pagar começam igual e não se confundem", () => {
  it("“registrar na Marcela: dormiu melhor” continua sendo anotação", () => {
    const c = comandoDaFala("registrar na Marcela: dormiu melhor");
    expect(c?.acao).toBe("anotar");
  });

  it("“registrar o pagamento da Marcela, 300” é dinheiro", () => {
    expect(comandoDaFala("registrar o pagamento da Marcela, 300")?.acao).toBe("pagar");
  });

  it("marcar e cancelar seguem intactos", () => {
    expect(comandoDaFala("marca a Marcela quinta às 16h")?.acao).toBe("reservar");
    expect(comandoDaFala("cancelar o atendimento da Marcela")?.acao).toBe("cancelar");
  });
});

describe("a fala INCOMPLETA avisa que só navega", () => {
  it("“pagamento”, sem paciente nem valor, não vira comando — vira a tela", () => {
    expect(comandoDaFala("pagamento")).toBeNull();
    expect(tarefaDaFala("pagamento")?.id).toBe("lancar-pagamento");
  });

  it("as tarefas cujo rótulo é um verbo que ESCREVE estão marcadas como “só leva”", () => {
    const marcadas = TAREFAS.filter((t) => t.soLeva).map((t) => t.id).sort();
    expect(marcadas).toEqual(["bloquear", "evolucao", "lancar-pagamento", "novo-paciente", "recibo"]);
  });

  it("ver a agenda não é promessa de escrita nenhuma — não leva o aviso", () => {
    expect(TAREFAS.find((t) => t.id === "agenda-hoje")?.soLeva).toBeFalsy();
  });
});

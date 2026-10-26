import { describe, expect, it } from "vitest";
import { decidirDesfazer, proximaSessaoParaReceber, recebePagamento, type SessaoNaLinha } from "@/lib/desfazerCobranca";

/**
 * Desfazer a cobrança de uma sessão que JÁ foi paga (doc 55).
 *
 * O caso fácil — sem pagamento — segue direto, como o documento manda. O difícil é quando há
 * dinheiro recebido preso a uma cobrança que vai deixar de existir: aí a terapeuta escolhe entre
 * estornar e transferir para a próxima sessão, e nenhuma das duas pode perder o valor de vista.
 */

const d = (dia: number) => new Date(2026, 9, dia, 11, 0);
const sessoes: SessaoNaLinha[] = [
  { id: "s1", date: d(5), status: "realizada", rotulo: "AVUL" },
  { id: "s2", date: d(12), status: "nao_realizada", rotulo: "AVUL" },
  { id: "s3", date: d(19), status: "cancelada", rotulo: "AVUL" },
  { id: "s4", date: d(26), status: "agendada", rotulo: "AVUL" },
];
const pg = { id: "p1", valor: 200, cobrancaChave: "extra:s2" };

describe("proximaSessaoParaReceber", () => {
  it("é a seguinte pela data, não a seguinte na lista", () => {
    const fora_de_ordem = [...sessoes].reverse();
    expect(proximaSessaoParaReceber("s1", fora_de_ordem)?.id).toBe("s2");
  });

  it("pula as que não aconteceram — desmarcada não recebe crédito", () => {
    // s3 está cancelada: transferir para ela só adiaria o mesmo problema.
    expect(proximaSessaoParaReceber("s2", sessoes)?.id).toBe("s4");
  });

  it("não existe próxima depois da última", () => {
    expect(proximaSessaoParaReceber("s4", sessoes)).toBeNull();
  });

  it("sessão que não está na lista não tem próxima", () => {
    expect(proximaSessaoParaReceber("fantasma", sessoes)).toBeNull();
  });
});

describe("decidirDesfazer", () => {
  it("sem pagamento, segue direto — o documento é explícito", () => {
    expect(decidirDesfazer({ escolha: null, pagamento: null, sessaoAtualId: "s2", sessoes })).toEqual({ acao: "nada" });
  });

  it("com pagamento e sem escolha, recusa: a pergunta existe para ser respondida", () => {
    const r = decidirDesfazer({ escolha: null, pagamento: pg, sessaoAtualId: "s2", sessoes });
    expect(r).toHaveProperty("erro");
  });

  it("estornar devolve o pagamento e o valor, para o registro do estorno", () => {
    expect(decidirDesfazer({ escolha: "estornar", pagamento: pg, sessaoAtualId: "s2", sessoes }))
      .toEqual({ acao: "estornar", pagamentoId: "p1", valor: 200 });
  });

  it("transferir aponta para a próxima sessão e para a cobrança dela", () => {
    expect(decidirDesfazer({ escolha: "transferir", pagamento: pg, sessaoAtualId: "s2", sessoes }))
      .toEqual({ acao: "transferir", pagamentoId: "p1", valor: 200, paraSessaoId: "s4", novaChave: "extra:s4" });
  });

  /**
   * Doc 57: sem próxima elegível o dinheiro VIRA CRÉDITO — não se perde nem se devolve.
   *
   * Antes eu recusava e mandava estornar. Recusar era melhor do que deixar o pagamento órfão, mas
   * obrigava a terapeuta a devolver um dinheiro que o paciente não pediu de volta: ele continua
   * cliente, e a sessão seguinte só ainda não foi marcada.
   */
  it("transferir sem próxima elegível vira CRÉDITO, não erro nem estorno", () => {
    expect(decidirDesfazer({ escolha: "transferir", pagamento: pg, sessaoAtualId: "s4", sessoes }))
      .toEqual({ acao: "creditar", pagamentoId: "p1", valor: 200 });
  });
});

describe("quem pode receber o pagamento transferido (doc 57)", () => {
  it("AVUL e X/X recebem: são as que têm o que pagar", () => {
    for (const r of ["AVUL", "1/4", "3/8", "DEVOL 2/4"]) expect(recebePagamento(r)).toBe(true);
  });

  it("GRAT não recebe — mandar dinheiro para uma sessão gratuita o faria sumir", () => {
    expect(recebePagamento("GRAT")).toBe(false);
  });

  it("sem rótulo não se adivinha: adivinhar aqui é mandar dinheiro para o lugar errado", () => {
    expect(recebePagamento("")).toBe(false);
    expect(recebePagamento(null)).toBe(false);
    expect(recebePagamento("DEVOL")).toBe(false);
  });

  it("a próxima elegível PULA as gratuitas, mesmo sendo mais próximas na data", () => {
    const lista: SessaoNaLinha[] = [
      { id: "a", date: d(5), status: "realizada", rotulo: "AVUL" },
      { id: "b", date: d(12), status: "agendada", rotulo: "GRAT" },
      { id: "c", date: d(19), status: "agendada", rotulo: "2/4" },
    ];
    expect(proximaSessaoParaReceber("a", lista)?.id).toBe("c");
  });
});

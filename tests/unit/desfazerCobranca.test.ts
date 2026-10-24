import { describe, expect, it } from "vitest";
import { decidirDesfazer, proximaSessaoParaReceber, type SessaoNaLinha } from "@/lib/desfazerCobranca";

/**
 * Desfazer a cobrança de uma sessão que JÁ foi paga (doc 55).
 *
 * O caso fácil — sem pagamento — segue direto, como o documento manda. O difícil é quando há
 * dinheiro recebido preso a uma cobrança que vai deixar de existir: aí a terapeuta escolhe entre
 * estornar e transferir para a próxima sessão, e nenhuma das duas pode perder o valor de vista.
 */

const d = (dia: number) => new Date(2026, 9, dia, 11, 0);
const sessoes: SessaoNaLinha[] = [
  { id: "s1", date: d(5), status: "realizada" },
  { id: "s2", date: d(12), status: "nao_realizada" },
  { id: "s3", date: d(19), status: "cancelada" },
  { id: "s4", date: d(26), status: "agendada" },
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

  it("transferir sem próxima sessão RECUSA, em vez de deixar o pagamento órfão", () => {
    // Devolver "nada" aqui prenderia o dinheiro a uma cobrança que vai deixar de existir.
    const r = decidirDesfazer({ escolha: "transferir", pagamento: pg, sessaoAtualId: "s4", sessoes });
    expect(r).toHaveProperty("erro");
    expect((r as { erro: string }).erro).toContain("Estorne");
  });
});

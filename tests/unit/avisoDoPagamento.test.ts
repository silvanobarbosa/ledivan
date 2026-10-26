import { describe, expect, it } from "vitest";
import { linhasDaGeral, type EntradaDaGeral } from "@/lib/guiaGeral";
import type { SessaoDaCobranca } from "@/lib/cobrancas";

/**
 * O QUE A GUIA GERAL DIZ quando a sessão muda de modalidade (doc 57).
 *
 * São textos de dinheiro: uma linha que muda de valor sem explicação vira dúvida, e a dúvida mais
 * cara é "para onde foi o que o paciente pagou?". Mas o contrário também custa — escrever
 * "convertida" numa sessão que nunca mudou inventa um evento que não houve, e foi por isso que o
 * dono mandou tirar o aviso do gratuito que respondeu "Não".
 *
 * Os dois avisos vivem em lugares diferentes de propósito: o da COLUNA é sobre uma linha que
 * deixou de cobrar; o da COBRANÇA fica em cima do botão "Lançar pagamento", onde há o que fazer.
 */

const base = (formato: string, extra: Partial<SessaoDaCobranca> & { estornoValor?: number }): EntradaDaGeral => ({
  vigencias: [],
  reserva: { formato, pacoteTipo: null },
  precos: [{ valor: 200, desde: new Date(2024, 0, 1) }],
  valorDaSessao: 200,
  tamanhos: [],
  sessoes: [{ id: "s0", date: new Date(2026, 9, 23, 11, 0), status: "nao_realizada", ...extra }] as EntradaDaGeral["sessoes"],
  pagamentos: [],
  hoje: new Date(2026, 9, 30),
});

const linha = (e: EntradaDaGeral) => {
  const l = linhasDaGeral(e).find((x) => x.tipo === "sessao");
  if (!l || l.tipo !== "sessao") throw new Error("sem linha de sessão");
  return l;
};

describe("AVUL que virou GRAT", () => {
  it("diz na coluna de pagamento, com as siglas que a tela usa", () => {
    expect(linha(base("sessao", { faltouConta: false })).avisoDoPagamento)
      .toBe("Sessão AVUL que foi convertida para GRAT");
  });

  it("e a sessão passa a se chamar GRAT — era o que faltava", () => {
    // O rótulo dizia AVUL numa linha que não cobrava nada: um dizia uma coisa, o outro outra.
    expect(linha(base("sessao", { faltouConta: false })).rotulo).toBe("GRAT");
  });

  it("com estorno, o texto carrega as duas coisas: a conversão E o dinheiro de volta", () => {
    expect(linha(base("sessao", { faltouConta: false, estornoValor: 150 })).avisoDoPagamento)
      .toBe("Sessão AVUL, que foi convertida para GRAT - Estorno realizado no valor de R$ 150,00");
  });
});

describe("GRAT que virou AVUL", () => {
  const e = base("gratuito", { faltouConta: true, valorExtra: 200 });

  it("NÃO escreve na coluna de pagamento — o aviso dela é outro lugar", () => {
    expect(linha(e).avisoDoPagamento).toBeNull();
  });

  it("escreve em cima do botão de lançar, que é onde há o que fazer", () => {
    expect(linha(e).avisoDaCobranca).toBe("Sessão GRAT que foi convertida para AVUL");
  });
});

describe("o que NÃO ganha aviso nenhum", () => {
  it('gratuito que respondeu "Não": nada mudou, nada a dizer (doc 57)', () => {
    // Antes aparecia "Sessão avulsa que foi convertida para gratuita" — inventava um evento numa
    // sessão que sempre foi gratuita. O dono mandou tirar.
    const l = linha(base("gratuito", { faltouConta: false }));
    expect(l.avisoDoPagamento).toBeNull();
    expect(l.avisoDaCobranca).toBeNull();
  });

  it("falta sem resposta: ninguém decidiu nada ainda", () => {
    expect(linha(base("sessao", {})).avisoDoPagamento).toBeNull();
  });

  it("no pacote não há modalidade da sessão para converter", () => {
    expect(linha(base("mensal", { faltouConta: false })).avisoDoPagamento).toBeNull();
  });
});

/**
 * Doc 57: os três destinos do dinheiro quando a sessão AVUL vira GRAT.
 *
 * Cada um responde a uma pergunta diferente de quem lê a linha, e por isso cada um tem seu texto:
 * "voltou para o paciente", "foi para outra sessão", "ficou guardado".
 */
describe("para onde foi o dinheiro", () => {
  const comDinheiro = (extra: Record<string, unknown>) =>
    linha(base("sessao", { faltouConta: false, ...extra } as never)).avisoDoPagamento;

  it("estornado: voltou para o paciente", () => {
    expect(comDinheiro({ estornoValor: 150 }))
      .toBe("Sessão AVUL, que foi convertida para GRAT - Estorno realizado no valor de R$ 150,00");
  });

  it("transferido: foi para outra sessão, e a data diz qual", () => {
    expect(comDinheiro({ transferidoPara: new Date(2026, 10, 7, 11, 0) }))
      .toBe("Sessão AVUL, que foi convertida para GRAT - este pagamento foi transferido para a data 07/11/26");
  });

  it("creditado: ficou guardado, esperando a próxima a pagar", () => {
    expect(comDinheiro({ creditoValor: 200, pagoEm: new Date(2026, 9, 24, 11, 0) }))
      .toBe("Sessão AVUL, que foi convertida para GRAT - Possui um crédito de R$ 200,00 do pago em 24/10/26 que será abatido na próxima sessão a ser paga");
  });

  it("crédito já usado: a mensagem muda, porque muda a pergunta de quem lê", () => {
    // Antes é "o que vai acontecer com esse dinheiro?"; depois é "onde ele foi parar?".
    expect(comDinheiro({ creditoValor: 200, pagoEm: new Date(2026, 9, 24), creditoUsadoEm: new Date(2026, 10, 14, 11, 0) }))
      .toBe("Crédito desta sessão foi utilizado na sessão do dia 14/11/26");
  });

  it("a data sai pela hora de PAREDE — não anda um dia por causa de fuso", () => {
    // Meia-noite é o caso que quebra: lido como UTC num fuso negativo, vira o dia anterior.
    expect(comDinheiro({ transferidoPara: new Date(2026, 10, 7, 0, 0) }))
      .toContain("07/11/26");
  });
});

/**
 * O PACIENTE GRATUITO cuja falta foi cobrada e depois desfeita (doc 60).
 *
 * Aqui a modalidade AVUL nunca foi GRAVADA: ela é derivada da resposta "sim, cobra" (doc 54) e
 * desaparece junto com ela. Era o buraco do doc 60 — "a mensagem sobre estorno parou de aparecer":
 * a sessão voltava a ser um gratuito comum e as três mensagens sumiam, justamente no caso em que
 * havia dinheiro a explicar. O que não some é a MARCA do dinheiro, gravada na sessão.
 */
describe("gratuito que virou AVUL, cobrou e desfez", () => {
  const gratuitoDesfeito = (extra: Record<string, unknown>) =>
    linha(base("gratuito", { faltouConta: false, ...extra } as never)).avisoDoPagamento;

  it("estornado: a mensagem volta a aparecer", () => {
    expect(gratuitoDesfeito({ estornoValor: 50 }))
      .toBe("Sessão AVUL, que foi convertida para GRAT - Estorno realizado no valor de R$ 50,00");
  });

  it("transferido: diz para onde o dinheiro foi", () => {
    expect(gratuitoDesfeito({ transferidoPara: new Date(2026, 10, 7, 11, 0) }))
      .toBe("Sessão AVUL, que foi convertida para GRAT - este pagamento foi transferido para a data 07/11/26");
  });

  it("creditado: diz que o valor ficou guardado", () => {
    expect(gratuitoDesfeito({ creditoValor: 50, pagoEm: new Date(2026, 9, 24) }))
      .toContain("Possui um crédito de R$ 50,00");
  });

  it("mas SEM dinheiro nenhum continua sem aviso — nada aconteceu ali (doc 57)", () => {
    expect(gratuitoDesfeito({})).toBeNull();
  });
});

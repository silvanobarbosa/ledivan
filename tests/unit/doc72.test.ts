import { describe, it, expect } from "vitest";
import { linhasDaGeral, type EntradaDaGeral, type LinhaDaGeral } from "@/lib/guiaGeral";
import { janelasDosPacotes, pacoteEmAndamentoEm } from "@/lib/pacoteNaData";
import { pagamentoParaMotor } from "@/lib/entradaDoMotor";
import { pagadorSugerido } from "@/lib/pagadorSugerido";

/**
 * Doc 72 — dois documentos do dono na mesma leva:
 *
 * 1. **Regra de reajuste de valores.** A pergunta "sobre qual pacote aplicar o novo valor?" (doc
 *    69) só deve aparecer quando a data da vigência cai no meio de um pacote; e, com pagamento já
 *    lançado, o valor pago fica intacto e a diferença aparece EM ABERTO, sem cobrança nova.
 * 2. **Textos do lançamento.** O porquê de a sobra não virar crédito e de a diferença não ser
 *    cobrada passam a ser escritos e exibidos; e trocar o nome de quem pagou vale só para aquele
 *    lançamento.
 */

const desde = new Date(2026, 0, 1);
const hoje = new Date(2026, 8, 15, 12);
const sessao = (id: string, dia: number, mes: number) => ({ id, date: new Date(2026, mes, dia, 9), status: "realizada" });
// Julho: 4 sessões (o pacote). Agosto: as 4 do pacote seguinte.
const SESSOES = [
  sessao("j1", 7, 6), sessao("j2", 14, 6), sessao("j3", 21, 6), sessao("j4", 28, 6),
  sessao("a1", 4, 7), sessao("a2", 11, 7), sessao("a3", 18, 7), sessao("a4", 25, 7),
];

function geral(precos: EntradaDaGeral["precos"], pagamentos: EntradaDaGeral["pagamentos"]): LinhaDaGeral[] {
  return linhasDaGeral({
    vigencias: [{ formato: "mensal", pacoteTipo: "completo", desde }],
    reserva: { formato: "mensal" },
    precos,
    sessoes: SESSOES,
    pagamentos,
    hoje,
  });
}
const cobrancas = (linhas: LinhaDaGeral[]) => linhas.filter((l) => l.tipo === "pagamento");

describe("doc 72 — reajuste sobre um pacote que JÁ foi pago", () => {
  const CEM = [{ valor: 100, desde }];
  // R$ 110 valendo da 3ª sessão de julho, com a resposta "pacote em andamento". O reajuste foi
  // REGISTRADO em setembro — a vigência é retroativa, e é o registro que separa o que já estava pago.
  const REAJUSTADO = [...CEM, { valor: 110, desde: new Date(2026, 6, 21), aplicaEm: "vigente", criadoEm: new Date(2026, 8, 1) }];
  const PAGOU_TUDO = [{
    id: "pg1", valor: 400, data: new Date(2026, 6, 28), metodo: "pix", pagoPor: "Ellen",
    cobrancaChave: "pacote:inicio:0", status: "paid" as const,
  }];

  it("antes do reajuste o pacote é R$ 400 e o pagamento o quita", () => {
    const [julho] = cobrancas(geral(CEM, PAGOU_TUDO));
    expect(julho.tipo === "pagamento" && julho.valor).toBe(400);
    expect(julho.tipo === "pagamento" && julho.situacao).toBe("pago");
  });

  it("o reajuste recalcula o total e a diferença vira valor EM ABERTO — sem cobrança nova", () => {
    const linhas = cobrancas(geral(REAJUSTADO, PAGOU_TUDO));
    const [julho] = linhas;
    // 100 + 100 + 110 + 110: as sessões anteriores à vigência ficam no valor antigo.
    expect(julho.tipo === "pagamento" && julho.valor).toBe(420);
    expect(julho.tipo === "pagamento" && julho.valorPago).toBe(400);
    expect(julho.tipo === "pagamento" && julho.falta).toBe(20);
    expect(julho.tipo === "pagamento" && julho.situacao).not.toBe("pago");
    // Duas cobranças: a de julho e a de agosto. O reajuste não criou uma terceira.
    expect(linhas).toHaveLength(2);
  });

  it("o pagamento lançado continua valendo R$ 400 — nada de alteração retroativa", () => {
    const [julho] = cobrancas(geral(REAJUSTADO, PAGOU_TUDO));
    expect(julho.tipo === "pagamento" && julho.pagamentos.map((p) => p.valor)).toEqual([400]);
  });

  it("'próximo pacote a iniciar' deixa o pacote em andamento inteiro no valor antigo", () => {
    const [julho, agosto] = cobrancas(geral(
      [...CEM, { valor: 110, desde: new Date(2026, 6, 21), aplicaEm: "proximo_pacote", criadoEm: new Date(2026, 8, 1) }],
      PAGOU_TUDO,
    ));
    expect(julho.tipo === "pagamento" && julho.valor).toBe(400);
    expect(julho.tipo === "pagamento" && julho.situacao).toBe("pago");
    expect(agosto.tipo === "pagamento" && agosto.valor).toBe(440);
  });
});

describe("doc 72 — a pergunta do reajuste só aparece com pacote em andamento na data", () => {
  const janelas = janelasDosPacotes([
    { data: "2026-07-07T09:00:00", chave: "pacote:inicio:0" },
    { data: "2026-07-28T09:00:00", chave: "pacote:inicio:0" },
    { data: "2026-08-04T09:00:00", chave: "pacote:inicio:1" },
    { data: "2026-08-25T09:00:00", chave: "pacote:inicio:1" },
  ]);

  it("cada pacote vira uma janela, da primeira à última sessão dele", () => {
    expect(janelas).toEqual([
      { inicio: "2026-07-07", fim: "2026-07-28" },
      { inicio: "2026-08-04", fim: "2026-08-25" },
    ]);
  });

  it("data no MEIO de um pacote: a pergunta aparece", () => {
    expect(pacoteEmAndamentoEm(janelas, "2026-07-21")).toBe(true);
    expect(pacoteEmAndamentoEm(janelas, "2026-08-25")).toBe(true);
  });

  it("data no dia da PRIMEIRA sessão não parte nada — esse pacote é o próximo a iniciar", () => {
    expect(pacoteEmAndamentoEm(janelas, "2026-07-07")).toBe(false);
  });

  it("entre dois pacotes, antes de todos ou depois de todos: não há o que perguntar", () => {
    expect(pacoteEmAndamentoEm(janelas, "2026-08-01")).toBe(false);
    expect(pacoteEmAndamentoEm(janelas, "2026-06-30")).toBe(false);
    expect(pacoteEmAndamentoEm(janelas, "2026-09-10")).toBe(false);
  });

  it("paciente sem pacote nenhum nunca vê a pergunta", () => {
    expect(pacoteEmAndamentoEm([], "2026-07-21")).toBe(false);
    expect(janelasDosPacotes([])).toEqual([]);
  });
});

describe("doc 72 — o porquê escrito no lançamento chega à tela", () => {
  const COBRANCA = "pacote:inicio:0";

  it("a travessia banco → motor carrega os dois motivos", () => {
    const linha = {
      id: "pg1", amount: "115.00", date: new Date(2026, 6, 28), status: "paid",
      motivoSemCredito: "Combinado: fica para a próxima sessão.",
      motivoSemDiferenca: null,
    };
    expect(pagamentoParaMotor(linha).motivoSemCredito).toBe("Combinado: fica para a próxima sessão.");
    expect(pagamentoParaMotor(linha).motivoSemDiferenca).toBeNull();
  });

  it("e o motivo chega ao lançamento que a guia Geral lista", () => {
    const [julho] = cobrancas(geral([{ valor: 100, desde }], [{
      id: "pg1", valor: 5, data: new Date(2026, 6, 28), metodo: "pix", pagoPor: "Ellen",
      cobrancaChave: COBRANCA, status: "paid", quita: true,
      motivoSemDiferenca: "Desconto combinado por causa da mudança.",
    }]));
    expect(julho.tipo === "pagamento" && julho.pagamentos[0].motivoSemDiferenca)
      .toBe("Desconto combinado por causa da mudança.");
  });

  it("o VALOR ORIGINAL da cobrança continua à mão depois de a diferença ser perdoada", () => {
    const [julho] = cobrancas(geral([{ valor: 100, desde }], [{
      id: "pg1", valor: 5, data: new Date(2026, 6, 28), metodo: "pix", pagoPor: "Ellen",
      cobrancaChave: COBRANCA, status: "paid", quita: true,
    }]));
    // É `valor` que a tela mostra como "Valor original": o recebido foi R$ 5,00.
    expect(julho.tipo === "pagamento" && julho.valor).toBe(400);
    expect(julho.tipo === "pagamento" && julho.valorPago).toBe(5);
    expect(julho.tipo === "pagamento" && julho.situacao).toBe("pago");
  });
});

describe("doc 72 — trocar quem pagou vale só para aquele lançamento", () => {
  const cadastro = {
    pacienteNome: "Giulia Pereira Silva de Araujo",
    pacienteCpf: "111.111.111-11",
    responsavelNome: "Elaine Pereira",
    responsavelCpf: "222.222.222-22",
  };

  it("o avô que pagou uma vez NÃO passa a ser o pagador proposto nas seguintes", () => {
    expect(pagadorSugerido(cadastro, { nome: "Avô Marco", cpf: "333.333.333-33" }))
      .toEqual({ nome: "Elaine Pereira", cpf: "222.222.222-22" });
  });

  it("sem responsável, a proposta é o paciente — e o par continua da mesma pessoa", () => {
    expect(pagadorSugerido({ ...cadastro, responsavelNome: null, responsavelCpf: null }, { nome: "Avô Marco", cpf: "333.333.333-33" }))
      .toEqual({ nome: "Giulia Pereira Silva de Araujo", cpf: "111.111.111-11" });
  });
});

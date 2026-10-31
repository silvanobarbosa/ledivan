import { describe, it, expect } from "vitest";
import { linhasDaGeral, type EntradaDaGeral, type LinhaDaGeral } from "@/lib/guiaGeral";

/**
 * Doc 71, item 3: *"'Será lançada em outra data' estava funcionando perfeitamente e agora parou de
 * funcionar e está jogando para a próxima sessão do pacote."*
 *
 * O doc 68 criou os dois destinos da diferença e nenhum teste os cobriu. Aqui a cena da dona: dois
 * pacotes seguidos, o primeiro já encerrado, pagamento de METADE marcado "fica nesta cobrança".
 */

const desde = new Date(2026, 0, 1);
const precos = [{ valor: 50, desde }];
const hoje = new Date(2026, 8, 15, 12);

const sessao = (id: string, dia: number, mes: number) => ({ id, date: new Date(2026, mes, dia, 9), status: "realizada" });
// Julho: 4 sessões (pacote de R$ 200). Agosto: outras 4 (o "próximo pacote").
const SESSOES = [
  sessao("j1", 7, 6), sessao("j2", 14, 6), sessao("j3", 21, 6), sessao("j4", 28, 6),
  sessao("a1", 4, 7), sessao("a2", 11, 7), sessao("a3", 18, 7), sessao("a4", 25, 7),
];

function geral(pagamentos: EntradaDaGeral["pagamentos"]): LinhaDaGeral[] {
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

const METADE = {
  id: "pg1", valor: 100, data: new Date(2026, 6, 28), metodo: "pix", pagoPor: "Ellen",
  cobrancaChave: "pacote:inicio:0", status: "paid" as const,
};

describe("doc 71 — a diferença que FICA não rola para o pacote seguinte", () => {
  it("sem a marca, a diferença rola: a cobrança de julho fecha e agosto engorda (comportamento antigo)", () => {
    const [julho, agosto] = cobrancas(geral([METADE]));
    expect(julho.tipo === "pagamento" && julho.valor).toBe(200);
    expect(agosto.tipo === "pagamento" && agosto.valor).toBe(300); // 200 + os 100 que rolaram
  });

  it("COM a marca, a cobrança de julho continua em aberto e agosto fica nos R$ 200 dela", () => {
    const [julho, agosto] = cobrancas(geral([{ ...METADE, ficaNaCobranca: true }]));
    expect(julho.tipo === "pagamento" && julho.situacao).not.toBe("pago");
    expect(julho.tipo === "pagamento" && julho.falta).toBe(100);
    expect(agosto.tipo === "pagamento" && agosto.valor).toBe(200);
  });

  it("e o segundo lançamento, na mesma cobrança, fecha o que faltava", () => {
    const [julho] = cobrancas(geral([
      { ...METADE, ficaNaCobranca: true },
      { ...METADE, id: "pg2", valor: 100, data: new Date(2026, 7, 5), ficaNaCobranca: false },
    ]));
    expect(julho.tipo === "pagamento" && julho.falta).toBe(0);
    expect(julho.tipo === "pagamento" && julho.situacao).toBe("pago");
  });
});

import { blocoDoAgendamento, camposDaEscolha, escolhaEfetiva } from "@/lib/opcoesDoAgendamento";
import { slotsRecorrentes } from "@/lib/agendaRecorrente";
import { rotuloFrequenciaReal } from "@/lib/rotulosPaciente";
import { cobrancasDoPaciente, rotulosDasSessoes } from "@/lib/cobrancas";

describe("doc 71 — quem paga a cada sessão pode marcar a sessão como cortesia", () => {
  it("o quadro aparece no financeiro avulso, com 'Não' como padrão", () => {
    const b = blocoDoAgendamento({ formato: "sessao" });
    expect(b?.titulo).toBe("Esta sessão será cortesia");
    expect(b?.opcoes.map((o) => o.rotulo)).toEqual(["Sim", "Não"]);
    expect(b?.padrao).toBe("normal");
  });

  it("no pacote o quadro continua sendo o da sequência — a cortesia não volta para lá", () => {
    const b = blocoDoAgendamento({ formato: "mensal", jaTemSequencia: true });
    expect(b?.titulo).toBe("Sequência do pacote");
    expect(b?.opcoes.some((o) => o.valor === "cortesia")).toBe(false);
  });

  it("gratuito e devolutiva não perguntam nada", () => {
    expect(blocoDoAgendamento({ formato: "gratuito" })).toBeNull();
    expect(blocoDoAgendamento({ formato: "sessao", sessionKind: "devolutiva" })).toBeNull();
  });

  it("a escolha vira o campo do formulário, sem tirar a sessão da sequência", () => {
    expect(camposDaEscolha("cortesia")).toEqual({ naSequencia: "sim", cortesia: "sim" });
    expect(camposDaEscolha("normal")).toEqual({ naSequencia: "sim", cortesia: "nao" });
    expect(camposDaEscolha("fora")).toEqual({ naSequencia: "nao", cortesia: "nao" });
  });

  it("marcar cortesia e depois trocar para um paciente de pacote volta ao padrão", () => {
    const doPacote = blocoDoAgendamento({ formato: "mensal", jaTemSequencia: true });
    expect(escolhaEfetiva(doPacote, "cortesia")).toBe("normal");
  });

  it("a sessão marcada não gera cobrança e se chama GRAT", () => {
    const desde2 = new Date(2026, 0, 1);
    const entrada = {
      vigencias: [{ formato: "sessao", pacoteTipo: "completo", desde: desde2 }],
      reserva: { formato: "sessao" },
      precos: [{ valor: 130, desde: desde2 }],
      sessoes: [
        { id: "x1", date: new Date(2026, 5, 2, 9), status: "realizada" },
        { id: "x2", date: new Date(2026, 5, 9, 9), status: "realizada", cortesia: true },
      ],
    } as never;
    expect(cobrancasDoPaciente(entrada).map((c) => c.chave)).toEqual(["sessao:x1"]);
    expect(rotulosDasSessoes(entrada).get("x2")).toBe("GRAT");
  });
});

describe("doc 71 — a lista mostra o combinado, não o atendimento remarcado", () => {
  // A agenda da Yngrid, medida: oito segundas às 20:00 e UMA terça às 17:00 (um remarcado).
  const segundas = [2, 9, 16, 23, 30, 37, 44, 51].map((d) => ({ date: new Date(2026, 10, 2 + d - 2, 20, 0) }));
  const remarcada = { date: new Date(2026, 10, 3, 17, 0) };
  const agenda = [remarcada, ...segundas];

  it("semanal 1x fica com o par que se repete", () => {
    expect(slotsRecorrentes(agenda, 1)).toEqual([{ dia: "segunda", hora: "20:00" }]);
    expect(rotuloFrequenciaReal("semanal", slotsRecorrentes(agenda, 1))).toBe("Semanal · Segunda 20:00");
  });

  it("semanal 2x continua mostrando os dois horários, em ordem de dia", () => {
    const tercas = [1, 8, 15].map((d) => ({ date: new Date(2026, 10, 2 + d, 17, 0) }));
    const slots = slotsRecorrentes([...segundas, ...tercas], 2);
    expect(slots).toEqual([{ dia: "segunda", hora: "20:00" }, { dia: "terça", hora: "17:00" }]);
    expect(rotuloFrequenciaReal("semanal2x", slots)).toBe("Semanal 2x · Segunda 20:00, Terça 17:00");
  });

  it("sem sessão recorrente nenhuma, nada se inventa", () => {
    expect(slotsRecorrentes([], 1)).toEqual([]);
  });
});

import { pagamentoParaMotor } from "@/lib/entradaDoMotor";

describe("doc 71 — a marca da diferença chega ao motor", () => {
  // O defeito do item 3 não estava no motor (os testes acima já passavam antes da correção): a
  // coluna era lida do banco e descartada na TRAVESSIA até ele. A guia Geral mandava um pagamento
  // sem `ficaNaCobranca`, e o motor, sem a marca, rolava a diferença como sempre rolou.
  const linha = {
    id: "p1", amount: "100.00", date: new Date(2026, 6, 28), status: "paid",
    cobrancaChave: "pacote:inicio:0", quita: false, ficaNaCobranca: true,
  };

  it("a travessia banco → motor carrega a marca", () => {
    expect(pagamentoParaMotor(linha).ficaNaCobranca).toBe(true);
  });

  it("e quem não a tem continua em nulo, que é o comportamento antigo", () => {
    expect(pagamentoParaMotor({ ...linha, ficaNaCobranca: undefined }).ficaNaCobranca).toBeNull();
  });
});

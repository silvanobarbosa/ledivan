import { describe, it, expect } from "vitest";
import { cobrancasDoPaciente, type EntradaDasCobrancas, type SessaoDaCobranca } from "@/lib/cobrancas";

/**
 * DOC 19 — A SEQUÊNCIA DESLOCADA VALE PARA O QUE AINDA NÃO EXISTE.
 *
 * O "Sim, desloca o mês das próximas parcelas" (doc 45) gravava uma data nova para cada cobrança
 * futura que existia NAQUELE instante. Sessão marcada depois nascia fora da sequência: o motor
 * calculava o vencimento natural dela e a lista voltava a misturar dois ritmos.
 *
 * A correção é de natureza, não de alcance: o deslocamento deixa de ser uma lista de datas e
 * passa a ser uma REGRA com um ponto de partida. Quem nasce depois do ponto nasce deslocado.
 *
 * As duas bordas que o dono fixou:
 *  - "enquanto fizerem parte da mesma sequência financeira" — uma nova alteração estabelece uma
 *    sequência NOVA, e a regra velha morre com ela (é uma linha por paciente, substituída);
 *  - "preservando os pagamentos e históricos anteriores" — cobrança já paga não anda, e o que
 *    ficou para trás do ponto de partida também não.
 */

const FEE = 100;
const precos = [{ valor: FEE, desde: new Date(2026, 0, 1) }];

let n = 0;
const sessao = (ano: number, mes: number, dia: number): SessaoDaCobranca => ({
  id: `s${++n}`,
  date: new Date(ano, mes, dia, 18, 0, 0),
  status: "realizada",
});

/** Quatro sessões semanais dentro de um mês — um pacote fechado. */
const mesCheio = (ano: number, mes: number) => [sessao(ano, mes, 7), sessao(ano, mes, 14), sessao(ano, mes, 21), sessao(ano, mes, 28)];

const cobrar = (sessoes: SessaoDaCobranca[], extra: Partial<EntradaDasCobrancas> = {}) =>
  cobrancasDoPaciente({
    vigencias: [],
    reserva: { formato: "mensal", pacoteTipo: "completo" },
    precos,
    valorDaSessao: FEE,
    tamanhos: [],
    diaPagamento: 5,
    ...extra,
    sessoes,
  });

const datas = (cs: ReturnType<typeof cobrar>) =>
  cs.filter((c) => c.tipo === "pacote").map((c) => (c.vencimento ? `${c.vencimento.getDate()}/${c.vencimento.getMonth() + 1}` : "—"));

const pacotes = (cs: ReturnType<typeof cobrar>) => cs.filter((c) => c.tipo === "pacote");

describe("doc 19: o deslocamento é uma regra, não uma lista de datas", () => {
  // Setembro, outubro e novembro de 2026: um pacote por mês, vencendo todo dia 5 — menos o
  // primeiro, que ancora na primeira sessão (regra de 18/09) e por isso vence em 07/09.
  const tresMeses = () => [...mesCheio(2026, 8), ...mesCheio(2026, 9), ...mesCheio(2026, 10)];

  it("sem regra nenhuma, o motor segue o dia combinado", () => {
    expect(datas(cobrar(tresMeses()))).toEqual(["7/9", "5/10", "5/11"]);
  });

  it("a regra desloca TODA cobrança a partir do ponto, inclusive as que nascem depois", () => {
    // A terapeuta empurrou a de outubro para novembro (+1 mês), a partir de 05/10.
    expect(datas(cobrar(tresMeses(), { deslocamentos: [{ aPartirDe: new Date(2026, 9, 5), meses: 1 }] })))
      .toEqual(["7/9", "5/11", "5/12"]);

    // Agora chegam sessões de dezembro — marcadas DEPOIS da decisão. Nascem já deslocadas.
    expect(datas(cobrar([...tresMeses(), ...mesCheio(2026, 11)], { deslocamentos: [{ aPartirDe: new Date(2026, 9, 5), meses: 1 }] })))
      .toEqual(["7/9", "5/11", "5/12", "5/1"]);
  });

  it("o que vence ANTES do ponto de partida não se mexe — é histórico", () => {
    expect(datas(cobrar(tresMeses(), { deslocamentos: [{ aPartirDe: new Date(2026, 10, 5), meses: 2 }] })))
      .toEqual(["7/9", "5/10", "5/1"]);
  });

  it("cobrança com pagamento lançado não anda, mesmo depois do ponto", () => {
    const segunda = pacotes(cobrar(tresMeses()))[1].chave;
    // A 1ª e a 3ª andam um mês; a 2ª (paga) fica em 05/10 — e por isso passa a aparecer ANTES da
    // primeira, que foi parar em 07/10. A guia ordena por vencimento, não por ordem de pacote.
    expect(datas(cobrar(tresMeses(), { deslocamentos: [{ aPartirDe: new Date(2026, 8, 5), meses: 1 }], naoDeslocar: [segunda] })))
      .toEqual(["5/10", "7/10", "5/12"]);
  });

  it("o vencimento editado à mão vence a regra — é a data mais específica que existe", () => {
    const terceira = pacotes(cobrar(tresMeses()))[2].chave;
    expect(datas(cobrar(tresMeses(), {
      deslocamentos: [{ aPartirDe: new Date(2026, 8, 5), meses: 1 }],
      vencimentos: [{ chave: terceira, vencimento: new Date(2026, 11, 20, 12, 0, 0) }],
    }))).toEqual(["7/10", "5/11", "20/12"]);
  });

  it("o dia se preserva, e encolhe só quando o mês de destino não o tem", () => {
    // 31 de janeiro + 1 mês = fevereiro, que não tem 31. Vira o último dia, não 3 de março.
    expect(datas(cobrar(mesCheio(2026, 0), {
      diaPagamento: 31,
      deslocamentos: [{ aPartirDe: new Date(2026, 0, 31), meses: 1 }],
    }))).toEqual(["28/2"]);
  });

  it("o vencimento natural fica registrado, para a tela saber de onde a data saiu", () => {
    const segunda = pacotes(cobrar(tresMeses(), { deslocamentos: [{ aPartirDe: new Date(2026, 9, 5), meses: 1 }] }))[1];
    expect(segunda.vencimento?.getMonth()).toBe(10); // novembro — deslocada
    expect(segunda.vencimentoNatural?.getMonth()).toBe(9); // outubro — o que o motor calculou
  });
});

/**
 * A SEGUNDA SEQUÊNCIA NÃO APAGA A PRIMEIRA.
 *
 * "Caso seja realizada uma nova alteração de vencimento, deverá ser estabelecida uma nova
 * sequência, sempre preservando os pagamentos e históricos anteriores."
 *
 * Guardar uma sequência só por paciente cumpriria a primeira metade da frase e quebraria a
 * segunda: ajustar uma cobrança de 2027 faria os vencimentos de 2026, já arrumados, voltarem
 * sozinhos à data natural — data de dinheiro mudando calada, sem ninguém pedir.
 */
describe("doc 19: cada sequência manda do seu ponto em diante", () => {
  const seisMeses = () => [
    ...mesCheio(2026, 8), ...mesCheio(2026, 9), ...mesCheio(2026, 10),
    ...mesCheio(2026, 11), ...mesCheio(2027, 0), ...mesCheio(2027, 1),
  ];
  // Os vencimentos NATURAIS: 07/09, 05/10, 05/11, 05/12, 05/01/27 e 05/02/27. É deles que cada
  // sequência mede o próprio passo — nunca da data que já está na tela.
  const PRIMEIRA = { aPartirDe: new Date(2026, 9, 5), meses: 1 };
  const SEGUNDA = { aPartirDe: new Date(2026, 11, 5), meses: 3 };

  it("o trecho arrumado pela primeira sequência continua arrumado", () => {
    expect(datas(cobrar(seisMeses(), { deslocamentos: [PRIMEIRA] })))
      .toEqual(["7/9", "5/11", "5/12", "5/1", "5/2", "5/3"]);

    // Agora ela mexe na cobrança de dezembro: +3 meses a partir do natural dela (05/12).
    expect(datas(cobrar(seisMeses(), { deslocamentos: [PRIMEIRA, SEGUNDA] })))
      .toEqual(["7/9", "5/11", "5/12", "5/3", "5/4", "5/5"]);
    // Outubro e novembro seguem onde a primeira sequência os pôs. Nada voltou sozinho.
  });

  it("os passos não se somam — vale a última sequência que alcança a cobrança", () => {
    // Dezembro é alcançado pelas duas (+1 e +3). Anda 3, não 4: cada passo parte do natural.
    expect(datas(cobrar(seisMeses(), { deslocamentos: [PRIMEIRA, SEGUNDA] }))[3]).toBe("5/3");
  });

  it("a ordem é a das datas, não a da digitação", () => {
    expect(datas(cobrar(seisMeses(), { deslocamentos: [SEGUNDA, PRIMEIRA] })))
      .toEqual(["7/9", "5/11", "5/12", "5/3", "5/4", "5/5"]);
  });
});

/**
 * QUAL PACOTE RECEBE O REAJUSTE quando a resposta é "próximo pacote a iniciar".
 *
 * Doc 74 (dono) — a regra, com as palavras dele:
 *
 * > O sistema deverá considerar a **data de início do pacote**, e não apenas as datas individuais
 * > das sessões. Se o pacote começou antes da data de vigência, deverá permanecer integralmente
 * > com o valor antigo. […] Se o pacote identificado já possuir **pagamento lançado**, deverá ser
 * > preservado integralmente, sem alteração retroativa, e o sistema deverá procurar o próximo
 * > pacote sem pagamento lançado.
 *
 * Duas coisas que o documento separa e que é fácil confundir:
 *
 * 1. **O pacote é identificado pelo INÍCIO**, não pelo vencimento nem pelas datas soltas das
 *    sessões. Um pacote que começou em agosto fica inteiro no valor antigo mesmo tendo sessões em
 *    setembro — é o exemplo do próprio documento.
 * 2. **O que desqualifica um pacote é PAGAMENTO**, não status. O doc 73 tinha lido "status
 *    lançado"; o 74 é explícito e mais estreito: um pacote com sessões já realizadas mas sem
 *    dinheiro lançado AINDA pode receber o valor novo. Mexer onde já entrou dinheiro é que não.
 *
 * A resposta é usada UMA VEZ, ao salvar o reajuste, para CONGELAR a data de vigência. Deixar a
 * regra viva no motor faria o reajuste escorregar para a frente a cada pagamento novo — e nunca
 * entrar em vigor.
 *
 * Funções puras.
 */

export type PacoteParaReajuste = {
  /** O número da sequência. É por ele que "o próximo" tem significado. */
  sequencia: number;
  /** A data da PRIMEIRA sessão do pacote. */
  inicio: Date | string;
  /** Já entrou dinheiro neste pacote? */
  temPagamento: boolean;
};

const emData = (d: Date | string): Date => (d instanceof Date ? d : new Date(d));
const noDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * O INÍCIO do próximo pacote elegível — `null` quando não há nenhum.
 *
 * Elegível = começa na data de vigência ou depois dela, E ainda não tem pagamento lançado. Entre
 * os que sobram, vale o de menor sequência: "o próximo" é o próximo mesmo, não o mais barato de
 * mexer.
 */
export function inicioDoProximoPacoteElegivel(
  pacotes: PacoteParaReajuste[],
  vigencia: Date,
): Date | null {
  const corte = noDia(vigencia).getTime();
  const candidatos = pacotes
    .map((p) => ({ ...p, dia: noDia(emData(p.inicio)) }))
    .filter((p) => !Number.isNaN(p.dia.getTime()))
    .filter((p) => p.dia.getTime() >= corte)
    .filter((p) => !p.temPagamento)
    .sort((a, b) => a.sequencia - b.sequencia);
  return candidatos.length ? candidatos[0].dia : null;
}

/**
 * A VIGÊNCIA QUE VAI SER GRAVADA.
 *
 * Empurra a data escolhida para o começo do próximo pacote elegível — e **nunca para trás**. Sem
 * pacote elegível conhecido (a agenda ainda não tem o próximo, ou os que existem já têm
 * pagamento), fica a data escolhida: o motor aplicará o valor novo ao primeiro pacote que começar
 * dali em diante, que é a mesma promessa.
 */
export function vigenciaDoProximoPacote(escolhida: Date, pacotes: PacoteParaReajuste[]): Date {
  const inicio = inicioDoProximoPacoteElegivel(pacotes, escolhida);
  if (!inicio) return escolhida;
  return inicio.getTime() > escolhida.getTime() ? inicio : escolhida;
}

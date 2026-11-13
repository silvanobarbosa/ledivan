/**
 * O "DESMARCOU" QUE PERGUNTA O QUE FAZER COM O DINHEIRO (documento do dono, 12/11/2026).
 *
 * Até aqui "Desmarcou" era mudo do lado financeiro: `cancelada` entra em `STATUS_QUE_PAUSAM`, a
 * cobrança da sessão deixa de existir e pronto. Isso está certo para o pacote — a posição volta
 * para a sessão seguinte e o paciente não perde nada —, mas erra na sessão AVULSA desmarcada em
 * cima da hora, que a terapeuta combinou cobrar: o valor sumia da guia Geral sem deixar rastro, e
 * não havia por onde trazê-lo de volta a não ser desfazer o status.
 *
 * Agora ela escolhe. E a escolha é de UM campo só (`desmarcouCobra`), pelo mesmo motivo do
 * `faltouConta` do doc 45: o que muda é se aquela cobrança continua de pé, não como ela é
 * calculada. Nenhuma regra de valor, vencimento ou competência nasce aqui.
 *
 * ALCANCE — o que o documento pede, em uma frase: avulso, mais o mensal/quinzenal cuja sessão
 * ficou FORA da sequência do pacote ("não adicionar à sequência — sim", que a tela mostra como
 * AVUL). Dentro da sequência, nada muda. Quem traduz isso é `tipoDaFaltaPeloRotulo`, que já lê o
 * rótulo da célula — a mesma porta que a janela da falta usa, e não uma segunda classificação
 * correndo em paralelo.
 */

import type { TipoDaFalta } from "./perguntaFalta";

/**
 * Os status que a tela chama de "Desmarcou". `realocada` é legado: ninguém a marca mais, mas o
 * banco tem linhas assim e a guia Geral as rotula igual — por isso a marca vale nas duas.
 *
 * `prof_desmarcou` fica de FORA: é outro botão, outro rótulo ("Prof. desm.") e o documento fala
 * do Desmarcou do paciente. Incluí-lo seria decidir sobre dinheiro por conta própria.
 */
export const STATUS_DE_DESMARCADA: ReadonlySet<string> = new Set(["cancelada", "realocada"]);

/** A janela da escolha aparece? Só no que tem cobrança PRÓPRIA da sessão para manter de pé. */
export function ofereceEscolhaDoDesmarcou(tipo: TipoDaFalta): boolean {
  return tipo === "avulso";
}

/**
 * Esta sessão está desmarcada E com a cobrança mantida?
 *
 * É a pergunta que o motor faz antes de deixar passar uma sessão que, por status, não cobraria.
 * `null`/ausente é o legado — e legado nenhum começa a cobrar sozinho.
 */
export function desmarcouCobrando(s: { status?: string | null; desmarcouCobra?: boolean | null }): boolean {
  return s.desmarcouCobra === true && STATUS_DE_DESMARCADA.has(s.status ?? "");
}

/** A pergunta da janela, nas palavras do documento. */
export const DESMARCOU_PERGUNTA = {
  titulo: "Deseja manter o pagamento pendente para que seja realizado posteriormente?",
  explicaSim: "O valor continua na guia Financeiro Geral, com a cobrança em aberto.",
  explicaNao: "O valor sai da guia Financeiro Geral, sem gerar cobrança.",
} as const;

/**
 * A saída, igual à da falta (doc 54): sem esta linha a resposta parece definitiva, e não é.
 * Clicar "Desmarcou" de novo numa sessão já desmarcada reabre a janela.
 */
export const COMO_REFAZER_DESMARCOU = 'Se mudar de ideia, selecione novamente "Desmarcou" para refazer sua escolha.';

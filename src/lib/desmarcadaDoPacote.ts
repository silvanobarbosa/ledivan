/**
 * O "DESMARCOU" DENTRO DE UM PACOTE FRACIONADO EM ABERTO (documento do dono, 17/11/2026).
 *
 * O doc 12/11 deu à terapeuta a escolha sobre o dinheiro da desmarcada AVULSA. Este documento
 * pede a mesma escolha dentro do pacote fracionado — e ela decide outra coisa, não a mesma:
 *
 * - no avulso, o que está em jogo é a cobrança DAQUELA sessão ficar de pé ou não;
 * - no fracionado, é o TAMANHO do pacote. Respondendo "Não", a sessão desmarcada deixa de compor
 *   a quantidade cobrável: o pacote de quatro passa a ser de três, a numeração se reorganiza
 *   (1/3, 2/3, 3/3) e o valor total acompanha, porque ele é preço × quantidade.
 *
 * **O agendamento continua existindo, com o status Desmarcou.** O que sai é a vaga que ele ocupava
 * na conta do mês — "o agendamento desmarcado permanece registrado na agenda, mas deixa de compor
 * a quantidade de sessões cobráveis", nas palavras do documento.
 *
 * **A resposta é gravada no MESMO campo do doc 12/11 (`desmarcouCobra`)**, e não num segundo. A
 * pergunta é a mesma — *esta desmarcada conta para o dinheiro?* —, só o efeito muda conforme o que
 * a sessão é. Uma coluna por tela faria duas verdades sobre a mesma sessão, e elas divergiriam na
 * primeira vez que alguém trocasse o formato do paciente.
 *
 * `null` é o legado: tudo que já está gravado continua contando, como sempre contou. Só o "Não"
 * EXPLÍCITO encolhe um pacote — nenhum pacote antigo muda de tamanho sozinho.
 *
 * ALCANCE, em uma frase: mensal ou quinzenal, fracionado, sem nenhum pagamento lançado. Pacote
 * completo não entra (o tamanho dele é contratado, não deduzido do mês), avulso não entra, e
 * pacote já pago não entra — mexer no tamanho de um pacote pago mudaria um valor já recebido.
 */

import { STATUS_DE_DESMARCADA } from "./desmarcouDoAvulso";

/**
 * Este paciente, NA DATA DA SESSÃO, está no caso do documento: mensal ou quinzenal, fracionado?
 *
 * O `primeira_pacote` fica de fora de propósito: ele é outro combinado ("paga na abertura"), e o
 * documento nomeia dois. Decidir por ele aqui seria decidir sobre dinheiro por conta própria.
 */
export function pacoteAceitaEscolha(formato: string | null | undefined, pacoteTipo: string | null | undefined): boolean {
  if (pacoteTipo !== "fragmentado") return false;
  const f = String(formato ?? "").trim().toLowerCase();
  return f === "mensal" || f === "quinzenal";
}

/**
 * Esta sessão foi tirada da contagem do pacote?
 *
 * Só o "Não" explícito (`false`) tira. Ausente/`null` é o legado, e legado nenhum encolhe pacote
 * sozinho — seria mudar, calado, o valor de pacotes que a terapeuta já conhece.
 */
export function foraDaContagemDoPacote(s: { status?: string | null; desmarcouCobra?: boolean | null }): boolean {
  return s.desmarcouCobra === false && STATUS_DE_DESMARCADA.has(s.status ?? "");
}

/** A pergunta da janela, nas palavras do documento. */
export const PACOTE_PERGUNTA = {
  titulo: "O pagamento deste pacote está em aberto, deseja considerar a cobrança desta sessão no pacote?",
  explicaSim: "A sessão continua compondo o pacote, como hoje.",
  // O que ela vai VER depois de responder: a numeração e o valor. "Não considerar na cobrança" é
  // a palavra do sistema; o que muda na tela é o tamanho do pacote.
  explicaNao: "A sessão sai da contagem: o pacote passa a ter uma sessão a menos, com a numeração e o valor recalculados.",
} as const;

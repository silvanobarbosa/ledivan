/**
 * O RECIBO DO QUE A VOZ EXECUTOU.
 *
 * Pedido do dono (02/11): "ao ouvir e executar um comando, precisamos que o sistema mostre o
 * comando executado, provando que fez". A prova não é a ação devolver `ok: true` — isso é a ação
 * falando de si mesma. É o registro **lido de volta do banco depois da escrita**, com o id que ela
 * pode conferir. Se a leitura não achar nada, não houve escrita, e então não existe recibo.
 *
 * Aqui mora só a forma (tipo e formatação do instante). Quem lê o banco são as ações.
 *
 * Funções puras.
 */

import { horaDeParede } from "./horaLocal";

export type ReciboDaVoz = {
  /** O comando como o APP o executou — verbo e alvo, não a frase solta que ela falou. */
  comando: string;
  paciente: string;
  /** O que ficou gravado, lido do banco depois de gravar. */
  gravado: string;
  /** Quando, em hora de parede: a mesma que o resto da tela mostra. */
  quando: string;
  /** O id da linha: é o que torna o recibo conferível em vez de uma frase bonita. */
  id: string;
};

/**
 * O instante do recibo, em hora de parede.
 *
 * Passa por `horaDeParede` de propósito: a coluna guarda hora de parede e o driver a devolve como
 * se fosse UTC — ler cru mostraria 12:41 numa anotação feita às 09:41. Ver
 * [[licao-meia-noite-vira-dia-anterior]].
 */
export function quandoDoRecibo(d: Date | string | null | undefined): string {
  const parede = horaDeParede(d);
  if (!parede) return "";
  const [dia, hora] = parede.split("T");
  const [a, m, g] = dia.split("-");
  return `${g}/${m}/${a} às ${hora.slice(0, 5)}`;
}

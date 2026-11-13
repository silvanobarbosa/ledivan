/**
 * O VALOR QUE NASCEU DA FALTA — e só ele — pode ser apagado quando o status muda.
 *
 * Doc 54: a falta cobrada do paciente gratuito recebe um valor digitado na hora, e esse valor só
 * existe por causa da resposta "Sim, cobra". Saindo de "Faltou", a resposta é limpa e o valor vai
 * junto; deixá-lo para trás guardava um número que ressuscitava sozinho se o status voltasse.
 *
 * O ERRO QUE ISTO CONSERTA (dono, 12/11/2026): a condição olhava só o status NOVO — "não é
 * Faltou, então apaga". Funcionava enquanto `valorExtra` fosse só o valor da falta. Desde o doc
 * 62 ele é o valor DAQUELA SESSÃO, escrito pelo lápis da coluna Valor da guia Geral — e aí a
 * mesma linha passou a apagar o que a terapeuta tinha digitado, em qualquer troca de status.
 * O relato veio pelo "Desmarcou" (escolher Não e depois Sim trazia a sessão de volta por R$ 0,00),
 * mas o caminho mais curto para o mesmo estrago era marcar "Presente".
 *
 * Agora a pergunta é a certa: **este valor nasceu da falta?** Ele nasceu se a sessão ESTAVA em
 * "Faltou" com a resposta "Sim" — o único estado em que `definirValorDaFalta` aceita gravar.
 *
 * Função pura.
 */

export function apagaOValorDaFalta(
  atual: { status: string; faltouConta?: boolean | null; extra?: string | null; valorExtra?: unknown },
  novoStatus: string,
): boolean {
  // Sessão EXTRA tem valor do agendamento: nunca foi da falta, nunca sai daqui.
  if (atual.extra) return false;
  if (atual.valorExtra == null) return false;
  // Nasceu da falta? Só o "Faltou" com resposta "Sim" abre o campo que grava este valor.
  if (atual.status !== "nao_realizada" || atual.faltouConta !== true) return false;
  // E só some quando a sessão DEIXA esse estado.
  return novoStatus !== "nao_realizada";
}

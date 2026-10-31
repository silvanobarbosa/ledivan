/**
 * QUANDO A CORTESIA É OFERECIDA.
 *
 * "Sessão Cortesia" significa uma coisa só: **esta sessão não é cobrada**.
 *
 * Doc 66 (dono, 31/10): ela é escolhida ao CRIAR o agendamento, junto da sequência do pacote, e
 * saiu da janela de editar — onde morou do doc 54 ao doc 65. O motivo é o mesmo que já tinha
 * tirado a sequência de lá: é uma decisão de dinheiro pegando carona numa troca de horário. Quais
 * opções aparecem em cada financeiro é assunto de `blocoDoAgendamento`; aqui fica só o gate.
 *
 * O que ela faz muda com o formato, e os efeitos já existiam:
 *  - dentro de um pacote, a sessão PAUSA a sequência: deixa de ocupar posição (a seguinte assume o
 *    número dela) e continua pertencendo ao pacote e ao grupo de pagamento;
 *  - a cada sessão, a cobrança daquele atendimento simplesmente não nasce;
 *  - no gratuito, ela protegia a sessão da cobrança que a resposta "Faltou → sim, cobrar" cria.
 *
 * A DEVOLUTIVA segue de fora: ela já tem a escolha dela ("cobrar esta devolutiva" / "abater do
 * pacote"), e as duas juntas na mesma tela seriam duas perguntas disputando a mesma decisão.
 *
 * Função pura.
 */

export function podeSerCortesia(o: { sessionKind?: string | null }): boolean {
  return o.sessionKind !== "devolutiva";
}

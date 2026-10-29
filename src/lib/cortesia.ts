/**
 * QUANDO A CORTESIA É OFERECIDA.
 *
 * "Este atendimento será uma cortesia" aparece no editar agendamento, acima da data e hora, e
 * significa uma coisa só: **esta sessão não é cobrada**. Doc 65 (dono, 28/10): a pergunta vale nos
 * três financeiros — a cada sessão, mensal e quinzenal — e também no gratuito; antes ela só
 * aparecia no mensal/quinzenal em pacote completo.
 *
 * O que ela faz muda com o formato, e os dois efeitos já existiam:
 *  - dentro de um pacote, a sessão PAUSA a sequência: deixa de ocupar posição (a seguinte assume o
 *    número dela) e continua pertencendo ao pacote e ao grupo de pagamento;
 *  - a cada sessão, a cobrança daquele atendimento simplesmente não nasce;
 *  - no gratuito, ela protege a sessão da cobrança que a resposta "Faltou → sim, cobrar" cria.
 *
 * Isto SUBSTITUI o recorte do doc 54 (só mensal/quinzenal em pacote completo) e o achado do
 * SuperQA de 22/10, que tirou o checkbox das extras porque ali ele não fazia efeito nenhum. O
 * efeito passa a existir: a extra avulsa marcada como cortesia não gera cobrança (ver
 * `cobrancasDoPaciente`, em lib/cobrancas). Oferecer uma escolha que não muda nada continua sendo
 * pior do que não oferecer — a correção foi dar efeito a ela, não esconder a pergunta.
 *
 * A DEVOLUTIVA segue de fora: ela já tem a escolha dela ("cobrar esta devolutiva" / "abater do
 * pacote"), e as duas juntas na mesma tela seriam duas perguntas disputando a mesma decisão.
 *
 * Função pura.
 */

export function podeSerCortesia(o: { sessionKind?: string | null }): boolean {
  return o.sessionKind !== "devolutiva";
}

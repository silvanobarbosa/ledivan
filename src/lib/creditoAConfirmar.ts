/**
 * O CRÉDITO QUE PRECISA DE UM "SIM" ANTES DE ABATER (doc 61).
 *
 * Até aqui o saldo de crédito abatia sozinho: na conversão de uma sessão GRAT em AVUL ele ia para a
 * cobrança nova (doc 59), e em qualquer "Lançar pagamento" ele entrava antes do dinheiro (doc 36).
 * Isso é o certo quando o crédito nasceu de uma sessão que não aconteceu — o paciente já pagou, não
 * há decisão a tomar.
 *
 * O documento abre UMA exceção, e só ela: ao transformar uma GRAT em AVUL tendo saldo, o sistema
 * PERGUNTA se o crédito deve ser usado agora. Dito "Não", o saldo fica inteiro e deixa de andar
 * sozinho — e a pergunta volta em cada lançamento seguinte, com o valor atualizado, até o crédito
 * acabar. "O sistema não deverá estender esse comportamento a outras situações de utilização de
 * crédito que já possuam regras próprias."
 *
 * Por isso o crédito à espera de confirmação é um SUBCONJUNTO do disponível, e não outro saldo: o
 * paciente tem um crédito só. O que muda é quem pode gastá-lo sem perguntar.
 *
 * Funções puras: decidem, não gravam.
 */

const TOL = 0.005;
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Quanto do saldo pode abater ESTE lançamento.
 *
 * O crédito à espera de confirmação só entra com o "Sim" explícito; o resto do saldo abate como
 * sempre abateu. É esta a conta que a tela usa na prévia e o servidor usa ao gravar — a mesma, no
 * mesmo lugar, porque prévia e gravação discordando num centavo é como o financeiro se parte.
 */
export function creditoParaAbater(opts: {
  /** Todo o crédito não consumido do paciente. */
  disponivel: number;
  /** A parte dele que está esperando um "Sim" (marcada na conversão GRAT→AVUL). */
  aConfirmar: number;
  /** A terapeuta respondeu "Sim" à pergunta deste lançamento? */
  usar: boolean;
}): number {
  const disponivel = Math.max(0, r2(opts.disponivel));
  const aConfirmar = Math.min(disponivel, Math.max(0, r2(opts.aConfirmar)));
  return opts.usar ? disponivel : r2(disponivel - aConfirmar);
}

/** A pergunta volta enquanto sobrar crédito marcado — e para quando ele acaba. */
export function perguntaOAbatimento(aConfirmar: number): boolean {
  return Number.isFinite(aConfirmar) && aConfirmar > TOL;
}

const emReais = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** A pergunta da conversão GRAT→AVUL, com o saldo que o cadastro tem agora. */
export function perguntaDaConversao(saldo: number): string {
  return `Este cadastro possui um crédito de ${emReais(saldo)}. Deseja utilizá-lo agora?`;
}

/** A pergunta de cada lançamento seguinte, com o saldo AINDA à espera de confirmação. */
export function perguntaDoLancamento(aConfirmar: number): string {
  return `Deseja abater o crédito de ${emReais(aConfirmar)} deste pagamento?`;
}

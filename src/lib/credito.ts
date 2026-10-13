/**
 * Crédito no saldo do paciente (doc 36).
 *
 * Quando o paciente paga a MAIS numa cobrança, a sobra pode virar CRÉDITO no saldo — e isso é uma
 * decisão do usuário a cada lançamento (nunca automática): "R$ X a mais entram como crédito no
 * saldo?". No PRÓXIMO pagamento, o crédito disponível é abatido automaticamente: cobre o que o
 * dinheiro recebido não cobrir, até fechar a cobrança.
 *
 * Esta é a regra pura (decide, não grava). Quem grava é `lancarPagamento`: o crédito aplicado entra
 * como um pagamento `kind="credito"` SEM transação (não é dinheiro novo no caixa — o dinheiro já
 * entrou quando houve a sobra), fechando a cobrança; o crédito novo vira uma linha em
 * `patient_credits`.
 */
const TOL = 0.005;
const r2 = (n: number) => Math.round(n * 100) / 100;

export function aplicarCreditoNoLancamento(opts: {
  /** O que a cobrança ainda deve. */
  falta: number;
  /** O dinheiro que a pessoa lançou agora. */
  cashRecebido: number;
  /** Saldo de crédito disponível do paciente (créditos ainda não consumidos). */
  creditoDisponivel: number;
  /** O usuário marcou "guardar a sobra como crédito no saldo"? */
  creditarExcedente: boolean;
}): { creditoAplicado: number; creditoNovo: number; fecha: boolean } {
  const falta = Math.max(0, opts.falta);
  const cash = Math.max(0, opts.cashRecebido);
  const disp = Math.max(0, opts.creditoDisponivel);

  // O crédito cobre SÓ o que o dinheiro não cobriu — nunca mais do que o disponível.
  const creditoAplicado = r2(Math.min(disp, Math.max(0, falta - cash)));
  // Sobra de dinheiro além do que a cobrança devia → vira crédito, se o usuário pediu.
  const excedenteCash = r2(Math.max(0, cash - falta));
  const creditoNovo = opts.creditarExcedente ? excedenteCash : 0;
  const fecha = cash + creditoAplicado + TOL >= falta;
  return { creditoAplicado, creditoNovo, fecha };
}

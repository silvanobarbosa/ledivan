/**
 * O CRÉDITO QUE ABRE A SESSÃO AVULSA JÁ PREENCHIDA (dono, 13/11/2026).
 *
 * O campo "Valor da sessão avulsa" já nascia preenchido com o preço do cadastro. Quando o paciente
 * tem crédito esperando, esse número é o errado: o dinheiro já está na mão do consultório, e o que
 * a terapeuta quer fazer é GASTÁ-LO. Ela precisava abrir a guia Geral, ler o saldo, voltar e
 * digitar — três telas para um número que o sistema já sabe.
 *
 * O que este arquivo decide é só a SUGESTÃO do campo. Ele não move dinheiro, não consome crédito e
 * não calcula saldo: quem consome é o motor de pagamentos (`aplicarCreditosPendentes`), e o saldo
 * chega aqui já descontado. É por isso que "se o crédito for 100 e ela digitar 50, a próxima
 * sessão aparece com 50" sai de graça — o saldo diminuiu lá, e aqui só se lê.
 *
 * Recalcular o saldo aqui criaria uma segunda verdade sobre o mesmo dinheiro. Este app já pagou
 * caro por isso.
 *
 * Função pura.
 */

/** O texto que fica embaixo da caixa do valor. Palavras do dono. */
export const AVISO_DO_CREDITO = "O paciente possui um crédito neste valor.";

/** Meio centavo: o mesmo corte que a guia Geral usa para decidir que uma sobra acabou. */
const TOLERANCIA = 0.005;

const dinheiro = (n: number) => Math.round(n * 100) / 100;

export function valorSugeridoDaAvulsa(o: {
  /** Saldo de crédito do paciente, já descontado do que foi usado. */
  credito?: number | string | null;
  /** O preço da sessão no cadastro — a sugestão de sempre, quando não há crédito. */
  precoDaSessao?: number | string | null;
}): { valor: number | null; porCredito: boolean } {
  const saldo = Number(o.credito);
  if (Number.isFinite(saldo) && saldo > TOLERANCIA) return { valor: dinheiro(saldo), porCredito: true };

  const preco = Number(o.precoDaSessao);
  // Sem crédito e sem preço, o campo fica vazio: zero seria um palpite, e palpite em campo de
  // dinheiro vira cobrança errada.
  if (o.precoDaSessao == null || !Number.isFinite(preco)) return { valor: null, porCredito: false };
  return { valor: dinheiro(preco), porCredito: false };
}

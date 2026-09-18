/**
 * O número no formato que o WhatsApp entende.
 *
 * Havia duas contas diferentes no app para a mesma coisa: o envio pelo servidor somava o `55` só
 * quando faltava, e o botão "Cobrar" da tela colava o `55` em qualquer coisa. Quem cadastrou o
 * telefone com o DDI recebia um número com dois `55` e o WhatsApp abria dizendo "número inválido" —
 * do lado de quem clica, isso é igual a "o botão não funciona" (documento de 18/09).
 *
 * Função pura, para as duas pontas usarem a mesma resposta.
 */

/** Celular brasileiro com DDD tem 11 dígitos; fixo com DDD, 10. */
const MIN_COM_DDD = 10;
/** 55 + DDD + 9 dígitos. Acima disso é número de outro país, e vai como veio. */
const MAX_NACIONAL = 13;

/**
 * `null` quando não dá para abrir uma conversa com o que foi cadastrado.
 *
 * Número sem DDD volta `null` de propósito: não há como adivinhar a cidade, e abrir a conversa de
 * um desconhecido é pior do que dizer que falta o telefone.
 */
export function numeroDoWhatsapp(telefone: string | null | undefined): string | null {
  const digitos = String(telefone ?? "").replace(/\D/g, "");
  if (!digitos) return null;

  // Já veio com o DDI do Brasil, ou é de fora: vai como está.
  if (digitos.length > MAX_NACIONAL) return digitos;
  if (digitos.startsWith("55") && digitos.length >= MIN_COM_DDD + 2) return digitos;

  if (digitos.length < MIN_COM_DDD) return null;
  return `55${digitos}`;
}

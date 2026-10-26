/**
 * O CAMPO DE DINHEIRO SE ESCREVE SOZINHO: digitou 20000, aparece R$ 200,00.
 *
 * O campo aceitava texto livre com um `placeholder` de "200,00", e `parseMoedaBR` depois adivinhava
 * o que a pessoa quis dizer. Funciona, mas joga a dúvida para quem digita: "200" é duzentos reais
 * ou dois reais? "1.500" é mil e quinhentos ou um e cinquenta? O parser decide isso por regra, e a
 * regra é invisível para quem está olhando a tela no meio do dia.
 *
 * Com a máscara não há o que adivinhar. Os dígitos entram pela direita, como numa maquininha: cada
 * tecla empurra o valor, e os centavos são sempre os dois últimos. O que se vê é o que vai ser
 * gravado — e o dono pediu exatamente isso, "permitir a digitação no formato moeda R$ 0,00".
 *
 * Funções puras.
 */

/** Só os dígitos, limitados ao que cabe em `numeric(10,2)` — 99.999.999,99. */
const digitos = (texto: string): string => texto.replace(/\D/g, "").replace(/^0+(?=\d)/, "").slice(0, 10);

/**
 * O texto que o campo deve mostrar depois desta tecla.
 *
 * Vazio continua vazio: um campo que insiste em "R$ 0,00" quando a pessoa apagou tudo parece
 * preenchido, e ela salva o zero sem querer.
 */
export function mascaraMoeda(texto: string): string {
  const d = digitos(texto);
  if (!d) return "";
  const centavos = d.padStart(3, "0");
  const reais = centavos.slice(0, -2);
  const cents = centavos.slice(-2);
  return `R$ ${Number(reais).toLocaleString("pt-BR")},${cents}`;
}

/** O número por trás do que está escrito. `0` quando não há dígito nenhum. */
export function valorDaMascara(texto: string): number {
  const d = digitos(texto);
  return d ? Number(d) / 100 : 0;
}

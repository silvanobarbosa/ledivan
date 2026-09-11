/**
 * Idade a partir da data de nascimento.
 *
 * Existe porque o dono trocou a "classificação" (criança, adolescente, adulto, idoso) pela IDADE:
 * o relatório já filtra por data de nascimento, e classificação é um rótulo que envelhece sozinho
 * — a criança cadastrada em 2019 continua "criança" no sistema até alguém lembrar de editar.
 *
 * A conta é por data de calendário, não por divisão de milissegundos: quem faz aniversário hoje
 * já tem a idade nova, e ano bissexto não tira um dia de ninguém.
 */
export function idadeEmAnos(nascimento: Date | string | null | undefined, hoje: Date = new Date()): number | null {
  if (!nascimento) return null;
  const d = nascimento instanceof Date ? nascimento : new Date(nascimento);
  if (Number.isNaN(d.getTime())) return null;

  let anos = hoje.getFullYear() - d.getFullYear();
  const passouOAniversario =
    hoje.getMonth() > d.getMonth() || (hoje.getMonth() === d.getMonth() && hoje.getDate() >= d.getDate());
  if (!passouOAniversario) anos -= 1;

  return anos >= 0 && anos < 130 ? anos : null;
}

/**
 * Como a idade aparece na tela.
 *
 * Bebê em meses, porque "0 anos" não diz nada a quem atende criança pequena. Sem data de
 * nascimento não se inventa faixa: devolve vazio, e a tela mostra o campo em branco em vez de
 * fingir um número.
 */
export function idadeEmPalavras(nascimento: Date | string | null | undefined, hoje: Date = new Date()): string {
  const anos = idadeEmAnos(nascimento, hoje);
  if (anos === null) return "";
  if (anos > 0) return `${anos} ${anos === 1 ? "ano" : "anos"}`;

  const d = nascimento instanceof Date ? nascimento : new Date(nascimento as string);
  const meses = Math.max(
    0,
    (hoje.getFullYear() - d.getFullYear()) * 12 + (hoje.getMonth() - d.getMonth()) - (hoje.getDate() < d.getDate() ? 1 : 0),
  );
  return `${meses} ${meses === 1 ? "mês" : "meses"}`;
}

/**
 * A HORA MARCADA NÃO PODE ANDAR NO CAMINHO ATÉ A TELA.
 *
 * Uma beta tester agendou às 6h e a agenda mostrou 3h. O defeito é de fuso, e ele **só aparece em
 * produção** — é por isso que passou por todas as conferências: a minha máquina fica no mesmo fuso
 * dela, e ali tudo batia.
 *
 * O caminho do erro, medido:
 *
 * 1. A coluna é `timestamp` **sem fuso**. Ela guarda hora de PAREDE: "18:00" quer dizer 18:00 para
 *    quem marcou, e ponto. Não existe fuso escrito ali.
 * 2. O driver do Postgres, ao ler, precisa inventar um fuso para montar o objeto de data — e usa o
 *    do processo. Na Vercel o processo roda em **UTC**, então "18:00" vira 18:00Z.
 * 3. Esse objeto atravessa para o navegador, que está em **UTC−3**, e desenha 15:00.
 *
 * Provado na produção com a conta de demonstração: o banco tinha 12:00, 13:00 e 18:00; a tela
 * desenhou 09:00, 10:00 e 15:00. Três horas a menos em TODAS as sessões.
 *
 * A correção é fazer a hora de parede atravessar como hora de parede.
 *
 * **Onde a hora de parede mora dentro do objeto Date — medido, porque eu tinha errado isto.** O
 * Drizzle com `neon-http` lê "12:00" e monta a data como **12:00Z**: a hora de parede fica nos
 * campos UTC, e `getHours()` já devolve o valor DESLOCADO. (O tag `sql` cru do mesmo pacote faz o
 * contrário — monta como hora local. Dois caminhos, duas convenções, e é por isso que medir foi
 * necessário.)
 *
 * Então lemos os campos **UTC** e escrevemos um texto SEM fuso. O navegador lê um texto sem fuso
 * como hora local, e o valor chega inteiro. De quebra, a resposta passa a ser a mesma em qualquer
 * fuso de servidor — o que fazia o defeito existir só em produção.
 */

const dois = (n: number) => String(n).padStart(2, "0");

/**
 * A data como texto de hora de parede: `2026-09-13T18:00:00`, sem `Z` e sem deslocamento.
 *
 * Um texto assim é lido pelo `new Date()` do navegador como hora LOCAL — que é exatamente o que se
 * quer. Pôr o `Z` no fim seria dizer "isto é UTC", e é a mentira que move o horário.
 */
export function horaDeParede(d: Date | string | null | undefined): string {
  if (!d) return "";

  // Texto SEM fuso já É hora de parede — passá-lo por `new Date()` e reler o desloca. Devolve-se
  // como está, só aparando o que sobra depois dos segundos.
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(d) && !/[Zz]|[+-]\d{2}:?\d{2}$/.test(d)) {
    const [dia, hora] = d.replace(" ", "T").split("T");
    const [h, m, seg = "00"] = hora.split(":");
    return `${dia}T${h}:${m}:${seg.slice(0, 2)}`;
  }

  const data = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(data.getTime())) return "";
  return (
    `${data.getUTCFullYear()}-${dois(data.getUTCMonth() + 1)}-${dois(data.getUTCDate())}` +
    `T${dois(data.getUTCHours())}:${dois(data.getUTCMinutes())}:${dois(data.getUTCSeconds())}`
  );
}

/** O mesmo, aceitando nulo e devolvendo nulo — para os campos opcionais. */
export function horaDeParedeOuNulo(d: Date | string | null | undefined): string | null {
  const t = horaDeParede(d);
  return t || null;
}

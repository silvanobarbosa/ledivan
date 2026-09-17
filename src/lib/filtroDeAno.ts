/**
 * O FILTRO DE ANO, compartilhado pelas duas tabelas do paciente.
 *
 * O documento de 17/09 pede um seletor **único**, antes da tabela de Controle, valendo ao mesmo
 * tempo para ela e para a de Pagamentos. Antes havia um seletor só dentro da tabela anual: dava
 * para estar lendo as sessões de 2026 com os pagamentos de 2025 na tela, e nada avisava.
 *
 * O ano sai do TEXTO da data, sem passar por `Date`. Este app já viu data andar um dia por causa
 * de fuso (ver `horaLocal.ts` e `formatDate`), e num filtro isso faria a sessão de 1º de janeiro
 * sumir do ano em que aconteceu.
 */

const ANO = /^(\d{4})/;

/** O ano de uma data de parede ("2026-09-01T09:00:00") ou de um `Date`. */
export function anoDe(valor: string | Date | null | undefined): number | null {
  if (!valor) return null;
  if (valor instanceof Date) return Number.isNaN(valor.getTime()) ? null : valor.getFullYear();
  const casa = ANO.exec(String(valor));
  return casa ? Number(casa[1]) : null;
}

/** Os anos que têm alguma coisa, do mais recente para o mais antigo. */
export function anosDisponiveis(datas: (string | Date | null | undefined)[], agora = new Date()): number[] {
  const anos = new Set<number>();
  for (const d of datas) {
    const a = anoDe(d);
    if (a) anos.add(a);
  }
  // O ano corrente sempre aparece: quem abre em janeiro, antes da primeira sessão, precisa poder
  // escolher o ano em que está — senão o seletor mostra só o passado.
  anos.add(agora.getFullYear());
  return [...anos].sort((a, b) => b - a);
}

/** Fica só o que é daquele ano. `null` no ano = não filtra. */
export function doAno<T>(itens: T[], ano: number | null, dataDe: (i: T) => string | Date | null | undefined): T[] {
  if (ano == null) return itens;
  return itens.filter((i) => anoDe(dataDe(i)) === ano);
}

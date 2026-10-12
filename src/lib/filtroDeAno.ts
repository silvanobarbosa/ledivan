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

type LinhaComAno = {
  tipo: string;
  data?: string | Date | null;
  vencimento?: string | Date | null;
  pagamento?: { data: string | Date } | null;
};

/**
 * A data que define EM QUE ANO a linha aparece na tabela de **Controle** (doc 32).
 *
 * - **Sessão / bloqueio:** o próprio dia dela.
 * - **Cabeçalho de pagamento (pacote/quinzena):** o **VENCIMENTO** — NÃO o dia em que foi pago.
 *
 * Isto é o que o dono pediu para o pacote que cruza o ano: o cabeçalho aparece junto das sessões do
 * ano em que o pacote começou (ex.: vence 10/12/2024 → o pacote e a sessão 23/12/2024 ficam em 2024),
 * e as sessões do ano seguinte caem no ano seguinte (04/01, 08/01, 15/01 → 2025). Antes o cabeçalho
 * seguia a data do pagamento (10/01/2025) e descolava da sessão 23/12, que sobrava solta em 2024.
 *
 * O VALOR pago continua contado no ano do pagamento (tabela de Valores Recebidos), que usa a data do
 * pagamento, não esta função.
 */
export function dataDoAnoControle(l: LinhaComAno): string | Date | null {
  if (l.tipo === "sessao" || l.tipo === "bloqueio") return l.data ?? null;
  return l.vencimento ?? l.pagamento?.data ?? null;
}

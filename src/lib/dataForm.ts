/**
 * Datas vindas de <input type="date"> (formato "YYYY-MM-DD").
 *
 * Duas armadilhas que isto existe para evitar:
 *
 * 1. Campo VAZIO. `new Date("")` é Invalid Date, e gravar isso numa coluna timestamp acaba em
 *    erro ou, pior, em 1970 dependendo de quem converte. Vazio tem que virar null.
 *
 * 2. Fuso. `new Date("2026-09-09")` é interpretado como MEIA-NOITE UTC. Quem está em
 *    UTC-3 lê essa data como 08/09 às 21h — a data escolhida aparece um dia antes na tela.
 *    Ancorar ao MEIO-DIA local dá 12h de folga para cada lado, o que cobre todos os fusos
 *    do Brasil e não erra o dia.
 */
export function dataDeFormulario(raw: unknown): Date | null {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v) return null;
  const d = new Date(`${v}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Valor de banco ("180.00") para um campo pt-BR ("180,00"). Vazio continua vazio. */
export function valorParaCampoBR(v: string | null | undefined): string {
  if (v === null || v === undefined || v === "") return "";
  return String(v).replace(".", ",");
}

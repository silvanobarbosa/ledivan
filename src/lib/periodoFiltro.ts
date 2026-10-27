/**
 * O RECORTE POR PERÍODO DA TELA DE TRANSAÇÕES (doc 64).
 *
 * A tela mostrava tudo o que existe, desde sempre, e a dona pediu um filtro no alto da página —
 * com **mês atual** ligado ao entrar, "para sempre visualizar o conteúdo do mês e realizar outro
 * filtro caso deseje".
 *
 * Duas decisões moram aqui:
 *
 * 1. **O recorte é de CALENDÁRIO, não "últimos N dias".** "6 meses" vai do primeiro dia do mês de
 *    seis meses atrás ao ÚLTIMO dia do mês corrente. Despesa que vence dia 30 não pode sumir do
 *    filtro só porque hoje é dia 3 — ela é deste mês, e o que a tela conta é o mês.
 * 2. **Compara texto, não `Date`.** As datas aqui são `YYYY-MM-DD` de hora de parede; convertê-las
 *    para `Date` traria o fuso de volta e, em fuso negativo, jogaria a meia-noite para o dia
 *    anterior — o defeito que já custou um dia inteiro ([[licao-meia-noite-vira-dia-anterior]]).
 *
 * Funções puras.
 */

export type Periodo = "mes" | "6m" | "12m" | "tudo" | "custom";

/** O que vale ao abrir a tela: o mês corrente (pedido da dona). */
export const PERIODO_PADRAO: Periodo = "mes";

export const PERIODOS: { k: Periodo; rotulo: string }[] = [
  { k: "mes", rotulo: "Mês atual" },
  { k: "6m", rotulo: "6 meses" },
  { k: "12m", rotulo: "12 meses" },
  { k: "tudo", rotulo: "Tudo" },
];

export type Intervalo = { de: string | null; ate: string | null };

const dois = (n: number) => String(n).padStart(2, "0");
const diaISO = (d: Date) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
const primeiroDoMes = (d: Date) => diaISO(new Date(d.getFullYear(), d.getMonth(), 1));
const ultimoDoMes = (d: Date) => diaISO(new Date(d.getFullYear(), d.getMonth() + 1, 0));

/** Lê o que veio da URL; qualquer coisa fora da lista vira o padrão. */
export function periodoDaUrl(valor: string | null | undefined): Periodo {
  const p = String(valor ?? "");
  return p === "6m" || p === "12m" || p === "tudo" || p === "custom" || p === "mes" ? p : PERIODO_PADRAO;
}

/** O intervalo (YYYY-MM-DD, pontas inclusivas) de cada recorte. `null` = sem limite daquele lado. */
export function intervaloDoPeriodo(periodo: Periodo, hoje: Date, de?: string | null, ate?: string | null): Intervalo {
  if (periodo === "tudo") return { de: null, ate: null };
  if (periodo === "custom") {
    const limpa = (v: string | null | undefined) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? "")) ? String(v) : null);
    return { de: limpa(de), ate: limpa(ate) };
  }
  const meses = periodo === "6m" ? 5 : periodo === "12m" ? 11 : 0; // o mês corrente conta como um
  return {
    de: primeiroDoMes(new Date(hoje.getFullYear(), hoje.getMonth() - meses, 1)),
    ate: ultimoDoMes(hoje),
  };
}

/** A data cai no intervalo? Sem data, não cai (não dá para afirmar nada sobre ela). */
export function dentroDoIntervalo(data: string | null | undefined, i: Intervalo): boolean {
  const d = String(data ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  if (i.de && d < i.de) return false;
  if (i.ate && d > i.ate) return false;
  return true;
}

/** Texto curto do recorte, para o título dos totais ("Mês atual", "01/05/2026 → 31/10/2026"…). */
export function rotuloDoIntervalo(periodo: Periodo, i: Intervalo): string {
  if (periodo === "tudo") return "Tudo";
  const br = (d: string | null) => (d ? d.split("-").reverse().join("/") : "—");
  if (periodo === "custom") return `${br(i.de)} → ${br(i.ate)}`;
  return PERIODOS.find((p) => p.k === periodo)?.rotulo ?? "";
}

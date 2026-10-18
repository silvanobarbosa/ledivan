/**
 * "Formato de pagamento" do Relatório de pacientes (doc 50) — puro.
 *
 * Seis categorias: Gratuito, Avulso, Mensal Completo, Mensal Fracionado, Quinzenal Completo,
 * Quinzenal Fracionado. O `paymentFormat` guarda a FREQUÊNCIA/timing (mensal | primeira_pacote |
 * ultima_pacote | quinzenal | sessao | gratuito) e o `pacoteTipo` o completo/fragmentado. Como a 1ª/
 * última sessão do pacote só existem no pacote MENSAL (ver PatientFormFields), elas contam como Mensal.
 */

import { formatBRL } from "./therapy";

export type CategoriaFormato =
  | "gratuito" | "avulso"
  | "mensal_completo" | "mensal_fracionado"
  | "quinzenal_completo" | "quinzenal_fracionado"
  | "outro";

const EH_MENSAL = new Set(["mensal", "pacote", "primeira_pacote", "ultima_pacote"]);

export function categoriaFormato(paymentFormat: string | null | undefined, pacoteTipo: string | null | undefined): { label: string; categoria: CategoriaFormato } {
  const f = paymentFormat || "";
  if (f === "gratuito") return { label: "Gratuito", categoria: "gratuito" };
  if (f === "sessao" || f === "avulso") return { label: "Avulso", categoria: "avulso" };
  const freq = EH_MENSAL.has(f) ? "Mensal" : f === "quinzenal" ? "Quinzenal" : null;
  if (!freq) return { label: "—", categoria: "outro" };
  const fracionado = pacoteTipo === "fragmentado";
  const tipo = fracionado ? "Fracionado" : "Completo";
  const chaveFreq = freq === "Mensal" ? "mensal" : "quinzenal";
  const chaveTipo = fracionado ? "fracionado" : "completo";
  return { label: `${freq} ${tipo}`, categoria: `${chaveFreq}_${chaveTipo}` as CategoriaFormato };
}

/** Vencimento legível do relatório: dia do mês, ou a 1ª/última sessão do pacote (doc 50). */
export function vencimentoRelatorio(paymentFormat: string | null | undefined, paymentDay: number | null | undefined): string {
  if (paymentFormat === "primeira_pacote") return "Primeira sessão do pacote";
  if (paymentFormat === "ultima_pacote") return "Última sessão do pacote";
  if (paymentDay != null) return `dia ${paymentDay}`;
  return "—";
}

/**
 * Valor do relatório conforme a categoria (doc 50):
 * - Gratuito: "-"; Avulso: R$ da sessão.
 * - Completo (mensal/quinzenal): nº de sessões do pacote × valor da sessão.
 * - Fracionado: o valor de cada sessão.
 */
export function valorRelatorio(categoria: CategoriaFormato, sessionFee: number, sessionsInPacket: number | null | undefined): string {
  if (categoria === "gratuito") return "-";
  if (categoria === "mensal_completo" || categoria === "quinzenal_completo") {
    const n = Number(sessionsInPacket) || 0;
    if (n > 0) return `${formatBRL(n * sessionFee)} (${n} × ${formatBRL(sessionFee)})`;
    return formatBRL(sessionFee);
  }
  if (categoria === "mensal_fracionado" || categoria === "quinzenal_fracionado") {
    return `${formatBRL(sessionFee)} por sessão`;
  }
  // Avulso e demais: o valor da sessão.
  return formatBRL(sessionFee);
}

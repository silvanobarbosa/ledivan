/**
 * Rótulos da LISTA de pacientes (dono, 16/09/2026): financeiro, frequência e situação.
 *
 * Tudo função pura — decide o texto, não busca nada. A lista pede, por paciente: o financeiro por
 * extenso (com pacote/fragmentado onde faz sentido), a frequência (dia e hora quando se repete) e a
 * situação de pagamento (em dia / em aberto / atrasado).
 */

import { rotuloDoFormato } from "./reajuste";

/**
 * O financeiro por extenso. Mensal e quinzenal ganham " pacote" ou " fragmentado" (é o que distingue
 * como a sequência é contada); os demais já se explicam sozinhos.
 */
export function rotuloFinanceiro(formato: string | null | undefined, pacoteTipo: string | null | undefined): string {
  const base = rotuloDoFormato(formato);
  const f = formato === "avulso" ? "sessao" : formato === "pacote" ? "mensal" : formato;
  if (f === "mensal" || f === "quinzenal") {
    return `${base} ${pacoteTipo === "fragmentado" ? "fragmentado" : "pacote"}`;
  }
  return base;
}

const DIA_BONITO: Record<string, string> = {
  domingo: "Domingo", segunda: "Segunda", terca: "Terça", "terça": "Terça", quarta: "Quarta",
  quinta: "Quinta", sexta: "Sexta", sabado: "Sábado", "sábado": "Sábado",
};
function diaBonito(dia: string | null | undefined): string {
  const d = (dia ?? "").toLowerCase();
  return DIA_BONITO[d] ?? (d ? d.charAt(0).toUpperCase() + d.slice(1) : "");
}

/** Frequências que NÃO se repetem — a lista mostra "Sem recorrência". */
const SEM_RECORRENCIA = new Set(["", "nao_repetir", "pontual", "none", "avulso", "unica", "única"]);

/**
 * A frequência como a lista mostra:
 * - não repetir → "Sem recorrência"
 * - semanal → dia e hora ("Segunda 09:00")
 * - quinzenal → "Quinzenal · " dia e hora
 * - mensal → "Mensal"
 */
export function rotuloFrequencia(frequency: string | null | undefined, dia?: string | null, hora?: string | null): string {
  const f = (frequency ?? "").toLowerCase();
  if (SEM_RECORRENCIA.has(f) || !f) return "Sem recorrência";
  if (f === "mensal") return "Mensal";
  const quando = [diaBonito(dia), hora ?? ""].filter(Boolean).join(" ").trim();
  if (f === "quinzenal") return quando ? `Quinzenal · ${quando}` : "Quinzenal";
  if (f === "semanal") return quando || "Semanal";
  // Frequência desconhecida: mostra o que der, sem inventar.
  return quando || (frequency ?? "Sem recorrência");
}

export type SituacaoDaLista = "em_dia" | "em_aberto" | "atrasado";

/** Atrasado manda sobre em aberto; sem nenhum pendente, em dia. */
export function situacaoDaLista(nAberto: number, nAtraso: number): SituacaoDaLista {
  if (nAtraso > 0) return "atrasado";
  if (nAberto > 0) return "em_aberto";
  return "em_dia";
}

export const ROTULO_SITUACAO_LISTA: Record<SituacaoDaLista, string> = {
  em_dia: "Em dia", em_aberto: "Em aberto", atrasado: "Atrasado",
};

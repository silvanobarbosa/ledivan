// Doc 41: um cadastro é um PACIENTE (padrão) ou um SUPERVISIONADO. A normalização fica aqui,
// numa função pura, para a regra ser testável e idêntica no create e no update do paciente.
export type CadastroKind = "paciente" | "supervisionado";

/** Qualquer entrada que não seja exatamente "supervisionado" cai em "paciente" (fail-safe). */
export function normalizeCadastroKind(v: unknown): CadastroKind {
  return v === "supervisionado" ? "supervisionado" : "paciente";
}

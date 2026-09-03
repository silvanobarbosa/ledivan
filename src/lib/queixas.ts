// Queixa/demanda principal — lista curada (editável). O paciente recebe UMA queixa;
// se não estiver na lista, o terapeuta usa "Outro" e o valor é gravado como texto livre.
// O filtro do dashboard agrupa por esta lista (valores fora dela caem em "Outro").

export const QUEIXAS = [
  "Depressão",
  "Ansiedade",
  "Transtorno de Pânico",
  "Borderline (TPB)",
  "Bipolaridade",
  "TDAH",
  "TOC",
  "Luto",
  "Estresse / Burnout",
  "Relacionamento / Casal",
  "Autoestima",
  "Trauma / TEPT",
  "Fobia",
  "Transtorno Alimentar",
  "Dependência / Uso de substâncias",
  "Sono",
] as const;

export type Queixa = (typeof QUEIXAS)[number];

const SET = new Set<string>(QUEIXAS);

// Normaliza um valor gravado para um rótulo de grupo do dashboard.
export function queixaGroup(value: string | null | undefined): string {
  const v = (value || "").trim();
  if (!v) return "—";
  return SET.has(v) ? v : "Outro";
}

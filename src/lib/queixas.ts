// Queixa/demanda principal — lista curada (editável). O paciente recebe UMA queixa;
// se não estiver na lista, o terapeuta usa "Outro" e o valor é gravado como texto livre.
// O filtro do dashboard agrupa por esta lista (valores fora dela caem em "Outro").

/**
 * Doc 68: em ORDEM ALFABÉTICA. A lista cresceu item a item, na ordem em que cada um foi
 * pedido, e procurar "Sono" no meio de vinte linhas sem ordem é procurar duas vezes.
 *
 * A ordenação ignora acento de propósito: por código, "Dependência" cairia depois de
 * "Transtorno", que não é onde ninguém procura.
 */
export const QUEIXAS = [
  "Ansiedade",
  "Autoconhecimento",
  "Autoestima",
  "Bipolaridade",
  "Borderline (TPB)",
  "Dependência / Uso de substâncias",
  "Depressão",
  "Estresse / Burnout",
  "Fobia",
  "Luto",
  "Relacionamento / Casal",
  "Sono",
  "TDAH",
  "TOC",
  "Transtorno Alimentar",
  "Transtorno de Pânico",
  "Trauma / TEPT",
] as const;

export type Queixa = (typeof QUEIXAS)[number];

const SET = new Set<string>(QUEIXAS);

// Normaliza um valor gravado para um rótulo de grupo do dashboard.
export function queixaGroup(value: string | null | undefined): string {
  const v = (value || "").trim();
  if (!v) return "—";
  return SET.has(v) ? v : "Outro";
}

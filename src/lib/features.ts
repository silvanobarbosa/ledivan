// Feature-flags dos recursos do paciente. O terapeuta escolhe, em Configurações, o MODO de cada
// recurso: "off" (ninguém), "all" (todos os pacientes) ou "per-patient" (decide por paciente — aí
// o liga/desliga fica no perfil de cada paciente). resolveFeature junta os dois.
export type FeatureKey =
  | "timer" | "waitingRoom" | "moodCheckin" | "scales" | "diary"
  | "goalsVisible" | "rescheduleApp" | "payment" | "rating" | "consent"
  | "statusDia" | "escritaTerapeutica";

export type FeatureMode = "off" | "all" | "per-patient";

export const FEATURES: { key: FeatureKey; label: string; desc: string }[] = [
  { key: "timer", label: "Cronômetro da sessão", desc: "Marca o tempo da consulta (pode mostrar ao paciente)." },
  { key: "waitingRoom", label: "Sala de espera", desc: "O paciente avisa que chegou; você recebe um aviso." },
  { key: "moodCheckin", label: "Check-in de humor", desc: "Humor do paciente antes e depois da sessão." },
  { key: "scales", label: "Escalas / questionários", desc: "Enviar PHQ-9, GAD-7 etc. pro paciente responder." },
  { key: "diary", label: "Diário entre sessões", desc: "O paciente escreve; você lê antes da próxima." },
  { key: "goalsVisible", label: "Metas visíveis", desc: "O paciente vê as metas terapêuticas e o progresso." },
  { key: "rescheduleApp", label: "Reagendar pelo app", desc: "O paciente pode pedir remarcação pelo app." },
  { key: "payment", label: "Pagamento no app", desc: "Pix + recibo automático." },
  { key: "rating", label: "Avaliação pós-sessão", desc: "Feedback rápido do paciente após a sessão." },
  { key: "consent", label: "Consentimento digital", desc: "Assinatura de consentimento no app." },
  { key: "statusDia", label: "Status do dia", desc: "O paciente registra como está chegando (emoji + texto); você é avisado e pode reagir." },
  { key: "escritaTerapeutica", label: "Escrita terapêutica", desc: "Propostas de escrita guiada (stories) no app; o paciente decide se compartilha com você." },
];

export type FeatureModes = Partial<Record<FeatureKey, FeatureMode>>;
export type FeatureOverrides = Partial<Record<FeatureKey, boolean>>;

/** O recurso está ligado para ESTE paciente? (modo global do terapeuta + override do paciente). */
export function resolveFeature(mode: FeatureMode | undefined, patientOverride: boolean | undefined): boolean {
  if (mode === "all") return true;
  if (mode === "per-patient") return patientOverride === true;
  return false; // "off" ou não configurado
}

export function parseOverrides(json: string | null | undefined): FeatureOverrides {
  if (!json) return {};
  try { const o = JSON.parse(json); return o && typeof o === "object" ? o : {}; } catch { return {}; }
}

/** Resolve TODOS os recursos pra um paciente (pro app saber o que mostrar). */
export function resolveAll(modes: FeatureModes | undefined, overrides: FeatureOverrides): Record<FeatureKey, boolean> {
  const out = {} as Record<FeatureKey, boolean>;
  for (const f of FEATURES) out[f.key] = resolveFeature(modes?.[f.key], overrides[f.key]);
  return out;
}

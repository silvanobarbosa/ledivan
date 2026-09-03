import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

// Direção da 1ª sincronização com o Google:
// pull = Google atualiza o Ledivan; push = Ledivan é principal e sobrepõe o Google; both = sincroniza ambos igualmente.
export type GoogleSyncMode = "pull" | "push" | "both";

export type Integrations = {
  googleCalendar?: boolean;
  gmail?: boolean;
  whatsapp?: boolean;
  whatsappNumber?: string;
  googleSyncMode?: GoogleSyncMode;
  // id do calendário DEDICADO "Pacientes" no Google (criado pelo Ledivan). As sessões vão só pra
  // ele — a agenda pessoal da terapeuta nunca é lida nem misturada.
  googleCalendarId?: string;
};

export type UserPreferences = {
  transcriptionEnabled?: boolean; // habilita transcrição de sessão por IA (opt-in do terapeuta)
  meetingProvider?: "jitsi" | "meet"; // provedor de vídeo para sessões online
  bookingAutoConfirm?: boolean; // agendamento público entra automático (true) ou requer confirmação (false)
  integrations?: Integrations;
  features?: Record<string, "off" | "all" | "per-patient">; // modo de cada recurso do paciente (ver lib/features)
  timerShowToPatient?: boolean; // mostrar o cronômetro da sessão ao paciente
  pix?: { key: string; name: string; city: string }; // chave Pix estática (pagamento no app do paciente)
  [key: string]: unknown;
};

export async function getPreferences(userId: string): Promise<UserPreferences> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user?.preferences) return {};
  try {
    return JSON.parse(user.preferences) as UserPreferences;
  } catch {
    return {};
  }
}

export async function setPreferences(userId: string, patch: UserPreferences) {
  const current = await getPreferences(userId);
  const merged = { ...current, ...patch };
  await db.update(users).set({ preferences: JSON.stringify(merged) }).where(eq(users.id, userId));
  return merged;
}

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export type Integrations = {
  googleCalendar?: boolean;
  gmail?: boolean;
  whatsapp?: boolean;
  whatsappNumber?: string;
};

export type UserPreferences = {
  autoLinkPayments?: boolean; // lançar pagamento de sessão como receita no financeiro automaticamente
  transcriptionEnabled?: boolean; // habilita transcrição de sessão por IA (opt-in do terapeuta)
  meetingProvider?: "jitsi" | "meet"; // provedor de vídeo para sessões online
  bookingAutoConfirm?: boolean; // agendamento público entra automático (true) ou requer confirmação (false)
  integrations?: Integrations;
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

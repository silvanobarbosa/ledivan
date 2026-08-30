// Token assinado (HMAC) pra o paciente confirmar/remarcar SEM login, direto do link do lembrete.
// Curto o bastante pra caber num SMS; seguro (HMAC-SHA256 truncado em 128 bits).
import { createHmac, timingSafeEqual } from "node:crypto";

export type ConfirmAction = "confirm" | "reschedule";

const secret = () => process.env.CONFIRM_SECRET || process.env.AUTH0_SECRET || process.env.CRON_SECRET || "ledivan-confirm-fallback";

export function signSession(sessionId: string, action: ConfirmAction): string {
  return createHmac("sha256", secret()).update(`${sessionId}:${action}`).digest("hex").slice(0, 32);
}

export function verifySession(sessionId: string, action: ConfirmAction, token: string): boolean {
  const expected = signSession(sessionId, action);
  if (!token || token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}

// Token assinado (HMAC) pra o paciente confirmar/remarcar SEM login, direto do link do lembrete.
// Curto o bastante pra caber num SMS; seguro (HMAC-SHA256 truncado em 128 bits).
import { createHmac, timingSafeEqual } from "node:crypto";
import { segredoObrigatorio } from "@/lib/secret";

export type ConfirmAction = "confirm" | "reschedule";

// Sem literal de fallback: segredo ausente FALHA (ver src/lib/secret.ts).
const secret = () => segredoObrigatorio("CONFIRM_SECRET", "AUTH0_SECRET", "CRON_SECRET");

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

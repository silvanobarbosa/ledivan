// Token assinado (HMAC) pra o paciente confirmar/remarcar SEM login, direto do link do lembrete.
// Curto o bastante pra caber num SMS; seguro (HMAC-SHA256 truncado em 128 bits).
import { createHmac, timingSafeEqual } from "node:crypto";
import { segredoObrigatorio } from "@/lib/secret";

export type ConfirmAction = "confirm" | "reschedule";

// Sem literal de fallback: segredo ausente FALHA (ver src/lib/secret.ts).
const secret = () => segredoObrigatorio("CONFIRM_SECRET", "AUTH0_SECRET", "CRON_SECRET");

// Validade padrão do link de confirmação/remarcação (dias). O link vem no lembrete da sessão;
// não faz sentido valer para sempre — um print encaminhado no WhatsApp confirmaria/remarcaria
// aquela sessão indefinidamente. O `exp` (dia epoch) entra no material assinado e no token.
const VALIDADE_DIAS = 14;
const diaEpoch = () => Math.floor(Date.now() / 86400000);

export function signSession(sessionId: string, action: ConfirmAction, expDay?: number): string {
  const exp = expDay ?? diaEpoch() + VALIDADE_DIAS;
  const sig = createHmac("sha256", secret()).update(`${sessionId}:${action}:${exp}`).digest("hex").slice(0, 32);
  return `${exp}.${sig}`;
}

export function verifySession(sessionId: string, action: ConfirmAction, token: string): boolean {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 0) return false; // formato antigo (sem exp) não é mais aceito
  const exp = Number(token.slice(0, dot));
  if (!Number.isFinite(exp) || exp < diaEpoch()) return false; // expirado
  const expected = signSession(sessionId, action, exp);
  if (token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(token));
  } catch {
    return false;
  }
}

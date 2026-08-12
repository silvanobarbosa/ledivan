import { lerSessao } from "./session-secret";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Auth por TOKEN BEARER para o app nativo.
 *
 * O navegador manda o cookie `auth-session`; o app nativo não tem cookie jar, então manda o
 * MESMO token no header `Authorization: Bearer <token>`. Os dois usam a mesma assinatura
 * (session-secret.ts), então o token do app é validado do mesmo jeito. Deny-by-default:
 * sem header / token inválido / usuário sumido → null.
 */
export async function userFromBearer(req: Request) {
  const h = req.headers.get("authorization") || "";
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;

  const userId = await lerSessao(m[1]);
  if (!userId) return null;

  const [u] = await db
    .select({ id: users.id, email: users.email, name: users.name, role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return u ?? null;
}

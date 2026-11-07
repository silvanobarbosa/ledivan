import { cookies } from "next/headers";
import { lerSessaoInfo, type ViaDaSessao } from "./session-secret";

/**
 * Por onde a pessoa entrou NESTA sessão (doc 19) — `null` quando não dá para afirmar.
 *
 * Lê o mesmo cookie `auth-session` que o resto do app, sem abrir um segundo caminho de
 * autenticação. Sessão antiga (assinada antes do claim existir) devolve `null`, e quem não sabe
 * não afrouxa regra nenhuma: o pedido de senha atual continua de pé.
 */
export async function comoEntrou(): Promise<ViaDaSessao | null> {
  const token = (await cookies()).get("auth-session");
  if (!token) return null;
  const info = await lerSessaoInfo(token.value);
  return info?.via ?? null;
}

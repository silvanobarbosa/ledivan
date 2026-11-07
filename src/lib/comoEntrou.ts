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

/**
 * A senha atual é exigida para trocar a senha?
 *
 * Só quando as DUAS coisas são verdade: já existe uma senha, e foi ela que abriu esta sessão.
 * Quem entrou pelo Google ou pelo código do e-mail já provou quem é por um caminho que não passa
 * pela senha — pedir a antiga ali não protege o cadastro, só impede de consertá-lo.
 */
export function pedeSenhaAtual(temSenha: boolean, via: ViaDaSessao | null): boolean {
  return temSenha && via !== "google" && via !== "codigo";
}

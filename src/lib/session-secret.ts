import * as jose from "jose";

/**
 * Chave que assina e verifica o cookie de sessão (`auth-session`).
 *
 * Uma fonte só para o segredo. Antes cada arquivo que mexia no cookie tinha o seu próprio
 * fallback quando `AUTH0_SECRET` faltava — `"default-secret-change-in-production"`,
 * `"ledivan-secret-2024"`, e até `crypto.randomBytes(32)`. Dois problemas nisso:
 *
 *  - os fallbacks fixos são segredos públicos (estão no repo), então quem assinasse com eles
 *    forjaria uma sessão válida caso o app subisse sem `AUTH0_SECRET`;
 *  - os fallbacks eram DIFERENTES entre os arquivos, então sem a env um lado assinava com uma
 *    chave e o outro verificava com outra — login "funcionando" que não persistia.
 *
 * Sem `AUTH0_SECRET` a resposta certa é falhar alto, não inventar um segredo. Em produção a env
 * existe (conferido) — isto blinda o dia em que alguém provisionar o app sem ela.
 */
function lerSegredo(): Uint8Array {
  const s = process.env.AUTH0_SECRET;
  if (!s || s.length < 16) {
    throw new Error("AUTH0_SECRET ausente ou curto demais — necessário para assinar a sessão.");
  }
  return new TextEncoder().encode(s);
}

export const SESSION_SECRET = lerSegredo();

/**
 * Assina o cookie de sessão com `{ userId }`. Validade padrão de 7 dias.
 * `opts.demo` marca a sessão como conta de DEMONSTRAÇÃO (somente leitura) — o proxy usa esse
 * claim para bloquear qualquer escrita.
 */
export async function assinarSessao(userId: string, validade = "7d", opts?: { demo?: boolean }): Promise<string> {
  const claims: Record<string, unknown> = { userId };
  if (opts?.demo) claims.demo = true;
  return new jose.SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(validade)
    .sign(SESSION_SECRET);
}

/** Verifica o cookie; devolve o `userId` ou null se inválido/expirado. */
export async function lerSessao(token: string): Promise<string | null> {
  try {
    const { payload } = await jose.jwtVerify(token, SESSION_SECRET);
    return (payload.userId as string) ?? null;
  } catch {
    return null;
  }
}

/** Como lerSessao, mas devolve também se é sessão de demonstração (read-only). */
export async function lerSessaoInfo(token: string): Promise<{ userId: string; demo: boolean } | null> {
  try {
    const { payload } = await jose.jwtVerify(token, SESSION_SECRET);
    const userId = payload.userId as string;
    if (!userId) return null;
    return { userId, demo: payload.demo === true };
  } catch {
    return null;
  }
}

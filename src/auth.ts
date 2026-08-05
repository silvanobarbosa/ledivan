import { redirect } from "next/navigation";
import { auth0 } from "@/lib/auth0";
import { db } from "./db";
import { users } from "./db/schema";
import { sql as dsql } from "drizzle-orm";

/**
 * SHIM — Ledivan migrou next-auth/Auth.js v5 → Auth0 puro (02/08/2026; só testes).
 * Mantém a MESMA API que os ~15 consumidores usam: `await auth()` → session (`{ user }`) ou null;
 * `signIn`/`signOut` (server actions) redirecionam pro Universal Login/logout do Auth0; `handlers`
 * (rota [...nextauth], removida) vira stub. Por baixo: sessão Auth0 → usuário do banco (por e-mail),
 * de onde vêm `id` e `role` (usados nas checagens). Deny-by-default: sem sessão/erro → null.
 */
export type Session = {
  user: { id: string; email: string; name: string | null; image: string | null; role: string };
} | null;

export async function auth(): Promise<Session> {
  try {
    const s = await auth0.getSession();
    if (!s?.user?.sub) return null;

    // sub contém o userId
    const userId = s.user.sub;
    const rows = await db.select().from(users).where(dsql`${users.id} = ${userId}`).limit(1);
    if (!rows.length) return null;
    const u = rows[0];
    return {
      user: {
        id: String(u.id),
        email: u.email,
        name: u.name ?? null,
        image: u.image ?? null,
        role: u.role ?? "user",
      },
    };
  } catch {
    return null;
  }
}

export async function signIn(
  _provider?: string,
  opts?: { redirectTo?: string } & Record<string, unknown>,
): Promise<never> {
  const to = typeof opts?.redirectTo === "string" ? opts.redirectTo : "/dashboard";
  redirect(`/auth/login?returnTo=${encodeURIComponent(to)}`);
}

export async function signOut(_opts?: { redirectTo?: string }): Promise<never> {
  redirect("/auth/logout");
}

// Rota [...nextauth] aposentada (Auth0 monta /auth/*). Stub mantém a assinatura.
export const handlers = {
  GET: async () => new Response("not found", { status: 404 }),
  POST: async () => new Response("not found", { status: 404 }),
};

"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { assinarSessao } from "@/lib/session-secret";
import { rateLimit } from "@/lib/rateLimit";

// E-mail da conta de demonstração pública (Dr. Sócrates). Populada por `npm run seed:socrates`
// com 3 anos de uso. NÃO é clonada a cada visita: a sessão demo é SOMENTE LEITURA (o proxy
// bloqueia escrita), então os dados persistem e são compartilhados por todos os visitantes.
const DEMO_EMAIL = "socrates@ledivan.com.br";

// Entra na conta demo: abre uma sessão marcada como `demo` (read-only) e vai para o dashboard.
export async function startDemo() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "ip-desconhecido";
  // Rate-limit leve por IP (a sessão é só leitura; isto só evita abuso de criação de sessão).
  if (!(await rateLimit(ip, "demo-start", 20, 3600, { failClosed: true }))) {
    redirect("/login?error=demo_limite");
  }

  const u = await db.query.users.findFirst({ where: eq(users.email, DEMO_EMAIL) });
  if (!u) redirect("/login?error=demo");

  // `demo: true` no token → o proxy recusa qualquer método de escrita para esta sessão.
  const token = await assinarSessao(String(u.id), "7d", { demo: true });
  const store = await cookies();
  store.set("auth-session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
  });

  redirect("/dashboard");
}

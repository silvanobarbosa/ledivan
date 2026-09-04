"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { resetDemoFromSource, DEMO_EMAIL } from "@/lib/demo";
import { assinarSessao } from "@/lib/session-secret";
import { rateLimit } from "@/lib/rateLimit";

// Prepara o sandbox (clone fresco do apoiador) e entra na conta demo.
//
// Duas mudanças de segurança:
//  1. A sessão é aberta AQUI, no servidor — a senha da demo não trafega nem fica no bundle.
//     Antes, o botão da tela de login mandava `password: "ledivan-demo-2026"` embutido no
//     JavaScript do cliente (login/page.tsx), ou seja, público.
//  2. `resetDemoFromSource` é caro (wipe + clone de ~15 tabelas no Neon). Sem gate, um visitante
//     dispara isso em loop — custo/DoS. Rate-limit fail-closed por IP.
export async function startDemo() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "ip-desconhecido";
  if (!(await rateLimit(ip, "demo-start", 5, 3600, { failClosed: true }))) {
    redirect("/login?error=demo_limite");
  }

  await resetDemoFromSource();

  const u = await db.query.users.findFirst({ where: eq(users.email, DEMO_EMAIL) });
  if (!u) redirect("/login?error=demo");

  const token = await assinarSessao(String(u.id));
  const store = await cookies();
  store.set("auth-session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
  });

  redirect("/dashboard");
}

import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "renan@rdmss.com.br")
  .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);

export function isAdminUser(u?: { email?: string | null; role?: string | null } | null): boolean {
  if (!u) return false;
  if (u.role === "admin") return true;
  return !!u.email && ADMIN_EMAILS.includes(u.email.toLowerCase());
}

// Retorna o usuário admin logado ou null.
export async function getAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const u = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
  return isAdminUser(u) ? u : null;
}

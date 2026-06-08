// Apaga COMPLETAMENTE usuários (dados + auth + conta). Uso: npm run delete-user -- a@x b@y
import { db } from "../db";
import { users, accounts, sessions } from "../db/schema";
import { eq } from "drizzle-orm";
import { wipeUserData } from "./seedCore";

async function main() {
  const emails = process.argv.slice(2);
  if (!emails.length) { console.error("Informe e-mails: npm run delete-user -- a@x b@y"); process.exit(1); }
  for (const email of emails) {
    const u = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (!u) { console.log(`(skip) ${email} não existe`); continue; }
    await wipeUserData(u.id);
    await db.delete(accounts).where(eq(accounts.userId, u.id));
    await db.delete(sessions).where(eq(sessions.userId, u.id));
    await db.delete(users).where(eq(users.id, u.id));
    console.log(`🗑️  ${email} apagado (dados + auth + conta).`);
  }
  process.exit(0);
}
main().catch((e) => { console.error("❌", e); process.exit(1); });

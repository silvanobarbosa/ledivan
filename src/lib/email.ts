import nodemailer from "nodemailer";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { decryptSecret } from "@/lib/crypto";

// Detecta o servidor SMTP a partir do domínio do e-mail.
export function detectSmtp(email: string): { host: string; port: number; secure: boolean } | null {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;
  const known: Record<string, { host: string; port: number; secure: boolean }> = {
    "gmail.com": { host: "smtp.gmail.com", port: 587, secure: false },
    "googlemail.com": { host: "smtp.gmail.com", port: 587, secure: false },
    "outlook.com": { host: "smtp.office365.com", port: 587, secure: false },
    "hotmail.com": { host: "smtp.office365.com", port: 587, secure: false },
    "live.com": { host: "smtp.office365.com", port: 587, secure: false },
    "msn.com": { host: "smtp.office365.com", port: 587, secure: false },
    "yahoo.com": { host: "smtp.mail.yahoo.com", port: 465, secure: true },
    "yahoo.com.br": { host: "smtp.mail.yahoo.com", port: 465, secure: true },
    "icloud.com": { host: "smtp.mail.me.com", port: 587, secure: false },
    "me.com": { host: "smtp.mail.me.com", port: 587, secure: false },
    "uol.com.br": { host: "smtps.uol.com.br", port: 587, secure: false },
    "bol.com.br": { host: "smtps.bol.com.br", port: 587, secure: false },
    "zoho.com": { host: "smtp.zoho.com", port: 587, secure: false },
  };
  return known[domain] ?? { host: `smtp.${domain}`, port: 587, secure: false };
}

type SmtpConfig = { host: string; port: number; secure: boolean; user: string; pass: string };

export function makeTransport(c: SmtpConfig) {
  return nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth: { user: c.user, pass: c.pass },
  });
}

// Testa a conexão SMTP (verify). Lança em caso de falha.
export async function verifySmtp(c: SmtpConfig): Promise<void> {
  const t = makeTransport(c);
  await t.verify();
}

// Envia e-mail PELO e-mail do profissional (SMTP por tenant). Retorna se conseguiu.
export async function sendProEmail(
  userId: string,
  to: string,
  subject: string,
  html: string,
): Promise<{ ok: boolean; notConfigured?: boolean; error?: string }> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!user?.emailConfigured || !user.smtpHost || !user.smtpUser || !user.smtpPassEnc) {
    return { ok: false, notConfigured: true };
  }
  try {
    const t = makeTransport({
      host: user.smtpHost,
      port: user.smtpPort ?? 587,
      secure: !!user.smtpSecure,
      user: user.smtpUser,
      pass: decryptSecret(user.smtpPassEnc),
    });
    const fromName = user.smtpFromName || user.name || "Ledivan";
    await t.sendMail({ from: `"${fromName}" <${user.smtpUser}>`, to, subject, html });
    return { ok: true };
  } catch (e) {
    console.error("Erro SMTP do profissional:", e);
    return { ok: false, error: "Falha ao enviar pelo seu e-mail." };
  }
}

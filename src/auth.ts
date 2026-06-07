import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "./db";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { users } from "./db/schema";
import { eq } from "drizzle-orm";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // Permite vincular o login Google a um usuario pre-existente com o mesmo e-mail
      // (necessario para a conta seed silvanobarbosa@gmail.com ja ter dados ao entrar).
      allowDangerousEmailAccountLinking: true,
      authorization: {
        params: {
          // Apenas escopos NÃO sensíveis → sem tela de "app não verificado".
          // (Google Meet via Agenda exigiria o escopo calendar.events + verificação;
          //  o vídeo do app usa Jitsi/JaaS, então não precisamos dele.)
          prompt: "select_account",
          scope: "openid email profile",
        },
      },
    }),
    // Login por e-mail + senha (conta demo "apoiador" e afins).
    Credentials({
      name: "Senha",
      credentials: { email: {}, password: {} },
      authorize: async (creds) => {
        const email = (creds?.email as string)?.toLowerCase().trim();
        const password = creds?.password as string;
        if (!email || !password) return null;
        const u = await db.query.users.findFirst({ where: eq(users.email, email) });
        if (!u?.passwordHash) return null;
        const ok = await bcrypt.compare(password, u.passwordHash);
        if (!ok) return null;
        return { id: u.id, email: u.email, name: u.name, image: u.image };
      },
    }),
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: process.env.RESEND_FROM || "Ledivan <onboarding@resend.dev>",
      async sendVerificationRequest({ identifier: email, url, provider }) {
        if (!provider.apiKey) {
          console.error("AUTH_RESEND_KEY is missing!");
          throw new Error("Configuração de e-mail ausente. Verifique a variável AUTH_RESEND_KEY.");
        }
        
        const { host } = new URL(url);
        console.log(`Enviando e-mail de verificação para: ${email}`);
        
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${provider.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: provider.from,
            to: email,
            subject: `Seu acesso ao Ledivan`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                <h1 style="color: #2b1830; font-size: 24px; font-weight: bold;">Ledivan</h1>
                <p style="color: #4a5568; font-size: 16px;">Olá! Use o botão abaixo para entrar na sua conta com segurança.</p>
                <div style="margin: 32px 0;">
                  <a href="${url}" style="background-color: #2b1830; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Entrar no Ledivan</a>
                </div>
                <p style="color: #718096; font-size: 14px;">Se você não solicitou este e-mail, pode ignorá-lo.</p>
              </div>
            `,
          }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error("Resend API Error:", errorText);
          throw new Error("Erro ao enviar e-mail. Tente novamente mais tarde.");
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  // JWT é necessário para o provider Credentials (sessões de banco não suportam).
  // Funciona normalmente com Google/e-mail; o adapter segue persistindo usuários/contas.
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});

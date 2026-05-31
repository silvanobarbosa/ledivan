import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "./db";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
    Resend({
      apiKey: process.env.AUTH_RESEND_KEY,
      from: "Ledivan+ <onboarding@resend.dev>",
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
            subject: `Seu acesso ao Ledivan+`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                <h1 style="color: #2b1830; font-size: 24px; font-weight: bold;">Ledivan+</h1>
                <p style="color: #4a5568; font-size: 16px;">Olá! Use o botão abaixo para entrar na sua conta com segurança.</p>
                <div style="margin: 32px 0;">
                  <a href="${url}" style="background-color: #2b1830; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">Entrar no Ledivan+</a>
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
  callbacks: {
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
});

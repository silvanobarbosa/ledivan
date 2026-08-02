import { Auth0Client } from "@auth0/nextjs-auth0/server";

// Auth0 é o provedor de auth do Ledivan (migração 02/08/2026 — só testes, sem usuários reais).
// Substitui o next-auth/Auth.js v5 (Authentik OIDC + Google + Credentials/bcrypt + Resend).
// `connection: "ledivan-db"` fixa a Custom DB (lazy — senha bcrypt em user.password_hash).
// Envs (v4): APP_BASE_URL, AUTH0_DOMAIN, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET, AUTH0_SECRET.
export const auth0 = new Auth0Client({
  authorizationParameters: { connection: "ledivan-db" },
});

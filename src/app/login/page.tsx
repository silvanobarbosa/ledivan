import { redirect } from "next/navigation";

// Auth0 é o único login (Universal Login hospedado) — migração next-auth → Auth0 (02/08/2026).
// /login manda pro fluxo do SDK, que usa a Custom DB connection `ledivan-db` (senha bcrypt).
export default function LoginPage() {
  redirect("/auth/login?returnTo=/dashboard");
}

import { cookies } from "next/headers";
import { lerSessao } from "./session-secret";

// Auth0 Shim - Implementação simplificada para compatibilidade
// Mantém a mesma interface mas usa JWT local enquanto Auth0 real não está configurado.
// O segredo do cookie vem de session-secret.ts (fonte única, exige AUTH0_SECRET).

export const auth0 = {
  async getSession() {
    const cookieStore = await cookies();
    const token = cookieStore.get("auth-session");
    if (!token) return null;

    const userId = await lerSessao(token.value);
    if (!userId) return null;

    return {
      user: {
        sub: userId,
        email: null, // Será preenchido pelo auth.ts
      },
    };
  },

  // Métodos stub para compatibilidade
  handleAuth: () => () => new Response("Not implemented", { status: 501 }),
  handleLogin: () => new Response("Not implemented", { status: 501 }),
  handleLogout: () => new Response("Not implemented", { status: 501 }),
  handleCallback: () => new Response("Not implemented", { status: 501 }),
};

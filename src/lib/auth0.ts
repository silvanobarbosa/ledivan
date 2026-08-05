import { cookies } from "next/headers";
import * as jose from "jose";

// Auth0 Shim - Implementação simplificada para compatibilidade
// Mantém a mesma interface mas usa JWT local enquanto Auth0 real não está configurado

const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH0_SECRET || "default-secret-change-in-production"
);

export const auth0 = {
  async getSession() {
    try {
      const cookieStore = await cookies();
      const token = cookieStore.get("auth-session");

      if (!token) return null;

      const { payload } = await jose.jwtVerify(token.value, JWT_SECRET);

      return {
        user: {
          sub: payload.userId as string,
          email: null, // Será preenchido pelo auth.ts
        },
      };
    } catch {
      return null;
    }
  },

  // Métodos stub para compatibilidade
  handleAuth: () => () => new Response("Not implemented", { status: 501 }),
  handleLogin: () => new Response("Not implemented", { status: 501 }),
  handleLogout: () => new Response("Not implemented", { status: 501 }),
  handleCallback: () => new Response("Not implemented", { status: 501 }),
};

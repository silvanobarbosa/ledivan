import { SignJWT, importPKCS8 } from "jose";

// JaaS (Jitsi as a Service / 8x8) — garante que o TERAPEUTA é sempre moderador,
// independente de quem entra primeiro, via JWT assinado (RS256).
// Configurado por env:
//   JAAS_APP_ID       -> AppID do tenant (ex.: vpaas-magic-cookie-xxxxxxxx)
//   JAAS_KID          -> ID da chave da API (ex.: vpaas-magic-cookie-xxxx/abc123)
//   JAAS_PRIVATE_KEY  -> chave privada PEM (PKCS8). Use \n para quebras de linha.

export const JAAS_DOMAIN = "8x8.vc";

export function jaasConfigured(): boolean {
  return !!(process.env.JAAS_APP_ID && process.env.JAAS_KID && process.env.JAAS_PRIVATE_KEY);
}

export function jaasAppId(): string {
  return process.env.JAAS_APP_ID || "";
}

// Nome completo da sala no JaaS: <appId>/<sala>
export function jaasRoom(room: string): string {
  return `${jaasAppId()}/${room}`;
}

export async function generateJaasJwt(opts: {
  name: string;
  moderator: boolean;
  id?: string;
  email?: string;
  avatar?: string;
}): Promise<string | null> {
  if (!jaasConfigured()) return null;

  const appId = process.env.JAAS_APP_ID!;
  const kid = process.env.JAAS_KID!;
  const pem = process.env.JAAS_PRIVATE_KEY!.replace(/\\n/g, "\n");

  const key = await importPKCS8(pem, "RS256");
  const now = Math.floor(Date.now() / 1000);

  return await new SignJWT({
    aud: "jitsi",
    iss: "chat",
    sub: appId,
    room: "*",
    context: {
      user: {
        id: opts.id || "user",
        name: opts.name,
        email: opts.email,
        avatar: opts.avatar,
        moderator: opts.moderator,
      },
      features: {
        livestreaming: false,
        recording: false,
        transcription: false,
        "outbound-call": false,
      },
    },
  })
    .setProtectedHeader({ alg: "RS256", kid, typ: "JWT" })
    .setIssuedAt(now)
    .setNotBefore(now - 10)
    .setExpirationTime(now + 4 * 60 * 60) // 4h
    .sign(key);
}

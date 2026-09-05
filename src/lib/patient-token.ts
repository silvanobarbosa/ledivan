// Token bearer do PACIENTE (app nativo). JWT-like assinado por HMAC (sem lib externa).
// Payload: pid (paciente), uid (terapeuta dono), exp. Segredo = PATIENT_JWT_SECRET | AUTH0_SECRET.
import { createHmac, timingSafeEqual } from "node:crypto";
import { segredoObrigatorio } from "@/lib/secret";

type Payload = { pid: string; uid: string; exp: number; demo?: boolean };

// Sem literal de fallback: segredo ausente FALHA (ver src/lib/secret.ts). Um fallback público
// no repo permitiria forjar bearer de qualquer paciente.
const secret = () => segredoObrigatorio("PATIENT_JWT_SECRET", "AUTH0_SECRET");
const b64 = (s: string) => Buffer.from(s).toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url").toString();

// `demo: true` marca o token da PACIENTE de demonstração (Srta. Dionísia) → o proxy recusa
// qualquer escrita feita com ele. Read-only igual à conta do terapeuta demo.
export function signPatient(pid: string, uid: string, days = 30, opts?: { demo?: boolean }): string {
  const p: Payload = { pid, uid, exp: Date.now() + days * 86400000, ...(opts?.demo ? { demo: true } : {}) };
  const body = b64(JSON.stringify(p));
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyPatient(token: string): Payload | null {
  const [body, sig] = (token || "").split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch { return null; }
  try {
    const p = JSON.parse(unb64(body)) as Payload;
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
}

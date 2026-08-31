import { describe, it, expect, beforeAll } from "vitest";
import { signPatient, verifyPatient } from "@/lib/patient-token";

beforeAll(() => { process.env.PATIENT_JWT_SECRET = "segredo-de-teste-fixo"; });

describe("patient-token", () => {
  it("assina e verifica de volta pid + uid", () => {
    const t = signPatient("pac-1", "ter-1");
    const p = verifyPatient(t);
    expect(p?.pid).toBe("pac-1");
    expect(p?.uid).toBe("ter-1");
  });

  it("rejeita token adulterado (assinatura não confere)", () => {
    const t = signPatient("pac-1", "ter-1");
    const [body] = t.split(".");
    expect(verifyPatient(`${body}.assinaturaerrada`)).toBeNull();
  });

  it("rejeita payload trocado mantendo a assinatura antiga", () => {
    const t = signPatient("pac-1", "ter-1");
    const forjado = Buffer.from(JSON.stringify({ pid: "pac-2", uid: "ter-1", exp: Date.now() + 1e9 })).toString("base64url");
    const [, sig] = t.split(".");
    expect(verifyPatient(`${forjado}.${sig}`)).toBeNull();
  });

  it("rejeita token expirado", () => {
    const t = signPatient("pac-1", "ter-1", -1); // já vencido
    expect(verifyPatient(t)).toBeNull();
  });

  it("rejeita formatos malformados", () => {
    expect(verifyPatient("")).toBeNull();
    expect(verifyPatient("semponto")).toBeNull();
    expect(verifyPatient("a.b.c")).toBeNull();
  });
});

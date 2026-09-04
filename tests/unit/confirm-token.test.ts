import { describe, it, expect, beforeAll } from "vitest";

// O segredo é obrigatório (segredoObrigatorio). Define antes de importar o módulo.
beforeAll(() => {
  process.env.CONFIRM_SECRET = process.env.CONFIRM_SECRET || "teste-confirm-secret-0123456789";
});

describe("confirm-token", () => {
  it("assina e verifica dentro da validade", async () => {
    const { signSession, verifySession } = await import("@/lib/messaging/confirm-token");
    const t = signSession("sess-1", "confirm");
    expect(verifySession("sess-1", "confirm", t)).toBe(true);
  });

  it("recusa outra sessão ou outra ação", async () => {
    const { signSession, verifySession } = await import("@/lib/messaging/confirm-token");
    const t = signSession("sess-1", "confirm");
    expect(verifySession("sess-2", "confirm", t)).toBe(false);
    expect(verifySession("sess-1", "reschedule", t)).toBe(false);
  });

  it("recusa token expirado", async () => {
    const { signSession, verifySession } = await import("@/lib/messaging/confirm-token");
    const ontem = Math.floor(Date.now() / 86400000) - 1;
    const expirado = signSession("sess-1", "confirm", ontem);
    expect(verifySession("sess-1", "confirm", expirado)).toBe(false);
  });

  it("recusa formato antigo sem exp e lixo", async () => {
    const { verifySession } = await import("@/lib/messaging/confirm-token");
    expect(verifySession("sess-1", "confirm", "abcdef0123456789abcdef0123456789")).toBe(false); // sem "."
    expect(verifySession("sess-1", "confirm", "")).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import { statusDespesa } from "@/lib/despesaStatus";

describe("statusDespesa", () => {
  const hoje = "2026-10-18";
  it("paga quando tem data de pagamento", () => {
    expect(statusDespesa("2026-10-01", "2026-10-05", hoje)).toBe("paga");
    expect(statusDespesa("2026-11-30", "2026-10-18", hoje)).toBe("paga"); // paga mesmo antes de vencer
  });
  it("atraso quando vencida e não paga", () => {
    expect(statusDespesa("2026-10-10", null, hoje)).toBe("atraso");
  });
  it("aberta quando dentro do prazo e não paga", () => {
    expect(statusDespesa("2026-10-18", null, hoje)).toBe("aberta"); // vence hoje = ainda no prazo
    expect(statusDespesa("2026-11-05", null, hoje)).toBe("aberta");
  });
});

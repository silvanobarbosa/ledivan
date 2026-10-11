import { describe, expect, it } from "vitest";
import { cobrancasDoPaciente, type EntradaDasCobrancas } from "@/lib/cobrancas";

// Doc 31 frente E — a terapeuta edita o vencimento de UMA cobrança. O motor usa a data editada no
// lugar da calculada; sem a entrada (desfazer), recalcula o original.
const base: EntradaDasCobrancas = {
  vigencias: [{ formato: "mensal", pacoteTipo: "completo", desde: new Date(2025, 0, 1) }],
  reserva: { formato: "mensal", pacoteTipo: "completo" },
  precos: [{ valor: 100, desde: new Date(2025, 0, 1) }],
  sessoes: [
    { id: "s1", date: new Date(2025, 0, 6, 9), status: "realizada" },
    { id: "s2", date: new Date(2025, 0, 13, 9), status: "realizada" },
  ],
  tamanhoPacote: 2,
  diaPagamento: 10,
};

describe("vencimento editado à mão (doc 31 E)", () => {
  it("sem edição, usa o vencimento calculado (dia 10)", () => {
    const c = cobrancasDoPaciente(base).find((x) => x.tipo === "pacote")!;
    expect(c.vencimento?.getDate()).toBe(10);
  });

  it("com edição, o vencimento da cobrança muda só para a chave editada", () => {
    const pacote = cobrancasDoPaciente(base).find((x) => x.tipo === "pacote")!;
    const novo = new Date(2025, 0, 25, 23, 59, 59);
    const c = cobrancasDoPaciente({ ...base, vencimentos: [{ chave: pacote.chave, vencimento: novo }] }).find(
      (x) => x.chave === pacote.chave,
    )!;
    expect(c.vencimento?.getDate()).toBe(25);
  });

  it("desfazer (sem a entrada) recalcula o original", () => {
    const c = cobrancasDoPaciente({ ...base, vencimentos: [] }).find((x) => x.tipo === "pacote")!;
    expect(c.vencimento?.getDate()).toBe(10);
  });
});

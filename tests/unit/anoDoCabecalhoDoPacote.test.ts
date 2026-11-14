import { describe, expect, it } from "vitest";
import { anoDe, dataDoAnoControle, dataDoAnoDaLinha } from "@/lib/filtroDeAno";

/**
 * EM QUE ANO O CABEÇALHO DO PACOTE APARECE (dono, 13/11/2026 — caso da Beatriz).
 *
 * O doc 32 pediu que o cabeçalho ficasse junto das sessões do ano em que o pacote COMEÇOU, e a
 * regra foi escrita como "vai pelo vencimento". Nos casos daquele documento as duas coisas davam
 * no mesmo, porque o vencimento caía no mesmo ano da primeira sessão.
 *
 * Quando o pacote começa no fim de dezembro e vence no ano seguinte, elas se separam: o cabeçalho
 * some para 2027 e as sessões de dezembro ficam órfãs em 2026 — sem campo para lançar o pagamento,
 * que foi exatamente o que a dona viu no pacote de 09/12/2026.
 *
 * A regra passa a ser a PRIMEIRA SESSÃO do pacote, que é o que o doc 32 queria dizer. O vencimento
 * continua valendo para a cobrança que não tem sessão a que se agarrar.
 */

const sessoes: Record<string, string> = {
  s1: "2026-12-09T18:00:00",
  s2: "2026-12-16T18:00:00",
  s3: "2026-12-23T18:00:00",
  s4: "2027-01-06T18:00:00",
};
const dataDaSessao = (id: string) => sessoes[id] ?? null;

const pacoteDaBeatriz = {
  tipo: "pagamento",
  ids: ["s1", "s2", "s3", "s4"],
  // Começa em dezembro/2026 e vence em janeiro/2027.
  vencimento: "2027-01-10T00:00:00",
  pagamento: null,
};

describe("o pacote que começa em dezembro e vence no ano seguinte", () => {
  it("o cabeçalho fica no ano da PRIMEIRA sessão (2026), não no do vencimento", () => {
    expect(anoDe(dataDoAnoDaLinha(pacoteDaBeatriz, dataDaSessao))).toBe(2026);
  });

  it("sem o localizador das sessões, continua caindo no vencimento — o comportamento de antes", () => {
    expect(anoDe(dataDoAnoDaLinha(pacoteDaBeatriz))).toBe(2027);
  });
});

describe("o que não pode mudar", () => {
  /** Doc 32: vence 10/12/2024, sessões 23/12/2024 e 08/01/2025 → cabeçalho em 2024. */
  it("o caso do doc 32 continua em 2024", () => {
    const linha = {
      tipo: "pagamento",
      ids: ["a", "b"],
      vencimento: "2024-12-10T00:00:00",
      pagamento: { data: "2025-01-10T00:00:00" },
    };
    const datas = (id: string) => ({ a: "2024-12-23T18:00:00", b: "2025-01-08T18:00:00" })[id] ?? null;
    expect(anoDe(dataDoAnoDaLinha(linha, datas))).toBe(2024);
  });

  it("a sessão continua indo pelo próprio dia", () => {
    const linha = { tipo: "sessao", data: "2027-01-06T18:00:00" };
    expect(anoDe(dataDoAnoDaLinha(linha, dataDaSessao))).toBe(2027);
  });

  /**
   * Cobrança sem sessão nenhuma (ou com ids que não estão na tela) não pode sumir do filtro: cai
   * no vencimento, como sempre foi.
   */
  it("cobrança sem sessão localizável cai no vencimento", () => {
    const linha = { tipo: "pagamento", ids: ["fantasma"], vencimento: "2026-05-10T00:00:00", pagamento: null };
    expect(anoDe(dataDoAnoDaLinha(linha, dataDaSessao))).toBe(2026);
  });

  it("a função antiga segue existindo e com o mesmo resultado", () => {
    expect(anoDe(dataDoAnoControle(pacoteDaBeatriz))).toBe(2027);
  });
});

describe("a primeira sessão é a MAIS ANTIGA, não a primeira da lista", () => {
  it("ids fora de ordem não enganam o filtro", () => {
    const linha = { tipo: "pagamento", ids: ["s4", "s1"], vencimento: "2027-01-10T00:00:00", pagamento: null };
    expect(anoDe(dataDoAnoDaLinha(linha, dataDaSessao))).toBe(2026);
  });
});

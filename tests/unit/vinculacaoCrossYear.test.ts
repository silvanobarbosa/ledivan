import { describe, expect, it } from "vitest";
import { linhasDaGeral, type EntradaDaGeral } from "@/lib/guiaGeral";

// Doc 31 — cenário: pacote de 2 (R$50/sessão), com GRAT (devolutiva) no meio, cruzando o ano.
// Sessões: 23/12/2024 (1/2), 04/01/2025 GRAT, 08/01/2025 (2/2), 15/01/2025 GRAT.
// Pagamento R$100 em 10/01/2025 referente às 2 do pacote → deve casar com [23/12, 08/01].
const dia = (ano: number, mes1: number, d: number, extra: Partial<EntradaDaGeral["sessoes"][number]> = {}) => ({
  id: `${ano}-${mes1}-${d}`,
  date: new Date(ano, mes1 - 1, d, 9, 0),
  status: "realizada",
  sessionKind: "consulta",
  abaterDoPacote: false,
  chargeable: true,
  extra: null,
  repoeSessaoId: null,
  online: false,
  ...extra,
});

describe("vinculação cross-year (doc 31)", () => {
  const sessoes = [
    dia(2024, 12, 23),
    dia(2025, 1, 4, { sessionKind: "devolutiva" }), // GRAT — devolutiva não abate do pacote
    dia(2025, 1, 8),
    dia(2025, 1, 15, { sessionKind: "devolutiva" }), // GRAT
  ];

  const linhas = linhasDaGeral({
    vigencias: [{ formato: "mensal", pacoteTipo: "completo", desde: new Date(2024, 0, 1) }],
    reserva: { formato: "mensal", pacoteTipo: "completo" },
    precos: [{ valor: 50, desde: new Date(2024, 0, 1) }],
    sessoes,
    tamanhoPacote: 2,
    diaPagamento: 10,
    hoje: new Date(2025, 1, 1),
    pagamentos: [{ id: "pg100", valor: 100, data: new Date(2025, 0, 10), status: "paid", metodo: "pix", pagoPor: "Mãe", cobrancaChave: "pacote:2024-12-01:0" }],
  });

  it("o pacote cobre 23/12 e 08/01 e o R$100 casa com ele (mesmo com chave defasada)", () => {
    const cobrancas = linhas.flatMap((l) => (l.tipo === "pagamento" ? [l] : l.tipo === "sessao" && l.cobranca ? [l.cobranca] : []));
    const pacote = cobrancas.find((c) => c.sessoes === 2);
    expect(pacote).toBeTruthy();
    expect(pacote!.valor).toBe(100);
    // O pacote cobre as DUAS sessões do pacote, cruzando o ano (exclui as GRAT/devolutivas).
    expect(pacote!.ids).toEqual(["2024-12-23", "2025-1-8"]);
    // O R$100 casa com o pacote e APARECE na lista de lançamentos — é como o recibo acha as datas das
    // sessões. Antes caía no "recebido" sem entrar em `pagamentos`, e o recibo perdia as sessões.
    expect(pacote!.pagamentos.map((p) => p.id)).toContain("pg100");
    expect(pacote!.situacao).toBe("pago");
  });
});

import { describe, it, expect } from "vitest";
import { datasDoRecibo } from "@/lib/reciboSequencia";

const d = (iso: string) => new Date(iso + "T12:00:00");
const br = (x: Date) => `${String(x.getDate()).padStart(2, "0")}/${String(x.getMonth() + 1).padStart(2, "0")}/${x.getFullYear()}`;

describe("datasDoRecibo (doc 28)", () => {
  // Exemplo do documento: valor da sessão 50, pago 100 → 2 sessões; 05/10 e 08/10 (Presente/Faltou).
  const sessoes = [
    { data: d("2026-10-05"), status: "realizada" },
    { data: d("2026-10-08"), status: "nao_realizada" },
    { data: d("2026-10-12"), status: "realizada" },
    { data: d("2026-10-15"), status: "realizada" },
  ];

  it("um pagamento de R$100 (sessão R$50) → as 2 primeiras datas", () => {
    const r = datasDoRecibo({ pagamentos: [{ id: "p1", valor: 100 }], alvoId: "p1", sessoes, valorSessao: 50 });
    expect(r.datas.map(br)).toEqual(["05/10/2026", "08/10/2026"]);
    expect(r.parcial).toBe(false);
  });

  it("sequência: 1º pagamento pega as 2 primeiras; 2º pega as 2 próximas, sem repetir", () => {
    const pagamentos = [{ id: "p1", valor: 100 }, { id: "p2", valor: 100 }];
    const r1 = datasDoRecibo({ pagamentos, alvoId: "p1", sessoes, valorSessao: 50 });
    const r2 = datasDoRecibo({ pagamentos, alvoId: "p2", sessoes, valorSessao: 50 });
    expect(r1.datas.map(br)).toEqual(["05/10/2026", "08/10/2026"]);
    expect(r2.datas.map(br)).toEqual(["12/10/2026", "15/10/2026"]);
    // nenhuma data se repete entre os dois recibos
    expect(r1.datas.some((x) => r2.datas.some((y) => y.getTime() === x.getTime()))).toBe(false);
  });

  it("exclui Desmarcou/Atestado/Prof. desmarcou — só Presente e Faltou entram", () => {
    const comLixo = [
      { data: d("2026-10-05"), status: "realizada" },
      { data: d("2026-10-06"), status: "cancelada" },     // Desmarcou — fora
      { data: d("2026-10-07"), status: "atestado" },      // Atestado — fora
      { data: d("2026-10-08"), status: "prof_desmarcou" },// Prof. desm. — fora
      { data: d("2026-10-09"), status: "nao_realizada" }, // Faltou — entra
    ];
    const r = datasDoRecibo({ pagamentos: [{ id: "p1", valor: 100 }], alvoId: "p1", sessoes: comLixo, valorSessao: 50 });
    expect(r.datas.map(br)).toEqual(["05/10/2026", "09/10/2026"]);
  });

  it("pagamento parcial (R$75, sessão R$50): marca parcial e aponta a 1ª sessão do pacote", () => {
    const r = datasDoRecibo({ pagamentos: [{ id: "p1", valor: 75 }], alvoId: "p1", sessoes, valorSessao: 50 });
    expect(r.parcial).toBe(true);
    expect(r.inicioPacote && br(r.inicioPacote)).toBe("05/10/2026");
    // a parte inteira (1 sessão) traz 1 data
    expect(r.datas.map(br)).toEqual(["05/10/2026"]);
  });

  it("pagamento menor que uma sessão (R$30): parcial, sem data inteira, início = próxima sessão", () => {
    const r = datasDoRecibo({ pagamentos: [{ id: "p1", valor: 30 }], alvoId: "p1", sessoes, valorSessao: 50 });
    expect(r.parcial).toBe(true);
    expect(r.datas).toEqual([]);
    expect(r.inicioPacote && br(r.inicioPacote)).toBe("05/10/2026");
  });

  it("valor da sessão ausente: não quebra, devolve vazio", () => {
    const r = datasDoRecibo({ pagamentos: [{ id: "p1", valor: 100 }], alvoId: "p1", sessoes, valorSessao: 0 });
    expect(r.datas).toEqual([]);
  });

  it("pagamento que não está na lista → vazio", () => {
    const r = datasDoRecibo({ pagamentos: [{ id: "p1", valor: 100 }], alvoId: "zzz", sessoes, valorSessao: 50 });
    expect(r.datas).toEqual([]);
  });

  // Doc 29 — a correção real foi ESCOPAR à cobrança (o recibo recebe só as sessões da cobrança do
  // pagamento, já sem gratuita/Desmarcou/Prof.desm). Aqui o pool já vem escopado: 2 pagamentos de
  // R$100 (sessão R$50) sobre as 4 sessões Presente da cobrança → 1º recibo as 2 primeiras, 2º as 2
  // seguintes, sem repetir. (A 20/12 Prof.desm nem entra no pool, por isso não aparece.)
  it("exemplo doc 29: dois R$100 numa cobrança de 4 → [1ª,2ª] e [3ª,4ª] datas, sem repetir", () => {
    const poolDaCobranca = [
      { data: d("2026-12-06"), status: "realizada" },
      { data: d("2026-12-13"), status: "realizada" },
      { data: d("2026-12-27"), status: "realizada" },
      { data: d("2027-01-03"), status: "realizada" },
    ];
    const pagamentos = [{ id: "a", valor: 100 }, { id: "b", valor: 100 }];
    const r1 = datasDoRecibo({ pagamentos, alvoId: "a", sessoes: poolDaCobranca, valorSessao: 50 });
    const r2 = datasDoRecibo({ pagamentos, alvoId: "b", sessoes: poolDaCobranca, valorSessao: 50 });
    expect(r1.datas.map(br)).toEqual(["06/12/2026", "13/12/2026"]);
    expect(r2.datas.map(br)).toEqual(["27/12/2026", "03/01/2027"]);
  });
});

import { describe, expect, it } from "vitest";
import { datasQueACobrancaCita, montarMensagemCobranca } from "@/lib/mensagemCobranca";

/** O pacote do William (doc 74): seis datas no conjunto, duas delas sem cobrança. */
const WILLIAM = [
  { data: "2026-11-03T19:00:00", status: "cancelada" },
  { data: "2026-11-10T19:00:00", status: "realizada" },
  { data: "2026-11-17T19:00:00", status: "atestado" },
  { data: "2026-11-24T19:00:00", status: "agendada" },
  { data: "2026-12-01T19:00:00", status: "agendada" },
  { data: "2026-12-08T19:00:00", status: "agendada" },
];

describe("datasQueACobrancaCita", () => {
  it("tira Desmarcou, Atestado e Prof. desmarcou", () => {
    expect(datasQueACobrancaCita(WILLIAM)).toEqual([
      "2026-11-10T19:00:00",
      "2026-11-24T19:00:00",
      "2026-12-01T19:00:00",
      "2026-12-08T19:00:00",
    ]);
  });

  it("realocada (a outra forma de Desmarcou) e prof_desmarcou também saem", () => {
    const r = datasQueACobrancaCita([
      { data: "2026-11-03T19:00:00", status: "realocada" },
      { data: "2026-11-10T19:00:00", status: "prof_desmarcou" },
      { data: "2026-11-17T19:00:00", status: "realizada" },
    ]);
    expect(r).toEqual(["2026-11-17T19:00:00"]);
  });

  it("'Faltou' CONTINUA na lista — a falta é cobrada", () => {
    const r = datasQueACobrancaCita([{ data: "2026-11-10T19:00:00", status: "nao_realizada" }]);
    expect(r).toEqual(["2026-11-10T19:00:00"]);
  });

  it("ordena e aceita status ausente", () => {
    const r = datasQueACobrancaCita([{ data: "2026-12-08T19:00:00" }, { data: "2026-11-10T19:00:00", status: null }]);
    expect(r).toEqual(["2026-11-10T19:00:00", "2026-12-08T19:00:00"]);
  });

  it("vazio quando nada é cobrável, e aí a linha some da mensagem", () => {
    expect(datasQueACobrancaCita([{ data: "2026-11-03T19:00:00", status: "cancelada" }])).toEqual([]);
    const msg = montarMensagemCobranca(null, {
      valor: "R$ 400,00",
      vencimento: "2026-11-15T00:00:00",
      sessoes: [],
      hoje: "2026-11-14",
    });
    expect(msg).not.toContain("Referente às sessões");
  });

  it("a mensagem do pacote lista só as cobradas", () => {
    const msg = montarMensagemCobranca(null, {
      caso: "mensal",
      nome: "William",
      valor: "R$ 400,00",
      vencimento: "2026-11-15T00:00:00",
      sessoes: datasQueACobrancaCita(WILLIAM),
      hoje: "2026-11-14",
    });
    expect(msg).toContain("10/11/26, 24/11/26, 01/12/26 e 08/12/26");
    expect(msg).not.toContain("03/11/26");
    expect(msg).not.toContain("17/11/26");
  });
});

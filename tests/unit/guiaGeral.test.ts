import { describe, expect, it } from "vitest";
import { linhasDaGeral, resumoDaGeral, type EntradaDaGeral, type LinhaDaGeral } from "@/lib/guiaGeral";

/**
 * A GUIA GERAL — os exemplos do documento do dono (15/09/2026), valor da sessão R$ 130.
 */

const desde = new Date(2026, 0, 1);
const precos = [{ valor: 130, desde }];
const hoje = new Date(2026, 8, 15, 12);

const terca = (dia: number, mes = 8, status = "realizada") => ({ id: `s${mes}-${dia}`, date: new Date(2026, mes, dia, 9), status });

function geral(formato: string, sessoes: EntradaDaGeral["sessoes"], extra: Partial<EntradaDaGeral> = {}): LinhaDaGeral[] {
  return linhasDaGeral({
    vigencias: [{ formato, pacoteTipo: extra.tamanhos ? "fragmentado" : "completo", desde }],
    reserva: { formato },
    precos,
    sessoes,
    pagamentos: [],
    hoje,
    ...extra,
  });
}

/** Resumo legível: "P 520" para pagamento, "1/4" / "AVUL 130" para sessão. */
const resumo = (linhas: LinhaDaGeral[]) =>
  linhas.map((l) => (l.tipo === "pagamento" ? `P ${l.valor}` : l.valor == null ? l.rotulo : `${l.rotulo} ${l.valor}`));

describe("a cada sessão", () => {
  it("o valor fica na linha de cada sessão", () => {
    expect(resumo(geral("sessao", [terca(1), terca(8)]))).toEqual(["AVUL 130", "AVUL 130"]);
  });

  it("a linha da sessão carrega a cobrança (é nela que se lança o pagamento)", () => {
    const [l] = geral("sessao", [terca(1)]);
    expect(l.tipo === "sessao" && l.cobranca?.chave).toBe("sessao:s8-1");
  });
});

describe("gratuito", () => {
  it("GRAT em cada sessão, sem cobrança", () => {
    const linhas = geral("gratuito", [terca(1), terca(8)]);
    expect(resumo(linhas)).toEqual(["GRAT 0", "GRAT 0"]);
    expect(linhas.every((l) => l.tipo === "sessao" && !l.cobranca)).toBe(true);
  });
});

describe("mensal", () => {
  it("completo: a linha de pagamento de R$ 520 vem ANTES da 1/4", () => {
    expect(resumo(geral("mensal", [terca(1), terca(8), terca(15), terca(22)]))).toEqual(["P 520", "1/4", "2/4", "3/4", "4/4"]);
  });

  it("fragmentado 3 e depois 4: R$ 390 antes da 1/3, R$ 520 antes da 1/4", () => {
    const s = [terca(1), terca(8), terca(15), terca(22), terca(29), terca(6, 9), terca(13, 9)];
    expect(resumo(geral("mensal", s, { tamanhos: [3, 4] }))).toEqual(["P 390", "1/3", "2/3", "3/3", "P 520", "1/4", "2/4", "3/4", "4/4"]);
  });

  it("a linha de pagamento não tem data enquanto não é paga", () => {
    const [p] = geral("mensal", [terca(1), terca(8), terca(15), terca(22)]);
    expect(p.tipo === "pagamento" && p.pagamento).toBeNull();
  });
});

describe("quinzenal", () => {
  it("duas linhas de R$ 260 antes da sequência", () => {
    expect(resumo(geral("quinzenal", [terca(1), terca(8), terca(15), terca(22)]))).toEqual(["P 260", "P 260", "1/4", "2/4", "3/4", "4/4"]);
  });

  it("fracionado de 3: R$ 195 + R$ 195", () => {
    expect(resumo(geral("quinzenal", [terca(1), terca(8), terca(15)], { tamanhos: [3] }))).toEqual(["P 195", "P 195", "1/3", "2/3", "3/3"]);
  });
});

describe("primeira e última sessão do pacote", () => {
  it("primeira: pagamento antes do pacote", () => {
    expect(resumo(geral("primeira_pacote", [terca(1), terca(8), terca(15), terca(22)]))).toEqual(["P 520", "1/4", "2/4", "3/4", "4/4"]);
  });

  it("última: pagamento DEPOIS do pacote", () => {
    expect(resumo(geral("ultima_pacote", [terca(1), terca(8), terca(15), terca(22)]))).toEqual(["1/4", "2/4", "3/4", "4/4", "P 520"]);
  });
});

describe("sessões extras no meio do pacote", () => {
  it("AVUL traz o valor dela e não mexe no pacote; GRAT fica sem cobrança", () => {
    const s = [
      terca(1), terca(8),
      { id: "avul", date: new Date(2026, 8, 10, 9), status: "realizada", extra: "avul", valorExtra: 150 },
      terca(15),
      { id: "grat", date: new Date(2026, 8, 17, 9), status: "realizada", extra: "grat" },
      terca(22),
    ];
    expect(resumo(geral("mensal", s))).toEqual(["P 520", "1/4", "2/4", "AVUL 150", "3/4", "GRAT 0", "4/4"]);
  });
});

describe("a troca de formato no meio do caminho", () => {
  it("gratuito em agosto, mensal a partir de setembro: cada período na sua forma", () => {
    const linhas = linhasDaGeral({
      vigencias: [
        { formato: "gratuito", desde },
        { formato: "mensal", pacoteTipo: "completo", desde: new Date(2026, 8, 1) },
      ],
      reserva: { formato: "mensal" },
      precos,
      sessoes: [terca(25, 7), terca(1), terca(8), terca(15), terca(22)],
      pagamentos: [],
      hoje,
    });
    expect(resumo(linhas)).toEqual(["GRAT 0", "P 520", "1/4", "2/4", "3/4", "4/4"]);
  });
});

describe("situação e pagamento lançado", () => {
  const seq = [terca(1), terca(8), terca(15), terca(22), terca(29), terca(6, 9), terca(13, 9), terca(20, 9)];
  const base = { diaPagamento: 5 };

  it("a primeira cobrança fica em aberto até ser paga; as seguintes, só a partir do vencimento", () => {
    const antesDoVencimento = linhasDaGeral({
      vigencias: [{ formato: "mensal", pacoteTipo: "completo", desde }], reserva: { formato: "mensal" }, precos,
      sessoes: seq, pagamentos: [], hoje: new Date(2026, 8, 2), ...base,
    }).filter((l) => l.tipo === "pagamento");
    // 1ª vence 05/09 e hoje é 02/09 — ainda não venceu, mas é a primeira: em aberto.
    expect(antesDoVencimento[0].tipo === "pagamento" && antesDoVencimento[0].situacao).toBe("em_aberto");

    const futura = linhasDaGeral({
      vigencias: [{ formato: "mensal", pacoteTipo: "completo", desde }], reserva: { formato: "mensal" }, precos,
      sessoes: [...seq, terca(27, 9), terca(3, 10), terca(10, 10), terca(17, 10)], pagamentos: [], hoje, ...base,
    }).filter((l) => l.tipo === "pagamento");
    // 3ª sequência começa em 27/10 → vence 05/10, depois de hoje (15/09): a vencer.
    expect(futura[2].tipo === "pagamento" && futura[2].situacao).toBe("a_vencer");
    expect(futura[1].tipo === "pagamento" && futura[1].situacao).toBe("em_aberto");
  });

  it("pagamento com a chave da cobrança: pago, com data, responsável e forma", () => {
    const linhas = linhasDaGeral({
      vigencias: [{ formato: "mensal", pacoteTipo: "completo", desde }], reserva: { formato: "mensal" }, precos,
      sessoes: seq, hoje,
      pagamentos: [{ id: "pg1", valor: 520, data: new Date(2026, 8, 3), status: "paid", metodo: "pix", pagoPor: "Mãe", cobrancaChave: "pacote:inicio:1" }],
    });
    const [primeiro, p] = linhas.filter((l) => l.tipo === "pagamento");
    // A chave manda: o pagamento é da SEGUNDA sequência, e a primeira continua em aberto. Sem isto
    // o teste passava pela distribuição por vencimento, e não provava o casamento pela chave.
    expect(primeiro.tipo === "pagamento" && primeiro.situacao).toBe("em_aberto");
    expect(p.tipo).toBe("pagamento");
    if (p.tipo !== "pagamento") return;
    expect(p.chave).toBe("pacote:inicio:1");
    expect(p.situacao).toBe("pago");
    expect(p.pagamento).toMatchObject({ id: "pg1", metodo: "pix", pagoPor: "Mãe" });
    expect(p.pagamento?.data.getTime()).toBe(new Date(2026, 8, 3).getTime());
  });

  it("pagamento antigo, sem chave, quita pela ordem de vencimento", () => {
    const linhas = linhasDaGeral({
      vigencias: [{ formato: "sessao", desde }], reserva: { formato: "sessao" }, precos,
      sessoes: [terca(1), terca(8), terca(15)], hoje,
      pagamentos: [{ id: "velho", valor: 260, data: new Date(2026, 8, 9), status: "paid", metodo: "cash", pagoPor: null, cobrancaChave: null }],
    });
    const sit = linhas.map((l) => (l.tipo === "sessao" ? l.cobranca?.situacao : null));
    expect(sit).toEqual(["pago", "pago", "em_aberto"]);
  });

  it("pagamento pendente não quita nada", () => {
    const linhas = linhasDaGeral({
      vigencias: [{ formato: "sessao", desde }], reserva: { formato: "sessao" }, precos,
      sessoes: [terca(1)], hoje,
      pagamentos: [{ id: "p", valor: 130, data: new Date(2026, 8, 1), status: "pending", metodo: "pix", pagoPor: null, cobrancaChave: "sessao:s8-1" }],
    });
    expect(linhas[0].tipo === "sessao" && linhas[0].cobranca?.situacao).toBe("em_aberto");
  });

  it("sessão desmarcada aparece sem código e sem cobrança", () => {
    const linhas = geral("sessao", [terca(1, 8, "cancelada")]);
    expect(linhas[0].tipo === "sessao" && linhas[0].cobranca).toBeFalsy();
  });
});

describe("devolutiva gratuita em 'a cada sessão' aparece como GRAT R$ 0,00", () => {
  it("rótulo GRAT, valor 0, sem botão de lançar", () => {
    const linhas = geral("sessao", [terca(1), { ...terca(3), id: "dev", sessionKind: "devolutiva", chargeable: false }]);
    expect(resumo(linhas)).toEqual(["AVUL 130", "GRAT 0"]);
    expect(linhas[1].tipo === "sessao" && linhas[1].cobranca).toBeNull();
  });
});

describe("o saldo único — o mesmo número nos cartões, no Financeiro e na Geral", () => {
  const entrada = (pagamentos: EntradaDaGeral["pagamentos"], extra: Partial<EntradaDaGeral> = {}): EntradaDaGeral => ({
    vigencias: [{ formato: "sessao", desde }],
    reserva: { formato: "sessao" },
    precos,
    sessoes: [terca(1), terca(8), terca(22)], // 22/09 é depois de hoje (15/09): a vencer
    pagamentos,
    hoje,
    ...extra,
  });
  const pg = (id: string, valor: number, dia: number, outros: Partial<EntradaDaGeral["pagamentos"][number]> = {}) =>
    ({ id, valor, data: new Date(2026, 8, dia), status: "paid", metodo: "pix", pagoPor: null, cobrancaChave: null, ...outros });

  it("sem pagamento: deve o que já é exigível, não o que ainda vai vencer", () => {
    const r = resumoDaGeral(entrada([]));
    expect(r.totalExigivel).toBe(260);
    expect(r.saldo).toBe(-260);
    expect(r.emAberto).toBe(260);
    expect(r.sessoesEmAberto).toBe(2);
  });

  it("pago tudo que venceu: saldo zero", () => {
    expect(resumoDaGeral(entrada([pg("a", 260, 9)])).saldo).toBe(0);
  });

  it("pagamento adiantado da sessão futura: a cobrança dela passa a contar, e o saldo não vira crédito falso", () => {
    const r = resumoDaGeral(entrada([pg("a", 260, 9), pg("b", 130, 10, { cobrancaChave: "sessao:s8-22" })]));
    expect(r.saldo).toBe(0);
  });

  it("dinheiro a mais quita até a futura (a Geral a mostra paga) e o resto vira crédito", () => {
    // R$ 400 sem chave: 01/09, 08/09 e a de 22/09, adiantada. Sobram R$ 10.
    expect(resumoDaGeral(entrada([pg("a", 400, 9)])).saldo).toBe(10);
    expect(resumoDaGeral(entrada([pg("a", 400, 9)], { sessoes: [terca(1)] })).saldo).toBe(270);
  });

  it("pagamento pendente não conta", () => {
    expect(resumoDaGeral(entrada([pg("a", 260, 9, { status: "pending" })])).saldo).toBe(-260);
  });

  it("gratuito sem pagamento: saldo zero (nada é cobrado)", () => {
    const r = resumoDaGeral(entrada([], { vigencias: [{ formato: "gratuito", desde }], reserva: { formato: "gratuito" } }));
    expect(r.saldo).toBe(0);
    expect(r.extrato).toEqual([]);
  });

  it("o extrato termina no saldo, do mais recente para o mais antigo", () => {
    const r = resumoDaGeral(entrada([pg("a", 400, 9)]));
    // 22/09 (adiantada) é a mais recente; depois o pagamento de 09/09; depois 08 e 01/09.
    expect(r.extrato.map((x) => x.valor)).toEqual([-130, 400, -130, -130]);
    expect(r.extrato.map((x) => x.saldo)).toEqual([10, 140, -260, -130]);
    expect(r.extrato[1].pagamentoId).toBe("a");
  });
});

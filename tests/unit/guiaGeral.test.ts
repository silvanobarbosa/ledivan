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

  it("fragmentado por MÊS: setembro com 3 é 1/3..3/3, outubro com 4 é 1/4..4/4 (dono 16/09)", () => {
    // Fragmentado deriva do calendário: setembro tem 3 sessões, outubro tem 4. Os meses não se juntam.
    const s = [terca(1), terca(8), terca(15), terca(6, 9), terca(13, 9), terca(20, 9), terca(27, 9)];
    expect(resumo(geral("mensal", s, { tamanhos: [3, 4] }))).toEqual(["P 390", "1/3", "2/3", "3/3", "P 520", "1/4", "2/4", "3/4", "4/4"]);
  });

  it("a linha de pagamento não tem data enquanto não é paga", () => {
    const [p] = geral("mensal", [terca(1), terca(8), terca(15), terca(22)]);
    expect(p.tipo === "pagamento" && p.pagamento).toBeNull();
  });
});

describe("quinzenal", () => {
  /**
   * Documento de 17/09: a quinzena é do CALENDÁRIO (01-15 e 16-fim) e cobra o que caiu nela.
   *
   * Até 16/09 estes dois casos eram "duas linhas de R$ 260" e "R$ 195 + R$ 195": o pacote era
   * partido ao meio em valor, sem olhar data. O dono desfez isso com todas as letras — *"não pode
   * simplesmente dividir o valor por 2"*.
   */
  it("cada pagamento vem antes das sessões dele — o pacote de quatro parte em 2 + 2", () => {
    // Documento de 18/09: no pacote COMPLETO a divisao e por contagem, nao por quinzena de
    // calendario. Ate entao este caso dava "P 390" e "P 130", com tres sessoes num pagamento so.
    expect(resumo(geral("quinzenal", [terca(1), terca(8), terca(15), terca(22)]))).toEqual(["P 260", "1/4", "2/4", "P 260", "3/4", "4/4"]);
  });

  it("mês inteiro na primeira quinzena: uma cobrança só", () => {
    // Quinzena sem atendimento não vira linha — uma de R$ 0,00 apareceria como "Pago" sem
    // ninguém ter pago.
    expect(resumo(geral("quinzenal", [terca(1), terca(8), terca(15)], { tamanhos: [3] }))).toEqual(["P 390", "1/3", "2/3", "3/3"]);
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
    // 3ª sequência vence 05/10 (depois de hoje, 15/09): ainda no prazo, em aberto. A 2ª vence 05/09
    // (dia 5 do mês de início) — já passou: em atraso.
    expect(futura[2].tipo === "pagamento" && futura[2].situacao).toBe("em_aberto");
    expect(futura[1].tipo === "pagamento" && futura[1].situacao).toBe("em_atraso");
  });

  it("pagamento com a chave da cobrança: pago, com data, responsável e forma", () => {
    const linhas = linhasDaGeral({
      vigencias: [{ formato: "mensal", pacoteTipo: "completo", desde }], reserva: { formato: "mensal" }, precos,
      sessoes: seq, hoje,
      pagamentos: [{ id: "pg1", valor: 520, data: new Date(2026, 8, 3), status: "paid", metodo: "pix", pagoPor: "Mãe", cobrancaChave: "pacote:inicio:1" }],
    });
    const [primeiro, p] = linhas.filter((l) => l.tipo === "pagamento");
    // A chave manda: o pagamento é da SEGUNDA sequência, e a primeira segue sem pagar — e como já
    // venceu (hoje é 15/09), está em atraso. Sem a chave o teste passava pela distribuição por
    // vencimento, e não provava o casamento pela chave.
    expect(primeiro.tipo === "pagamento" && primeiro.situacao).toBe("em_atraso");
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
    // 01 e 08 quitados pela ordem; a de 15/09 segue sem pagar e já passou da hora: em atraso.
    expect(sit).toEqual(["pago", "pago", "em_atraso"]);
  });

  it("pagamento pendente não quita nada", () => {
    const linhas = linhasDaGeral({
      vigencias: [{ formato: "sessao", desde }], reserva: { formato: "sessao" }, precos,
      sessoes: [terca(1)], hoje,
      pagamentos: [{ id: "p", valor: 130, data: new Date(2026, 8, 1), status: "pending", metodo: "pix", pagoPor: null, cobrancaChave: "sessao:s8-1" }],
    });
    expect(linhas[0].tipo === "sessao" && linhas[0].cobranca?.situacao).toBe("em_atraso");
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

describe("quantas sessões estão em aberto no quinzenal", () => {
  /**
   * As DUAS quinzenas contam (17/09).
   *
   * Enquanto cada quinzena cobrava metade do pacote, as duas diziam o total inteiro e somar
   * dobrava — por isso a conta descartava a parte 2. Agora cada uma carrega as que caíram nela, e
   * descartar a segunda subcontaria: aqui dariam 2 em vez de 5.
   */
  it("soma as sessões das duas quinzenas, não só as da primeira", () => {
    const r = resumoDaGeral({
      vigencias: [{ formato: "quinzenal", pacoteTipo: "fragmentado", desde }],
      reserva: { formato: "quinzenal", pacoteTipo: "fragmentado" },
      precos,
      sessoes: [terca(2), terca(9), terca(16), terca(23), terca(30)],
      pagamentos: [],
      hoje: new Date(2026, 9, 1, 12),
    });
    expect(r.sessoesEmAtraso + r.sessoesEmAberto).toBe(5);
    expect(r.totalExigivel).toBe(5 * 130);
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
    // 01 e 08/09 já venceram (em atraso); 22/09 ainda está no prazo (em aberto).
    expect(r.emAtraso).toBe(260);
    expect(r.sessoesEmAtraso).toBe(2);
    expect(r.nAtraso).toBe(2);
    expect(r.emAberto).toBe(130);
    expect(r.nAberto).toBe(1);
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

describe("cobrança enviada (avisada ao paciente)", () => {
  const sess = [terca(1), terca(8), terca(15), terca(22)];
  const chaveDoPagamento = (linhas: LinhaDaGeral[]) => (linhas[0].tipo === "pagamento" ? linhas[0].chave : "");

  it("sem envios, a cobrança não tem marca", () => {
    const [p] = geral("mensal", sess);
    expect(p.tipo === "pagamento" && p.envio).toBeNull();
  });

  it("marca a cobrança cuja chave casa, com quem enviou", () => {
    const chave = chaveDoPagamento(geral("mensal", sess));
    const [p] = geral("mensal", sess, { envios: [{ cobrancaChave: chave, enviadaEm: new Date(2026, 8, 10), enviadaPor: "Gisele" }] });
    expect(p.tipo === "pagamento" && p.envio?.por).toBe("Gisele");
    expect(p.tipo === "pagamento" && p.envio?.data.getTime()).toBe(new Date(2026, 8, 10).getTime());
  });

  it("na cobrança de cada sessão, a marca fica na linha da sessão", () => {
    const linhas0 = geral("sessao", [terca(1)]);
    const chave = linhas0[0].tipo === "sessao" ? linhas0[0].cobranca!.chave : "";
    const [l] = geral("sessao", [terca(1)], { envios: [{ cobrancaChave: chave, enviadaEm: new Date(2026, 8, 2), enviadaPor: "Gisele" }] });
    expect(l.tipo === "sessao" && l.cobranca?.envio?.por).toBe("Gisele");
  });

  it("reenvio: fica com a data mais recente", () => {
    const chave = chaveDoPagamento(geral("mensal", sess));
    const [p] = geral("mensal", sess, {
      envios: [
        { cobrancaChave: chave, enviadaEm: new Date(2026, 8, 10), enviadaPor: "Gisele" },
        { cobrancaChave: chave, enviadaEm: new Date(2026, 8, 14), enviadaPor: "Gisele" },
      ],
    });
    expect(p.tipo === "pagamento" && p.envio?.data.getTime()).toBe(new Date(2026, 8, 14).getTime());
  });

  it("envio de uma chave que não existe é ignorado", () => {
    const linhas = geral("mensal", sess, { envios: [{ cobrancaChave: "nao-existe", enviadaEm: new Date(2026, 8, 10), enviadaPor: "x" }] });
    expect(linhas.every((l) => (l.tipo === "pagamento" ? !l.envio : !l.cobranca?.envio))).toBe(true);
  });
});

describe("em aberto × em atraso (dono, 16/09/2026)", () => {
  const umAvulso = (hojeD: Date, horasAntes?: number | null) =>
    linhasDaGeral({
      vigencias: [{ formato: "sessao", desde }], reserva: { formato: "sessao" }, precos,
      sessoes: [{ id: "s1", date: new Date(2026, 8, 10, 9, 0), status: "realizada" }],
      pagamentos: [], hoje: hojeD, horasAntesPagamento: horasAntes,
    })[0];

  it("avulso vence na hora da sessão quando não há prazo (0h antes)", () => {
    const antes = umAvulso(new Date(2026, 8, 10, 8, 0));
    const depois = umAvulso(new Date(2026, 8, 10, 10, 0));
    expect(antes.tipo === "sessao" && antes.cobranca?.situacao).toBe("em_aberto");
    expect(depois.tipo === "sessao" && depois.cobranca?.situacao).toBe("em_atraso");
  });

  it("avulso com prazo de 24h antes: vence no dia anterior", () => {
    // Sessão 10/09 09:00; 24h antes = 09/09 09:00.
    const noPrazo = umAvulso(new Date(2026, 8, 9, 8, 0), 24);
    const vencido = umAvulso(new Date(2026, 8, 9, 10, 0), 24);
    expect(noPrazo.tipo === "sessao" && noPrazo.cobranca?.situacao).toBe("em_aberto");
    expect(vencido.tipo === "sessao" && vencido.cobranca?.situacao).toBe("em_atraso");
  });

  const mensal = (hojeD: Date) =>
    linhasDaGeral({
      vigencias: [{ formato: "mensal", pacoteTipo: "completo", desde }], reserva: { formato: "mensal" }, precos,
      sessoes: [terca(1), terca(8), terca(15), terca(22)], pagamentos: [], hoje: hojeD, diaPagamento: 5,
    }).find((l) => l.tipo === "pagamento");

  it("mensal vale o dia inteiro do vencimento — atraso só no dia seguinte", () => {
    // Vence dia 05/09.
    const noDia = mensal(new Date(2026, 8, 5, 23, 0));
    const depois = mensal(new Date(2026, 8, 6, 1, 0));
    expect(noDia?.tipo === "pagamento" && noDia.situacao).toBe("em_aberto");
    expect(depois?.tipo === "pagamento" && depois.situacao).toBe("em_atraso");
  });

  it("os contadores separam em aberto de em atraso", () => {
    const r = resumoDaGeral({
      vigencias: [{ formato: "sessao", desde }], reserva: { formato: "sessao" }, precos,
      sessoes: [terca(1), terca(8), terca(22)], pagamentos: [], hoje,
    });
    expect(r.nAtraso).toBe(2);   // 01 e 08/09
    expect(r.nAberto).toBe(1);   // 22/09
    expect(r.emAtraso).toBe(260);
    expect(r.emAberto).toBe(130);
  });
});

describe("o histórico de avisos de cobrança (documento de 17/09)", () => {
  /**
   * O botão "Marcar enviada" saiu: cada clique em "Cobrar" registra um aviso, e o documento pede
   * que os registros anteriores NÃO sejam substituídos — "primeiro clique: enviada em 05/10;
   * segundo: 08/10; terceiro: 12/10". Sem o histórico, não dá para saber se o paciente está sendo
   * lembrado ou ignorado.
   */
  const s1 = terca(1, 8);
  const out = (d: number) => new Date(2026, 9, d, 12);
  const envioDa = (linhas: LinhaDaGeral[]) =>
    linhas.flatMap((l) => (l.tipo === "sessao" ? [l.cobranca?.envio] : [l.envio])).find(Boolean);

  it("guarda todos os avisos, do mais recente para o mais antigo", () => {
    const linhas = geral("a_cada_sessao", [s1], {
      envios: [
        { cobrancaChave: `sessao:${s1.id}`, enviadaEm: out(5) },
        { cobrancaChave: `sessao:${s1.id}`, enviadaEm: out(12) },
        { cobrancaChave: `sessao:${s1.id}`, enviadaEm: out(8) },
      ],
    });
    const envio = envioDa(linhas);
    expect(envio?.total).toBe(3);
    expect(envio?.data.getDate()).toBe(12);
    expect(envio?.datas.map((d) => d.getDate())).toEqual([12, 8, 5]);
  });

  it("um aviso só continua sendo um aviso", () => {
    const linhas = geral("a_cada_sessao", [s1], {
      envios: [{ cobrancaChave: `sessao:${s1.id}`, enviadaEm: out(5) }],
    });
    expect(envioDa(linhas)?.total).toBe(1);
    expect(envioDa(linhas)?.datas).toHaveLength(1);
  });
});

describe("GRAT mostra R$ 0,00 sempre (documento de 17/09)", () => {
  /**
   * "No caso de sessão GRAT, o valor sempre deve aparecer R$ 0,00 independente do status."
   *
   * A célula ficava VAZIA quando a sessão gratuita tinha status que pausa (Desmarcou, Atestado,
   * Prof. desm.). Vazio e "R$ 0,00" não dizem a mesma coisa: vazio parece dado faltando, e numa
   * tabela de dinheiro isso vira dúvida sobre se aquela sessão foi cobrada.
   */
  const paraStatus = (status: string) =>
    geral("gratuito", [{ id: `g-${status}`, date: new Date(2026, 8, 1, 9), status }]);

  it("gratuito presente continua zero", () => {
    const linha = paraStatus("realizada").find((l) => l.tipo === "sessao");
    expect(linha?.valor).toBe(0);
  });

  for (const status of ["cancelada", "atestado", "profissional_cancelou"]) {
    it(`gratuito com status "${status}" também mostra zero, não vazio`, () => {
      const linha = paraStatus(status).find((l) => l.tipo === "sessao");
      expect(linha?.valor).toBe(0);
    });
  }
});

describe("em aberto: mês vigente e anteriores, nunca o futuro (documento de 17/09)", () => {
  /**
   * "Considerar em aberto apenas as que estão dentro do mês vigente e as anteriores não pagas."
   *
   * Sessão agendada para dezembro entrava no "Em aberto" de setembro e inflava o número que a
   * terapeuta usa para saber quanto tem a receber AGORA — dinheiro que ainda nem podia ser cobrado.
   */
  const emSetembro = { id: "set", date: new Date(2026, 8, 10, 9), status: "realizada" };
  const emDezembro = { id: "dez", date: new Date(2026, 11, 10, 9), status: "agendada" };

  it("a sessão de dezembro não entra no em aberto de setembro", () => {
    const so = resumoDaGeral({
      vigencias: [{ formato: "a_cada_sessao", pacoteTipo: "completo", desde }],
      reserva: { formato: "a_cada_sessao" },
      precos, sessoes: [emSetembro], pagamentos: [], hoje,
    });
    const com = resumoDaGeral({
      vigencias: [{ formato: "a_cada_sessao", pacoteTipo: "completo", desde }],
      reserva: { formato: "a_cada_sessao" },
      precos, sessoes: [emSetembro, emDezembro], pagamentos: [], hoje,
    });
    expect(com.emAberto).toBe(so.emAberto);
    expect(com.nAberto).toBe(so.nAberto);
  });

  it("o que venceu e não foi pago continua em atraso, como antes", () => {
    const r = resumoDaGeral({
      vigencias: [{ formato: "a_cada_sessao", pacoteTipo: "completo", desde }],
      reserva: { formato: "a_cada_sessao" },
      precos,
      sessoes: [{ id: "ago", date: new Date(2026, 7, 10, 9), status: "realizada" }],
      pagamentos: [], hoje,
    });
    expect(r.emAtraso).toBeGreaterThan(0);
  });
});

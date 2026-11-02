import { describe, it, expect } from "vitest";
import { ehAlteracaoDeCampo, vencimentoDoPreco, vigenciaDoReajuste } from "@/lib/reajuste";
import { excedenteSemCreditoAte, linhaDoFechamento, resumoDoFechamento } from "@/lib/fechamento";

/**
 * DOC 75 — vigência do reajuste, histórico sem registro inútil, e o que é "pagou a mais".
 *
 * Os três itens que mexem em regra (3/4, 5 e 7). Os outros quatro são de tela — a janela que
 * cortava, a pergunta de exclusão sem próximos e o formato pré-marcado — e vivem no percurso
 * `scripts/e2e-doc75.mjs`, que roda no app de verdade.
 */

describe("item 3/4 — o prazo do reajuste corre da VIGÊNCIA, não da data empurrada", () => {
  it("empurrado para o próximo pacote, o prazo continua contando da data digitada", () => {
    // O caso da Patrícia, medido na base: ela digitou 01/10/2026 e o doc 73 empurrou a data efetiva
    // para 26/10 (início do próximo pacote). Contar de 26/10 dava 26/10/2027, e o dono pediu 01/10.
    const vigencia = vigenciaDoReajuste({ dataEfetiva: new Date(2026, 9, 26), vigenciaDeclarada: new Date(2026, 9, 1) });
    expect(vencimentoDoPreco(vigencia, null, 12)).toEqual(new Date(2027, 9, 1));
  });

  it("sem empurrão, a vigência é a própria data efetiva", () => {
    expect(vigenciaDoReajuste({ dataEfetiva: new Date(2026, 2, 23), vigenciaDeclarada: null }))
      .toEqual(new Date(2026, 2, 23));
    expect(vigenciaDoReajuste({ dataEfetiva: new Date(2026, 2, 23) })).toEqual(new Date(2026, 2, 23));
  });

  it("lê data gravada como texto (é assim que ela chega de uma requisição)", () => {
    expect(vigenciaDoReajuste({ dataEfetiva: "2026-09-16T00:00:00", vigenciaDeclarada: "2026-09-01T00:00:00" }))
      .toEqual(new Date("2026-09-01T00:00:00"));
  });

  it("registro sem data nenhuma não inventa prazo", () => {
    expect(vigenciaDoReajuste(null)).toBeNull();
    expect(vigenciaDoReajuste({ dataEfetiva: null })).toBeNull();
    expect(vigenciaDoReajuste({ dataEfetiva: "não é data" })).toBeNull();
  });

  it("as três datas do doc 75, da vigência que o dono declarou", () => {
    const prazo = (iso: string) => vencimentoDoPreco(new Date(`${iso}T00:00:00`), null, 12);
    expect(prazo("2026-10-01")).toEqual(new Date(2027, 9, 1));  // Patrícia
    expect(prazo("2026-09-01")).toEqual(new Date(2027, 8, 1));  // Thayná
    expect(prazo("2026-03-01")).toEqual(new Date(2027, 2, 1));  // Celani
  });
});

describe("item 5 — campo que sai do vazio foi PREENCHIDO, não alterado", () => {
  it("o nada virar alguma coisa não é alteração: era 202 das 219 linhas da base", () => {
    expect(ehAlteracaoDeCampo({ de: null, para: "12" })).toBe(false);
    expect(ehAlteracaoDeCampo({ de: "", para: "completo" })).toBe(false);
    expect(ehAlteracaoDeCampo({ de: undefined, para: "4" })).toBe(false);
  });

  it("trocar um valor por outro é alteração", () => {
    expect(ehAlteracaoDeCampo({ de: "4", para: "2" })).toBe(true);
    expect(ehAlteracaoDeCampo({ de: "completo", para: "fragmentado" })).toBe(true);
  });

  it("LIMPAR um campo é alteração — havia valor e deixou de haver", () => {
    expect(ehAlteracaoDeCampo({ de: "12", para: null })).toBe(true);
    expect(ehAlteracaoDeCampo({ de: "12", para: "" })).toBe(true);
  });

  it("valor igual não vira registro (é o que evita duplicar campo intocado)", () => {
    expect(ehAlteracaoDeCampo({ de: "4", para: "4" })).toBe(false);
    expect(ehAlteracaoDeCampo({ de: null, para: null })).toBe(false);
  });

  it("preencher o Financeiro pela 1a vez nao produz quatro alteracoes na mesma vigencia", () => {
    const naPrimeiraVez = [
      { campo: "pacote", de: null, para: "completo" },
      { campo: "sessoes", de: null, para: "4" },
      { campo: "reajuste", de: null, para: "12" },
      { campo: "vencimento", de: null, para: "1" },
    ];
    expect(naPrimeiraVez.filter(ehAlteracaoDeCampo)).toEqual([]);
  });

  it("mexer em UM campo grava UM registro, e nao repete os intocados", () => {
    const umSoCampo = [
      { campo: "vencimento", de: "10", para: "15" },
      { campo: "pacote", de: "completo", para: "completo" },
      { campo: "sessoes", de: "4", para: "4" },
    ];
    expect(umSoCampo.filter(ehAlteracaoDeCampo).map((m) => m.campo)).toEqual(["vencimento"]);
  });
});

describe("item 7 — pagou a mais e a sobra MARCADA, nao o saldo negativo", () => {
  const precos = [{ valor: 200, desde: new Date(2025, 0, 1) }];
  const sessao = (dia: number) => ({ id: `s-${dia}`, date: new Date(2026, 7, dia), status: "realizada" });
  /** Agosto de 2026: três sessões a R$ 200 = R$ 600 no mês. */
  const linha = (pagamentos: Parameters<typeof linhaDoFechamento>[0]["pagamentos"]) =>
    linhaDoFechamento({
      paciente: { id: "p1", nome: "Ana", formato: "mensal", pacoteTipo: "fragmentado" },
      sessoes: [sessao(5), sessao(12), sessao(19)],
      precos, pagamentos, tamanhos: [3], ano: 2026, mes: 7,
    });

  const pago = (valor: number, dia: number, excedenteSemCredito?: number) => ({
    pacienteId: "p1", valor, data: new Date(2026, 7, dia), status: "paid", metodo: "pix",
    ...(excedenteSemCredito == null ? {} : { excedenteSemCredito }),
  });

  it("sobra marcada: pagou a mais, pelo valor da sobra — o caso da Paula e da Roberta", () => {
    const l = linha([pago(615, 20, 15)]);
    expect(l.excedenteSemCredito).toBe(15);
    expect(l.situacao).toBe("pago_a_mais");
  });

  it("pagou adiantado e o saldo ficou negativo, SEM sobra marcada: esta quitado", () => {
    // É o grupo que o dono mandou sair da coluna: "não significa que foi pago um valor a mais,
    // apenas foi pago várias vezes dentro do mês, cada pagamento referente a um pacote diferente".
    const l = linha([pago(600, 10), pago(940, 20)]);
    expect(l.saldo).toBeLessThan(0);
    expect(l.excedenteSemCredito).toBe(0);
    expect(l.situacao).toBe("pago");
  });

  it("quem deve continua devendo — a marca nao mexe em a receber", () => {
    const l = linha([pago(200, 10)]);
    expect(l.situacao).toBe("a_receber");
    expect(l.saldo).toBe(400);
  });

  it("deve E tem sobra marcada de um pacote anterior: a divida manda", () => {
    // Ordem deliberada: dinheiro em falta é o que a terapeuta precisa ver primeiro.
    const l = linha([pago(100, 10, 15)]);
    expect(l.situacao).toBe("a_receber");
  });

  it("a sobra acumula ATE o mes — mes seguinte ainda a ve, mes anterior nao", () => {
    const pagamentos = [pago(615, 20, 15)];
    expect(excedenteSemCreditoAte(pagamentos, "p1", 2026, 7)).toBe(15);
    expect(excedenteSemCreditoAte(pagamentos, "p1", 2026, 8)).toBe(15);
    expect(excedenteSemCreditoAte(pagamentos, "p1", 2026, 6)).toBe(0);
  });

  it("duas sobras somam; sobra de outro paciente nao entra", () => {
    const pagamentos = [pago(615, 10, 15), pago(630, 20, 30), { ...pago(900, 20, 500), pacienteId: "p2" }];
    expect(excedenteSemCreditoAte(pagamentos, "p1", 2026, 7)).toBe(45);
  });

  it("pagamento nao quitado nao conta sobra nenhuma", () => {
    const pagamentos = [{ ...pago(615, 20, 15), status: "pending" }];
    expect(excedenteSemCreditoAte(pagamentos, "p1", 2026, 7)).toBe(0);
  });

  it("sobra zero ou negativa nao e sobra", () => {
    expect(excedenteSemCreditoAte([pago(600, 20, 0)], "p1", 2026, 7)).toBe(0);
    expect(excedenteSemCreditoAte([pago(600, 20, -10)], "p1", 2026, 7)).toBe(0);
  });

  it("o contador do alto da tela acompanha a mesma regra", () => {
    const comSobra = linha([pago(615, 20, 15)]);
    const adiantado = linha([pago(600, 10), pago(940, 20)]);
    expect(resumoDoFechamento([comSobra, adiantado]).pacientesComCredito).toBe(1);
  });
});

import { describe, it, expect } from "vitest";
import { inicioDoProximoPacoteElegivel, vigenciaDoProximoPacote } from "@/lib/pacoteIntocado";
import { linhasDaGeral, type EntradaDaGeral, type LinhaDaGeral } from "@/lib/guiaGeral";

/**
 * Doc 74 — a regra de aplicação do reajuste em pacotes, com os EXEMPLOS do próprio documento.
 *
 * Quase tudo aqui o motor já fazia (docs 69, 72 e 73); estes testes existem para travar os
 * números do dono contra uma regressão futura. O que o documento MUDOU é a identificação do
 * "próximo pacote": pela data de INÍCIO, e o que desqualifica é PAGAMENTO lançado — não status,
 * como o doc 73 tinha lido.
 */

const desde = new Date(2026, 0, 1);
const sessao = (id: string, dia: number, mes: number) => ({ id, date: new Date(2026, mes, dia, 9), status: "realizada" });
/** Pacote A: 18/08, 27/08, 03/09, 10/09. Pacote B: 17/09, 24/09, 01/10, 08/10. */
const SESSOES = [
  sessao("a1", 18, 7), sessao("a2", 27, 7), sessao("a3", 3, 8), sessao("a4", 10, 8),
  sessao("b1", 17, 8), sessao("b2", 24, 8), sessao("b3", 1, 9), sessao("b4", 8, 9),
];
const SESSENTA_E_CINCO = [{ valor: 65, desde }];

function pacotes(precos: EntradaDaGeral["precos"], pagamentos: EntradaDaGeral["pagamentos"] = []): LinhaDaGeral[] {
  return linhasDaGeral({
    vigencias: [{ formato: "mensal", pacoteTipo: "completo", desde }],
    reserva: { formato: "mensal" },
    precos, sessoes: SESSOES, pagamentos,
    tamanhoPacote: 4,
    hoje: new Date(2026, 10, 1, 12),
  }).filter((l) => l.tipo === "pagamento");
}
const valores = (ls: LinhaDaGeral[]) => ls.map((l) => (l.tipo === "pagamento" ? l.valor : 0));

describe("doc 74 — os números dos exemplos do dono", () => {
  it("antes de qualquer reajuste: dois pacotes de R$ 260", () => {
    expect(valores(pacotes(SESSENTA_E_CINCO))).toEqual([260, 260]);
  });

  it("opção 1 (pacote em andamento, vigência 01/09): R$ 270 e R$ 280", () => {
    // 65 + 65 + 70 + 70 = 270 no pacote partido; o seguinte inteiro a 70 = 280.
    const precos = [...SESSENTA_E_CINCO, { valor: 70, desde: new Date(2026, 8, 1), aplicaEm: "vigente", criadoEm: new Date(2026, 9, 1) }];
    expect(valores(pacotes(precos))).toEqual([270, 280]);
  });

  it("opção 2 (próximo pacote, vigência 05/09): R$ 260 e R$ 280", () => {
    // O pacote começado em 18/08 fica INTEIRO no valor antigo, mesmo tendo sessões em setembro.
    const precos = [...SESSENTA_E_CINCO, { valor: 70, desde: new Date(2026, 8, 5), aplicaEm: "proximo_pacote", criadoEm: new Date(2026, 9, 1) }];
    expect(valores(pacotes(precos))).toEqual([260, 280]);
  });

  it("pacote já pago e reajustado: o pago fica, e a diferença aparece EM ABERTO", () => {
    const precos = [...SESSENTA_E_CINCO, { valor: 70, desde: new Date(2026, 8, 1), aplicaEm: "vigente", criadoEm: new Date(2026, 9, 1) }];
    const pagou = [{
      id: "pg", valor: 260, data: new Date(2026, 7, 15), metodo: "pix", pagoPor: "Ellen",
      cobrancaChave: "pacote:inicio:0", status: "paid" as const,
    }];
    const [primeiro] = pacotes(precos, pagou);
    expect(primeiro.tipo === "pagamento" && primeiro.valor).toBe(270);
    expect(primeiro.tipo === "pagamento" && primeiro.valorPago).toBe(260);
    expect(primeiro.tipo === "pagamento" && primeiro.falta).toBe(10); // o exemplo do documento
    // "sem gerar automaticamente uma nova cobrança": continuam dois pacotes, não três.
    expect(pacotes(precos, pagou)).toHaveLength(2);
  });
});

describe("doc 74 — qual pacote recebe o reajuste", () => {
  const p = (sequencia: number, dia: number, mes: number, temPagamento = false) =>
    ({ sequencia, inicio: new Date(2026, mes, dia), temPagamento });

  it("pacote que COMEÇOU antes da vigência não é candidato, mesmo com sessões depois", () => {
    // O caso do documento: o pacote de 18/08 tem sessões em setembro e mesmo assim fica de fora.
    const lista = [p(0, 18, 7), p(1, 17, 8)];
    expect(inicioDoProximoPacoteElegivel(lista, new Date(2026, 8, 5))).toEqual(new Date(2026, 8, 17));
  });

  it("pacote com PAGAMENTO lançado é pulado — vai para o seguinte", () => {
    const lista = [p(0, 17, 8, true), p(1, 15, 9)];
    expect(inicioDoProximoPacoteElegivel(lista, new Date(2026, 8, 5))).toEqual(new Date(2026, 9, 15));
  });

  it("status não desqualifica: sessões realizadas sem dinheiro lançado ainda recebem", () => {
    // É aqui que o doc 74 supera o doc 73. Quem decide é o PAGAMENTO.
    const lista = [p(0, 17, 8)];
    expect(inicioDoProximoPacoteElegivel(lista, new Date(2026, 8, 5))).toEqual(new Date(2026, 8, 17));
  });

  it("nenhum candidato: a agenda ainda não tem o próximo, ou todos já foram pagos", () => {
    expect(inicioDoProximoPacoteElegivel([p(0, 18, 7)], new Date(2026, 8, 5))).toBeNull();
    expect(inicioDoProximoPacoteElegivel([p(0, 17, 8, true)], new Date(2026, 8, 5))).toBeNull();
    expect(inicioDoProximoPacoteElegivel([], new Date(2026, 8, 5))).toBeNull();
  });

  it("entre dois elegíveis vale o de menor sequência — 'o próximo' é o próximo mesmo", () => {
    const lista = [p(2, 15, 9), p(1, 17, 8)];
    expect(inicioDoProximoPacoteElegivel(lista, new Date(2026, 8, 5))).toEqual(new Date(2026, 8, 17));
  });

  it("a vigência é EMPURRADA para o início do pacote elegível, nunca puxada para trás", () => {
    const lista = [p(0, 18, 7), p(1, 17, 8)];
    expect(vigenciaDoProximoPacote(new Date(2026, 8, 5), lista)).toEqual(new Date(2026, 8, 17));
    const laNaFrente = new Date(2026, 11, 1);
    expect(vigenciaDoProximoPacote(laNaFrente, lista)).toEqual(laNaFrente);
  });

  it("sem pacote elegível, fica a data escolhida", () => {
    const escolhida = new Date(2026, 8, 5);
    expect(vigenciaDoProximoPacote(escolhida, [p(0, 18, 7)])).toEqual(escolhida);
  });

  it("pacote que começa NO DIA da vigência é elegível", () => {
    expect(inicioDoProximoPacoteElegivel([p(0, 5, 8)], new Date(2026, 8, 5))).toEqual(new Date(2026, 8, 5));
  });
});

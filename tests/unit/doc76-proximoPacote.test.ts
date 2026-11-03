import { describe, it, expect } from "vitest";
import { vigenciaDoProximoPacote } from "@/lib/pacoteIntocado";
import { todasAsSequencias } from "@/lib/sequenciaPacote";
import { linhasDaGeral, type LinhaDaGeral } from "@/lib/guiaGeral";

/**
 * O CASO DO BRUNO (doc 76, paciente da Gisele).
 *
 * Ela pediu, com estas palavras: valor 110, pacote de 2, vigência a partir de 01/11/2025, **do
 * PRÓXIMO pacote a iniciar**, que seria o de 27/11/2025. O sistema aplicou no pacote EM
 * ANDAMENTO: partiu a sequência de 4 ao alcançar 01/11 e criou um pacote de 2 começando em
 * 06/11, cobrado R$ 220.
 *
 * Duas causas, e elas são independentes:
 *
 * 1. A vigência empurrada só olhava pacotes que JÁ EXISTEM na agenda. O pacote de 27/11 ainda não
 *    estava marcado, então não havia "próximo elegível", e a regra devolvia a data escolhida
 *    (01/11) — que cai DENTRO do pacote em curso. O comentário dizia que isso era "a mesma
 *    promessa"; não é, porque o pacote em curso tem sessões depois de 01/11 e é partido por elas.
 * 2. O TAMANHO do pacote nunca passou por essa regra. Só o preço era empurrado; o tamanho usava a
 *    data digitada crua. Mesmo com o preço certo, o 4→2 partia a sequência sozinho.
 */

const sessao = (id: string, iso: string) => ({ id, date: new Date(`${iso}T19:00:00`), status: "agendada" });

/** O pacote em curso do Bruno: quatro quintas, de 16/10 a 14/11. */
const EM_CURSO = [
  sessao("s1", "2025-10-16"), sessao("s2", "2025-10-23"),
  sessao("s3", "2025-10-30"), sessao("s4", "2025-11-06"),
  sessao("s5", "2025-11-14"),
];
/** O próximo, que ela espera que receba o valor novo. */
const PROXIMO = [sessao("s6", "2025-11-27"), sessao("s7", "2025-12-04")];

const PACOTE_EM_CURSO = {
  sequencia: 0,
  inicio: new Date("2025-10-16T19:00:00"),
  fim: new Date("2025-11-14T19:00:00"),
  temPagamento: false,
};

describe("doc 76 — 'próximo pacote' não pode partir o pacote em andamento", () => {
  const escolhida = new Date("2025-11-01T00:00:00");

  it("sem pacote futuro agendado, a vigência vai para DEPOIS do pacote em curso", () => {
    // Era aqui que o sistema devolvia 01/11 e partia a sequência em 06/11.
    const v = vigenciaDoProximoPacote(escolhida, [PACOTE_EM_CURSO]);
    expect(v.getTime()).toBeGreaterThan(new Date("2025-11-14T23:59:59").getTime());
  });

  it("a data empurrada deixa o pacote de 27/11 receber o valor novo", () => {
    const v = vigenciaDoProximoPacote(escolhida, [PACOTE_EM_CURSO]);
    expect(v.getTime()).toBeLessThanOrEqual(new Date("2025-11-27T00:00:00").getTime());
  });

  it("com o próximo pacote JÁ agendado, continua indo para o início dele", () => {
    const v = vigenciaDoProximoPacote(escolhida, [
      PACOTE_EM_CURSO,
      { sequencia: 1, inicio: new Date("2025-11-27T19:00:00"), fim: new Date("2025-12-04T19:00:00"), temPagamento: false },
    ]);
    expect(v.toISOString().slice(0, 10)).toBe("2025-11-27");
  });

  it("pacote em curso COM pagamento também é preservado inteiro", () => {
    const v = vigenciaDoProximoPacote(escolhida, [{ ...PACOTE_EM_CURSO, temPagamento: true }]);
    expect(v.getTime()).toBeGreaterThan(new Date("2025-11-14T23:59:59").getTime());
  });

  it("vigência ANTERIOR a tudo cai no início do primeiro pacote — regra do doc 74, intacta", () => {
    // Aqui o pacote de 16/10 É o próximo elegível: começa depois da vigência e não tem pagamento.
    // Empurrar para 16/10 é o certo, e o conserto do doc 76 não pode mexer nisso.
    const v = vigenciaDoProximoPacote(new Date("2025-10-01T00:00:00"), [PACOTE_EM_CURSO]);
    expect(v.toISOString().slice(0, 10)).toBe("2025-10-16");
  });
});

describe("doc 76 — o tamanho novo não parte a sequência em curso", () => {
  const todas = EM_CURSO.concat(PROXIMO);

  it("com a vigência EMPURRADA (15/11), o pacote em curso fecha com as 4 sessões", () => {
    const seqs = todasAsSequencias(todas, {
      pacoteTipo: "completo", tamanhos: [], tamanhoPacote: 4, vezesPorSemana: 1,
      tamanhosPorData: [{ desde: new Date("2025-11-15T00:00:00"), tamanho: 2 }],
    });
    // A sequência que contém 16/10 tem de ter as quatro cobráveis, não duas.
    expect(seqs[0].ids.length).toBe(4);
  });

  it("e é esse corte que a vigência CRUA (01/11) errava — vira um toco", () => {
    const seqs = todasAsSequencias(todas, {
      pacoteTipo: "completo", tamanhos: [], tamanhoPacote: 4, vezesPorSemana: 1,
      tamanhosPorData: [{ desde: new Date("2025-11-01T00:00:00"), tamanho: 2 }],
    });
    // Documenta o defeito: o primeiro pacote fecha com MENOS do que contratou.
    expect(seqs[0].ids.length).toBeLessThan(4);
  });
});


/**
 * O DINHEIRO do caso do Bruno — com os dados REAIS dele, lidos do banco.
 *
 * Paciente de Ana Raquel: início 14/08/2025, pacote completo de 4 a R$ 97,50, sessões semanais
 * até 14/11, com 16/10 marcada "Prof. desm.". Em 01/11 ela gravou valor 110, tamanho 2,
 * respondendo "próximo pacote a iniciar".
 *
 * O print mostra o resultado errado: o pacote em curso fechou com 3 linhas e nasceu um de 2
 * sessões (06/11 e 14/11) cobrado R$ 220. É o que o primeiro teste trava — para que o segundo
 * prove que a vigência empurrada devolve o pacote inteiro a R$ 390.
 */
describe("doc 76 — o dinheiro do Bruno, com os dados reais", () => {
  const inicio = new Date(2025, 7, 14);
  const DATAS = [
    "2025-08-14", "2025-08-19", "2025-08-28", "2025-09-04", "2025-09-11", "2025-09-18",
    "2025-09-25", "2025-10-02", "2025-10-09", "2025-10-16", "2025-10-23", "2025-10-30",
    "2025-11-06", "2025-11-14",
  ];
  const SESSOES = DATAS.map((d, i) => ({
    id: `s${i}`,
    date: new Date(`${d}T19:00:00`),
    // 16/10 foi desmarcada pela profissional: ocupa a linha, não consome o pacote.
    status: d === "2025-10-16" ? "prof_desmarcou" : "realizada",
  }));

  const cobrancas = (vigencia: Date): number[] =>
    linhasDaGeral({
      vigencias: [{ formato: "mensal", pacoteTipo: "completo", desde: inicio }],
      reserva: { formato: "mensal", pacoteTipo: "completo" },
      sessoes: SESSOES,
      precos: [
        { valor: 97.5, desde: inicio },
        { valor: 110, desde: vigencia, aplicaEm: "proximo_pacote", criadoEm: new Date(2025, 10, 1) },
      ],
      pagamentos: [],
      tamanhoPacote: 4,
      tamanhosPorData: [{ desde: vigencia, tamanho: 2 }],
      vezesPorSemana: 1,
      hoje: new Date(2025, 10, 20, 12),
    })
      .filter((l) => l.tipo === "pagamento")
      .map((l) => (l.tipo === "pagamento" ? l.valor : 0));

  it("com a vigência CRUA (01/11) o pacote em curso vira um toco de R$ 220 — o defeito do print", () => {
    expect(cobrancas(new Date(2025, 10, 1))).toEqual([390, 390, 390, 220]);
  });

  it("com a vigência EMPURRADA (15/11) ele cobra os R$ 390 contratados", () => {
    expect(cobrancas(new Date(2025, 10, 15))).toEqual([390, 390, 390, 390]);
  });
});

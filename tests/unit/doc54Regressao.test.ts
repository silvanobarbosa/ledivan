import { describe, expect, it } from "vitest";
import { cobrancasDoPaciente, type SessaoDaCobranca } from "@/lib/cobrancas";

/**
 * GUARDAS DAS REGRESSÕES QUE O SUPERQA DE 22/10 ENCONTROU.
 *
 * Ao fazer a falta não abatida PAUSAR em vez de sair do pacote (doc 54), ela passou a existir no
 * fluxo do motor — e, sem cuidado, passou a CONTAR nele: criava vaga no mês, puxava a data de
 * vencimento para si e entrava no valor da quinzena. Quatro formatos saíram com dinheiro ou mês
 * diferentes do que cobravam no dia anterior.
 *
 * A regra que ficou: a sessão pausada POR RESPOSTA (falta não abatida, cortesia) pertence ao grupo
 * de pagamento e exibe a posição onde parou, mas é invisível para CONTAR — não vira vaga, não data
 * a cobrança e não entra no valor. Desmarcou e Atestado, que pausam por STATUS, continuam como
 * sempre foram: são sessões contratadas, ocupam vaga e seguram o denominador.
 *
 * Cada caso aqui tem o número que o app cobrava ANTES do doc 54, e é esse número que ele deve
 * continuar cobrando.
 */

const FEE = 200;
const semana = (i: number) => new Date(2024, 7, 7 + i * 7, 11, 0);

const base = (formato: string, n: number, faltaEm: number, pacoteTipo = "completo") => ({
  vigencias: [],
  reserva: { formato, pacoteTipo },
  precos: [{ valor: FEE, desde: new Date(2024, 0, 1) }],
  valorDaSessao: FEE,
  tamanhos: [],
  tamanhoPacote: 4,
  vezesPorSemana: 1,
  diaPagamento: 10,
  diaPagamento2: 20,
  sessoes: Array.from({ length: n }, (_, i) => ({
    id: `s${i}`,
    date: semana(i),
    status: i === faltaEm ? "nao_realizada" : "realizada",
    ...(i === faltaEm ? { faltouConta: false } : {}),
  })) as SessaoDaCobranca[],
});

const total = (e: ReturnType<typeof base>) => cobrancasDoPaciente(e).reduce((a, c) => a + c.valor, 0);

describe("doc 54 — a falta não abatida não pode encarecer a cobrança", () => {
  it("quinzenal: cobra as sessões que aconteceram, não a que faltou", () => {
    // Cobrava R$ 600 (3 sessões). Pausar fazia a metade contá-la e pedir R$ 800.
    expect(total(base("quinzenal", 4, 0))).toBe(FEE * 3);
    expect(total(base("quinzenal", 4, 1))).toBe(FEE * 3);
    expect(total(base("quinzenal", 4, 3))).toBe(FEE * 3);
  });

  it("fragmentado: o mês não ganha uma vaga por causa da falta", () => {
    // Agosto com 3 marcadas e a 1ª faltando cobrava R$ 400. Pausar virava R$ 600.
    expect(total(base("mensal", 3, 0, "fragmentado"))).toBe(FEE * 2);
  });

  it("mensal completo: o pacote sempre cobrou o tamanho contratado, e continua", () => {
    expect(total(base("mensal", 4, 0))).toBe(FEE * 4);
    expect(total(base("mensal", 4, 2))).toBe(FEE * 4);
  });
});

describe("doc 54 — a falta não abatida não pode mover a cobrança de mês nem de dia", () => {
  it("fragmentado: a cobrança de agosto continua caindo em agosto", () => {
    // Pausar deixava a sequência aberta (`competencia: null`) e agosto PERDIA a cobrança inteira.
    const c = cobrancasDoPaciente(base("mensal", 3, 0, "fragmentado"));
    expect(c).toHaveLength(1);
    expect(c[0].competencia?.getMonth()).toBe(7);
  });

  it("primeira do pacote: a competência não anda para o mês anterior", () => {
    // A falta na virada do mês puxava `comecouEm` para si e a Fechamento mudava de mês.
    const e = base("primeira_pacote", 5, 0);
    e.sessoes[0] = { ...e.sessoes[0], date: new Date(2024, 6, 31, 11, 0) };
    const c = cobrancasDoPaciente(e);
    expect(c[0].competencia?.getMonth()).toBe(7);
  });

  it("mensal: o pacote começa na primeira sessão que ACONTECEU, não na que faltou", () => {
    // A falta em 31/07 não abre o pacote: ele começa em 14/08. E como o dia 10 combinado cairia
    // antes dessa primeira sessão, vale a data dela — a regra de 18/09, que já existia. O que não
    // pode é o vencimento andar para 31/07 só porque a falta passou a pertencer à sequência.
    const e = base("mensal", 5, 0);
    e.sessoes[0] = { ...e.sessoes[0], date: new Date(2024, 6, 31, 11, 0) };
    const venc = cobrancasDoPaciente(e)[0].vencimento!;
    expect([venc.getDate(), venc.getMonth()]).toEqual([14, 7]);
  });

  it("última do pacote: vence na última sessão que ACONTECEU", () => {
    // Com a falta na última, o vencimento andava para a data dela.
    const c = cobrancasDoPaciente(base("ultima_pacote", 4, 3));
    expect(c).toHaveLength(1);
    expect(c[0].vencimento?.getTime()).toBe(semana(2).getTime());
  });
});

describe("doc 54 — Desmarcou e Atestado não mudaram de comportamento", () => {
  it("fragmentado: o denominador NÃO encolhe quando alguém desmarca", () => {
    // Regra antiga e deliberada: o paciente contratou os três atendimentos do mês.
    const e = base("mensal", 3, -1, "fragmentado");
    e.sessoes[0] = { ...e.sessoes[0], status: "cancelada" };
    expect(total(e)).toBe(FEE * 3);
  });
});

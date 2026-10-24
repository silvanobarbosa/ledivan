import { describe, expect, it } from "vitest";
import { cobrancasDoPaciente, rotulosDasSessoes, type SessaoDaCobranca } from "@/lib/cobrancas";

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

const total = (e: { sessoes: SessaoDaCobranca[] } & Record<string, unknown>) =>
  cobrancasDoPaciente(e as Parameters<typeof cobrancasDoPaciente>[0]).reduce((a, c) => a + c.valor, 0);

/**
 * Fracionado com DOIS meses — agosto e setembro, três atendimentos em cada.
 *
 * Dois meses, e não um, porque a regra do doc 55 é sobre a redistribuição ENTRE eles: a vaga que a
 * falta deixa aberta em agosto é ocupada por uma sessão de setembro, e setembro reduz. Um mês
 * sozinho não mostra isso — e foi olhando um mês só que o teste anterior concluiu errado.
 */
const fracionadoDoisMeses = (comFalta: boolean) => ({
  vigencias: [],
  reserva: { formato: "mensal", pacoteTipo: "fragmentado" },
  precos: [{ valor: FEE, desde: new Date(2024, 0, 1) }],
  valorDaSessao: FEE,
  tamanhos: [],
  vezesPorSemana: 1,
  diaPagamento: 10,
  sessoes: [
    { id: "a1", date: new Date(2024, 7, 7, 11, 0), status: comFalta ? "nao_realizada" : "realizada", ...(comFalta ? { faltouConta: false } : {}) },
    { id: "a2", date: new Date(2024, 7, 14, 11, 0), status: "realizada" },
    { id: "a3", date: new Date(2024, 7, 21, 11, 0), status: "realizada" },
    { id: "s1", date: new Date(2024, 8, 4, 11, 0), status: "realizada" },
    { id: "s2", date: new Date(2024, 8, 11, 11, 0), status: "realizada" },
    { id: "s3", date: new Date(2024, 8, 18, 11, 0), status: "realizada" },
  ] as SessaoDaCobranca[],
});

describe("doc 54 — a falta não abatida não pode encarecer a cobrança", () => {
  it("quinzenal: cobra as sessões que aconteceram, não a que faltou", () => {
    // Cobrava R$ 600 (3 sessões). Pausar fazia a metade contá-la e pedir R$ 800.
    expect(total(base("quinzenal", 4, 0))).toBe(FEE * 3);
    expect(total(base("quinzenal", 4, 1))).toBe(FEE * 3);
    expect(total(base("quinzenal", 4, 3))).toBe(FEE * 3);
  });

  /**
   * Doc 55 reescreveu esta regra, e o teste mudou junto.
   *
   * Em agosto, isolado, a falta não abatida FAZ o mês cobrar 3 em vez de 2 — porque o denominador
   * não encolhe (o paciente contratou três atendimentos) e a vaga aberta é ocupada por uma sessão
   * de setembro, que atravessa. O que não pode crescer é o TOTAL, e ele não cresce: setembro
   * reduz na mesma medida. É o que o dono pediu — "reduzindo a quantidade de sessões previstas
   * para cobrança no mês seguinte".
   *
   * Olhar um mês só e gritar "encareceu" foi o erro do teste anterior.
   */
  it("fragmentado: a falta redistribui entre os meses, sem aumentar o total", () => {
    const comFalta = total(fracionadoDoisMeses(true));
    const semFalta = total(fracionadoDoisMeses(false));
    // Uma sessão deixou de ser cobrada: o total cai exatamente o preço dela, nunca sobe.
    expect(comFalta).toBe(semFalta - FEE);
  });

  it("mensal completo: o pacote sempre cobrou o tamanho contratado, e continua", () => {
    expect(total(base("mensal", 4, 0))).toBe(FEE * 4);
    expect(total(base("mensal", 4, 2))).toBe(FEE * 4);
  });
});

describe("doc 54 — a falta não abatida não pode mover a cobrança de mês nem de dia", () => {
  /**
   * O que NÃO pode acontecer, e acontecia: a sequência ficar eternamente aberta
   * (`competencia: null`), fazendo a cobrança sumir da Fechamento. Ela tem que fechar em ALGUM
   * mês. Fecha no mês em que a última vaga foi ocupada — a mesma regra de quem desmarca, que o
   * doc 55 mandou seguir.
   */
  it("fragmentado: a cobrança não some da Fechamento — ela fecha no mês em que a vaga foi ocupada", () => {
    const c = cobrancasDoPaciente(fracionadoDoisMeses(true));
    expect(c.every((x) => x.competencia !== null)).toBe(true);
  });

  it("fragmentado: a numeração é preservada e o mês seguinte reduz (doc 55)", () => {
    const e = fracionadoDoisMeses(true);
    const r = rotulosDasSessoes(e);
    // A falta mantém o número onde parou, a seguinte repete, e a 3ª vaga é ocupada por uma sessão
    // do mês seguinte — que então passa a ter uma sessão a menos para cobrar.
    expect(e.sessoes.map((s) => r.get(s.id))).toEqual(["1/3", "1/3", "2/3", "3/3", "1/2", "2/2"]);
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

import { describe, expect, it } from "vitest";
import { cobrancasDoPaciente, rotulosDasSessoes, type SessaoDaCobranca } from "@/lib/cobrancas";

/**
 * O MOTOR ÚNICO DE COBRANÇAS.
 *
 * Três telas precisam da mesma resposta — o que o paciente deve, de quê, e quando: a Fechamento, a
 * célula da agenda e a guia Geral. Até aqui cada uma montava a sua, e já divergiam: a agenda tirava a
 * devolutiva comum da sequência e a Fechamento não. Com a guia Geral seriam três versões da verdade.
 *
 * Os exemplos seguem os do documento do dono (15/09/2026), com sessão a R$ 130.
 */

const FEE = 130;
const precos = [{ valor: FEE, desde: new Date(2026, 0, 1) }];

let n = 0;
const sessao = (dia: number, mes = 8, extra: Partial<SessaoDaCobranca> = {}): SessaoDaCobranca => ({
  id: `s${++n}`,
  date: new Date(2026, mes, dia, 14, 0, 0),
  status: "realizada",
  ...extra,
});

const base = (extra: Record<string, unknown> = {}) => ({
  vigencias: [],
  reserva: { formato: "sessao", pacoteTipo: "completo" },
  precos,
  valorDaSessao: FEE,
  tamanhos: [],
  diaPagamento: 5,
  diaPagamento2: 20,
  ...extra,
});

describe("a cada sessão", () => {
  it("cada atendimento é uma cobrança do valor da sessão", () => {
    const ss = [sessao(14), sessao(21)];
    const c = cobrancasDoPaciente({ ...base(), sessoes: ss });
    expect(c.map((x) => [x.tipo, x.valor, x.ids])).toEqual([
      ["sessao", 130, [ss[0].id]],
      ["sessao", 130, [ss[1].id]],
    ]);
  });

  it("sessão desmarcada ou com atestado não cobra", () => {
    const c = cobrancasDoPaciente({
      ...base(),
      sessoes: [sessao(14), sessao(21, 8, { status: "cancelada" }), sessao(28, 8, { status: "atestado" })],
    });
    expect(c).toHaveLength(1);
  });
});

describe("gratuito", () => {
  it("não gera cobrança nenhuma", () => {
    const c = cobrancasDoPaciente({ ...base({ reserva: { formato: "gratuito" } }), sessoes: [sessao(14), sessao(21)] });
    expect(c).toEqual([]);
  });
});

describe("a regra do dono: a troca vale a partir da data definida", () => {
  it("gratuito → a cada sessão em 21/09: só o que vem depois cobra", () => {
    const ss = [sessao(7), sessao(14), sessao(21), sessao(28)];
    const c = cobrancasDoPaciente({
      ...base({
        vigencias: [
          { formato: "gratuito", desde: new Date(2026, 0, 1) },
          { formato: "sessao", desde: new Date(2026, 8, 21) },
        ],
      }),
      sessoes: ss,
    });
    expect(c.flatMap((x) => x.ids)).toEqual([ss[2].id, ss[3].id]);
  });

  it("a cada sessão → gratuito em 21/09: as cobranças de antes PERMANECEM", () => {
    const ss = [sessao(7), sessao(14), sessao(21), sessao(28)];
    const c = cobrancasDoPaciente({
      ...base({
        vigencias: [
          { formato: "sessao", desde: new Date(2026, 0, 1) },
          { formato: "gratuito", desde: new Date(2026, 8, 21) },
        ],
      }),
      sessoes: ss,
    });
    expect(c.flatMap((x) => x.ids)).toEqual([ss[0].id, ss[1].id]);
  });

  it("trocar o formato HOJE não mexe no que agosto já cobrou", () => {
    const agosto = [sessao(4, 7), sessao(11, 7)];
    const antes = cobrancasDoPaciente({
      ...base({ vigencias: [{ formato: "sessao", desde: new Date(2026, 0, 1) }] }),
      sessoes: agosto,
    });
    const depois = cobrancasDoPaciente({
      ...base({
        vigencias: [
          { formato: "sessao", desde: new Date(2026, 0, 1) },
          { formato: "gratuito", desde: new Date(2026, 8, 15) },
        ],
      }),
      sessoes: agosto,
    });
    expect(depois).toEqual(antes);
  });
});

describe("mensal — pacote completo", () => {
  const cfg = base({ reserva: { formato: "mensal", pacoteTipo: "completo" } });

  it("um pacote de quatro é UMA cobrança de R$ 520", () => {
    const ss = [sessao(14), sessao(21), sessao(28), sessao(5, 9)];
    const [c] = cobrancasDoPaciente({ ...cfg, sessoes: ss });
    expect(c).toMatchObject({ tipo: "pacote", valor: 520, sessoes: 4 });
    expect(c.ids).toEqual(ss.map((s) => s.id));
  });

  it("vence no dia de pagamento do mês em que o pacote começa", () => {
    const [c] = cobrancasDoPaciente({ ...cfg, sessoes: [sessao(14), sessao(21), sessao(28), sessao(5, 9)] });
    expect(c.vencimento?.getTime()).toBe(new Date(2026, 8, 5).getTime());
  });

  it("a Fechamento conta quando o pacote FECHA — decisão de 13/09 continua valendo", () => {
    const ss = [sessao(14), sessao(21), sessao(28), sessao(5, 9)];
    const [c] = cobrancasDoPaciente({ ...cfg, sessoes: ss });
    expect(c.competencia?.getTime()).toBe(ss[3].date instanceof Date ? ss[3].date.getTime() : 0);
  });

  it("pacote ainda aberto aparece, mas não entra na Fechamento", () => {
    const [c] = cobrancasDoPaciente({ ...cfg, sessoes: [sessao(14), sessao(21)] });
    expect(c.valor).toBe(520);
    expect(c.competencia).toBeNull();
  });

  it("dois pacotes seguidos são duas cobranças", () => {
    const ss = [14, 21, 28].map((d) => sessao(d)).concat([5, 12, 19, 26, 2].map((d, i) => sessao(d, i < 4 ? 9 : 10)));
    const c = cobrancasDoPaciente({ ...cfg, sessoes: ss });
    expect(c.map((x) => x.valor)).toEqual([520, 520]);
  });
});

describe("mensal — pacote fragmentado (exemplo do documento)", () => {
  it("3 sessões = R$ 390, depois 4 sessões = R$ 520", () => {
    const set = [14, 21, 28].map((d) => sessao(d));
    const out = [5, 12, 19, 26].map((d) => sessao(d, 9));
    const c = cobrancasDoPaciente({
      ...base({ reserva: { formato: "mensal", pacoteTipo: "fragmentado" }, tamanhos: [3, 4] }),
      sessoes: [...set, ...out],
    });
    expect(c.map((x) => [x.valor, x.sessoes])).toEqual([
      [390, 3],
      [520, 4],
    ]);
  });
});

describe("quinzenal", () => {
  const cfg = base({ reserva: { formato: "quinzenal", pacoteTipo: "completo" } });

  it("o pacote de quatro vira DUAS cobranças de R$ 260", () => {
    const c = cobrancasDoPaciente({ ...cfg, sessoes: [14, 21, 28].map((d) => sessao(d)).concat(sessao(5, 9)) });
    expect(c.map((x) => [x.tipo, x.valor])).toEqual([
      ["quinzena", 260],
      ["quinzena", 260],
    ]);
  });

  it("cada quinzena vence no seu dia", () => {
    const c = cobrancasDoPaciente({ ...cfg, sessoes: [14, 21, 28].map((d) => sessao(d)).concat(sessao(5, 9)) });
    expect(c.map((x) => x.vencimento?.getDate())).toEqual([5, 20]);
  });

  it("fracionado de 3: R$ 195 + R$ 195", () => {
    const c = cobrancasDoPaciente({
      ...base({ reserva: { formato: "quinzenal", pacoteTipo: "fragmentado" }, tamanhos: [3, 4] }),
      sessoes: [14, 21, 28].map((d) => sessao(d)),
    });
    expect(c.map((x) => x.valor)).toEqual([195, 195]);
  });
});

describe("primeira e última sessão do pacote", () => {
  const ss = () => [sessao(14), sessao(21), sessao(28), sessao(5, 9)];

  it("na primeira: vence e entra na Fechamento na PRIMEIRA sessão", () => {
    const s = ss();
    const [c] = cobrancasDoPaciente({ ...base({ reserva: { formato: "primeira_pacote" } }), sessoes: s });
    expect(c.vencimento?.getTime()).toBe((s[0].date as Date).getTime());
    expect(c.competencia?.getTime()).toBe((s[0].date as Date).getTime());
    expect(c.posicao).toBe("antes");
  });

  it("na última: vence na última sessão, e a linha vai DEPOIS do pacote", () => {
    const s = ss();
    const [c] = cobrancasDoPaciente({ ...base({ reserva: { formato: "ultima_pacote" } }), sessoes: s });
    expect(c.vencimento?.getTime()).toBe((s[3].date as Date).getTime());
    expect(c.posicao).toBe("depois");
  });
});

describe("devolutiva", () => {
  const cfg = base({ reserva: { formato: "mensal", pacoteTipo: "completo" } });

  it("a comum fica FORA da sequência e não cobra — a agenda e a Fechamento passam a concordar", () => {
    const ss = [sessao(14), sessao(17, 8, { sessionKind: "devolutiva" }), sessao(21), sessao(28), sessao(5, 9)];
    const [c] = cobrancasDoPaciente({ ...cfg, sessoes: ss });
    expect(c.ids).not.toContain(ss[1].id);
    expect(c.sessoes).toBe(4);
    expect(c.competencia).not.toBeNull();
  });

  it("a que abate do pacote OCUPA posição", () => {
    const ss = [sessao(14), sessao(17, 8, { sessionKind: "devolutiva", abaterDoPacote: true }), sessao(21), sessao(28)];
    const [c] = cobrancasDoPaciente({ ...cfg, sessoes: ss });
    expect(c.ids).toContain(ss[1].id);
    expect(c.competencia).not.toBeNull();
  });
});

describe("devolutiva em 'a cada sessão' — resposta do dono (15/09/2026)", () => {
  // "Se elas forem gratuitas, precisam ser identificadas como GRAT, sem gerar cobrança."
  it("marcada para não cobrar: GRAT, sem cobrança", () => {
    const ss = [sessao(14), sessao(17, 8, { sessionKind: "devolutiva", chargeable: false })];
    const e = { ...base(), sessoes: ss };
    expect(cobrancasDoPaciente(e).map((c) => c.ids[0])).toEqual([ss[0].id]);
    expect(rotulosDasSessoes(e).get(ss[1].id)).toBe("GRAT");
  });

  it("marcada para cobrar: continua cobrada e continua DEVOL", () => {
    const ss = [sessao(17, 8, { sessionKind: "devolutiva", chargeable: true })];
    const e = { ...base(), sessoes: ss };
    expect(cobrancasDoPaciente(e)).toHaveLength(1);
    expect(rotulosDasSessoes(e).get(ss[0].id)).toBe("DEVOL");
  });

  it("consulta com chargeable falso não muda nada — a regra é da devolutiva", () => {
    const ss = [sessao(17, 8, { chargeable: false })];
    expect(cobrancasDoPaciente({ ...base(), sessoes: ss })).toHaveLength(1);
  });
});

describe("sessão extra fora da sequência", () => {
  const cfg = base({ reserva: { formato: "mensal", pacoteTipo: "completo" } });

  it("AVUL: cobrança própria no valor informado, e o pacote segue com quatro", () => {
    const ss = [sessao(14), sessao(21), sessao(24, 8, { extra: "avul", valorExtra: 150 }), sessao(28), sessao(5, 9)];
    const c = cobrancasDoPaciente({ ...cfg, sessoes: ss });
    const pacote = c.find((x) => x.tipo === "pacote");
    const extra = c.find((x) => x.tipo === "extra");
    expect(pacote).toMatchObject({ valor: 520, sessoes: 4 });
    expect(pacote?.ids).not.toContain(ss[2].id);
    expect(extra).toMatchObject({ valor: 150, ids: [ss[2].id] });
  });

  it("GRAT: não cobra, e não mexe na numeração", () => {
    const ss = [sessao(14), sessao(21), sessao(24, 8, { extra: "grat" }), sessao(28), sessao(5, 9)];
    const c = cobrancasDoPaciente({ ...cfg, sessoes: ss });
    expect(c).toHaveLength(1);
    const rot = rotulosDasSessoes({ ...cfg, sessoes: ss });
    expect([...rot.values()]).toEqual(["1/4", "2/4", "GRAT", "3/4", "4/4"]);
  });

  it("é INDEPENDENTE do financeiro: extra AVUL cobra mesmo com o paciente gratuito", () => {
    const ss = [sessao(14, 8, { extra: "avul", valorExtra: 90 })];
    const c = cobrancasDoPaciente({ ...base({ reserva: { formato: "gratuito" } }), sessoes: ss });
    expect(c).toMatchObject([{ tipo: "extra", valor: 90 }]);
  });

  it("antes, durante ou depois do pacote: nunca altera as cobranças que já existiam", () => {
    const pacote = [sessao(14), sessao(21), sessao(28), sessao(5, 9)];
    const sem = cobrancasDoPaciente({ ...cfg, sessoes: pacote }).filter((x) => x.tipo === "pacote");
    for (const dia of [10, 25]) {
      const com = cobrancasDoPaciente({
        ...cfg,
        sessoes: [...pacote, sessao(dia, 8, { extra: "avul", valorExtra: 130 })],
      }).filter((x) => x.tipo === "pacote");
      expect(com).toEqual(sem);
    }
  });
});

describe("rótulos da sessão (coluna 2 da guia Geral, 2ª linha da célula)", () => {
  it("segue o formato do PERÍODO de cada sessão", () => {
    const ss = [sessao(7), sessao(14), sessao(21), sessao(28)];
    const rot = rotulosDasSessoes({
      ...base({
        vigencias: [
          { formato: "gratuito", desde: new Date(2026, 0, 1) },
          { formato: "sessao", desde: new Date(2026, 8, 21) },
        ],
      }),
      sessoes: ss,
    });
    expect([...rot.values()]).toEqual(["GRAT", "GRAT", "AVUL", "AVUL"]);
  });

  it("uma troca de formato abre sequência NOVA", () => {
    const ss = [sessao(1), sessao(8), sessao(15), sessao(22)];
    const rot = rotulosDasSessoes({
      ...base({
        vigencias: [
          { formato: "mensal", pacoteTipo: "completo", desde: new Date(2026, 0, 1) },
          { formato: "quinzenal", pacoteTipo: "completo", desde: new Date(2026, 8, 15) },
        ],
      }),
      sessoes: ss,
    });
    expect([...rot.values()]).toEqual(["1/4", "2/4", "1/4", "2/4"]);
  });

  it("devolutiva comum é DEVOL; a que abate mostra a posição", () => {
    const ss = [sessao(1), sessao(3, 8, { sessionKind: "devolutiva" }), sessao(8, 8, { sessionKind: "devolutiva", abaterDoPacote: true })];
    const rot = rotulosDasSessoes({ ...base({ reserva: { formato: "mensal", pacoteTipo: "completo" } }), sessoes: ss });
    expect([...rot.values()]).toEqual(["1/4", "DEVOL", "DEVOL 2/4"]);
  });
});

describe("as chaves das cobranças", () => {
  it("são únicas e estáveis entre duas contas iguais", () => {
    const ss = [14, 21, 28].map((d) => sessao(d)).concat([5, 12].map((d) => sessao(d, 9)));
    const cfg = base({ reserva: { formato: "quinzenal", pacoteTipo: "completo" } });
    const a = cobrancasDoPaciente({ ...cfg, sessoes: ss }).map((x) => x.chave);
    const b = cobrancasDoPaciente({ ...cfg, sessoes: [...ss].reverse() }).map((x) => x.chave);
    expect(new Set(a).size).toBe(a.length);
    expect(a).toEqual(b);
  });
});

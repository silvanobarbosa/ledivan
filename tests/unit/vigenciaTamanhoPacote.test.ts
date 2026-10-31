import { describe, it, expect } from "vitest";
import { posicoesDaSequencia, todasAsSequencias } from "@/lib/sequenciaPacote";

/**
 * O caso da Ana Eduarda (paciente da Gisele, 31/10/2026).
 *
 * O cadastro dela diz pacote de 8, e existe uma vigência de tamanho dizendo "8, a partir de
 * 01/10/2026" — o MESMO 8. O tamanho não mudou. Mas a sequência em curso era cortada ao alcançar
 * a data, e o toco de 3 sessões virava um pacote inteiro de 8, cobrado como tal: R$ 640,00 a mais
 * num paciente só, e os vencimentos seguintes todos deslocados.
 */
const sessoes = (datas: string[]) =>
  datas.map((d, i) => ({ id: `s${String(i).padStart(2, "0")}`, date: new Date(`${d}T11:00:00`), status: "agendada" }));

/** 16 sessões, 2 por semana, atravessando 01/10/2026. */
const DATAS = [
  "2026-09-01", "2026-09-03", "2026-09-08", "2026-09-10",
  "2026-09-15", "2026-09-17", "2026-09-22", "2026-09-24",
  "2026-09-29", "2026-10-01", "2026-10-06", "2026-10-08",
  "2026-10-13", "2026-10-15", "2026-10-20", "2026-10-22",
];
const OPTS = { pacoteTipo: "completo" as const, tamanhos: [], tamanhoPacote: 8, vezesPorSemana: 2 };
const VIGENCIA_IGUAL = [{ desde: new Date("2026-10-01T00:00:00"), tamanho: 8 }];

describe("vigência de tamanho do pacote", () => {
  it("vigência que NÃO muda o tamanho não corta a sequência em curso", () => {
    const com = todasAsSequencias(sessoes(DATAS), { ...OPTS, tamanhosPorData: VIGENCIA_IGUAL });
    const sem = todasAsSequencias(sessoes(DATAS), OPTS);
    expect(com.map((s) => s.ids.length)).toEqual(sem.map((s) => s.ids.length));
    // 16 sessões, pacote de 8 = exatamente dois pacotes cheios.
    expect(com.map((s) => s.ids.length)).toEqual([8, 8]);
  });

  it("o toco de 3 sessões deixa de existir — era ele que cobrava um pacote inteiro", () => {
    const seqs = todasAsSequencias(sessoes(DATAS), { ...OPTS, tamanhosPorData: VIGENCIA_IGUAL });
    expect(seqs.some((s) => s.ids.length !== s.total)).toBe(false);
  });

  it("vigência que MUDA o tamanho continua cortando — é para isso que ela existe (doc 30)", () => {
    const seqs = todasAsSequencias(sessoes(DATAS), {
      ...OPTS,
      tamanhosPorData: [{ desde: new Date("2026-10-01T00:00:00"), tamanho: 4 }],
    });
    // Corta em 01/10: o que veio antes fecha como está, e dali em diante conta de 4 em 4.
    expect(seqs.length).toBeGreaterThan(2);
    expect(seqs.filter((s) => s.total === 4).length).toBeGreaterThan(0);
    const depois = seqs.filter((s) => s.total === 4);
    expect(depois.every((s) => s.ids.length <= 4)).toBe(true);
  });

  it("a numeração não pula: com a vigência igual, a 9ª sessão é 1/8 do segundo pacote", () => {
    const pos = posicoesDaSequencia(sessoes(DATAS), { ...OPTS, tamanhosPorData: VIGENCIA_IGUAL });
    expect(pos.get("s07")).toMatchObject({ index: 8, total: 8 });
    expect(pos.get("s08")).toMatchObject({ index: 1, total: 8 });
  });
});

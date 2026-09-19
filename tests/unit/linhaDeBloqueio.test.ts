import { describe, expect, it } from "vitest";
import { linhasDaGeral, type EntradaDaGeral } from "@/lib/guiaGeral";

/**
 * A DATA BLOQUEADA APARECE NA GUIA GERAL (documento de 19/09).
 *
 * A dona desenhou a tabela que quer ver:
 *
 * | Data/hora | Status      | Sessão | Valor |
 * |-----------|-------------|--------|-------|
 * | 15/09     | Presente    | 1/4    | —     |
 * | **22/09** | **Hor. Bloq.** | **—** | **—** |
 * | 29/09     | —           | 2/4    | —     |
 * | 06/10     | —           | 3/4    | —     |
 * | 13/10     | —           | 4/4    | —     |
 *
 * *"O bloqueio da data 22/09 não deve ser considerado uma sessão realizada nem deve consumir uma
 * sessão do pacote. A sequência continua normalmente na próxima data disponível, começando em 2/4."*
 *
 * É por isso que a falta fica GUARDADA, e não deduzida: o bloqueio mora em tabela própria e não
 * conhece paciente nenhum — de propósito, para não virar dinheiro. Quem sabe que ESTA série pulou
 * ESTA data é o registro que a criação da série deixou.
 */

const desde = new Date(2026, 0, 1);
const hoje = new Date(2026, 9, 20, 12);
const segunda = (dia: number, mes = 8, status = "agendada") => ({
  id: `s${mes}-${dia}`,
  date: new Date(2026, mes, dia, 14),
  status,
});

/** O caso da dona: série semanal com 22/09 bloqueado. */
const entrada = (extra: Partial<EntradaDaGeral> = {}): EntradaDaGeral => ({
  vigencias: [{ formato: "mensal", pacoteTipo: "completo", desde }],
  reserva: { formato: "mensal", pacoteTipo: "completo" },
  precos: [{ valor: 100, desde }],
  sessoes: [segunda(15, 8, "realizada"), segunda(29), segunda(6, 9), segunda(13, 9)],
  pagamentos: [],
  bloqueios: [{ data: new Date(2026, 8, 22, 14) }],
  hoje,
  ...extra,
});

/** "dd/mm status rotulo" de cada linha de sessão ou bloqueio, na ordem. */
const tabela = (e: EntradaDaGeral) =>
  linhasDaGeral(e)
    .filter((l) => l.tipo !== "pagamento")
    .map((l) => {
      const d = `${String(l.data.getDate()).padStart(2, "0")}/${String(l.data.getMonth() + 1).padStart(2, "0")}`;
      if (l.tipo === "bloqueio") return `${d} Hor. Bloq. —`;
      return `${d} ${l.status} ${l.rotulo}`;
    });

describe("a tabela que ela desenhou", () => {
  it("o bloqueio entra entre as sessões, na data dele", () => {
    expect(tabela(entrada())).toEqual([
      "15/09 realizada 1/4",
      "22/09 Hor. Bloq. —",
      "29/09 agendada 2/4",
      "06/10 agendada 3/4",
      "13/10 agendada 4/4",
    ]);
  });

  it("o bloqueio NÃO consome uma sessão do pacote — a seguinte é 2/4", () => {
    const linhas = linhasDaGeral(entrada());
    const depoisDoBloqueio = linhas.find((l) => l.tipo === "sessao" && l.data.getDate() === 29);
    expect(depoisDoBloqueio?.tipo === "sessao" && depoisDoBloqueio.rotulo).toBe("2/4");
  });

  it("o pacote continua fechando em quatro, não em cinco", () => {
    const rotulos = linhasDaGeral(entrada())
      .filter((l) => l.tipo === "sessao")
      .map((l) => (l.tipo === "sessao" ? l.rotulo : ""));
    expect(rotulos).toEqual(["1/4", "2/4", "3/4", "4/4"]);
  });
});

describe("desbloqueado, a linha some", () => {
  it("sem bloqueio guardado, a tabela é só das sessões", () => {
    expect(tabela(entrada({ bloqueios: [] }))).toEqual([
      "15/09 realizada 1/4",
      "29/09 agendada 2/4",
      "06/10 agendada 3/4",
      "13/10 agendada 4/4",
    ]);
  });

  it("quem não passa bloqueio nenhum não vê diferença", () => {
    const semCampo = { ...entrada() };
    delete (semCampo as { bloqueios?: unknown }).bloqueios;
    expect(tabela(semCampo).every((l) => !l.includes("Hor. Bloq."))).toBe(true);
  });
});

describe("mais de um bloqueio", () => {
  it("dois bloqueios seguidos aparecem os dois, e nenhum consome sessão", () => {
    const e = entrada({
      sessoes: [segunda(15, 8, "realizada"), segunda(6, 9), segunda(13, 9)],
      bloqueios: [{ data: new Date(2026, 8, 22, 14) }, { data: new Date(2026, 8, 29, 14) }],
    });
    expect(tabela(e)).toEqual([
      "15/09 realizada 1/4",
      "22/09 Hor. Bloq. —",
      "29/09 Hor. Bloq. —",
      "06/10 agendada 2/4",
      "13/10 agendada 3/4",
    ]);
  });
});

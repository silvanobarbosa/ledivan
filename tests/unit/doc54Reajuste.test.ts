import { describe, expect, it } from "vitest";
import { entradaDoHistorico } from "@/lib/reajuste";

/**
 * APAGAR UM REAJUSTE QUANDO VÁRIOS COMPARTILHAM A MESMA VIGÊNCIA (doc 54).
 *
 * A tela e o servidor discordavam. O histórico marca a lixeira por POSIÇÃO na lista — a primeira
 * linha é a entrada do cadastro, as seguintes são reajustes. O servidor protegia por DATA: recusava
 * apagar qualquer registro cuja `dataEfetiva` fosse a mais antiga.
 *
 * Quando as três alterações da paciente caem na MESMA vigência (ela trocou Gratuito → Avulso →
 * Gratuito no mesmo dia), todas empatam na data mais antiga — e nenhuma podia ser removida, embora
 * a lixeira estivesse lá. "Esse registro não pode ser removido", três vezes.
 *
 * A entrada é UM registro, não uma data: o mais antigo, com `dataCriacao` desempatando quem foi
 * gravado primeiro no mesmo dia.
 */
const reg = (id: string, dia: number, criadoEm: string) => ({
  id,
  dataEfetiva: new Date(2024, 7, dia),
  dataCriacao: new Date(criadoEm),
});

describe("entradaDoHistorico — qual registro é a entrada do cadastro", () => {
  it("o mais antigo pela data de vigência", () => {
    expect(entradaDoHistorico([reg("b", 20, "2024-08-20T10:00:00Z"), reg("a", 9, "2024-08-09T10:00:00Z")])).toBe("a");
  });

  it("empate na vigência: desempata por quem foi gravado primeiro", () => {
    const mesmaVigencia = [
      reg("c", 9, "2026-10-21T23:58:03Z"),
      reg("a", 9, "2026-10-21T23:58:01Z"),
      reg("b", 9, "2026-10-21T23:58:02Z"),
    ];
    expect(entradaDoHistorico(mesmaVigencia)).toBe("a");
  });

  it("empate total: o id desempata, para a resposta não dançar entre duas leituras", () => {
    const iguais = [reg("b", 9, "2024-08-09T10:00:00Z"), reg("a", 9, "2024-08-09T10:00:00Z")];
    expect(entradaDoHistorico(iguais)).toBe("a");
  });

  it("lista vazia não tem entrada", () => {
    expect(entradaDoHistorico([])).toBeNull();
  });

  it("só a ENTRADA é protegida — as outras alterações da mesma vigência são removíveis", () => {
    const tres = [reg("a", 9, "2026-10-21T23:58:01Z"), reg("b", 9, "2026-10-21T23:58:02Z"), reg("c", 9, "2026-10-21T23:58:03Z")];
    const entrada = entradaDoHistorico(tres);
    expect(tres.filter((r) => r.id !== entrada).map((r) => r.id)).toEqual(["b", "c"]);
  });
});

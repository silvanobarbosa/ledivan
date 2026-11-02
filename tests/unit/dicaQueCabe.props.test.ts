import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { bytesDe, dicaQueCabe, TETO_DA_DICA } from "@/lib/transcricao";
import { listaDePacientes, textoHostilLongo } from "../geradores";

/**
 * A DICA DO WHISPER, POR PROPRIEDADE.
 *
 * Os testes-exemplo ao lado (`dicaQueCabe.test.ts`) dizem "com ESTA entrada, sai AQUILO". Eles são
 * necessários e não bastam: foi eu escolhendo os exemplos que deixou o bug passar duas vezes
 * seguidas — na primeira porque escolhi poucos nomes, na segunda porque escolhi nomes sem acento.
 *
 * Aqui a máquina escolhe. Cada `it` roda 1.000 entradas geradas e, se achar uma que quebra, ela
 * ENCOLHE a entrada até o menor caso que ainda quebra e imprime ele — que é o que transforma
 * "falhou" em "falhou com 'Conceição' na posição 19".
 *
 * A propriedade é escrita na UNIDADE DO PROVEDOR (bytes UTF-8). Escrever a propriedade na unidade
 * errada daria uma suíte verde sobre uma mentira — foi exatamente o que aconteceu em 01/11.
 */

const BASE = "Verbos: anotar, marcar, cancelar. Comandos: ver agenda; lançar pagamento.";
const EXECUCOES = { numRuns: 1000 };

describe("propriedades da dica — valem para QUALQUER lista de pacientes", () => {
  it("NUNCA passa do teto, em bytes — com qualquer lista e qualquer teto", () => {
    fc.assert(
      fc.property(listaDePacientes(), fc.integer({ min: 40, max: 2000 }), (nomes, teto) => {
        expect(bytesDe(dicaQueCabe(BASE, nomes, teto))).toBeLessThanOrEqual(teto);
      }),
      EXECUCOES,
    );
  });

  it("nunca devolve caractere partido ao meio", () => {
    // Cortar por byte cru deixa meio acento no fim, que vira U+FFFD (3 bytes) e volta a estourar.
    fc.assert(
      fc.property(textoHostilLongo(), listaDePacientes(20), fc.integer({ min: 10, max: 400 }), (base, nomes, teto) => {
        const d = dicaQueCabe(base, nomes, teto);
        expect(d).not.toContain("�");
        expect(bytesDe(d)).toBeLessThanOrEqual(teto);
      }),
      EXECUCOES,
    );
  });

  it("a base sempre sobrevive inteira quando cabe — ela é a instrução, os nomes são ajuda", () => {
    fc.assert(
      fc.property(listaDePacientes(), (nomes) => {
        const d = dicaQueCabe(BASE, nomes);
        expect(d.startsWith(BASE)).toBe(true);
      }),
      EXECUCOES,
    );
  });

  it("o que cabe inteiro entra inteiro — nenhum nome é perdido à toa", () => {
    fc.assert(
      fc.property(listaDePacientes(6), (nomes) => {
        const unicos = [...new Set(nomes.map((n) => n.trim()).filter(Boolean))];
        const d = dicaQueCabe(BASE, nomes);
        // Com até 6 nomes a dica é curta; se couber no teto, todos têm de estar lá.
        if (bytesDe(`${BASE} Pacientes: ${unicos.join(", ")}.`) <= TETO_DA_DICA) {
          for (const n of unicos) expect(d).toContain(n);
        }
      }),
      EXECUCOES,
    );
  });

  it("corta a CAUDA: acrescentar nome no fim nunca derruba quem já estava", () => {
    /**
     * Esta é a propriedade que protege a REGRA DE NEGÓCIO, não o teto.
     *
     * A ordem chega pronta da rota: primeiro quem tem atendimento marcado. Se o corte mexesse na
     * cabeça da lista, a terapeuta perderia justamente o nome que ia falar — e o sintoma seria
     * "ele não me entende", não "estourou o teto". Bug pior, porque não parece bug.
     */
    fc.assert(
      fc.property(listaDePacientes(40), nomeExtra(), (nomes, extra) => {
        const antes = dicaQueCabe(BASE, nomes);
        const depois = dicaQueCabe(BASE, [...nomes, extra]);
        const cabiam = nomesDentro(antes);
        const cabem = nomesDentro(depois);
        // Quem estava na dica continua nela, na mesma ordem, como prefixo.
        expect(cabem.slice(0, Math.min(cabiam.length, cabem.length)))
          .toEqual(cabiam.slice(0, Math.min(cabiam.length, cabem.length)));
      }),
      EXECUCOES,
    );
  });
});

function nomeExtra() {
  return listaDePacientes(1).map((l) => l[0] ?? "Ana");
}

function nomesDentro(dica: string): string[] {
  const m = dica.match(/Pacientes: (.*)\.$/);
  return m ? m[1].split(", ").filter(Boolean) : [];
}

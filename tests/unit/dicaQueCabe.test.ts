import { describe, it, expect } from "vitest";
import { dicaQueCabe, TETO_DA_DICA } from "@/lib/transcricao";

/**
 * O teto da dica do Whisper — 896 caracteres, medido com a chave da terapeuta em 01/11:
 * `prompt length must be 896 characters or fewer, but provided prompt contains 1206 characters`.
 *
 * Foi este teto que derrubou o Divã da Gisele. O corte era por QUANTIDADE de nomes (80), que não
 * tem relação com o que o provedor mede; a lista dela cresceu para 32 pacientes, a dica passou de
 * 1.200 caracteres e TODO comando de voz passou a falhar com 400 — que a tela mostrava como
 * "Não consegui ouvir agora". Daí este arquivo existir.
 */

const BASE = "Verbos: anotar, marcar, cancelar.";
const nomes = (n: number, tamanho = 20) =>
  Array.from({ length: n }, (_, i) => `Paciente ${String(i).padStart(2, "0")} ${"x".repeat(tamanho)}`);

describe("a dica cabe no teto do provedor", () => {
  it("lista curta entra inteira", () => {
    const d = dicaQueCabe(BASE, ["Ana Lima", "Kleber Souza"]);
    expect(d).toBe(`${BASE} Pacientes: Ana Lima, Kleber Souza.`);
  });

  it("lista grande é CORTADA — nunca passa do teto", () => {
    const d = dicaQueCabe(BASE, nomes(80));
    expect(d.length).toBeLessThanOrEqual(TETO_DA_DICA);
    expect(d.startsWith(BASE)).toBe(true);
    expect(d.endsWith(".")).toBe(true);
  });

  it("o caso real da Gisele: 32 nomes, e a dica continua válida", () => {
    const d = dicaQueCabe(BASE, nomes(32, 14));
    expect(d.length).toBeLessThanOrEqual(TETO_DA_DICA);
  });

  it("corta a CAUDA — os primeiros nomes sobrevivem", () => {
    const d = dicaQueCabe(BASE, nomes(80));
    expect(d).toContain("Paciente 00");
    expect(d).not.toContain("Paciente 79");
  });

  it("sem nomes, devolve só a base", () => {
    expect(dicaQueCabe(BASE, [])).toBe(BASE);
    expect(dicaQueCabe(BASE, [null, undefined, "   "])).toBe(BASE);
  });

  it("nome repetido conta uma vez", () => {
    expect(dicaQueCabe(BASE, ["Ana", "Ana", " Ana "])).toBe(`${BASE} Pacientes: Ana.`);
  });

  it("nem a base cabendo, ela é truncada em vez de derrubar a transcrição", () => {
    const enorme = "y".repeat(TETO_DA_DICA + 200);
    const d = dicaQueCabe(enorme, ["Ana"]);
    expect(d.length).toBe(TETO_DA_DICA);
  });

  it("um único nome gigante não entra pela metade", () => {
    const d = dicaQueCabe(BASE, ["z".repeat(TETO_DA_DICA)]);
    expect(d).toBe(BASE);
  });
});

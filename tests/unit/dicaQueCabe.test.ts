import { describe, it, expect } from "vitest";
import { bytesDe, dicaQueCabe, TETO_DA_DICA } from "@/lib/transcricao";

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

/**
 * O MESMO BUG, DE NOVO, POR CAUSA DO TESTE SEM ACENTO.
 *
 * Os testes acima usam "Paciente 00 xxxx" — ASCII puro, em que byte e caractere são a mesma
 * coisa. Por isso passaram verdes enquanto a dica da terapeuta, cheia de "Thaís" e "Conceição",
 * era recusada em produção: 885 caracteres, 898 bytes, teto de 896 (medido em 02/11).
 *
 * Num app em português, teste com nome sem acento não testa o caso real. Estes aqui medem o que
 * o provedor mede. Ver [[licao-dica-do-whisper-tem-teto]].
 */
const ACENTUADOS = (n: number) =>
  Array.from({ length: n }, (_, i) => `Conceição Thaís Gonçalves ${String(i).padStart(2, "0")}`);

describe("o teto é em BYTES — o que o provedor realmente mede", () => {
  it("acento conta 2: a dica cheia de nome português cabe em bytes, não só em caracteres", () => {
    const d = dicaQueCabe(BASE, ACENTUADOS(32));
    expect(bytesDe(d)).toBeLessThanOrEqual(TETO_DA_DICA);
    // E a prova de que o teste importa: contando caractere, ela teria passado do teto real.
    expect(bytesDe(d)).toBeGreaterThan(d.length);
  });

  it("o caso exato da produção: 885 caracteres não podem virar 898 bytes aceitos", () => {
    const d = dicaQueCabe(BASE, ACENTUADOS(60));
    expect(bytesDe(d)).toBeLessThanOrEqual(896);
  });

  it("base acentuada maior que o teto é truncada em BYTES, sem partir caractere", () => {
    const d = dicaQueCabe("ç".repeat(TETO_DA_DICA), ["Ana"]);
    expect(bytesDe(d)).toBeLessThanOrEqual(TETO_DA_DICA);
    expect(d).not.toContain("�");
    expect([...d].every((c) => c === "ç")).toBe(true);
  });

  it("emoji no nome não sai partido ao meio", () => {
    const d = dicaQueCabe("🙂".repeat(TETO_DA_DICA), ["Ana"]);
    expect(bytesDe(d)).toBeLessThanOrEqual(TETO_DA_DICA);
    expect(d).not.toContain("�");
    expect(d.length % 2).toBe(0);
  });

  it("bytesDe mede UTF-8, não unidade de código", () => {
    expect(bytesDe("abc")).toBe(3);
    expect(bytesDe("ção")).toBe(5);
    expect(bytesDe("🙂")).toBe(4);
    expect(bytesDe("")).toBe(0);
  });
});

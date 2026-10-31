import { describe, it, expect } from "vitest";
import { audioAceitavel, dicaDeNomes, TETO_DO_AUDIO } from "@/lib/transcricao";

describe("a dica de nomes próprios", () => {
  it("traz os nomes desta sessão", () => {
    expect(dicaDeNomes(["Marcela Damaceno", "Elaine"])).toBe(
      "Nomes próprios que podem aparecer: Marcela Damaceno, Elaine.",
    );
  });

  it("ignora vazio, nulo e repetido", () => {
    expect(dicaDeNomes(["Marcela", null, "  ", "Marcela", undefined])).toBe(
      "Nomes próprios que podem aparecer: Marcela.",
    );
  });

  it("sem nome nenhum, não manda dica — string vazia enviesaria à toa", () => {
    expect(dicaDeNomes([null, undefined, "   "])).toBeUndefined();
    expect(dicaDeNomes([])).toBeUndefined();
  });
});

describe("o teto do áudio", () => {
  it("recusa vazio e recusa acima de 25 MB", () => {
    expect(audioAceitavel(0).ok).toBe(false);
    expect(audioAceitavel(-1).ok).toBe(false);
    expect(audioAceitavel(Number.NaN).ok).toBe(false);
    expect(audioAceitavel(TETO_DO_AUDIO + 1).ok).toBe(false);
  });

  it("aceita o que cabe", () => {
    expect(audioAceitavel(1024).ok).toBe(true);
    expect(audioAceitavel(TETO_DO_AUDIO).ok).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import { audioAceitavel, dicaDeNomes, escolherMotor, TETO_DO_AUDIO } from "@/lib/transcricao";

describe("onde o áudio da sessão é ouvido", () => {
  it("a casa vem primeiro: é o único motor em que o áudio do paciente não sai da nossa infra", () => {
    expect(escolherMotor({ casaDisponivel: true, terapeutaTemChave: true })).toBe("casa");
    expect(escolherMotor({ casaDisponivel: true, terapeutaTemChave: false })).toBe("casa");
  });

  it("sem a casa, a chave dela segura o recurso de pé", () => {
    expect(escolherMotor({ casaDisponivel: false, terapeutaTemChave: true })).toBe("byok");
  });

  it("sem nenhum dos dois, recusa — nunca escolhe um motor que não existe", () => {
    expect(escolherMotor({ casaDisponivel: false, terapeutaTemChave: false })).toBeNull();
  });
});

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

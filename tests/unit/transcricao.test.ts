import { describe, it, expect } from "vitest";
import { audioAceitavel, dicaDeNomes, ordemDosMotores, TETO_DO_AUDIO } from "@/lib/transcricao";

describe("onde o áudio da sessão é ouvido", () => {
  it("o padrão é a chave DELA: o app não depende da nossa VPS", () => {
    expect(ordemDosMotores({ optouPelaCasa: false, casaConfigurada: true, terapeutaTemChave: true })).toEqual(["byok"]);
  });

  it("a casa só entra quando ELA liga — estar configurada não basta", () => {
    expect(ordemDosMotores({ optouPelaCasa: false, casaConfigurada: true, terapeutaTemChave: false })).toEqual([]);
  });

  it("ligada a casa, a chave dela fica de reserva NA MESMA chamada", () => {
    expect(ordemDosMotores({ optouPelaCasa: true, casaConfigurada: true, terapeutaTemChave: true })).toEqual(["casa", "byok"]);
  });

  it("ligada a casa sem chave dela, vai só a casa — e ela sabe que ficou sem reserva", () => {
    expect(ordemDosMotores({ optouPelaCasa: true, casaConfigurada: true, terapeutaTemChave: false })).toEqual(["casa"]);
  });

  it("ligada a casa num ambiente sem gateway, cai na chave dela", () => {
    expect(ordemDosMotores({ optouPelaCasa: true, casaConfigurada: false, terapeutaTemChave: true })).toEqual(["byok"]);
  });

  it("sem nada, lista vazia — nunca escolhe um motor que não existe", () => {
    expect(ordemDosMotores({ optouPelaCasa: true, casaConfigurada: false, terapeutaTemChave: false })).toEqual([]);
    expect(ordemDosMotores({ optouPelaCasa: false, casaConfigurada: false, terapeutaTemChave: false })).toEqual([]);
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

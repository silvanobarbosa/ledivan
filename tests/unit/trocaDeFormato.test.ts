import { describe, expect, it } from "vitest";
import { dataDoPreco, diaDoFormulario, formatoMudou, vigenciasAGravar } from "@/lib/trocaDeFormato";

const hoje = new Date(2026, 8, 15, 16, 30);

describe("mudou ou não mudou", () => {
  it("salvar o cadastro sem mexer no formato não é troca", () => {
    expect(formatoMudou({ formato: "mensal", pacoteTipo: "completo" }, { formato: "mensal", pacoteTipo: "completo" })).toBe(false);
  });

  it("tipo de pacote esquecido num formato sem pacote não é troca", () => {
    expect(formatoMudou({ formato: "sessao", pacoteTipo: "completo" }, { formato: "sessao", pacoteTipo: null })).toBe(false);
  });

  it("completo → fragmentado é troca", () => {
    expect(formatoMudou({ formato: "mensal", pacoteTipo: "completo" }, { formato: "mensal", pacoteTipo: "fragmentado" })).toBe(true);
  });

  it("gratuito → a cada sessão é troca", () => {
    expect(formatoMudou({ formato: "gratuito" }, { formato: "sessao" })).toBe(true);
  });
});

describe("o dia do formulário", () => {
  it("lê AAAA-MM-DD como meia-noite daquele dia", () => {
    expect(diaDoFormulario("2026-09-10")?.getTime()).toBe(new Date(2026, 8, 10).getTime());
  });

  it("recusa data que não existe e lixo", () => {
    expect(diaDoFormulario("2026-02-31")).toBeNull();
    expect(diaDoFormulario("10/09/2026")).toBeNull();
    expect(diaDoFormulario("")).toBeNull();
    expect(diaDoFormulario(null)).toBeNull();
  });
});

describe("as linhas a gravar", () => {
  const base = { hoje, jaTemHistorico: true, inicioDoPaciente: new Date(2026, 0, 5) };

  it("não mudou: nada", () => {
    expect(vigenciasAGravar({ ...base, anterior: { formato: "sessao" }, novo: { formato: "sessao" }, desde: "2026-09-20" })).toEqual([]);
  });

  it("mudou com data: uma linha a partir daquele dia", () => {
    const l = vigenciasAGravar({ ...base, anterior: { formato: "gratuito" }, novo: { formato: "sessao" }, desde: "2026-09-20" });
    expect(l).toEqual([{ formato: "sessao", pacoteTipo: null, dataEfetiva: new Date(2026, 8, 20) }]);
  });

  it("mudou sem data: vale a partir de HOJE, à meia-noite", () => {
    const [l] = vigenciasAGravar({ ...base, anterior: { formato: "gratuito" }, novo: { formato: "sessao" }, desde: "" });
    expect(l.dataEfetiva.getTime()).toBe(new Date(2026, 8, 15).getTime());
  });

  it("formato com pacote grava o tipo; sem pacote grava nulo", () => {
    const [a] = vigenciasAGravar({ ...base, anterior: { formato: "sessao" }, novo: { formato: "mensal", pacoteTipo: "fragmentado" }, desde: null });
    expect(a.pacoteTipo).toBe("fragmentado");
    const [b] = vigenciasAGravar({ ...base, anterior: { formato: "mensal", pacoteTipo: "completo" }, novo: { formato: "gratuito", pacoteTipo: "completo" }, desde: null });
    expect(b.pacoteTipo).toBeNull();
  });

  it("SEM HISTÓRICO: grava primeiro o formato antigo desde o início — senão o novo tomaria o passado", () => {
    const l = vigenciasAGravar({
      ...base,
      jaTemHistorico: false,
      anterior: { formato: "gratuito" },
      novo: { formato: "sessao" },
      desde: "2026-09-20",
    });
    expect(l).toEqual([
      { formato: "gratuito", pacoteTipo: null, dataEfetiva: new Date(2026, 0, 5) },
      { formato: "sessao", pacoteTipo: null, dataEfetiva: new Date(2026, 8, 20) },
    ]);
  });

  it("sem histórico e início DEPOIS da troca: o antigo cola na véspera, nunca depois do novo", () => {
    const l = vigenciasAGravar({
      ...base,
      jaTemHistorico: false,
      inicioDoPaciente: new Date(2026, 9, 1),
      anterior: { formato: "gratuito" },
      novo: { formato: "sessao" },
      desde: "2026-09-20",
    });
    expect(l[0].dataEfetiva.getTime()).toBeLessThan(l[1].dataEfetiva.getTime());
  });
});

describe("de quando vale o preço novo — defeito achado no percurso real", () => {
  it("saindo de gratuito a partir de 01/09, o preço novo também vale desde 01/09", () => {
    // Antes nascia com a data de hoje, e as sessões de 01 e 08/09 caíam no preço R$ 0.
    const d = dataDoPreco({ dataEfetiva: null, formatoMudou: true, formatoDesde: "2026-09-01", hoje });
    expect(d.getTime()).toBe(new Date(2026, 8, 1).getTime());
  });

  it("data explícita do preço manda", () => {
    const d = dataDoPreco({ dataEfetiva: "2026-10-01", formatoMudou: true, formatoDesde: "2026-09-01", hoje });
    expect(d.getTime()).toBe(new Date("2026-10-01").getTime());
  });

  it("só o preço mudou (formato igual): vale de hoje, como antes", () => {
    const d = dataDoPreco({ dataEfetiva: null, formatoMudou: false, formatoDesde: "2026-09-01", hoje });
    expect(d.getTime()).toBe(hoje.getTime());
  });
});

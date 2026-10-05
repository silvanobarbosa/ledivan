import { describe, expect, it } from "vitest";
import { vigenciasAGravar } from "@/lib/trocaDeFormato";

/**
 * O QUE SE GRAVA NO HISTÓRICO DE FORMATO — com foco no PRIMEIRO cadastro financeiro (doc 18).
 *
 * O defeito: ao salvar o primeiro financeiro, o sistema inventava uma linha-base de "Avulso" antes
 * da modalidade escolhida, e o histórico mostrava "Avulso → Gratuito" de uma troca que nunca houve.
 * "Não definido" (null/"") não é Avulso — é o estado de quem salvou só os Dados.
 */

const inicio = new Date(2024, 7, 7); // 07/08/2024 (como no print do dono)
const hoje = new Date(2024, 7, 8); // 08/08/2024
const base = { desde: null, hoje, inicioDoPaciente: inicio };

describe("primeiro cadastro financeiro (doc 18): sem 'anterior' fictício", () => {
  it("Gratuito: grava SÓ 'gratuito', como entrada — nada de Avulso antes", () => {
    const linhas = vigenciasAGravar({ ...base, anterior: { formato: null }, novo: { formato: "gratuito" }, jaTemHistorico: false });
    expect(linhas).toHaveLength(1);
    expect(linhas[0].formato).toBe("gratuito");
    expect(linhas[0].dataEfetiva.getTime()).toBe(new Date(2024, 7, 7).getTime());
  });

  it("Avulso como 1ª escolha: grava 'sessao' (antes dava [] e sumia do histórico)", () => {
    const linhas = vigenciasAGravar({ ...base, anterior: { formato: null }, novo: { formato: "sessao" }, jaTemHistorico: false });
    expect(linhas).toHaveLength(1);
    expect(linhas[0].formato).toBe("sessao");
  });

  it("Mensal: uma linha só, com o tipo de pacote normalizado", () => {
    const linhas = vigenciasAGravar({ ...base, anterior: { formato: "" }, novo: { formato: "mensal", pacoteTipo: "completo" }, jaTemHistorico: false });
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ formato: "mensal", pacoteTipo: "completo" });
  });

  it("nada definido (novo também vazio): não grava nada", () => {
    const linhas = vigenciasAGravar({ ...base, anterior: { formato: null }, novo: { formato: null }, jaTemHistorico: false });
    expect(linhas).toHaveLength(0);
  });
});

describe("troca DEPOIS de já existir financeiro: 'anterior → nova' continua valendo", () => {
  it("com histórico, a troca grava só a nova (a partir da data)", () => {
    const linhas = vigenciasAGravar({ ...base, desde: "2024-09-01", anterior: { formato: "gratuito" }, novo: { formato: "mensal", pacoteTipo: "completo" }, jaTemHistorico: true });
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toMatchObject({ formato: "mensal" });
    expect(linhas[0].dataEfetiva.getTime()).toBe(new Date(2024, 8, 1).getTime());
  });

  it("modalidade anterior REAL sem histórico (legado): grava base antiga + nova", () => {
    const linhas = vigenciasAGravar({ ...base, desde: "2024-09-01", anterior: { formato: "gratuito" }, novo: { formato: "mensal", pacoteTipo: "completo" }, jaTemHistorico: false });
    expect(linhas).toHaveLength(2);
    expect(linhas[0].formato).toBe("gratuito");
    expect(linhas[1].formato).toBe("mensal");
  });

  it("salvar sem mudar o formato não grava nada", () => {
    const linhas = vigenciasAGravar({ ...base, anterior: { formato: "mensal", pacoteTipo: "completo" }, novo: { formato: "mensal", pacoteTipo: "completo" }, jaTemHistorico: true });
    expect(linhas).toHaveLength(0);
  });
});

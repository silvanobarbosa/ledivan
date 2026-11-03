import { describe, it, expect } from "vitest";
import { PARA_A_CONTADORA, tutorialDoMunicipio } from "@/lib/tutorialNfse";

/**
 * O doc 76 proíbe simular emissão e manda apresentar alternativa oficial. Estes testes travam as
 * duas coisas: nenhum cenário promete emissão dentro do app, e nenhum cenário termina sem saída.
 */

const SITUACOES = ["emissor_nacional", "so_ambiente", "fora", "desconhecido"] as const;

describe("tutorial da nota — todo cenário tem saída e nenhum promete demais", () => {
  it("os quatro cenários têm resumo, roteiro e ao menos um passo", () => {
    for (const s of SITUACOES) {
      const t = tutorialDoMunicipio(s, "ALGUM LUGAR");
      expect(t.resumo.length).toBeGreaterThan(10);
      expect(t.oQueOLedivanFaz.length).toBeGreaterThan(10);
      expect(t.passos.length).toBeGreaterThan(0);
    }
  });

  it("nenhum cenário diz que o Ledivan emite a nota sozinho", () => {
    for (const s of SITUACOES) {
      const t = tutorialDoMunicipio(s, "ALGUM LUGAR");
      expect(t.oQueOLedivanFaz).not.toMatch(/o Ledivan emite\b/i);
    }
  });

  it("onde NÃO há caminho nacional, o texto diz isso e aponta a prefeitura", () => {
    for (const s of ["so_ambiente", "fora"] as const) {
      const t = tutorialDoMunicipio(s, "ALGUM LUGAR");
      expect(t.passos.some((p) => p.quem === "prefeitura")).toBe(true);
    }
  });

  it("todo cenário oferece levar para a contadora — metade disso é decisão tributária", () => {
    for (const s of SITUACOES) {
      expect(tutorialDoMunicipio(s, "X").passos.some((p) => p.quem === "contadora")).toBe(true);
    }
  });

  it("os links são sempre oficiais: gov.br, e mais ninguém", () => {
    for (const s of SITUACOES) {
      for (const p of tutorialDoMunicipio(s, "X").passos) {
        if (!p.link) continue;
        expect(p.link.url).toMatch(/^https:\/\/(www\.)?(gov\.br|nfse\.gov\.br)/);
      }
    }
  });

  it("o nome do município aparece no resumo quando é conhecido", () => {
    expect(tutorialDoMunicipio("emissor_nacional", "ABADIANIA").resumo).toContain("ABADIANIA");
  });

  it("sem o nome, o texto não fica quebrado", () => {
    const t = tutorialDoMunicipio("fora", null);
    expect(t.resumo).not.toContain("null");
    expect(t.resumo).not.toContain("undefined");
  });

  it("quem pode emitir recebe o passo do cadastro; quem não pode, não recebe", () => {
    const pode = tutorialDoMunicipio("emissor_nacional", "X");
    const naoPode = tutorialDoMunicipio("fora", "X");
    expect(pode.passos.some((p) => /Emissor Nacional/i.test(p.titulo))).toBe(true);
    expect(naoPode.passos.some((p) => /Emissor Nacional/i.test(p.titulo))).toBe(false);
  });

  it("a lista para a contadora cobre o que o doc 76 pede na configuração", () => {
    const campos = PARA_A_CONTADORA.map((c) => c.campo.toLowerCase()).join(" | ");
    for (const exigido of ["cpf", "cnpj", "município", "inscrição municipal", "endereço", "código do serviço"]) {
      expect(campos).toContain(exigido);
    }
  });

  it("o CNPJ técnico é explicado como NÃO sendo de MEI nem de empresa", () => {
    const linha = PARA_A_CONTADORA.find((c) => /CNPJ/.test(c.campo));
    expect(linha?.porque).toMatch(/não é CNPJ de MEI|Não é CNPJ de MEI/i);
  });
});

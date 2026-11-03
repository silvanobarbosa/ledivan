import { describe, it, expect } from "vitest";
import {
  COM_EMISSOR_NACIONAL, TOTAL_DE_MUNICIPIOS, chaveDoNome, consultarMunicipio,
  municipiosDaUf, ufsConhecidas,
} from "@/lib/municipioNfse";

/**
 * A consulta de município é o que impede o app de PROMETER uma emissão que não existe — que é a
 * proibição explícita do doc 76 ("sem simular uma emissão dentro do Le'Divan").
 *
 * Os casos aqui são municípios reais da planilha oficial de 28/09/2026, escolhidos porque cada um
 * cai num ramo diferente da resposta.
 */

describe("consulta de município — a lista oficial", () => {
  it("cobre o Brasil inteiro e as 27 unidades da federação", () => {
    expect(TOTAL_DE_MUNICIPIOS).toBeGreaterThan(5500);
    expect(ufsConhecidas().length).toBe(27);
  });

  it("metade do país NÃO tem Emissor Nacional — é por isso que a pergunta existe", () => {
    const fatia = COM_EMISSOR_NACIONAL / TOTAL_DE_MUNICIPIOS;
    expect(fatia).toBeGreaterThan(0.4);
    expect(fatia).toBeLessThan(0.7);
  });
});

describe("consulta de município — os quatro desfechos", () => {
  it("Brasília: está no ambiente nacional e NÃO no emissor", () => {
    // O caso que separa as duas colunas. Ler só "aderiu" prometeria emissão onde não há.
    const r = consultarMunicipio("DF", "Brasília");
    expect(r.situacao).toBe("so_ambiente");
    expect(r.nome).toBe("BRASILIA");
  });

  it("Abadiânia (GO): emissor nacional, dá para emitir pelo caminho nacional", () => {
    expect(consultarMunicipio("GO", "Abadiânia").situacao).toBe("emissor_nacional");
  });

  it("município que não existe na lista volta como desconhecido, nunca como 'não dá'", () => {
    const r = consultarMunicipio("SP", "Cidade Que Não Existe");
    expect(r.situacao).toBe("desconhecido");
    expect(r.nome).toBeNull();
  });

  it("UF ou nome em branco não inventa resposta", () => {
    expect(consultarMunicipio("", "Brasília").situacao).toBe("desconhecido");
    expect(consultarMunicipio("DF", "").situacao).toBe("desconhecido");
  });

  it("a resposta carrega a data de PUBLICAÇÃO da lista, não a da geração do arquivo", () => {
    // A tela mostra esta data. Exibir a data em que o script rodou faria o app afirmar que a
    // lista é de hoje enquanto mostra dados de meses atrás.
    const r = consultarMunicipio("DF", "Brasília");
    expect(r.dadosDe).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.dadosDe).not.toBe(new Date().toISOString().slice(0, 10));
  });
});

describe("consulta de município — o nome como as pessoas escrevem", () => {
  it("acento não atrapalha: a planilha vem sem, quem digita escreve com", () => {
    const com = consultarMunicipio("GO", "Abadiânia");
    const sem = consultarMunicipio("GO", "ABADIANIA");
    expect(com.situacao).toBe(sem.situacao);
    expect(com.nome).toBe(sem.nome);
  });

  it("caixa e espaço sobrando não atrapalham", () => {
    expect(consultarMunicipio("df", "  brasilia  ").nome).toBe("BRASILIA");
  });

  it("apóstrofo some na chave — a planilha escreve D'OESTE", () => {
    expect(chaveDoNome("Mirassol d'Oeste")).toBe("MIRASSOL DOESTE");
    expect(chaveDoNome("Mirassol D’Oeste")).toBe("MIRASSOL DOESTE");
  });

  it("os 34 nomes com apóstrofo achados dos três jeitos que alguém digita", () => {
    const esperado = consultarMunicipio("MT", "MIRASSOL D'OESTE");
    expect(esperado.situacao).not.toBe("desconhecido");
    for (const jeito of ["Mirassol d'Oeste", "Mirassol D’Oeste", "Mirassol D Oeste", "mirassol doeste"]) {
      expect(consultarMunicipio("MT", jeito).nome).toBe(esperado.nome);
    }
  });
});

describe("consulta de município — a lista por UF alimenta a tela", () => {
  it("São Paulo tem centenas de municípios, em ordem", () => {
    const sp = municipiosDaUf("SP");
    expect(sp.length).toBeGreaterThan(500);
    expect([...sp]).toEqual([...sp].sort((a, b) => a.localeCompare(b, "pt-BR")));
  });

  it("UF inexistente devolve lista vazia, não erro", () => {
    expect(municipiosDaUf("XX")).toEqual([]);
  });
});

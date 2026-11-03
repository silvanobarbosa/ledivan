/**
 * O MUNICÍPIO DELA ACEITA NFS-e PELO CAMINHO NACIONAL? (doc 76)
 *
 * Esta é a primeira pergunta de toda a funcionalidade de nota, e a mais fácil de responder
 * errado. O documento do dono manda, com todas as letras: *"caso não exista integração disponível
 * para determinada situação, informar claramente ao profissional e apresentar uma alternativa
 * oficial, SEM SIMULAR uma emissão dentro do Le'Divan"*.
 *
 * Três fatos medidos em 03/11/2026 que explicam por que a resposta não é um sim/não:
 *
 * 1. **Aderir ao Ambiente Nacional não é aderir ao Emissor Nacional.** São colunas diferentes na
 *    planilha oficial, e divergem muito: dos 5.571 municípios, 5.543 estão no ambiente, mas só
 *    **2.870 (51,5%)** estão no emissor E ativos. Brasília é um deles: ambiente sim, emissor não.
 *    Quem lê só a primeira coluna promete emissão para metade do país que não a tem.
 * 2. **`adn.nfse.gov.br` recusa a conexão no handshake TLS** — sem certificado não se lê nem a
 *    documentação. Então a consulta NÃO pode ser feita contra a API: ela se faz contra a planilha
 *    que o gov.br publica aberta, e por isso ela é uma FOTOGRAFIA com data (ver `geradoEm`).
 * 3. **A lista muda todo mês.** Município com `Início de Vigência` no futuro entra sozinho depois.
 *    Por isso a resposta carrega a data da foto: dizer "não dá" com um dado de seis meses atrás é
 *    tão ruim quanto dizer "dá" sem conferir.
 *
 * Funções puras. A tabela vem de `src/data/municipios-nfse.json`, gerada por
 * `scripts/gerar-municipios-nfse.mjs`.
 */

import tabela from "@/data/municipios-nfse.json";

const AMBIENTE = 1;
const EMISSOR = 2;
const ATIVO = 4;

export type SituacaoDoMunicipio =
  /** Dá para emitir pelo caminho nacional. */
  | "emissor_nacional"
  /** Manda dados para o ambiente nacional, mas a emissão é pelo sistema da prefeitura. */
  | "so_ambiente"
  /** Nem ambiente nem emissor: tudo pela prefeitura. */
  | "fora"
  /** O nome não foi encontrado na lista oficial. */
  | "desconhecido";

export type RespostaDoMunicipio = {
  situacao: SituacaoDoMunicipio;
  uf: string;
  /** O nome como está na planilha oficial, quando encontrado. */
  nome: string | null;
  /** Desde quando o convênio vale, como a planilha escreve (dd/mm/aaaa). */
  inicioVigencia: string | null;
  /** A data em que o gov.br publicou a lista. `null` se a fonte nao a declarou. */
  dadosDe: string | null;
};

/**
 * Tira acento, pontuação e caixa — dos DOIS lados.
 *
 * A planilha já vem sem acento ("ABADIA DE GOIAS"), mas quem digita escreve "Abadia de Goiás".
 * Normalizar só um lado faz a busca falhar justamente nos nomes com acento, que no Brasil é
 * quase todo lugar. E `d'Oeste` / `D'Oeste` / `dOeste` são o mesmo município.
 */
export function chaveDoNome(nome: string): string {
  return (nome ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/['´`’]/g, "")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();
}

type Linha = [string, number, string];
/**
 * O JSON e gerado por script, entao o TypeScript so consegue inferir `(string | number)[][]`.
 * O formato de cada linha esta travado pelo gerador e pelos testes, nao pelo tipo do import —
 * por isso a conversao passa por `unknown`.
 */
const dados = tabela as unknown as {
  listaDe: string | null; geradoEm: string; total: number; comEmissorNacionalAtivo: number;
  municipios: Record<string, Linha[]>;
};
const porUf = dados.municipios;

/** As UFs que a tabela conhece, em ordem. */
export function ufsConhecidas(): string[] {
  return Object.keys(porUf).sort();
}

/** Os municípios de uma UF, com o nome como a planilha escreve. */
export function municipiosDaUf(uf: string): string[] {
  return (porUf[(uf ?? "").toUpperCase()] ?? []).map((l) => l[0]);
}

/**
 * A data em que o gov.br PUBLICOU a lista — nao a data em que o arquivo foi gerado aqui.
 *
 * Sao coisas diferentes e a tela mostra esta. Dizer "lista atualizada em 03/11" exibindo dados de
 * 28/09 e uma afirmacao errada numa tela sobre nota fiscal.
 */
export const DADOS_DE = dados.listaDe;
/** Quantos municípios têm Emissor Nacional ativo — o número que a tela usa para dar contexto. */
export const COM_EMISSOR_NACIONAL = dados.comEmissorNacionalAtivo;
export const TOTAL_DE_MUNICIPIOS = dados.total;

export function consultarMunicipio(uf: string, nome: string): RespostaDoMunicipio {
  const sigla = (uf ?? "").trim().toUpperCase();
  const alvo = chaveDoNome(nome);
  const base: Omit<RespostaDoMunicipio, "situacao"> = {
    uf: sigla, nome: null, inicioVigencia: null, dadosDe: DADOS_DE,
  };
  if (!sigla || !alvo) return { ...base, situacao: "desconhecido" };

  const lista = porUf[sigla] ?? [];
  /**
   * Primeiro a comparação normal. Se falhar, compara SEM OS ESPAÇOS.
   *
   * A planilha escreve `MIRASSOL D'OESTE`; tirar o apóstrofo dá `MIRASSOL DOESTE`, que casa com
   * quem digita "Mirassol d'Oeste". Mas quem digita "Mirassol D Oeste" produz `MIRASSOL D OESTE`
   * e não casava. São 34 municípios com apóstrofo no nome ("Olho d'Água", "São João d'Aliança"),
   * e errar o município é errar a resposta inteira sobre poder ou não emitir.
   *
   * O risco de dois municípios da MESMA UF colidirem só pela falta do espaço é desprezível, e a
   * comparação sem espaço só roda quando a exata já não achou nada.
   */
  const semEspaco = (s: string) => s.replace(/ /g, "");
  const linha = lista.find((l) => chaveDoNome(l[0]) === alvo)
    ?? lista.find((l) => semEspaco(chaveDoNome(l[0])) === semEspaco(alvo));
  if (!linha) return { ...base, situacao: "desconhecido" };

  const [achado, bits, inicio] = linha;
  const comum = { ...base, nome: achado, inicioVigencia: inicio || null };

  /**
   * Convênio inativo é tratado como FORA, não como emissor.
   *
   * Um município que aderiu e depois saiu não emite hoje — e prometer emissão por causa da
   * adesão antiga é exatamente o erro que o documento proíbe.
   */
  if (!(bits & ATIVO)) return { ...comum, situacao: "fora" };
  if (bits & EMISSOR) return { ...comum, situacao: "emissor_nacional" };
  if (bits & AMBIENTE) return { ...comum, situacao: "so_ambiente" };
  return { ...comum, situacao: "fora" };
}

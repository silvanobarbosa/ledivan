#!/usr/bin/env node
/**
 * GERA A TABELA DE MUNICÍPIOS DA NFS-e NACIONAL a partir da planilha OFICIAL.
 *
 * A fonte é o arquivo que o próprio gov.br publica em
 * `https://www.gov.br/nfse/pt-br/municipios/monitoramento-adesoes/` — o nome dele carrega a data
 * (`municipios-aderentes-AAAAMMDD.xlsx`) e a lista MUDA TODO MÊS, com municípios entrando e com
 * datas de início de vigência futuras virando presentes.
 *
 * Por isso este script existe: a tabela no repo é uma FOTOGRAFIA, e qualquer pessoa precisa
 * conseguir tirar outra sem adivinhar o formato. Rodar:
 *
 *     node scripts/gerar-municipios-nfse.mjs <caminho-ou-url-do-xlsx>
 *
 * O que ele guarda, por município, são as três respostas que mudam a vida de quem vai emitir:
 *
 * - `ambiente`  (AderenteAmbienteNacional): o município manda os dados para o ADN.
 * - `emissor`   (AderenteEmissorNacional): dá para emitir pelo EMISSOR NACIONAL. É esta que
 *               decide se o caminho nacional serve — e ela é diferente da anterior. Medido em
 *               03/11/2026: 5.571 municípios no arquivo, 2.870 com emissor E ativos (51,5%).
 *               Brasília, por exemplo, está no ambiente e NÃO está no emissor.
 * - `ativo`     (AtivoNaBase): o convênio está de pé agora.
 *
 * O nome vem da planilha já sem acento e em caixa alta; a busca normaliza dos dois lados.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { read, utils } from "xlsx";

const origem = process.argv[2];
if (!origem) {
  console.error("uso: node scripts/gerar-municipios-nfse.mjs <caminho-ou-url-do-xlsx>");
  process.exit(1);
}

const bytes = /^https?:\/\//.test(origem)
  ? Buffer.from(await (await fetch(origem)).arrayBuffer())
  : readFileSync(origem);

const planilha = read(bytes, { type: "buffer" });
const linhas = utils.sheet_to_json(planilha.Sheets[planilha.SheetNames[0]]);

const sim = (v) => String(v ?? "").trim().toLowerCase() === "sim";
const porUf = {};
let total = 0;
let comEmissor = 0;

for (const l of linhas) {
  const uf = String(l.UF ?? "").trim().toUpperCase();
  const nome = String(l.NomeMunicipio ?? "").trim().toUpperCase();
  if (!uf || !nome) continue;
  total++;
  const emissor = sim(l.AderenteEmissorNacional);
  const ativo = sim(l.AtivoNaBase);
  if (emissor && ativo) comEmissor++;
  /**
   * Três booleanos viram um número de 0 a 7. São 5.571 linhas: guardar `"Sim"`/`"Não"` triplicava
   * o arquivo sem dizer nada a mais.
   */
  const bits = (sim(l.AderenteAmbienteNacional) ? 1 : 0) | (emissor ? 2 : 0) | (ativo ? 4 : 0);
  (porUf[uf] ??= []).push([nome, bits, String(l["Início de Vigência"] ?? "").trim()]);
}

for (const uf of Object.keys(porUf)) porUf[uf].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));

/**
 * A DATA QUE VALE É A DA LISTA, NÃO A DO DIA EM QUE O SCRIPT RODOU.
 *
 * O nome do arquivo oficial carrega a data da publicação (`municipios-aderentes-20260928.xlsx`).
 * Mostrar na tela a data da GERAÇÃO faria o app dizer "lista atualizada em 03/11" exibindo dados
 * de 28/09 — uma afirmação errada numa tela sobre nota fiscal, que é onde ela custa mais caro.
 * Sem data no nome do arquivo, fica `null` e a tela não afirma nada.
 */
const daData = String(origem).match(/(\d{4})(\d{2})(\d{2})/);
const listaDe = daData ? `${daData[1]}-${daData[2]}-${daData[3]}` : null;

const saida = {
  _leia: "Gerado por scripts/gerar-municipios-nfse.mjs a partir da planilha oficial do gov.br. Não editar à mão.",
  listaDe,
  fonte: /^https?:\/\//.test(origem) ? origem : origem.split(/[\\/]/).pop(),
  geradoEm: new Date().toISOString().slice(0, 10),
  total,
  comEmissorNacionalAtivo: comEmissor,
  // bits: 1 = ambiente nacional, 2 = emissor nacional, 4 = ativo na base
  municipios: porUf,
};

const destino = "src/data/municipios-nfse.json";
writeFileSync(destino, JSON.stringify(saida));
console.log(`${destino}: ${total} municípios, ${comEmissor} com Emissor Nacional ativo (${((comEmissor / total) * 100).toFixed(1)}%)`);
console.log(listaDe ? `lista publicada em ${listaDe}` : "SEM data no nome do arquivo — a tela não mostrará data da lista");

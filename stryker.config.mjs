/**
 * TESTE DE MUTAÇÃO — a pergunta que cobertura não responde.
 *
 * Cobertura diz "esta linha rodou durante os testes". Não diz se algum teste NOTARIA que ela está
 * errada. O Stryker estraga o código de propósito — troca `>` por `>=`, inverte condição, apaga
 * uma linha — e vê se algum teste fica vermelho. Mutante que sobrevive é um lugar onde a suíte é
 * cega.
 *
 * Por que isto entrou aqui (02/11/2026): a dica mandada ao Whisper era cortada por caractere onde
 * o provedor cobra BYTES. Os oito testes da função passavam verdes, porque usavam nomes em ASCII
 * num app em português. Trocar `bytesDe(x)` por `x.length` é literalmente um mutante — e, até
 * ontem, ele sobreviveria à suíte inteira. Ver [[licao-dica-do-whisper-tem-teto]].
 *
 * ESCOPO: os motores PUROS onde o erro é silencioso e caro — tamanho de texto que vai a provedor
 * e leitura de fala que vira dinheiro. Mutar o app inteiro levaria horas e devolveria ruído; o
 * valor está onde um engano não dá erro, só dá número errado.
 *
 * NÃO é gate de CI (leva minutos e o runner é um só). Roda sob demanda: `npm run test:mutation`,
 * e sempre que mexer nestes arquivos.
 */
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  packageManager: "npm",
  testRunner: "vitest",
  coverageAnalysis: "perTest",
  mutate: [
    "src/lib/transcricao.ts",
    "src/lib/previaDoComando.ts",
    "src/lib/reciboDaVoz.ts",
    "src/lib/motivoDoProvedor.ts",
  ],
  reporters: ["html", "clear-text", "progress"],
  htmlReporter: { fileName: "reports/mutation/index.html" },
  /**
   * `break` reprova se o placar CAIR. É catraca: sobe conforme a suíte melhora, nunca desce.
   *
   * 80 sai da primeira medição real — 84,25% em 02/11 (245 mutantes mortos, 44 sobreviventes,
   * 70 segundos) — com uma folga pequena para variação. Número de catraca escolhido por palpite
   * não segura nada: ou é tão baixo que nunca reprova, ou vive vermelho e a gente desliga.
   *
   * Os sobreviventes de hoje são, na maioria, texto de mensagem trocado por "" — mutante que
   * ninguém quer matar com teste. Os que importam (comparação de tamanho, limite, ordem) estão
   * mortos.
   */
  thresholds: { high: 90, low: 75, break: 80 },
};

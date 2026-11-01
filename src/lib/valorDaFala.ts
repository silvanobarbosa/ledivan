/**
 * QUANTO ELA DISSE, E EM QUE FORMA.
 *
 * O pedaço de dinheiro de uma fala — "lança o pagamento da Talita, 300 reais no pix". Três
 * decisões moram aqui, e as três existem para que a voz nunca invente um número:
 *
 * 1. **Só dígito vira valor.** "trezentos reais" por extenso NÃO é lido: a transcrição às vezes
 *    escreve por extenso, às vezes em dígito, e um dicionário de numerais em português erra em
 *    casos que ninguém testa ("cento e vinte e cinco"). Não entendeu, devolve `null` — e a tela
 *    pede. Chutar o valor de um pagamento é errar dinheiro com a cara de quem acertou.
 * 2. **O valor sai da frase.** O que sobra vai para `pacienteDaFala`, e nome se resolve melhor
 *    sem "300" e "pix" no meio.
 * 3. **A forma é OPCIONAL.** Não dita, a tela usa o padrão dela; o que esta função não faz é
 *    adivinhar entre pix e crédito, que mudam o líquido no caixa (doc 49).
 *
 * Funções puras.
 */

/** As formas que a coluna `method` aceita, do jeito que se fala. Ordem = especificidade. */
const FORMAS: { metodo: string; ditos: string[] }[] = [
  { metodo: "credito", ditos: ["cartao de credito", "no credito", "em credito", "credito"] },
  { metodo: "debito", ditos: ["cartao de debito", "no debito", "em debito", "debito"] },
  { metodo: "transfer", ditos: ["transferencia bancaria", "transferencia", "ted", "doc bancario"] },
  { metodo: "cash", ditos: ["em dinheiro", "dinheiro vivo", "dinheiro", "especie"] },
  { metodo: "pix", ditos: ["por pix", "no pix", "em pix", "via pix", "pix"] },
];

/**
 * "CARTÃO" sozinho não vira forma nenhuma — de propósito.
 *
 * O seletor tem crédito e débito separados, e eles mudam o líquido no caixa (doc 49). Escolher um
 * dos dois por ela seria adivinhar dinheiro. A palavra só sai da frase, para não atrapalhar o
 * nome; a forma fica com o padrão da tela, à vista, e ela troca se quiser.
 */
const SO_LIMPA = ["no cartao", "de cartao", "cartao"];

/**
 * O número.
 *
 * Aceita "300", "300,50", "1.200", "R$ 300" e "300 reais". A vírgula é decimal e o ponto é
 * milhar — é assim que o Whisper escreve português, e trocar os dois transforma R$ 1.200 em
 * R$ 1,20.
 */
const NUMERO = /(?:r\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?(?:\s*(?:reais|real|contos|conto|pila))?/;

/** As palavras que só servem para dizer "é dinheiro" e atrapalham achar o nome. */
const ENFEITES = /\b(reais|real|contos|conto|pila|r\$|um pagamento|o pagamento|pagamento|de valor|no valor|valor)\b/g;

export type ValorDaFala = {
  /** Em reais. `null` quando a fala não trouxe um número. */
  valor: number | null;
  /** O método do banco, ou `null` quando ela não disse — a tela usa o padrão. */
  forma: string | null;
  /** A frase sem o dinheiro: é isto que vai resolver o paciente. */
  resto: string;
};

const semAcento = (s: string) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export function valorDaFala(fala: string): ValorDaFala {
  let texto = semAcento(fala);
  if (!texto) return { valor: null, forma: null, resto: "" };

  // A FORMA sai primeiro: "no crédito" tem de sumir antes de alguém procurar nome nessa frase.
  let forma: string | null = null;
  for (const f of FORMAS) {
    for (const dito of f.ditos) {
      if (!texto.includes(dito)) continue;
      forma = f.metodo;
      texto = texto.replace(dito, " ");
      break;
    }
    if (forma) break;
  }
  if (!forma) for (const dito of SO_LIMPA) if (texto.includes(dito)) { texto = texto.replace(dito, " "); break; }

  const m = texto.match(NUMERO);
  let valor: number | null = null;
  if (m) {
    const inteiro = Number(m[1].replace(/\./g, ""));
    const centavos = m[2] ? Number(m[2].padEnd(2, "0")) : 0;
    if (Number.isFinite(inteiro)) valor = inteiro + centavos / 100;
    texto = texto.replace(m[0], " ");
  }
  // Valor zero ou negativo não é pagamento. Devolve `null` para a tela pedir, em vez de lançar 0.
  if (valor != null && !(valor > 0)) valor = null;

  const resto = texto.replace(ENFEITES, " ").replace(/\s+/g, " ").trim();
  return { valor, forma, resto };
}

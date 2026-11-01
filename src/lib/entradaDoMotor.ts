import { patientPriceHistory, sessionPayments } from "@/db/schema";
import { horaDeParede } from "@/lib/horaLocal";

/**
 * A LINHA DO BANCO VIRANDO ENTRADA DO MOTOR — num lugar só.
 *
 * `COLUNAS_DA_SESSAO` já garantia que toda tela LESSE as mesmas colunas. Não bastou: a lista de
 * cadastros lia tudo e então remontava a sessão campo a campo, e `faltouConta` ficou de fora da
 * remontagem. A coluna chegava do banco e se perdia no caminho — um andar abaixo do defeito que a
 * constante tinha resolvido, com o mesmo sintoma: a sessão AVUL convertida em GRAT continuava
 * cobrável só naquela tela, e o cadastro aparecia "Atrasado · 1" por uma cobrança que a guia Geral
 * já não tinha (doc 58).
 *
 * O mesmo vale do lado do dinheiro: `estornadoEm` era lido e descartado, e sem ele o pagamento
 * estornado voltava a quitar cobrança.
 *
 * Por isso a tradução mora aqui. Acrescentar um dado que o motor lê é mexer em dois lugares — a
 * constante e este arquivo —, e nenhuma tela pode ficar para trás sem alguém notar.
 */

/** Data do banco na hora de PAREDE: converter no fuso do runtime desloca o dia (fuso negativo). */
export const local = (d: Date | string | null | undefined): Date => new Date(horaDeParede(d));

/**
 * Tudo o que veio do `select`, mais a data em hora de parede.
 *
 * É SPREAD de propósito: assim um dado novo em `COLUNAS_DA_SESSAO` atravessa sozinho, em vez de
 * depender de alguém lembrar de acrescentá-lo também aqui — que é exatamente o que não aconteceu.
 */
export function sessaoParaMotor<T extends { date: Date | string; isOnline?: boolean | null }>(s: T) {
  return { ...s, date: local(s.date), online: s.isOnline };
}

/**
 * AS COLUNAS DO PAGAMENTO que o motor lê — num lugar só, pelo mesmo motivo das colunas da sessão.
 *
 * Doc 71: a guia Geral lia `diferenca_outra_data` e a lista de cadastros não — então a mesma
 * cobrança parcial ficava "em aberto" numa tela e "paga" na outra. Com a lista aqui, acrescentar
 * um dado do dinheiro é mexer num lugar só, e nenhuma tela fica para trás em silêncio.
 */
export const COLUNAS_DO_PAGAMENTO = {
  id: sessionPayments.id,
  amount: sessionPayments.amount,
  date: sessionPayments.date,
  status: sessionPayments.status,
  method: sessionPayments.method,
  pagoPor: sessionPayments.pagoPor,
  cobrancaChave: sessionPayments.cobrancaChave,
  quita: sessionPayments.quitaDiferenca,
  ficaNaCobranca: sessionPayments.diferencaOutraData,
  kind: sessionPayments.kind,
  estornadoEm: sessionPayments.estornadoEm,
  // Doc 72: por que a sobra não virou crédito / por que a diferença não foi cobrada.
  motivoSemCredito: sessionPayments.motivoSemCredito,
  motivoSemDiferenca: sessionPayments.motivoSemDiferenca,
} as const;

/** O mesmo do lado do dinheiro. `estornadoEm` é o que impede o estornado de quitar cobrança. */
export function pagamentoParaMotor<
  T extends {
    id: string;
    amount: string | number;
    date: Date | string;
    status: string;
    method?: string | null;
    pagoPor?: string | null;
    cobrancaChave?: string | null;
    quita?: boolean | null;
    /** Doc 68: "a diferença será lançada em outra data" — ela NÃO rola para o pacote seguinte. */
    ficaNaCobranca?: boolean | null;
    kind?: string | null;
    estornadoEm?: Date | string | null;
    /** Doc 72: a explicação escrita no lançamento. Texto livre, só para a tela. */
    motivoSemCredito?: string | null;
    motivoSemDiferenca?: string | null;
    reciboEmitidoEm?: Date | string | null;
    notaEmitidaEm?: Date | string | null;
    reciboNumero?: string | null;
  },
>(p: T) {
  return {
    id: p.id,
    valor: p.amount,
    data: local(p.date),
    status: p.status,
    metodo: p.method ?? null,
    pagoPor: p.pagoPor ?? null,
    cobrancaChave: p.cobrancaChave ?? null,
    quita: p.quita ?? null,
    // Doc 71: esta linha faltava. A coluna era lida do banco e morria aqui, e a diferença marcada
    // para ficar rolava assim mesmo para o pacote seguinte — o motor nunca soube da marca.
    ficaNaCobranca: p.ficaNaCobranca ?? null,
    kind: p.kind ?? null,
    // Nulo quando não houve estorno — e é o nulo que deixa o pagamento quitar normalmente.
    estornadoEm: p.estornadoEm ? local(p.estornadoEm) : null,
    motivoSemCredito: p.motivoSemCredito ?? null,
    motivoSemDiferenca: p.motivoSemDiferenca ?? null,
    recibo: !!p.reciboEmitidoEm,
    nota: !!p.notaEmitidaEm,
    reciboNumero: p.reciboNumero ?? null,
  };
}

/**
 * AS COLUNAS DO PREÇO que o motor lê — num lugar só, pelo mesmo motivo das colunas da sessão.
 *
 * Três telas montam a lista de preços do motor (a guia Geral, a lista de cadastros e o Fechamento).
 * Quando o doc 69 acrescentou `aplica_em`, acrescentá-la em duas e esquecer a terceira daria o
 * sintoma clássico: a mesma paciente com dois valores de pacote dependendo da tela que se abre.
 */
export const COLUNAS_DO_PRECO = {
  valor: patientPriceHistory.valor,
  dataEfetiva: patientPriceHistory.dataEfetiva,
  aplicaEm: patientPriceHistory.aplicaEm,
  // Doc 72: QUANDO o reajuste foi registrado (não de quando ele vale). É por ela que a guia Geral
  // sabe quais pagamentos já existiam quando o valor mudou.
  criadoEm: patientPriceHistory.dataCriacao,
} as const;

/** A linha de preço virando faixa do motor. `aplicaEm` ausente = `vigente` (o comportamento antigo). */
export function precoParaMotor(p: { valor: string | number; dataEfetiva: Date | string; aplicaEm?: string | null; criadoEm?: Date | string | null }) {
  return {
    valor: Number(p.valor) || 0,
    desde: local(p.dataEfetiva),
    aplicaEm: p.aplicaEm ?? null,
    criadoEm: p.criadoEm ? local(p.criadoEm) : null,
  };
}

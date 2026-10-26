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
    kind?: string | null;
    estornadoEm?: Date | string | null;
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
    kind: p.kind ?? null,
    // Nulo quando não houve estorno — e é o nulo que deixa o pagamento quitar normalmente.
    estornadoEm: p.estornadoEm ? local(p.estornadoEm) : null,
    recibo: !!p.reciboEmitidoEm,
    nota: !!p.notaEmitidaEm,
    reciboNumero: p.reciboNumero ?? null,
  };
}

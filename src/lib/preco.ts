/**
 * O PREÇO QUE VALIA — por mês e por dia.
 *
 * Saiu de `fechamento.ts` para que o motor de cobranças (`cobrancas.ts`) e a Fechamento possam os
 * dois usá-lo sem um importar o outro em círculo. `fechamento.ts` reexporta, então quem já
 * importava de lá não muda.
 */

const emData = (d: Date | string): Date => (d instanceof Date ? d : new Date(d));

/**
 * Doc 69 — a resposta de "Aplicar sobre o pacote vigente ou o próximo a iniciar?".
 *
 * `vigente` (o padrão, e o que sempre aconteceu): o valor novo vale da data dele, mesmo que o
 * pacote esteja no meio — e então aquele pacote sai com DOIS valores, as sessões de antes pelo
 * preço antigo e as de depois pelo novo.
 *
 * `proximo_pacote`: o pacote que já tinha começado fica inteiro no preço antigo, e o valor novo
 * começa a valer no pacote seguinte.
 *
 * O porquê de existirem as duas (dono, 31/10): a data que se põe em "Vale a partir de" é a data em
 * que o paciente foi AVISADO do aumento. Se ele quebra o pacote vigente em dois valores ou não
 * "depende da resposta" dele — e essa é uma conversa que o app não tem como adivinhar.
 */
export type AplicacaoDoPreco = "vigente" | "proximo_pacote";

export type PrecoVigente = {
  valor: number;
  /** A partir de quando aquele valor passou a valer. */
  desde: Date | string;
  /** Como ele entra num pacote já começado. Ausente = `vigente`, que é o comportamento antigo. */
  aplicaEm?: AplicacaoDoPreco | string | null;
  /**
   * Doc 72: quando o reajuste foi REGISTRADO — que é outra data de "a partir de quando ele vale".
   * A vigência pode ser retroativa; o registro não. É por ela que se sabe quais pagamentos já
   * existiam na hora em que o valor mudou.
   */
  criadoEm?: Date | string | null;
};

/**
 * O preço que valia naquele mês.
 *
 * Pega a última faixa que começou até o FIM do mês fechado. Usar o preço de hoje para fechar um
 * mês antigo cobraria o reajuste retroativamente — e a conta pareceria certa na tela.
 */
export function precoNoMes(historico: PrecoVigente[], ano: number, mes: number): number {
  return precoNaData(historico, new Date(ano, mes + 1, 0, 23, 59, 59, 999));
}

/**
 * O preço que valia NAQUELE DIA.
 *
 * O acumulado precisa disto, não do preço do mês: cada cobrança vale o que valia quando aconteceu.
 * Sem isso, somar o passado inteiro com o preço de hoje faria a dívida de um ano atrás **crescer
 * sozinha a cada reajuste** — e ninguém perceberia olhando a tela.
 */
export function precoNaData(historico: PrecoVigente[], quando: Date, reserva = 0): number {
  const fimDoMes = quando;
  const validos = historico
    .map((h) => ({ valor: Number(h.valor), desde: emData(h.desde) }))
    .filter((h) => Number.isFinite(h.valor) && !Number.isNaN(h.desde.getTime()))
    .filter((h) => h.desde.getTime() <= fimDoMes.getTime())
    .sort((a, b) => a.desde.getTime() - b.desde.getTime());

  if (validos.length > 0) return validos[validos.length - 1].valor;
  // Sem faixa que alcance a data: o valor do cadastro. Zero aqui apagaria a cobrança em silêncio.
  const r = Number(reserva);
  return Number.isFinite(r) && r > 0 ? r : 0;
}

/**
 * Preço para FORMATOS QUE COBRAM (mensal, a cada sessão, pacote). Um preço **0** vindo do histórico
 * — tipicamente a entrada residual gravada quando o paciente era **gratuito** (o cadastro grava
 * `patientPriceHistory` valor 0) — NÃO pode zerar a cobrança. Se a faixa aplicável for 0 mas houver
 * valor no cadastro (reserva), vale o do cadastro. Assim, ao trocar Gratuito→Mensal, a linha da
 * cobrança mostra o valor da mensalidade em vez de R$ 0,00 (e "Confirmar pagamento" deixa de dizer
 * "já está paga" por falta ≤ 0). Formato gratuito não passa por aqui — ele nem gera cobrança.
 */
export function precoCobravel(historico: PrecoVigente[], quando: Date, reserva = 0): number {
  const p = precoNaData(historico, quando, reserva);
  if (p > 0) return p;
  const r = Number(reserva);
  return Number.isFinite(r) && r > 0 ? r : p;
}

const inicioDoDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * AS FAIXAS QUE VALEM PARA UMA SEQUÊNCIA que começou naquele dia.
 *
 * Tira do caminho as faixas marcadas "próximo pacote a iniciar" que nasceram DEPOIS de a sequência
 * começar: elas não entram num pacote já em andamento. A faixa que começa no mesmo dia da primeira
 * sessão entra — esse pacote é justamente "o próximo a iniciar".
 *
 * A comparação é por DIA: a faixa é gravada à meia-noite e a sessão tem hora, e comparar os dois
 * instantes faria a sessão das 8h do próprio dia cair na faixa anterior.
 */
export function faixasDaSequencia(historico: PrecoVigente[], inicio: Date): PrecoVigente[] {
  const comecou = inicioDoDia(inicio).getTime();
  return historico.filter((h) => {
    if (h.aplicaEm !== "proximo_pacote") return true;
    const desde = emData(h.desde);
    return !Number.isNaN(desde.getTime()) && inicioDoDia(desde).getTime() <= comecou;
  });
}

/**
 * O VALOR DE UM PACOTE — somando sessão a sessão, cada uma pelo preço que valia no dia dela.
 *
 * Antes era `preço da competência × tamanho contratado`, e por isso um reajuste no meio do pacote
 * reprecificava o pacote inteiro, inclusive as sessões que já tinham acontecido pelo valor antigo.
 * Somando por sessão, o pacote sai com dois valores quando a faixa começa no meio dele — que é o
 * que o dono descreveu para a resposta "vigente".
 *
 * Quando nenhuma faixa começa dentro da sequência, a soma dá exatamente o que a multiplicação dava.
 *
 * Quem paga o tamanho CONTRATADO continua pagando o tamanho contratado: as posições sem sessão
 * (sequência ainda aberta) entram pelo preço da competência, não somem da conta.
 */
/**
 * A FAIXA QUE PARTIU ESTA SEQUÊNCIA NO MEIO — a data dela, ou `null`.
 *
 * É o reajuste respondido "pacote vigente" que começou DEPOIS da primeira sessão do pacote e já
 * alcança a competência. Quem pergunta é o valor do pacote (parte sessão a sessão) e, desde o doc
 * 72, também a guia Geral: uma diferença que só existe por causa do reajuste NÃO rola para o
 * pacote seguinte, ela fica em aberto onde nasceu.
 *
 * Uma regra só para as duas perguntas, de propósito. Duas cópias divergiriam num detalhe e as
 * telas discordariam em silêncio.
 */
export function faixaQuePartiuASequencia(
  historico: PrecoVigente[],
  opts: { inicio: Date; competencia: Date },
): Date | null {
  const faixas = faixasDaSequencia(historico, opts.inicio);
  const comecou = inicioDoDia(opts.inicio).getTime();
  const ateQuando = opts.competencia.getTime();
  const partiram = faixas
    .filter((h) => {
      if (h.aplicaEm !== "vigente") return false;
      const desde = emData(h.desde);
      return !Number.isNaN(desde.getTime()) && inicioDoDia(desde).getTime() > comecou && desde.getTime() <= ateQuando;
    })
    // A data devolvida é a do REGISTRO, não a da vigência: "Vale a partir de" pode ser retroativo,
    // e é o registro que separa o que já estava pago de quando o valor mudou. Sem registro gravado
    // (histórico antigo), vale a própria vigência.
    .map((h) => emData(h.criadoEm ?? h.desde))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  return partiram[0] ?? null;
}

export function valorDoPacote(
  historico: PrecoVigente[],
  opts: { inicio: Date; competencia: Date; datas: Date[]; total: number },
  reserva = 0,
): number {
  const faixas = faixasDaSequencia(historico, opts.inicio);
  const total = Math.max(0, Math.floor(opts.total));

  /**
   * O PASSADO NÃO SE REPRECIFICA.
   *
   * Partir o pacote sessão a sessão é a resposta "vigente" — e resposta é coisa que só existe a
   * partir do doc 69. Medido na base real antes de soltar isto: aplicar a soma a todas as faixas
   * já gravadas mexia em **216 cobranças antigas**, muitas delas já pagas, trocando o valor de
   * recibo que o paciente tem na mão. A regra do dono é explícita desde 15/09 — "o sistema nunca
   * deve apagar, criar ou modificar cobranças passadas".
   *
   * Então: faixa SEM resposta gravada (tudo o que existia antes) mantém a conta de sempre, o preço
   * da competência pelo tamanho contratado. A soma por sessão vale quando alguma faixa que começa
   * DENTRO da sequência traz a resposta "vigente", dada por quem salvou o reajuste sabendo o que
   * estava escolhendo.
   */
  const partiuNoMeio = !!faixaQuePartiuASequencia(historico, { inicio: opts.inicio, competencia: opts.competencia });
  if (!partiuNoMeio) return precoCobravel(faixas, opts.competencia, reserva) * total;

  const datas = [...opts.datas].sort((a, b) => a.getTime() - b.getTime());
  let soma = 0;
  for (let i = 0; i < total; i++) {
    soma += precoCobravel(faixas, datas[i] ?? opts.competencia, reserva);
  }
  return soma;
}

/**
 * O mesmo julgamento, para a QUINZENA — que cobra as sessões que caíram nela, e não o contratado.
 *
 * Devolve `null` quando nenhuma faixa respondida parte a sequência no meio: aí quem chama mantém a
 * conta de sempre (preço da competência × sessões cobráveis), e nenhuma cobrança antiga se mexe.
 */
export function valorPorSessao(
  historico: PrecoVigente[],
  opts: { inicio: Date; competencia: Date; datas: Date[] },
  reserva = 0,
): number | null {
  const faixas = faixasDaSequencia(historico, opts.inicio);
  const partiuNoMeio = !!faixaQuePartiuASequencia(historico, { inicio: opts.inicio, competencia: opts.competencia });
  if (!partiuNoMeio) return null;
  return opts.datas.reduce((soma, d) => soma + precoCobravel(faixas, d, reserva), 0);
}

/**
 * Quando o preço vence, e quanto o paciente paga no mês.
 *
 * Duas regras do dono moram aqui, e as duas são de dinheiro:
 *
 * 1. A validade do preço é contada em MESES a partir do início do tratamento. Se o paciente parou
 *    e voltou, a referência passa a ser a data do RETORNO — que é quando o status sai de inativo
 *    para ativo. Contar do início original faria o reajuste vencer no dia em que a pessoa volta,
 *    depois de meses sem atendimento.
 *
 * 2. O total do pacote Completo é a QUANTIDADE informada no cadastro (doc 18) — acabou o número
 *    fixo de 4 (fica só como rede para cadastro legado sem a quantidade). Quando é fragmentado,
 *    quem diz o total é a AGENDA: o sistema conta as sessões que caem dentro do mês (ver
 *    lib/pacoteMes).
 *
 * Tudo aqui é função pura: decide, não grava.
 */

/**
 * Os seis formatos que o dono combina com o paciente.
 *
 * `primeira_pacote` e `ultima_pacote` cobram o pacote inteiro de uma vez — na primeira ou na
 * última sessão dele — e por isso não têm dia de pagamento: o dia é o da sessão.
 */
export type FormatoPagamento =
  | "gratuito" | "sessao" | "mensal" | "quinzenal" | "primeira_pacote" | "ultima_pacote";

/** Formatos que fecham as contas por PACOTE (e portanto perguntam completo ou fragmentado). */
export const FORMATOS_COM_PACOTE = ["mensal", "quinzenal", "primeira_pacote", "ultima_pacote"];

export function usaPacote(formato: FormatoPagamento | string | null | undefined): boolean {
  return FORMATOS_COM_PACOTE.includes(formato ?? "");
}

export const SESSOES_PACOTE_COMPLETO = 4;

/** O formato aceita valor e pacote? Gratuito não — é atendimento social. */
export function cobra(formato: FormatoPagamento | string | null | undefined): boolean {
  return formato !== "gratuito" && !!formato;
}

/**
 * A data de referência do preço: o retorno, se houve; senão, o início.
 *
 * Retorno é a data em que o paciente voltou a ficar ativo depois de um período inativo.
 */
export function referenciaDoPreco(
  inicio: Date | null | undefined,
  retorno: Date | null | undefined,
  /**
   * Doc 63: a vigência do ÚLTIMO reajuste de preço, quando existe.
   *
   * Sem ela, a conta voltava sempre ao início do tratamento — e qualquer salvamento posterior do
   * Financeiro (mudar o dia de vencimento, por exemplo) apagava a baixa do reajuste e trazia o
   * paciente de volta para a lista de "Reajustes a vencer", já vencido. Foi o que a dona viu:
   * registrou a alteração de valor e o lembrete continuou lá.
   */
  ultimoReajuste?: Date | null | undefined,
): Date | null {
  const candidatas = [inicio, retorno, ultimoReajuste].filter((d): d is Date => !!d);
  if (!candidatas.length) return null;
  return candidatas.reduce((maior, d) => (d.getTime() > maior.getTime() ? d : maior));
}

/** Quando o preço atual vence. `null` quando falta a referência ou a validade. */
export function vencimentoDoPreco(
  inicio: Date | null | undefined,
  retorno: Date | null | undefined,
  validadeMeses: number | null | undefined,
  /** Vigência do último reajuste de preço (doc 63) — manda quando é a data mais recente. */
  ultimoReajuste?: Date | null | undefined,
): Date | null {
  const base = referenciaDoPreco(inicio, retorno, ultimoReajuste);
  if (!base || !validadeMeses || validadeMeses <= 0) return null;

  const d = new Date(base);
  const diaOriginal = d.getDate();
  d.setMonth(d.getMonth() + validadeMeses);
  // 31 de janeiro + 1 mês vira 3 de março no JavaScript. Quando o mês novo não tem o dia, o
  // vencimento cai no último dia dele — que é o que uma pessoa entende por "daqui a um mês".
  if (d.getDate() !== diaOriginal) d.setDate(0);
  return d;
}

/** Quantos dias faltam para o reajuste. Negativo = já venceu. */
export function diasParaReajuste(vencimento: Date | null, hoje: Date = new Date()): number | null {
  if (!vencimento) return null;
  const dia = 24 * 60 * 60 * 1000;
  const a = Date.UTC(vencimento.getFullYear(), vencimento.getMonth(), vencimento.getDate());
  const b = Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  return Math.round((a - b) / dia);
}

/**
 * Sessões previstas no mês.
 *
 * Pacote completo: a QUANTIDADE informada pelo usuário no cadastro (doc 18) — acabou o número fixo
 * de 4. Quando ela não vem (cadastro legado que nunca preencheu), cai na rede antiga: 4 × vezes por
 * semana. Fragmentado: o que a agenda tiver marcado naquele mês — a contagem vem de `sessoesDoMes`
 * (lib/pacoteMes) e chega aqui pronta.
 */
export function sessoesNoMes(opts: {
  pacote: "completo" | "fragmentado" | null | undefined;
  sessoesAgendadas?: number | null;
  /** Quantidade de sessões do pacote (cadastro, `sessions_in_packet`). Manda no Completo (doc 18). */
  tamanhoPacote?: number | null;
  /** 1 ou 2 por semana (cadastro): rede legado do Completo quando a quantidade não foi informada. */
  vezesPorSemana?: number | null;
}): number {
  if (opts.pacote !== "fragmentado") {
    const qtd = Number(opts.tamanhoPacote);
    if (Number.isFinite(qtd) && qtd >= 1) return Math.floor(qtd);
    return SESSOES_PACOTE_COMPLETO * Math.max(1, Math.floor(opts.vezesPorSemana ?? 1));
  }
  return Math.max(0, Math.floor(opts.sessoesAgendadas ?? 0));
}

/** Quanto o paciente paga no mês, no formato escolhido. Gratuito é zero, sempre. */
export function valorDoMes(opts: {
  formato: FormatoPagamento | string | null | undefined;
  valorSessao: number;
  pacote?: "completo" | "fragmentado" | null;
  sessoesAgendadas?: number | null;
  tamanhoPacote?: number | null;
  vezesPorSemana?: number | null;
}): number {
  if (!cobra(opts.formato)) return 0;
  if (opts.formato === "sessao") return opts.valorSessao;   // paga por atendimento, não por mês
  const sessoes = sessoesNoMes({ pacote: opts.pacote, sessoesAgendadas: opts.sessoesAgendadas, tamanhoPacote: opts.tamanhoPacote, vezesPorSemana: opts.vezesPorSemana });
  return Number((sessoes * opts.valorSessao).toFixed(2));
}

/**
 * O histórico de reajuste como a tela mostra: data, valor anterior e valor novo.
 *
 * O banco guarda só o valor que passou a valer em cada data. O "anterior" é o valor da linha de
 * antes — e a primeira linha não tem anterior, porque não houve reajuste: foi o preço de entrada.
 */
export function linhasDeReajuste(
  historico: { valor: string | number; dataEfetiva: Date | string }[],
): { data: Date; anterior: number | null; novo: number }[] {
  const ordenado = [...historico]
    .map((h) => ({ data: new Date(h.dataEfetiva), novo: Number(h.valor) }))
    .filter((h) => !Number.isNaN(h.data.getTime()) && !Number.isNaN(h.novo))
    .sort((a, b) => a.data.getTime() - b.data.getTime());

  return ordenado.map((linha, i) => ({
    data: linha.data,
    anterior: i === 0 ? null : ordenado[i - 1].novo,
    novo: linha.novo,
  }));
}

/** O nome do formato como o dono fala. Aceita os valores antigos (`avulso`/`pacote`) também. */
const ROTULO_FORMATO: Record<string, string> = {
  gratuito: "Gratuito", sessao: "Avulso", mensal: "Mensal", quinzenal: "Quinzenal",
  primeira_pacote: "Na primeira sessão do pacote", ultima_pacote: "Na última sessão do pacote",
  avulso: "Avulso", pacote: "Mensal",
};
export function rotuloDoFormato(formato: string | null | undefined): string {
  if (!formato) return "Não definido"; // 1º cadastro só com Dados: financeiro ainda não preenchido (doc 17)
  return ROTULO_FORMATO[formato] ?? formato ?? "—";
}

/**
 * O histórico de reajuste UNIFICADO (dono, 16/09/2026): mostra tanto a mudança de VALOR quanto a de
 * MODALIDADE (gratuito, a cada sessão, mensal…), numa linha do tempo só, em ordem de data.
 *
 * Valor vem de `patient_price_history`; modalidade, de `patient_payment_format_history`. A primeira
 * linha de cada um é a de ENTRADA (sem "anterior"). Uma linha de modalidade que não mudou de fato
 * (mesmo formato da anterior) é descartada — não é reajuste.
 *
 * Função pura.
 */
/**
 * Um evento do historico de reajuste.
 *
 * `data` é a VIGÊNCIA — quando o valor ou a modalidade passa a valer. `solicitadoEm` é quando a
 * mudança foi PEDIDA, com hora. As duas datas são diferentes de propósito: combina-se hoje um
 * reajuste que vale mês que vem, e sem a data do pedido uma cobrança contestada não se explica.
 * `null` nos registros antigos, gravados antes de o app guardar isso.
 */
export type EventoDeReajuste =
  | { data: Date; kind: "valor"; anterior: number | null; novo: number; solicitadoEm: Date | null }
  | { data: Date; kind: "modalidade"; anterior: string | null; novo: string; solicitadoEm: Date | null };

export function eventosDeReajuste(
  precos: { valor: string | number; dataEfetiva: Date | string; dataCriacao?: Date | string | null }[],
  formatos: { formato: string; dataEfetiva: Date | string; dataCriacao?: Date | string | null }[],
): EventoDeReajuste[] {
  // Quando o reajuste foi PEDIDO, por data de vigência. São duas datas diferentes e as duas
  // importam: combina-se hoje um valor que passa a valer mês que vem, e uma cobrança contestada
  // só se explica com a data do pedido.
  const instante = (d: Date | string | null | undefined): Date | null => {
    if (!d) return null;
    const x = d instanceof Date ? d : new Date(d);
    return Number.isNaN(x.getTime()) ? null : x;
  };
  const pedidoPorVigencia = new Map<number, Date>();
  for (const lista of [precos, formatos]) {
    for (const item of lista) {
      const vig = instante(item.dataEfetiva);
      const ped = instante(item.dataCriacao);
      if (vig && ped) pedidoPorVigencia.set(vig.getTime(), ped);
    }
  }
  const pedidoDe = (d: Date): Date | null => pedidoPorVigencia.get(d.getTime()) ?? null;

  const valores: EventoDeReajuste[] = linhasDeReajuste(precos).map((l) => ({
    data: l.data, kind: "valor", anterior: l.anterior, novo: l.novo, solicitadoEm: pedidoDe(l.data),
  }));

  const fOrd = [...formatos]
    .map((f) => ({ data: new Date(f.dataEfetiva), formato: f.formato }))
    .filter((f) => !Number.isNaN(f.data.getTime()))
    .sort((a, b) => a.data.getTime() - b.data.getTime());
  const modalidades: EventoDeReajuste[] = fOrd
    .map((f, i) => ({ data: f.data, kind: "modalidade" as const, anterior: i === 0 ? null : fOrd[i - 1].formato, novo: f.formato, solicitadoEm: pedidoDe(f.data) }))
    .filter((m) => m.anterior === null || m.anterior !== m.novo);

  // Empatou na data? A modalidade vem antes do valor — a troca de formato é o que arrasta o preço novo.
  const ordem = (e: EventoDeReajuste) => (e.kind === "modalidade" ? 0 : 1);
  return [...valores, ...modalidades].sort((a, b) => a.data.getTime() - b.data.getTime() || ordem(a) - ordem(b));
}

/**
 * O histórico de reajuste no formato que o dono pediu (doc 16, 03/10/2026): uma linha por mudança,
 * combinando modalidade e valor. Regras:
 *  - Entrada Gratuito → "Gratuito" (sem R$ 0,00).
 *  - Entrada paga → "Mensal → R$ 150,00" (modalidade → valor do 1º cadastro).
 *  - Troca de modalidade → "Gratuito → Mensal → R$ 150,00" (de → para → valor novo); se a nova for
 *    Gratuito, "Mensal → Gratuito" (sem valor).
 *  - Só valor (mesma modalidade) → "Mensal → R$ 150,00 → R$ 180,00" (modalidade, anterior, novo).
 * Função pura.
 */
// `removivel` (doc 27): a linha ganha lixeira quando é um REAJUSTE (troca de valor/modalidade). A
// linha de ENTRADA (preço/formato inicial do cadastro) não é removível — é a base do financeiro do
// paciente, não um reajuste que possa ter sido lançado errado.
// `valor` (doc 63): a mudança de VALOR desta linha, em número, para a tela poder mostrá-la no
// cabeçalho da vigência — recolhido, o acordeão dizia só "1 alteração", e a dona alterou valor e
// vigência convencida de que só a vigência tinha sido registrada.
export type LinhaDeHistorico = {
  data: Date; solicitadoEm: Date | null; texto: string; removivel: boolean;
  valor?: { anterior: number | null; novo: number };
};

/**
 * Qual registro do histórico é a ENTRADA do cadastro — o primeiro preço, o primeiro formato.
 *
 * A entrada nunca é removível: é a base do financeiro do paciente, não um reajuste lançado errado.
 * Mas ela é UM registro, não uma data. Protegendo por data, três alterações na mesma vigência
 * empatam todas no mínimo, e a tela oferece uma lixeira que o servidor recusa — foi o que aconteceu
 * com a paciente que trocou Gratuito → Avulso → Gratuito no mesmo dia (doc 54).
 *
 * `dataCriacao` desempata quem foi gravado primeiro no mesmo dia; o id desempata o resto, para a
 * resposta não mudar entre duas leituras iguais.
 */
/**
 * A ordem canônica do histórico financeiro: vigência, depois quem foi GRAVADO primeiro, depois o id.
 *
 * Os dois desempates existem porque a data sozinha empata com frequência — o doc 54 abriu a porta
 * para várias alterações na mesma vigência, e é justamente nesse empate que as pontas da lista
 * decidem o que vale. `dataCriacao` é `defaultNow().notNull()` nas duas tabelas; o id entra como
 * último recurso para que duas leituras iguais nunca devolvam respostas diferentes.
 */
function ordemDoHistorico(
  registros: { id: string; dataEfetiva: Date | string; dataCriacao?: Date | string | null }[],
): { id: string; vigencia: number; criacao: number }[] {
  const ms = (d: Date | string | null | undefined, reserva: number): number => {
    if (!d) return reserva;
    const x = d instanceof Date ? d : new Date(d);
    return Number.isNaN(x.getTime()) ? reserva : x.getTime();
  };
  return registros
    .map((r) => ({ id: r.id, vigencia: ms(r.dataEfetiva, NaN), criacao: ms(r.dataCriacao, Infinity) }))
    .filter((r) => !Number.isNaN(r.vigencia))
    .sort((a, b) => a.vigencia - b.vigencia || a.criacao - b.criacao || a.id.localeCompare(b.id));
}

/**
 * O registro que VALE depois de apagar um reajuste — a outra ponta de `entradaDoHistorico`.
 *
 * Apagar reconcilia o cadastro com o que sobrou, e "o que sobrou" precisa ser UM registro definido.
 * Antes a escolha ordenava só por vigência, e as leituras do banco não têm `ORDER BY`: com vários
 * registros na mesma data, o escolhido era qualquer um, e duas execuções iguais podiam gravar
 * formatos diferentes no cadastro do paciente — Avulso onde é Gratuito, com a cobrança seguindo
 * atrás. Achado do SuperQA de 22/10.
 */
export function maisRecenteDoHistorico<T extends { id: string; dataEfetiva: Date | string; dataCriacao?: Date | string | null }>(
  registros: T[],
): T | null {
  const ordenados = ordemDoHistorico(registros);
  const ultimo = ordenados[ordenados.length - 1];
  return ultimo ? registros.find((r) => r.id === ultimo.id) ?? null : null;
}

export function entradaDoHistorico(
  registros: { id: string; dataEfetiva: Date | string; dataCriacao?: Date | string | null }[],
): string | null {
  const ms = (d: Date | string | null | undefined, reserva: number): number => {
    if (!d) return reserva;
    const x = d instanceof Date ? d : new Date(d);
    return Number.isNaN(x.getTime()) ? reserva : x.getTime();
  };
  const ordenados = [...registros]
    .map((r) => ({ id: r.id, vigencia: ms(r.dataEfetiva, NaN), criacao: ms(r.dataCriacao, Infinity) }))
    .filter((r) => !Number.isNaN(r.vigencia))
    .sort((a, b) => a.vigencia - b.vigencia || a.criacao - b.criacao || a.id.localeCompare(b.id));
  return ordenados[0]?.id ?? null;
}

export function historicoDeReajuste(
  precos: { valor: string | number; dataEfetiva: Date | string; dataCriacao?: Date | string | null }[],
  formatos: { formato: string; dataEfetiva: Date | string; dataCriacao?: Date | string | null }[],
): LinhaDeHistorico[] {
  const brl = (v: number) => "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const inst = (d: Date | string | null | undefined): Date | null => {
    if (!d) return null;
    const x = d instanceof Date ? d : new Date(d);
    return Number.isNaN(x.getTime()) ? null : x;
  };
  const pedidoPorVigencia = new Map<number, Date>();
  for (const lista of [precos, formatos]) {
    for (const item of lista) {
      const vig = inst(item.dataEfetiva);
      const ped = inst(item.dataCriacao);
      if (vig && ped) pedidoPorVigencia.set(vig.getTime(), ped);
    }
  }
  const pedidoDe = (d: Date): Date | null => pedidoPorVigencia.get(d.getTime()) ?? null;

  const pOrd = precos
    .map((p) => ({ data: new Date(p.dataEfetiva), valor: Number(p.valor) }))
    .filter((p) => !Number.isNaN(p.data.getTime()) && !Number.isNaN(p.valor))
    .sort((a, b) => a.data.getTime() - b.data.getTime());
  const valorNaData = (d: Date): number | null => {
    let v: number | null = null;
    for (const p of pOrd) { if (p.data.getTime() <= d.getTime()) v = p.valor; else break; }
    return v;
  };

  const fOrd = formatos
    .map((f) => ({ data: new Date(f.dataEfetiva), formato: f.formato }))
    .filter((f) => !Number.isNaN(f.data.getTime()))
    .sort((a, b) => a.data.getTime() - b.data.getTime());
  const fDedup = fOrd.filter((f, i) => i === 0 || f.formato !== fOrd[i - 1].formato);
  const modNaData = (d: Date): string | null => {
    let m: string | null = null;
    for (const f of fDedup) { if (f.data.getTime() <= d.getTime()) m = f.formato; else break; }
    return m;
  };

  const out: LinhaDeHistorico[] = [];
  const fDatas = new Set(fDedup.map((f) => f.data.getTime()));
  // O reajuste de VALOR que cai na mesma vigência de uma troca de modalidade. Ele não vira linha
  // própria (a linha da modalidade já fala do valor novo), mas precisa dizer de quanto veio: doc 63.
  const reajustePorData = new Map(linhasDeReajuste(precos).map((l) => [l.data.getTime(), l]));

  for (let i = 0; i < fDedup.length; i++) {
    const f = fDedup[i];
    const rot = rotuloDoFormato(f.formato);
    const pago = cobra(f.formato);
    const v = valorNaData(f.data);
    // Vindo de GRATUITO, o "valor anterior" é R$ 0,00 por não haver preço nenhum — dizer
    // "R$ 0,00 → R$ 150,00" inventa um reajuste que não houve (doc 16). Só quem já cobrava tem de onde vir.
    const reajuste = i > 0 && !cobra(fDedup[i - 1].formato) ? undefined : reajustePorData.get(f.data.getTime());
    // "R$ 450,00 → R$ 500,00" quando o valor MUDOU nesta vigência; só "R$ 500,00" quando ele apenas
    // acompanha a modalidade nova (preço de entrada, ou o mesmo valor de antes).
    const dinheiro = v == null ? null
      : reajuste && reajuste.anterior !== null && reajuste.novo === v ? `${brl(reajuste.anterior)} → ${brl(v)}`
      : brl(v);
    let texto: string;
    if (i === 0) {
      texto = pago && dinheiro ? `${rot} → ${dinheiro}` : rot;
    } else {
      const de = rotuloDoFormato(fDedup[i - 1].formato);
      texto = pago && dinheiro ? `${de} → ${rot} → ${dinheiro}` : `${de} → ${rot}`;
    }
    // i === 0 é a modalidade de ENTRADA do cadastro: sem lixeira.
    out.push({
      data: f.data, solicitadoEm: pedidoDe(f.data), texto, removivel: i > 0,
      ...(pago && reajuste && reajuste.anterior !== null && reajuste.novo === v
        ? { valor: { anterior: reajuste.anterior, novo: reajuste.novo } }
        : {}),
    });
  }

  for (const l of linhasDeReajuste(precos)) {
    if (l.anterior === null) {
      // Preço de ENTRADA (sem modalidade no histórico): sem lixeira.
      if (fDedup.length === 0 && l.novo > 0) out.push({ data: l.data, solicitadoEm: pedidoDe(l.data), texto: `Preço inicial → ${brl(l.novo)}`, removivel: false });
      continue;
    }
    if (fDatas.has(l.data.getTime())) continue;
    const m = modNaData(l.data);
    const prefixo = m ? `${rotuloDoFormato(m)} → ` : "";
    out.push({
      data: l.data, solicitadoEm: pedidoDe(l.data), texto: `${prefixo}${brl(l.anterior)} → ${brl(l.novo)}`,
      removivel: true, valor: { anterior: l.anterior, novo: l.novo },
    });
  }

  return out.sort((a, b) => a.data.getTime() - b.data.getTime());
}

/**
 * Doc 35 (A1): agrupa itens do histórico de reajuste por DATA DE VIGÊNCIA, da mais recente para a
 * mais antiga, para a tela mostrar um acordeão (só as datas de vigência; expande numa data → todas
 * as alterações daquela vigência). A chave do dia vem de fora (`chaveDoDia`) para respeitar a hora
 * de parede (o fuso negativo, se usasse UTC cru, jogaria a vigência para o dia anterior). Dentro de
 * cada grupo, o que foi SOLICITADO mais recentemente vem primeiro. Função pura.
 */
export function agruparPorVigencia<T extends { vigencia: Date; solicitadoEm: Date | null }>(
  itens: T[],
  chaveDoDia: (d: Date) => string,
): { chave: string; vigencia: Date; itens: T[] }[] {
  const mapa = new Map<string, { vigencia: Date; itens: T[] }>();
  for (const it of itens) {
    const k = chaveDoDia(it.vigencia);
    const g = mapa.get(k);
    if (g) g.itens.push(it);
    else mapa.set(k, { vigencia: it.vigencia, itens: [it] });
  }
  const ts = (d: Date | null) => (d ? d.getTime() : 0);
  return [...mapa.entries()]
    .map(([chave, g]) => ({
      chave,
      vigencia: g.vigencia,
      itens: g.itens.slice().sort((a, b) => ts(b.solicitadoEm) - ts(a.solicitadoEm)),
    }))
    .sort((a, b) => (a.chave < b.chave ? 1 : a.chave > b.chave ? -1 : 0));
}

/**
 * A GUIA GERAL DO PACIENTE — linha a linha, sessões e pagamentos na ordem em que acontecem.
 *
 * Especificação do dono (15/09/2026). O que cada formato desenha:
 *
 * - **A cada sessão**: o valor fica na linha da própria sessão.
 * - **Gratuito**: GRAT, sem cobrança.
 * - **Mensal / primeira do pacote**: uma linha de pagamento ANTES da 1/X, no valor sessão × tamanho.
 * - **Quinzenal**: duas linhas de pagamento (metade cada) antes da sequência.
 * - **Última do pacote**: a linha de pagamento vem DEPOIS da última sessão.
 * - **AVUL / GRAT extras**: linha própria, sem mexer na sequência.
 *
 * Situação: a primeira cobrança fica em aberto até ser paga; as demais ficam "a vencer" até o dia
 * do vencimento e "em aberto" a partir dele, até o pagamento ser lançado.
 *
 * Nada aqui calcula cobrança: isso é do motor único (`cobrancas.ts`). Este arquivo só DISPÕE as
 * cobranças entre as sessões e casa os pagamentos com elas.
 *
 * Casamento: pagamento com `cobrancaChave` vai para a sua cobrança; o que não tem chave (os
 * lançados antes da guia existir, ou pela tela antiga) quita pela ordem de vencimento.
 *
 * Função pura.
 */

import { cobrancasDoPaciente, rotulosDasSessoes, type Cobranca, type EntradaDasCobrancas, type SessaoDaCobranca } from "./cobrancas";
import { formatoNaData } from "./vigenciaDoFormato";
import { STATUS_QUE_PAUSAM } from "./therapy";

export type PagamentoDaGeral = {
  id: string;
  valor: number | string;
  data: Date | string;
  status: string;
  metodo: string | null;
  pagoPor: string | null;
  cobrancaChave: string | null;
};

export type EntradaDaGeral = Omit<EntradaDasCobrancas, "sessoes"> & {
  sessoes: (SessaoDaCobranca & { online?: boolean | null })[];
  pagamentos: PagamentoDaGeral[];
  hoje: Date;
};

export type Situacao = "pago" | "em_aberto" | "a_vencer";

export type PagamentoLancado = { id: string; data: Date; metodo: string | null; pagoPor: string | null };

export type CobrancaDaGeral = Cobranca & {
  situacao: Situacao;
  /** O que ainda falta receber — é o valor que "Lançar pagamento" grava. */
  falta: number;
  pagamento: PagamentoLancado | null;
};

export type LinhaDaGeral =
  | {
      tipo: "sessao";
      id: string;
      data: Date;
      online: boolean;
      status: string;
      rotulo: string;
      /** Valor que a linha mostra. `null` = a sessão é paga pela linha do pacote. */
      valor: number | null;
      /** A cobrança da própria linha (a cada sessão, AVUL). */
      cobranca: CobrancaDaGeral | null;
    }
  | ({ tipo: "pagamento"; tipoDeCobranca: Cobranca["tipo"] } & Omit<CobrancaDaGeral, "tipo">);

const TOLERANCIA = 0.005;
const emData = (d: Date | string) => (d instanceof Date ? d : new Date(d));

function casarPagamentos(cobrancas: Cobranca[], pagamentos: PagamentoDaGeral[], hoje: Date): CobrancaDaGeral[] {
  const pagos = pagamentos
    .filter((p) => p.status === "paid")
    .map((p) => ({ ...p, valor: Number(p.valor) || 0, data: emData(p.data) }))
    .sort((a, b) => a.data.getTime() - b.data.getTime() || a.id.localeCompare(b.id));

  const chaves = new Set(cobrancas.map((c) => c.chave));
  const recebido = new Map<string, number>();
  const ultimo = new Map<string, PagamentoLancado>();
  const lancado = (p: (typeof pagos)[number]): PagamentoLancado => ({ id: p.id, data: p.data, metodo: p.metodo, pagoPor: p.pagoPor });

  // 1. Os que dizem a qual cobrança pertencem.
  const semChave: typeof pagos = [];
  for (const p of pagos) {
    if (p.cobrancaChave && chaves.has(p.cobrancaChave)) {
      recebido.set(p.cobrancaChave, (recebido.get(p.cobrancaChave) ?? 0) + p.valor);
      ultimo.set(p.cobrancaChave, lancado(p));
    } else {
      semChave.push(p);
    }
  }

  // 2. Os demais, pela ordem de vencimento (as cobranças já chegam ordenadas assim).
  let sobra = 0;
  let fonte: PagamentoLancado | null = null;
  const fila = [...semChave];
  for (const c of cobrancas) {
    let falta = c.valor - (recebido.get(c.chave) ?? 0);
    while (falta > TOLERANCIA) {
      if (sobra <= TOLERANCIA) {
        const p = fila.shift();
        if (!p) break;
        sobra = p.valor;
        fonte = lancado(p);
      }
      const usa = Math.min(sobra, falta);
      sobra -= usa;
      falta -= usa;
      recebido.set(c.chave, (recebido.get(c.chave) ?? 0) + usa);
      if (fonte) ultimo.set(c.chave, fonte);
    }
  }

  const hojeDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate()).getTime();
  return cobrancas.map((c, i) => {
    const pago = c.valor - (recebido.get(c.chave) ?? 0) <= TOLERANCIA;
    const vence = c.vencimento ?? c.competencia;
    const situacao: Situacao = pago ? "pago" : i === 0 || !vence || new Date(vence.getFullYear(), vence.getMonth(), vence.getDate()).getTime() <= hojeDia ? "em_aberto" : "a_vencer";
    const falta = pago ? 0 : Math.round((c.valor - (recebido.get(c.chave) ?? 0)) * 100) / 100;
    return { ...c, situacao, falta, pagamento: pago ? (ultimo.get(c.chave) ?? null) : null };
  });
}

const comoLinha = ({ tipo, ...c }: CobrancaDaGeral): LinhaDaGeral => ({ ...c, tipo: "pagamento", tipoDeCobranca: tipo });

export function linhasDaGeral(e: EntradaDaGeral): LinhaDaGeral[] {
  const cobrancas = casarPagamentos(cobrancasDoPaciente(e), e.pagamentos, e.hoje);
  const rotulos = rotulosDasSessoes(e);

  const naSessao = new Map<string, CobrancaDaGeral>();
  const antes = new Map<string, CobrancaDaGeral[]>();
  const depois = new Map<string, CobrancaDaGeral[]>();
  const sessoes = e.sessoes
    .map((s) => ({ ...s, data: emData(s.date) }))
    .filter((s) => !Number.isNaN(s.data.getTime()))
    .sort((a, b) => a.data.getTime() - b.data.getTime() || a.id.localeCompare(b.id));
  const ordem = new Map(sessoes.map((s, i) => [s.id, i]));
  const soltas: CobrancaDaGeral[] = [];

  const empilha = (m: Map<string, CobrancaDaGeral[]>, id: string, c: CobrancaDaGeral) => m.set(id, [...(m.get(id) ?? []), c]);
  for (const c of cobrancas) {
    const ids = c.ids.filter((id) => ordem.has(id)).sort((a, b) => ordem.get(a)! - ordem.get(b)!);
    if (!ids.length) { soltas.push(c); continue; }
    if (c.posicao === "na_sessao") naSessao.set(ids[0], c);
    else if (c.posicao === "antes") empilha(antes, ids[0], c);
    else empilha(depois, ids[ids.length - 1], c);
  }

  const out: LinhaDaGeral[] = [];
  for (const s of sessoes) {
    for (const c of antes.get(s.id) ?? []) out.push(comoLinha(c));

    const cobranca = naSessao.get(s.id) ?? null;
    const pausada = STATUS_QUE_PAUSAM.has(s.status);
    const formato = formatoNaData(e.vigencias, s.data, e.reserva).formato;
    const gratis = s.extra === "grat" || (!s.extra && formato === "gratuito");
    out.push({
      tipo: "sessao",
      id: s.id,
      data: s.data,
      online: !!s.online,
      status: s.status,
      rotulo: rotulos.get(s.id) ?? "",
      valor: cobranca ? cobranca.valor : gratis && !pausada ? 0 : null,
      cobranca,
    });

    for (const c of depois.get(s.id) ?? []) out.push(comoLinha(c));
  }
  for (const c of soltas) out.push(comoLinha(c));
  return out;
}

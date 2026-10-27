import "server-only";

import { type LinhaNaTela } from "./geralDoPaciente";
import { type CobrancaResolvida, type SituacaoVenc, type TipoVencimentoPacote } from "./vencimentosDoDia";
import { recebidoPorForma } from "./recebidoPorForma";
import { type VigenciaTaxa } from "./taxaCartao";

const grupoDe = (tipo: string): "avulsa" | "pacote" => (tipo === "pacote" || tipo === "quinzena" ? "pacote" : "avulsa");

function tipoVencimentoDe(formato: string | null | undefined, paymentFormat: string | null | undefined): TipoVencimentoPacote {
  const f = `${formato ?? ""} ${paymentFormat ?? ""}`.toLowerCase();
  if (f.includes("primeira")) return "primeira";
  if (f.includes("ultima") || f.includes("última")) return "ultima";
  return "dia";
}

export type CadastroParaCobrancas = {
  id: string;
  name: string;
  phone: string | null;
  guardianPhone: string | null;
  paymentFormat: string | null;
  registrationNumber?: number | null;
  agendaId?: string | null;
};

/**
 * Resolve as cobranças de UM cadastro a partir das linhas da guia Geral (motor único). Usada pelo
 * Vencimentos por dia e pelo Menu Pagamentos — a mesma fonte, para não divergirem.
 *
 * Junta as duas fontes de cobrança (doc 48): a linha "pagamento" (pacote) e a cobrança embutida na
 * linha da SESSÃO (avulso — a cada sessão). Dedup por chave.
 */
export function resolverCobrancas(linhas: LinhaNaTela[], p: CadastroParaCobrancas, vigencias: VigenciaTaxa[] = []): CobrancaResolvida[] {
  const sessaoPorId = new Map<string, { data: string; status: string }>();
  for (const l of linhas) if (l.tipo === "sessao") sessaoPorId.set(l.id, { data: l.data, status: l.status });
  const telefone = p.guardianPhone?.trim() ? p.guardianPhone : p.phone;

  const cobrancasDaLinha = linhas.flatMap((l) =>
    l.tipo === "pagamento" ? [l] : l.tipo === "sessao" && l.cobranca ? [l.cobranca] : [],
  );
  const vistas = new Set<string>();
  const out: CobrancaResolvida[] = [];
  for (const l of cobrancasDaLinha) {
    if (vistas.has(l.chave)) continue;
    vistas.add(l.chave);
    if (!l.vencimento) continue;
    const datas = (l.ids.map((id) => sessaoPorId.get(id)?.data).filter(Boolean) as string[]).sort();
    const realizadas = l.ids
      .map((id) => sessaoPorId.get(id))
      .filter((s): s is { data: string; status: string } => !!s && s.status !== "agendada")
      .sort((a, b) => a.data.localeCompare(b.data));
    const ult = realizadas.length ? realizadas[realizadas.length - 1] : null;
    const ultimaRealizada = ult ? { data: ult.data, status: ult.status, seq: `${realizadas.length}/${l.sessoes}` } : null;
    const grupo = grupoDe(l.tipoDeCobranca);
    const pagoEm = l.pagamentos.length ? l.pagamentos[l.pagamentos.length - 1].data : null;
    // Doc 50: recebido por forma (bruto+líquido). Crédito de pacote não é dinheiro recebido → fora.
    const recebido = recebidoPorForma(
      l.pagamentos.filter((pg) => !pg.credito).map((pg) => ({ valor: pg.valor, metodo: pg.metodo, data: pg.data })),
      vigencias,
    );
    const statusSessao = grupo === "avulsa" ? (sessaoPorId.get(l.ids[0])?.status ?? null) : null;
    out.push({
      cadastroId: p.id,
      nome: p.name,
      registro: p.registrationNumber ?? null,
      agendaId: p.agendaId ?? null,
      recebido,
      telefone: telefone ?? null,
      chave: l.chave,
      grupo,
      vencimento: l.vencimento,
      situacao: l.situacao as SituacaoVenc,
      valor: l.valor,
      falta: l.falta,
      enviosTotal: l.envio?.total ?? 0,
      pagoEm,
      dataSessao: grupo === "avulsa" ? (datas[0] ?? null) : null,
      statusSessao,
      horarioAtraso: grupo === "avulsa" ? l.vencimento : null,
      tipoVencimento: grupo === "pacote" ? tipoVencimentoDe(l.formato, p.paymentFormat) : undefined,
      primeiraSessao: datas[0] ?? null,
      ultimaSessao: datas.length ? datas[datas.length - 1] : null,
      // Doc 63: a mensagem do pacote lista os dias das sessões cobradas, não só o início.
      datasDasSessoes: grupo === "pacote" ? datas : null,
      ultimaRealizada,
    });
  }
  return out;
}

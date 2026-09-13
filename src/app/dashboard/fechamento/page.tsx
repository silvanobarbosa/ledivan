import Link from "next/link";
import { and, eq, gte, inArray, lte, ne } from "drizzle-orm";
import { CalendarCheck, ChevronLeft, ChevronRight } from "lucide-react";
import { db } from "@/db";
import { auth } from "@/auth";
import { patientPackages, patientPriceHistory, patients, sessionPayments, therapySessions } from "@/db/schema";
import { tamanhosDasSequencias } from "@/lib/sequenciaPacote";
import {
  linhaDoFechamento,
  mesPorExtenso,
  mesQueSeFecha,
  ordemDoFechamento,
  resumoDoFechamento,
  type LinhaDoFechamento,
  type SituacaoDoFechamento,
} from "@/lib/fechamento";

export const dynamic = "force-dynamic";

/**
 * O FECHAMENTO DO MÊS.
 *
 * Uma tela por mês, com uma pergunta só: *fechando este mês, quem ainda deve, e quanto?* Ela é
 * separada da tela de pagamentos de propósito — pagamento é do dia a dia, fechamento é ritual de
 * fim de mês, e misturar os dois faz a pessoa procurar o número errado com pressa.
 *
 * O valor não é digitado em lugar nenhum: sai da AGENDA (quantas sessões o mês teve) vezes o
 * preço que valia NAQUELE mês. Cancelada e realocada não contam. Pacote completo cobra quatro,
 * mesmo que a agenda tenha marcado três — é o combinado.
 *
 * A tela abre no mês que se fecha, que é o anterior. Quem quiser outro navega pelas setas.
 */
export default async function FechamentoPage({
  searchParams,
}: {
  searchParams: Promise<{ ano?: string; mes?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const pedido = await searchParams;
  const padrao = mesQueSeFecha();
  const ano = Number(pedido.ano) || padrao.ano;
  // A URL fala em mês de 1 a 12, como gente; por dentro é 0 a 11, como o JavaScript.
  const mes = pedido.mes ? Math.min(11, Math.max(0, Number(pedido.mes) - 1)) : padrao.mes;

  const inicio = new Date(ano, mes, 1);
  const fim = new Date(ano, mes + 1, 0, 23, 59, 59, 999);

  const carteira = await db
    .select({
      id: patients.id,
      name: patients.name,
      paymentFormat: patients.paymentFormat,
      pacoteTipo: patients.pacoteTipo,
      paymentDay: patients.paymentDay,
      status: patients.patientStatus,
    })
    .from(patients)
    .where(and(eq(patients.userId, userId), ne(patients.patientStatus, "prospect")));

  const ids = carteira.map((p) => p.id);

  const [sessoes, pagamentos, precos, contratos] = await Promise.all([
    // O histórico INTEIRO, não só o mês. A conta passou a seguir a sequência do pacote, e uma
    // sequência de setembro empurrada por um atestado fecha em outubro — ler só o mês faria a
    // varredura começar no meio e dar a posição errada, e com ela o valor errado.
    db
      .select({
        id: therapySessions.id,
        patientId: therapySessions.patientId,
        date: therapySessions.date,
        status: therapySessions.status,
      })
      .from(therapySessions)
      .where(eq(therapySessions.userId, userId)),
    db
      .select({
        patientId: sessionPayments.patientId,
        amount: sessionPayments.amount,
        date: sessionPayments.date,
        status: sessionPayments.status,
      })
      .from(sessionPayments)
      .where(
        and(
          eq(sessionPayments.userId, userId),
          gte(sessionPayments.date, inicio),
          lte(sessionPayments.date, fim),
        ),
      ),
    // O preço mora no histórico, e o histórico não tem dono: filtra pelos pacientes deste
    // terapeuta, que é o que separa uma agenda da outra.
    ids.length > 0
      ? db
          .select({
            patientId: patientPriceHistory.patientId,
            valor: patientPriceHistory.valor,
            dataEfetiva: patientPriceHistory.dataEfetiva,
          })
          .from(patientPriceHistory)
          .where(inArray(patientPriceHistory.patientId, ids))
      : Promise.resolve([]),
    // O tamanho de cada sequência é o que se guarda: é o combinado, e não se deduz das sessões.
    db
      .select({
        patientId: patientPackages.patientId,
        seq: patientPackages.seq,
        sessions: patientPackages.sessions,
      })
      .from(patientPackages)
      .where(eq(patientPackages.userId, userId)),
  ]);

  const sessoesPor = new Map<string, { id: string; date: Date; status: string }[]>();
  for (const s of sessoes) {
    sessoesPor.set(s.patientId, [...(sessoesPor.get(s.patientId) ?? []), s]);
  }
  const precosPor = new Map<string, { valor: number; desde: Date }[]>();
  for (const p of precos) {
    precosPor.set(p.patientId, [
      ...(precosPor.get(p.patientId) ?? []),
      { valor: Number(p.valor) || 0, desde: p.dataEfetiva },
    ]);
  }
  const pagos = pagamentos.map((p) => ({
    pacienteId: p.patientId,
    valor: Number(p.amount) || 0,
    data: p.date,
    status: p.status,
  }));

  const linhas = ordemDoFechamento(
    carteira.map((p) =>
      linhaDoFechamento({
        paciente: {
          id: p.id,
          nome: p.name,
          formato: p.paymentFormat,
          pacoteTipo: p.pacoteTipo,
          diaPagamento: p.paymentDay,
        },
        sessoes: sessoesPor.get(p.id) ?? [],
        precos: precosPor.get(p.id) ?? [],
        pagamentos: pagos,
        tamanhos: tamanhosDasSequencias(contratos.filter((c) => c.patientId === p.id)),
        ano,
        mes,
      }),
    ),
  );

  const resumo = resumoDoFechamento(linhas);
  const anterior = new Date(ano, mes - 1, 1);
  const seguinte = new Date(ano, mes + 1, 1);
  const ehFuturo = seguinte.getTime() > new Date().getTime();

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary flex items-center gap-2">
            <CalendarCheck className="w-7 h-7" aria-hidden="true" />
            Fechamento do mês
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mesPorExtenso(ano, mes)} — as sessões vêm da agenda, e o preço é o que valia neste mês.
          </p>
        </div>

        <nav className="flex items-center gap-2" aria-label="Escolher o mês">
          <Link
            href={`/dashboard/fechamento?ano=${anterior.getFullYear()}&mes=${anterior.getMonth() + 1}`}
            className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"
          >
            <ChevronLeft className="w-4 h-4" aria-hidden="true" /> mês anterior
          </Link>
          {!ehFuturo && (
            <Link
              href={`/dashboard/fechamento?ano=${seguinte.getFullYear()}&mes=${seguinte.getMonth() + 1}`}
              className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-sm hover:bg-muted"
            >
              mês seguinte <ChevronRight className="w-4 h-4" aria-hidden="true" />
            </Link>
          )}
        </nav>
      </header>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumo do mês">
        <Numero rotulo="a receber" valor={resumo.aReceber} destaque={resumo.aReceber > 0 ? "alerta" : "ok"} />
        <Numero rotulo="recebido no mês" valor={resumo.recebido} destaque="ok" />
        <Numero rotulo="previsto no mês" valor={resumo.previsto} />
      </section>

      {resumo.pacientesAReceber > 0 && (
        <p className="text-sm text-muted-foreground">
          {resumo.pacientesAReceber} paciente(s) com saldo em aberto neste mês.
          {resumo.semSessoes > 0 && ` ${resumo.semSessoes} sem sessão nenhuma — estão na lista para conferência, não para cobrança.`}
        </p>
      )}

      {linhas.length === 0 ? (
        <div className="rounded-xl border p-10 text-center text-sm text-muted-foreground">
          Nenhum paciente na carteira ainda.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <caption className="sr-only">
              Fechamento de {mesPorExtenso(ano, mes)}: sessões, valor e saldo de cada paciente
            </caption>
            <thead className="bg-muted/50 text-left">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">Paciente</th>
                <th scope="col" className="px-4 py-2 font-semibold">Sessões</th>
                <th scope="col" className="px-4 py-2 font-semibold">Valor da sessão</th>
                <th scope="col" className="px-4 py-2 font-semibold">Valor do mês</th>
                <th scope="col" className="px-4 py-2 font-semibold">Pago</th>
                <th scope="col" className="px-4 py-2 font-semibold">Saldo</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {linhas.map((l) => (
                <tr key={l.pacienteId} className={l.situacao === "a_receber" ? "bg-red-50/40" : undefined}>
                  <td className="px-4 py-2.5">
                    <Link href={`/dashboard/patients/${l.pacienteId}`} className="font-medium hover:underline">
                      {l.nome}
                    </Link>
                    <span className="ml-2 text-xs text-muted-foreground">{rotuloDoFormato(l)}</span>
                  </td>
                  {/* Duas informações diferentes, e misturá-las confundia: quantas sessões houve no
                      mês, e o que a conta cobra. Elas divergem de propósito — um pacote empurrado
                      por uma desmarcação fecha no mês seguinte e cobra lá, inteiro. */}
                  <td className="px-4 py-2.5 tabular-nums">
                    {l.sessoes} <span className="text-xs text-muted-foreground">no mês</span>
                    {l.pacotesNoMes > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {l.pacotesNoMes} {l.pacotesNoMes === 1 ? "pacote fechado" : "pacotes fechados"} · cobra {l.sessoesCobradas}
                      </p>
                    )}
                    {l.pacotesNoMes === 0 && l.sessoesCobradas !== l.sessoes && (
                      <p className="text-xs text-muted-foreground">cobra {l.sessoesCobradas}</p>
                    )}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{reais(l.precoDaSessao)}</td>
                  <td className="px-4 py-2.5 tabular-nums font-medium">{reais(l.valorDoMes)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{reais(l.pago)}</td>
                  <td className="px-4 py-2.5">
                    <Situacao linha={l} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        A conta segue o combinado, não o calendário: quem fecha por pacote cobra a sequência
        inteira quando ela se completa, mesmo que a última sessão tenha caído no mês seguinte. Quem
        paga a cada sessão cobra as do mês. Sessão desmarcada, com atestado ou desmarcada pelo
        profissional não entra na conta e devolve a posição à sessão seguinte.
      </p>
    </div>
  );
}

const reais = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

const FORMATO: Record<string, string> = {
  gratuito: "gratuito",
  sessao: "a cada sessão",
  mensal: "mensal",
  quinzenal: "quinzenal",
  primeira_pacote: "na 1ª do pacote",
  ultima_pacote: "na última do pacote",
};

function rotuloDoFormato(l: LinhaDoFechamento): string {
  const base = FORMATO[l.formato] ?? l.formato;
  return l.sessoesCobradas === 4 && l.sessoes !== 4 ? `${base} · pacote completo` : base;
}

const SITUACAO: Record<SituacaoDoFechamento, { texto: string; classe: string }> = {
  a_receber: { texto: "a receber", classe: "text-red-600 font-semibold" },
  pago: { texto: "quitado", classe: "text-emerald-600" },
  pago_a_mais: { texto: "pagou a mais", classe: "text-amber-600 font-medium" },
  sem_cobranca: { texto: "sem cobrança", classe: "text-muted-foreground" },
  sem_sessoes: { texto: "sem sessão no mês", classe: "text-muted-foreground" },
};

/** O saldo e a palavra andam juntos: número sozinho não diz se é dívida ou crédito. */
function Situacao({ linha }: { linha: LinhaDoFechamento }) {
  const { texto, classe } = SITUACAO[linha.situacao];
  if (linha.situacao === "sem_cobranca" || linha.situacao === "sem_sessoes") {
    return <span className={`text-xs ${classe}`}>{texto}</span>;
  }
  return (
    <span className={`tabular-nums ${classe}`}>
      {reais(Math.abs(linha.saldo))} <span className="text-xs font-normal">{texto}</span>
    </span>
  );
}

function Numero({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: number;
  destaque?: "ok" | "alerta";
}) {
  const cor = destaque === "alerta" ? "text-red-600" : destaque === "ok" ? "text-emerald-600" : "text-foreground";
  return (
    <div className="rounded-xl border p-4">
      <strong className={`font-display text-2xl font-bold tabular-nums ${cor}`}>{reais(valor)}</strong>
      <p className="mt-1 text-sm text-muted-foreground">{rotulo}</p>
    </div>
  );
}

import { notFound, redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { patients, sessionPayments, therapySessions, users } from "@/db/schema";
import { auth } from "@/auth";
import { descricaoValida, montarRecibo } from "@/lib/recibo";
import { datasDoRecibo } from "@/lib/reciboSequencia";
import { geralDoPaciente, type CobrancaNaTela } from "@/lib/geralDoPaciente";
import { horaDeParede } from "@/lib/horaLocal";
import { ReciboImpresso } from "./ReciboImpresso";

export const dynamic = "force-dynamic";

/**
 * O RECIBO — a tela de conferência antes de o papel existir.
 *
 * O documento de 17/09 pede que ele abra "já preenchido com as informações do pagamento" e permita
 * "sua conferência antes da emissão definitiva". Por isso é uma página, e não um download direto:
 * a terapeuta lê, confere o nome e o valor, e só então imprime.
 *
 * Sem logotipo, como pedido. O texto sai de `src/lib/recibo.ts`, que é puro e testado — inclusive o
 * valor por extenso.
 */
export default async function Recibo({ params }: { params: Promise<{ id: string; pagamentoId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const { id: patientId, pagamentoId } = await params;

  // Os dois ids na mesma cláusula, com o dono: pagamento de outro consultório responde 404 igual a
  // pagamento inexistente, sem confirmar que o id existe.
  const [pagamento] = await db
    .select({
      id: sessionPayments.id,
      amount: sessionPayments.amount,
      date: sessionPayments.date,
      pagoPor: sessionPayments.pagoPor,
      pagoPorCpf: sessionPayments.pagoPorCpf,
      sessionId: sessionPayments.sessionId,
      cobrancaChave: sessionPayments.cobrancaChave,
    })
    .from(sessionPayments)
    .where(and(eq(sessionPayments.id, pagamentoId), eq(sessionPayments.userId, userId), eq(sessionPayments.patientId, patientId)))
    .limit(1);
  if (!pagamento) notFound();

  // O responsável do CADASTRO só entra como reserva: o recibo prefere quem pagou ESTE pagamento.
  const [paciente] = await db
    .select({ name: patients.name, guardianName: patients.guardianName, guardianCpf: patients.guardianCpf, cpf: patients.cpf, sessionFee: patients.sessionFee, cadastroKind: patients.cadastroKind })
    .from(patients)
    .where(and(eq(patients.id, patientId), eq(patients.userId, userId)))
    .limit(1);
  if (!paciente) notFound();

  const [terapeuta] = await db
    .select({ name: users.name, cpf: users.therapistCpf, descricao: users.descricaoAtendimento, logoUrl: users.logoUrl })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  /**
   * As datas dos ATENDIMENTOS que ESTE pagamento cobre (doc 28/29).
   *
   * O recibo lista as sessões da COBRANÇA a que o pagamento pertence — nunca todas as sessões do
   * paciente (era o bug do doc 28: cruzava a fronteira da cobrança e trazia data de outro pagamento,
   * além de deixar vazar sessão gratuita). A cobrança já carrega o conjunto certo em `ids` (exclui
   * gratuita, Desmarcou/Prof.desm/Atestado; inclui Presente/Faltou). Dentro da cobrança, as sessões
   * são consumidas em sequência pela ordem dos pagamentos (`datasDoRecibo`, pura e testada).
   */
  const geral = await geralDoPaciente(userId, patientId);
  const cobrancas: CobrancaNaTela[] = [];
  const vistas = new Set<string>();
  for (const l of geral?.linhas ?? []) {
    const c = l.tipo === "pagamento" ? l : (l.tipo === "sessao" ? l.cobranca : null);
    if (c && !vistas.has(c.chave)) { vistas.add(c.chave); cobrancas.push(c); }
  }
  const cob = cobrancas.find((c) => c.pagamentos.some((p) => p.id === pagamento.id));

  let datasSeq: Date[] = [];
  let parcialDe: Date | null = null;
  if (cob) {
    const sess = cob.ids.length
      ? await db.select({ date: therapySessions.date, status: therapySessions.status })
          .from(therapySessions)
          .where(and(inArray(therapySessions.id, cob.ids), eq(therapySessions.userId, userId)))
      : [];
    // Preço da sessão nesta cobrança (não o do cadastro atual, que pode ter mudado).
    const unit = cob.sessoes > 0 ? cob.valor / cob.sessoes : (Number(paciente.sessionFee) || 0);
    const seq = datasDoRecibo({
      pagamentos: cob.pagamentos.map((p) => ({ id: p.id, valor: p.valor })),
      alvoId: pagamento.id,
      sessoes: sess.map((s) => ({ data: new Date(horaDeParede(s.date)), status: s.status })),
      valorSessao: unit,
    });
    datasSeq = seq.datas;
    parcialDe = seq.parcial ? seq.inicioPacote : null;
  }

  // Sem datas de atendimento (ex.: pagamento solto, ou valor sem sessões): fallback — a sessão
  // vinculada, senão a data do pagamento — para o recibo nunca sair vazio.
  const fallback = pagamento.sessionId
    ? (await db.select({ date: therapySessions.date }).from(therapySessions)
        .where(and(eq(therapySessions.id, pagamento.sessionId), eq(therapySessions.userId, userId))))
        .map((s) => new Date(horaDeParede(s.date)))
    : [];
  const datas = datasSeq.length ? datasSeq : (fallback.length ? fallback : [new Date(horaDeParede(pagamento.date))]);

  const texto = montarRecibo({
    responsavel: pagamento.pagoPor || paciente.guardianName || paciente.name,
    responsavelCpf: pagamento.pagoPorCpf || paciente.guardianCpf || paciente.cpf,
    paciente: paciente.name,
    datas,
    valorTotal: Number(pagamento.amount) || 0,
    dataPagamento: new Date(horaDeParede(pagamento.date)),
    terapeuta: terapeuta?.name || "",
    terapeutaCpf: terapeuta?.cpf,
    descricao: descricaoValida(terapeuta?.descricao),
    parcialDe,
    supervisao: paciente.cadastroKind === "supervisionado",
  });

  const faltando = [
    !terapeuta?.name && "seu nome",
    !terapeuta?.cpf && "seu CPF",
  ].filter(Boolean) as string[];

  return (
    <ReciboImpresso
      texto={texto}
      patientId={patientId}
      pagamentoId={pagamento.id}
      faltando={faltando}
      semDatasDeSessao={datasSeq.length === 0 && fallback.length === 0}
      logoUrl={terapeuta?.logoUrl ?? null}
    />
  );
}

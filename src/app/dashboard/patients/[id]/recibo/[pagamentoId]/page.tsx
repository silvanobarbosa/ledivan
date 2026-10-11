import { notFound, redirect } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { patients, sessionPayments, therapySessions, users } from "@/db/schema";
import { auth } from "@/auth";
import { descricaoValida, montarRecibo } from "@/lib/recibo";
import { datasDoRecibo } from "@/lib/reciboSequencia";
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
    .select({ name: patients.name, guardianName: patients.guardianName, guardianCpf: patients.guardianCpf, cpf: patients.cpf, sessionFee: patients.sessionFee })
    .from(patients)
    .where(and(eq(patients.id, patientId), eq(patients.userId, userId)))
    .limit(1);
  if (!paciente) notFound();

  const [terapeuta] = await db
    .select({ name: users.name, cpf: users.therapistCpf, descricao: users.descricaoAtendimento })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  /**
   * As datas dos ATENDIMENTOS que ESTE pagamento cobre (doc 28).
   *
   * Não é a data do pagamento: são as sessões Presente/Faltou que o valor paga, consumidas em
   * sequência pela ordem de lançamento dos pagamentos (o 1º pega as primeiras datas, o 2º as
   * próximas, sem repetir). A conta mora em `datasDoRecibo`, pura e testada.
   */
  const [pagamentosDoPaciente, sessoesDoPaciente] = await Promise.all([
    db.select({ id: sessionPayments.id, amount: sessionPayments.amount, date: sessionPayments.date })
      .from(sessionPayments)
      .where(and(eq(sessionPayments.patientId, patientId), eq(sessionPayments.userId, userId)))
      .orderBy(asc(sessionPayments.date), asc(sessionPayments.id)),
    db.select({ date: therapySessions.date, status: therapySessions.status })
      .from(therapySessions)
      .where(and(eq(therapySessions.patientId, patientId), eq(therapySessions.userId, userId))),
  ]);

  const seq = datasDoRecibo({
    pagamentos: pagamentosDoPaciente.map((p) => ({ id: p.id, valor: Number(p.amount) || 0 })),
    alvoId: pagamento.id,
    sessoes: sessoesDoPaciente.map((s) => ({ data: new Date(horaDeParede(s.date)), status: s.status })),
    valorSessao: Number(paciente.sessionFee) || 0,
  });

  // Sem datas de atendimento (ex.: pagamento preso a uma sessão, ou valor sem sessões): mantém o
  // fallback antigo — a sessão vinculada, senão a data do pagamento — para o recibo nunca sair vazio.
  const fallback = pagamento.sessionId
    ? (await db.select({ date: therapySessions.date }).from(therapySessions)
        .where(and(eq(therapySessions.id, pagamento.sessionId), eq(therapySessions.userId, userId))))
        .map((s) => new Date(horaDeParede(s.date)))
    : [];
  const datas = seq.datas.length ? seq.datas : (fallback.length ? fallback : [new Date(horaDeParede(pagamento.date))]);

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
    parcialDe: seq.parcial ? seq.inicioPacote : null,
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
      semDatasDeSessao={seq.datas.length === 0 && fallback.length === 0}
    />
  );
}

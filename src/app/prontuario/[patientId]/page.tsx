import { db } from "@/db";
import { auth } from "@/auth";
import { patients, users, treatmentGoals, patientRecords, scaleApplications, therapySessions, sessionPayments, assignments } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { formatDate, formatDateTime, formatBRL, SESSION_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/therapy";
import { SCALES, type ScaleType } from "@/lib/scales";
import { PrintButton } from "@/components/PrintButton";

export const dynamic = "force-dynamic";

export default async function ProntuarioExport({ params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(patientId)) notFound();

  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.userId, userId)),
  });
  if (!patient) notFound();

  const [therapist, goals, records, scales, sessions, payments, tasks] = await Promise.all([
    db.query.users.findFirst({ where: eq(users.id, userId) }),
    db.query.treatmentGoals.findMany({ where: eq(treatmentGoals.patientId, patientId), orderBy: [desc(treatmentGoals.createdAt)] }),
    db.query.patientRecords.findMany({ where: eq(patientRecords.patientId, patientId), orderBy: [desc(patientRecords.createdAt)] }),
    db.query.scaleApplications.findMany({ where: and(eq(scaleApplications.patientId, patientId), eq(scaleApplications.status, "respondida")), orderBy: [desc(scaleApplications.appliedAt)] }),
    db.query.therapySessions.findMany({ where: eq(therapySessions.patientId, patientId), orderBy: [desc(therapySessions.date)] }),
    db.query.sessionPayments.findMany({ where: eq(sessionPayments.patientId, patientId) }),
    db.query.assignments.findMany({ where: eq(assignments.patientId, patientId), orderBy: [desc(assignments.createdAt)] }),
  ]);

  // Indexa pagamentos e anotações por sessão p/ montar o cenário de cada consulta.
  const paymentsBySession = new Map<string, typeof payments>();
  for (const p of payments) {
    if (!p.sessionId) continue;
    const arr = paymentsBySession.get(p.sessionId) ?? [];
    arr.push(p);
    paymentsBySession.set(p.sessionId, arr);
  }
  const recordsBySession = new Map<string, typeof records>();
  for (const r of records) {
    if (!r.sessionId) continue;
    const arr = recordsBySession.get(r.sessionId) ?? [];
    arr.push(r);
    recordsBySession.set(r.sessionId, arr);
  }

  return (
    <div className="min-h-screen bg-[#faf6f1] py-8 px-4 print:bg-white print:py-0">
      <div className="mx-auto max-w-3xl">
        <div className="mb-4 flex justify-between items-center print:hidden">
          <a href={`/dashboard/patients/${patientId}`} className="text-sm text-[#6b5b6f] hover:text-[#2b1830]">← Voltar</a>
          <PrintButton label="Imprimir / Salvar prontuário" />
        </div>

        <div className="bg-white rounded-[20px] border border-[#e7ddd4] p-10 print:border-0 print:rounded-none print:p-0 space-y-7 text-[#1a0f1f]">
          <div className="flex items-center justify-between border-b border-[#e7ddd4] pb-5">
            <img src="/landing/logo-ledivan.png" alt="Ledivan" className="h-12 w-auto" />
            <div className="text-right text-xs text-[#6b5b6f]">
              <p className="font-display text-lg font-semibold text-[#2b1830]">Prontuário</p>
              <p>{therapist?.name ?? "Terapeuta"}</p>
              <p>Emitido em {formatDate(new Date())}</p>
            </div>
          </div>

          <Section title="Paciente">
            <Grid>
              <Field label="Nome" value={patient.name} />
              <Field label="Status" value={patient.patientStatus} />
              <Field label="Telefone" value={patient.phone ?? "—"} />
              <Field label="E-mail" value={patient.email ?? "—"} />
              <Field label="Início" value={formatDate(patient.startedAt)} />
              <Field label="Frequência" value={patient.frequency ?? "—"} />
            </Grid>
            {patient.notes && <p className="text-sm mt-2 text-[#1a0f1f]/80 whitespace-pre-wrap">{patient.notes}</p>}
          </Section>

          <Section title="Plano terapêutico">
            {goals.length === 0 ? <Empty /> : goals.map((g) => (
              <div key={g.id} className="py-1.5 border-b border-[#f0e9e0] last:border-0">
                <p className="text-sm font-semibold">{g.title} <span className="text-xs font-normal text-[#6b5b6f]">· {g.progress}% · {g.status}</span></p>
                {g.description && <p className="text-xs text-[#6b5b6f]">{g.description}</p>}
              </div>
            ))}
          </Section>

          <Section title="Escalas de desfecho">
            {scales.length === 0 ? <Empty /> : (
              <div className="space-y-1">
                {scales.map((s) => {
                  const sc = SCALES[s.scaleType as ScaleType];
                  return <p key={s.id} className="text-sm">{sc?.short ?? s.scaleType}: <strong>{s.score}/{sc?.max}</strong> — {s.severity} <span className="text-xs text-[#6b5b6f]">({formatDate(s.appliedAt)})</span></p>;
                })}
              </div>
            )}
          </Section>

          <Section title="Evoluções e registros">
            {records.length === 0 ? <Empty /> : records.map((r) => (
              <div key={r.id} className="py-2 border-b border-[#f0e9e0] last:border-0">
                <p className="text-xs font-bold uppercase tracking-wide text-[#6b5b6f]">{r.type}{r.title ? ` · ${r.title}` : ""} · {formatDate(r.createdAt)}</p>
                <p className="text-sm mt-1 whitespace-pre-wrap leading-relaxed">{r.content}</p>
              </div>
            ))}
          </Section>

          <Section title="Tarefas (lição de casa)">
            {tasks.length === 0 ? <Empty /> : (
              <div className="space-y-1">
                {tasks.map((t) => (
                  <p key={t.id} className="text-sm">
                    {t.title} <span className="text-xs text-[#6b5b6f]">· {t.status === "respondida" ? "respondida" : "pendente"} · {formatDate(t.createdAt)}</span>
                  </p>
                ))}
              </div>
            )}
          </Section>

          <Section title="Cenário por consulta (recente → antiga)">
            {sessions.length === 0 ? <Empty /> : (
              <div className="space-y-3">
                {sessions.map((s) => {
                  const pays = paymentsBySession.get(s.id) ?? [];
                  const recs = recordsBySession.get(s.id) ?? [];
                  const paid = pays.some((p) => p.status === "paid");
                  return (
                    <div key={s.id} className="rounded-[12px] border border-[#e7ddd4] p-4 break-inside-avoid">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <strong className="text-sm text-[#2b1830]">{formatDateTime(s.date)}</strong>
                        <Badge>{SESSION_STATUS_LABELS[s.status]}</Badge>
                        <Badge>{s.chargeable ? "Cobrável" : "Cortesia"}</Badge>
                        {pays.length > 0 ? (
                          <Badge>{paid ? "Pago" : PAYMENT_STATUS_LABELS[pays[0].status]} · {formatBRL(pays[0].amount)}</Badge>
                        ) : s.chargeable ? <Badge>Sem pagamento</Badge> : null}
                        {s.isOnline && <Badge>Online</Badge>}
                        {recs.length > 0 && <Badge>{recs.length} anotação(ões)</Badge>}
                      </div>

                      {s.isOnline && (s.meetingOpenedAt || s.guestJoinedAt || s.meetingEndedAt) && (
                        <p className="text-[11px] text-[#6b5b6f] mt-1.5">
                          Reunião: {s.meetingOpenedAt ? `abriu ${formatDateTime(s.meetingOpenedAt)}` : "—"}
                          {s.guestJoinedAt ? ` · convidado ${new Date(s.guestJoinedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}
                          {s.meetingEndedAt ? ` · encerrou ${new Date(s.meetingEndedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}
                        </p>
                      )}

                      {s.notes && <p className="text-sm mt-2 whitespace-pre-wrap leading-relaxed"><span className="text-[#6b5b6f] text-xs">Notas: </span>{s.notes}</p>}

                      {recs.map((r) => (
                        <div key={r.id} className="mt-2 pl-3 border-l-2 border-[#e7ddd4]">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-[#6b5b6f]">{r.type}{r.title ? ` · ${r.title}` : ""}</p>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{r.content}</p>
                        </div>
                      ))}

                      {s.patientSummary && (
                        <p className="text-[12px] mt-2 text-[#6b5b6f] italic whitespace-pre-wrap">Resumo ao paciente: {s.patientSummary}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Section>

          <p className="text-[10px] text-[#6b5b6f] pt-4 border-t border-[#e7ddd4]">
            Documento confidencial — uso clínico. Gerado pelo Ledivan.
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-lg font-semibold text-[#2b1830] mb-2">{title}</h2>
      {children}
    </section>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">{children}</div>;
}
function Field({ label, value }: { label: string; value: string }) {
  return <p className="text-sm"><span className="text-[#6b5b6f]">{label}:</span> <strong>{value}</strong></p>;
}
function Empty() {
  return <p className="text-sm text-[#6b5b6f]">—</p>;
}
function Badge({ children }: { children: React.ReactNode }) {
  return <span className="inline-block rounded-full bg-[#f5efe8] border border-[#e7ddd4] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#6b5b6f]">{children}</span>;
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { therapySessions, accounts, users } from "@/db/schema";
import { and, eq, gte, lt, isNull, isNotNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { sendSessionReminder } from "@/lib/reminders";
import { syncCalendar } from "@/lib/googleCalendar";
import { geralDoPaciente } from "@/lib/geralDoPaciente";
import { DIAS_A_FRENTE, HORA_DO_LEMBRETE, posicaoNoPacote, quandoDoDisparo, type QuandoLembrar } from "@/lib/lembreteDaSessao";
import { agoraEmParede, horaDeDisparar } from "@/lib/lembretePorSessao";
import { COLUNAS_DA_SESSAO } from "@/lib/colunasDaSessao";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * O LEMBRETE DE SESSÃO (doc 61).
 *
 * Roda duas vezes por dia e cada disparo serve UM grupo de terapeutas:
 *
 * - de manhã (6h de Brasília) vão as sessões de HOJE, para quem escolheu "no dia da sessão";
 * - de tarde (15h) vão as de AMANHÃ, para quem escolheu "no dia anterior".
 *
 * Os dois grupos nunca se cruzam — é o que impede o mesmo paciente de receber dois lembretes da
 * mesma sessão. A escolha é do terapeuta (Ajustes); quem recebe continua sendo decidido paciente a
 * paciente (`reminderEnabled`). `reminderSentAt` garante a mensagem única mesmo se o cron repetir.
 *
 * A regra anterior era por ANTECEDÊNCIA em minutos, e com cron diário ela mandava o lembrete a
 * qualquer hora do dia — inclusive de madrugada, se fosse essa a hora em que a execução caísse.
 *
 * DOIS CAMINHOS, desde 13/11/2026 (dono):
 *
 * 1. **Por SESSÃO** — a antecedência escolhida no agendamento ("quantas horas antes"). O campo
 *    existia desde sempre, era gravado e NUNCA lido por envio nenhum; agora manda. Roda em TODA
 *    passada do cron, que passou a ser de hora em hora.
 * 2. **Por TURNO** — o caminho do doc 61, que continua valendo para quem NÃO tem antecedência
 *    própria: todo o passado está assim. Ele só acontece nas horas do turno (6h e 15h), senão a
 *    mesma sessão seria avaliada 24 vezes por dia pelo caminho velho.
 *
 * Os dois nunca se cruzam na mesma sessão: o caminho por turno ignora quem tem antecedência
 * própria, e `reminderSentAt` fecha a porta de qualquer jeito.
 */
export async function GET(req: NextRequest) {
  // Fail-closed: sem CRON_SECRET configurado o endpoint NÃO roda (evita disparo aberto de lembretes).
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET não configurado" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  // A Vercel roda em UTC; a hora que importa é a de Brasília (UTC-3). `?quando=` força o turno —
  // é como se confere o disparo da véspera sem esperar as 15h. `?dry=1` percorre sem enviar.
  const forcado = req.nextUrl.searchParams.get("quando");
  const simulacao = req.nextUrl.searchParams.get("dry") === "1";
  const agora = new Date();
  const horaBR = (agora.getUTCHours() + 24 - 3) % 24;
  const quando: QuandoLembrar = forcado === "dia" || forcado === "vespera" ? forcado : quandoDoDisparo(horaBR);

  // O dia-alvo em hora de parede: hoje para o turno da manhã, amanhã para o da tarde.
  const inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + DIAS_A_FRENTE[quando]);
  const fim = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);

  /**
   * CAMINHO 1 — por sessão. Vale em qualquer hora, porque a antecedência é de cada agendamento.
   *
   * A janela de busca é generosa (próximas 2 semanas): quem decide é `horaDeDisparar`, e trazer
   * um pouco mais de linha é mais barato do que recalcular a janela em SQL para cada antecedência
   * diferente.
   */
  // O relógio tem de ser o MESMO das sessões: hora de parede. Ver `agoraEmParede`.
  const agoraParede = agoraEmParede(agora);
  const proximas = await db
    .select({ ...COLUNAS_DA_SESSAO, userId: therapySessions.userId, patientId: therapySessions.patientId, isOnline: therapySessions.isOnline, meetingUrl: therapySessions.meetingUrl, confirmChannel: therapySessions.confirmChannel, confirmLeadHours: therapySessions.confirmLeadHours, reminderSentAt: therapySessions.reminderSentAt })
    .from(therapySessions)
    .where(and(
      eq(therapySessions.status, "agendada"),
      isNull(therapySessions.reminderSentAt),
      gte(therapySessions.date, agoraParede),
      lt(therapySessions.date, new Date(agoraParede.getTime() + 14 * 24 * 60 * 60 * 1000)),
    ));

  const porSessao = proximas.filter((s) => horaDeDisparar(agoraParede, s));
  let enviadosPorSessao = 0;
  for (const s of porSessao) {
    const p = await db.query.patients.findFirst({ where: (t, { eq: igual }) => igual(t.id, s.patientId) });
    // `reminderEnabled` continua mandando: a antecedência diz QUANDO, o cadastro diz SE.
    if (!p?.reminderEnabled) continue;
    if (simulacao) { enviadosPorSessao++; continue; }
    const ok = await sendSessionReminder(
      s.userId,
      { id: p.id, name: p.name, phone: p.phone, email: p.email, reminderChannel: "whatsapp" },
      {
        id: s.id,
        date: s.date,
        isOnline: s.isOnline,
        meetingUrl: s.meetingUrl,
        // "véspera" é só a REDAÇÃO: muda se a sessão é hoje ou num outro dia.
        vespera: new Date(s.date).toDateString() !== agoraParede.toDateString(),
        pacote: posicaoNoPacote(await cobrancasDe(s.userId, s.patientId), s.id),
      },
    );
    if (ok) {
      await db.update(therapySessions).set({ reminderSentAt: sql`now()` }).where(eq(therapySessions.id, s.id));
      enviadosPorSessao++;
    }
  }

  /**
   * CAMINHO 2 — por turno (doc 61), só nas horas do turno. Fora delas o cron de hora em hora
   * reavaliaria as mesmas sessões a cada passada, sem nada novo para fazer.
   */
  const naHoraDoTurno = forcado != null || horaBR === HORA_DO_LEMBRETE[quando];
  const donos = naHoraDoTurno
    ? await db.select({ id: users.id, quando: users.lembreteQuando }).from(users)
    : [];
  const atendidos = new Set(donos.filter((d) => (d.quando || "dia") === quando).map((d) => d.id));

  const sessions = naHoraDoTurno ? await db.query.therapySessions.findMany({
    where: and(
      eq(therapySessions.status, "agendada"),
      gte(therapySessions.date, inicio),
      lt(therapySessions.date, fim),
      isNull(therapySessions.reminderSentAt),
    ),
    with: { patient: true },
  }) : [];

  // O "Sessão x de x do pacote" vem do motor de cobrança — é ele que sabe quais sessões formam o
  // pacote. Uma leitura por paciente, reaproveitada entre as sessões dele no mesmo dia.
  const pacoteDoPaciente = new Map<string, { tipoDeCobranca: string; ids: string[]; sessoes: number }[]>();
  async function cobrancasDe(userId: string, patientId: string) {
    const chave = `${userId}:${patientId}`;
    if (!pacoteDoPaciente.has(chave)) {
      const g = await geralDoPaciente(userId, patientId).catch(() => null);
      pacoteDoPaciente.set(
        chave,
        (g?.linhas ?? []).flatMap((l) => (l.tipo === "pagamento" ? [{ tipoDeCobranca: l.tipoDeCobranca, ids: l.ids, sessoes: l.sessoes }] : [])),
      );
    }
    return pacoteDoPaciente.get(chave)!;
  }

  let sent = 0;
  let skipped = 0;
  for (const s of sessions) {
    const p = s.patient;
    if (!p?.reminderEnabled || !atendidos.has(s.userId)) { skipped++; continue; }
    // Quem tem antecedência própria já foi tratado acima — aqui ele seria um segundo lembrete.
    if (s.confirmChannel === "whatsapp" && Number(s.confirmLeadHours) > 0) { skipped++; continue; }
    if (simulacao) { sent++; continue; }
    const ok = await sendSessionReminder(
      s.userId,
      { id: p.id, name: p.name, phone: p.phone, email: p.email, reminderChannel: p.reminderChannel },
      {
        id: s.id,
        date: s.date,
        isOnline: s.isOnline,
        meetingUrl: s.meetingUrl,
        vespera: quando === "vespera",
        pacote: posicaoNoPacote(await cobrancasDe(s.userId, s.patientId), s.id),
      },
    );
    if (ok) {
      await db.update(therapySessions)
        .set({ reminderSentAt: sql`now()` })
        .where(eq(therapySessions.id, s.id));
      sent++;
    } else {
      skipped++;
    }
  }

  /**
   * Sincronização Google (best-effort) p/ quem conectou a Agenda + concedeu escopo.
   *
   * Só nas horas do TURNO. O cron passou a rodar de hora em hora por causa do lembrete por sessão,
   * e deixar a sincronia junto multiplicaria por doze as chamadas ao Google e as leituras do banco
   * — sem nada novo para sincronizar na maior parte das passadas. Cadência de cron já estourou
   * cota nesta casa antes.
   */
  let synced = 0;
  try {
    const googleUsers = naHoraDoTurno ? await db.select({ userId: accounts.userId, scope: accounts.scope })
      .from(accounts).where(and(eq(accounts.provider, "google"), isNotNull(accounts.refresh_token))) : [];
    for (const g of googleUsers) {
      if (!g.scope?.includes("calendar")) continue;
      const r = await syncCalendar(g.userId); // checa preferências (googleCalendar on) internamente
      if (r.ok) synced++;
    }
  } catch (e) { console.error("cron sync google:", e); }

  return NextResponse.json({ ok: true, quando, naHoraDoTurno, simulacao, porSessao: porSessao.length, enviadosPorSessao, candidates: sessions.length, sent, skipped, synced });
}

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { therapySessions, accounts, users } from "@/db/schema";
import { and, eq, gte, lt, isNull, isNotNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { sendSessionReminder } from "@/lib/reminders";
import { syncCalendar } from "@/lib/googleCalendar";
import { geralDoPaciente } from "@/lib/geralDoPaciente";
import { DIAS_A_FRENTE, posicaoNoPacote, quandoDoDisparo, type QuandoLembrar } from "@/lib/lembreteDaSessao";

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

  const donos = await db.select({ id: users.id, quando: users.lembreteQuando }).from(users);
  const atendidos = new Set(donos.filter((d) => (d.quando || "dia") === quando).map((d) => d.id));

  const sessions = await db.query.therapySessions.findMany({
    where: and(
      eq(therapySessions.status, "agendada"),
      gte(therapySessions.date, inicio),
      lt(therapySessions.date, fim),
      isNull(therapySessions.reminderSentAt),
    ),
    with: { patient: true },
  });

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

  // Sincronização Google (best-effort) p/ quem conectou a Agenda + concedeu escopo.
  let synced = 0;
  try {
    const googleUsers = await db.select({ userId: accounts.userId, scope: accounts.scope })
      .from(accounts).where(and(eq(accounts.provider, "google"), isNotNull(accounts.refresh_token)));
    for (const g of googleUsers) {
      if (!g.scope?.includes("calendar")) continue;
      const r = await syncCalendar(g.userId); // checa preferências (googleCalendar on) internamente
      if (r.ok) synced++;
    }
  } catch (e) { console.error("cron sync google:", e); }

  return NextResponse.json({ ok: true, quando, simulacao, candidates: sessions.length, sent, skipped, synced });
}

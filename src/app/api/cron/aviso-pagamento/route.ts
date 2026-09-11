import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { therapySessions, sessionPayments, users } from "@/db/schema";
import { and, eq, gte, lt, isNull, sql } from "drizzle-orm";
import { avisoPagamentoTexto, deveAvisar, prazoDoPagamento } from "@/lib/pagamentoSessao";
import { sendWhatsappFromUser } from "@/lib/whatsappEvolution";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron diário: o aviso de pagamento de quem paga A CADA SESSÃO.
 *
 * É UMA mensagem por sessão, no prazo que o terapeuta combinou ("pagar até X horas antes"), e
 * nada acontece sozinho depois dela. Se o pagamento não vier, a agenda mostra a sessão como
 * pagamento atrasado e quem decide é o profissional: atende assim mesmo, ou cancela a sessão.
 *
 * `avisoPagamentoAt` é o que garante a mensagem única, do mesmo jeito que `reminderSentAt` faz
 * com o lembrete de sessão.
 */
export async function GET(req: NextRequest) {
  // Fail-closed: sem CRON_SECRET o endpoint não roda — mensagem para paciente não sai de rota aberta.
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ ok: false, error: "CRON_SECRET não configurado" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ ok: false }, { status: 401 });

  // Simulação: `?dry=1` percorre tudo e diz quem receberia, sem enviar nada e sem marcar a
  // sessão. É como se confere o cron sem mandar mensagem para paciente de verdade.
  const simulacao = req.nextUrl.searchParams.get("dry") === "1";

  const agora = new Date();
  const ate = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000); // um mês à frente cobre qualquer "pagar até"

  const sessoes = await db.query.therapySessions.findMany({
    where: and(
      eq(therapySessions.status, "agendada"),
      gte(therapySessions.date, agora),
      lt(therapySessions.date, ate),
      isNull(therapySessions.avisoPagamentoAt),
    ),
    with: { patient: true },
  });

  const intervaloMin = parseInt(process.env.CRON_INTERVAL_MIN || "1440");
  const nomeDoTerapeuta = new Map<string, string>();
  let enviados = 0, pulados = 0;

  for (const s of sessoes) {
    const p = s.patient;
    // Só quem paga a cada sessão e combinou um prazo. Mensal, quinzenal e gratuito não entram.
    if (!p || p.paymentFormat !== "sessao" || !p.horasAntesPagamento) { pulados++; continue; }
    if (!p.phone) { pulados++; continue; }

    const [pago] = await db.select({ n: sql<number>`count(*)::int` })
      .from(sessionPayments)
      .where(and(eq(sessionPayments.sessionId, s.id), eq(sessionPayments.status, "paid")));

    const precisa = deveAvisar({
      agora,
      dataSessao: s.date as Date,
      horasAntes: p.horasAntesPagamento,
      jaAvisado: !!s.avisoPagamentoAt,
      pago: (pago?.n ?? 0) > 0,
      intervaloMin,
    });
    if (!precisa) { pulados++; continue; }

    if (!nomeDoTerapeuta.has(s.userId)) {
      const u = await db.query.users.findFirst({ where: eq(users.id, s.userId) });
      nomeDoTerapeuta.set(s.userId, u?.name || "Seu terapeuta");
    }

    const prazo = prazoDoPagamento(s.date as Date, p.horasAntesPagamento)!;
    const valor = Number(s.fee) || Number(p.sessionFee) || 0;
    if (simulacao) { enviados++; continue; }
    const ok = await sendWhatsappFromUser(
      s.userId,
      p.phone,
      avisoPagamentoTexto(p.name, valor, s.date as Date, prazo, nomeDoTerapeuta.get(s.userId)!),
    );

    if (ok) {
      await db.update(therapySessions).set({ avisoPagamentoAt: sql`now()` }).where(eq(therapySessions.id, s.id));
      enviados++;
    } else {
      pulados++;
    }
  }

  return NextResponse.json({ ok: true, simulacao, enviados, pulados });
}

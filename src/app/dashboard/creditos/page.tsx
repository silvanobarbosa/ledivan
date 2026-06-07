import { db } from "@/db";
import { auth } from "@/auth";
import { patients, sessionPayments, therapySessions } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { Wallet, ChevronRight } from "lucide-react";
import Link from "next/link";
import { formatBRL } from "@/lib/therapy";

export const dynamic = "force-dynamic";

export default async function CreditosPage({ searchParams }: { searchParams: Promise<{ ordem?: string }> }) {
  const { ordem } = await searchParams;
  const desc = ordem === "desc"; // padrão: dos mais negativos aos mais positivos
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const [list, pays, debits] = await Promise.all([
    db.query.patients.findMany({
      where: and(eq(patients.userId, userId), eq(patients.patientStatus, "ativo")),
      columns: { id: true, name: true, sessionFee: true, paymentFormat: true },
    }),
    db.select({ pid: sessionPayments.patientId, total: sql<string>`sum(${sessionPayments.amount})` })
      .from(sessionPayments).where(and(eq(sessionPayments.userId, userId), eq(sessionPayments.status, "paid"))).groupBy(sessionPayments.patientId),
    db.select({ pid: therapySessions.patientId, total: sql<string>`sum(${therapySessions.fee})` })
      .from(therapySessions).where(and(eq(therapySessions.userId, userId), eq(therapySessions.status, "realizada"), eq(therapySessions.chargeable, true))).groupBy(therapySessions.patientId),
  ]);
  const paidMap = new Map(pays.map((r) => [r.pid, parseFloat(r.total || "0")]));
  const debitMap = new Map(debits.map((r) => [r.pid, parseFloat(r.total || "0")]));

  const rows = list.map((p) => {
    const fee = parseFloat(p.sessionFee || "0") || 0;
    const balance = (paidMap.get(p.id) ?? 0) - (debitMap.get(p.id) ?? 0);
    const sessions = fee > 0 ? balance / fee : 0;
    return { id: p.id, name: p.name, fee, balance, sessions, paymentFormat: p.paymentFormat };
  }).sort((a, b) => desc ? b.sessions - a.sessions : a.sessions - b.sessions);

  return (
    <div className="max-w-3xl space-y-6 pb-20">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary flex items-center gap-2">
            <Wallet className="w-7 h-7" /> Gestão de Créditos
          </h1>
          <p className="text-foreground/50 mt-1">Pacientes ativos por saldo de sessões — dos mais negativos aos mais positivos.</p>
        </div>
        <Link href={`/dashboard/creditos?ordem=${desc ? "asc" : "desc"}`} className="text-sm font-semibold px-4 py-2 rounded-full bg-white/60 text-foreground/60 hover:bg-white transition">
          {desc ? "↓ Mais positivos primeiro" : "↑ Mais negativos primeiro"}
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className="glass-card rounded-[24px] p-10 text-center text-foreground/40">Nenhum paciente ativo.</div>
      ) : (
        <div className="grid gap-2">
          {rows.map((r) => {
            const credit = Math.floor(r.sessions);
            const negative = r.balance < 0;
            const debt = negative ? Math.ceil(-r.sessions) : 0;
            return (
              <Link key={r.id} href={`/dashboard/patients/${r.id}`} className="flex items-center gap-3 bg-white rounded-2xl border border-border px-4 py-3 hover:border-primary/30 transition group">
                <span className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center font-display font-bold shrink-0 ${negative ? "bg-[#fef2f2] text-[#b91c1c]" : credit > 0 ? "bg-[#ecfdf5] text-[#047857]" : "bg-surface text-foreground/50"}`}>
                  <span className="text-base leading-none">{negative ? `-${debt}` : credit}</span>
                  <span className="text-[8px] uppercase">sess.</span>
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{r.name}</p>
                  <p className="text-sm text-foreground/50">
                    {negative ? <span className="text-[#b91c1c] font-semibold">Devendo {formatBRL(Math.abs(r.balance).toFixed(2))}</span> : <span className="text-[#047857] font-semibold">Crédito {formatBRL(r.balance.toFixed(2))}</span>}
                  </p>
                </div>
                <ChevronRight className="w-4 h-4 text-foreground/30 group-hover:text-primary transition" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

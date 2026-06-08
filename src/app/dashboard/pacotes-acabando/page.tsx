import { db } from "@/db";
import { auth } from "@/auth";
import { patients, patientPackages } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { Package, ChevronRight } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PacotesAcabandoPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  // pacientes ativos com pacote cujo saldo de sessões em aberto == 1
  const rows = await db
    .select({ id: patients.id, name: patients.name, rem: sql<number>`sum(${patientPackages.sessions} - ${patientPackages.used})::int` })
    .from(patientPackages)
    .innerJoin(patients, eq(patientPackages.patientId, patients.id))
    .where(and(eq(patientPackages.userId, userId), eq(patients.patientStatus, "ativo"), eq(patients.contractType, "pacote")))
    .groupBy(patients.id, patients.name)
    .having(sql`sum(${patientPackages.sessions} - ${patientPackages.used}) = 1`)
    .orderBy(patients.name);

  return (
    <div className="max-w-3xl space-y-6 pb-20">
      <div>
        <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary flex items-center gap-2">
          <Package className="w-7 h-7" /> Pacotes acabando
        </h1>
        <p className="text-foreground/50 mt-1">Pacientes ativos com apenas 1 sessão restante no pacote — hora de renovar.</p>
      </div>

      {rows.length === 0 ? (
        <div className="glass-card rounded-[24px] p-10 text-center text-foreground/40">Nenhum pacote acabando. 🌿</div>
      ) : (
        <div className="grid gap-2">
          {rows.map((r) => (
            <Link key={r.id} href={`/dashboard/patients/${r.id}`} className="flex items-center gap-3 bg-white rounded-2xl border border-[#bfdbfe] px-4 py-3 hover:border-primary/30 transition group">
              <span className="w-10 h-10 rounded-xl bg-[#dbeafe] text-[#1e40af] flex items-center justify-center font-display font-bold shrink-0">{r.name.charAt(0).toUpperCase()}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{r.name}</p>
                <p className="text-sm text-[#1e40af] font-semibold">1 sessão restante</p>
              </div>
              <ChevronRight className="w-4 h-4 text-foreground/30 group-hover:text-primary transition" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

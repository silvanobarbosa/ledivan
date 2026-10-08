import { redirect } from "next/navigation";
import Link from "next/link";
import { and, asc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { patients } from "@/db/schema";
import { auth } from "@/auth";
import { FileText, ChevronRight } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Contratos" };

/**
 * Menu Contratos (doc 9): escolher o paciente e abrir o contrato dele, já preenchido e pronto para
 * completar/imprimir. Não guarda contrato no banco — é gerado do cadastro, como o recibo.
 */
export default async function Contratos() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = session.user.id;

  const lista = await db
    .select({ id: patients.id, name: patients.name, registrationNumber: patients.registrationNumber })
    .from(patients)
    .where(and(eq(patients.userId, userId), ne(patients.patientStatus, "prospect")))
    .orderBy(asc(patients.name));

  return (
    <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <header className="space-y-1">
        <h1 className="text-2xl font-display font-bold text-primary flex items-center gap-2">
          <FileText className="w-6 h-6" /> Contratos
        </h1>
        <p className="text-sm text-foreground/50">Escolha o paciente para abrir o contrato — já vem preenchido com o cadastro e os Ajustes; é só completar e imprimir.</p>
      </header>

      {lista.length === 0 ? (
        <div className="glass-card rounded-2xl p-6 text-center text-foreground/50">Nenhum paciente cadastrado ainda.</div>
      ) : (
        <ul className="divide-y divide-border glass-card rounded-2xl overflow-hidden">
          {lista.map((p) => (
            <li key={p.id}>
              <Link href={`/dashboard/patients/${p.id}/contrato`} className="flex items-center gap-3 px-4 py-3 hover:bg-surface transition">
                {p.registrationNumber != null && (
                  <span className="text-xs font-mono font-bold text-foreground/40 tabular-nums">#{String(p.registrationNumber).padStart(4, "0")}</span>
                )}
                <span className="flex-1 font-semibold">{p.name}</span>
                <span className="text-xs font-bold text-primary">Abrir contrato</span>
                <ChevronRight className="w-4 h-4 text-foreground/30" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

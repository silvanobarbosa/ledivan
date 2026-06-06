import { db } from "@/db";
import { auth } from "@/auth";
import { patients } from "@/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { createProspect, convertProspect } from "./actions";
import { formatDate } from "@/lib/therapy";
import { UserPlus, ArrowRight } from "lucide-react";
import Link from "next/link";

const inputCls = "w-full px-4 py-2.5 rounded-xl bg-white/70 border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm";

export default async function ProspectsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const list = await db.query.patients.findMany({
    where: and(eq(patients.userId, session.user.id), eq(patients.patientStatus, "prospect")),
    orderBy: [desc(patients.createdAt)],
  });

  const convert = async (formData: FormData) => {
    "use server";
    await convertProspect(formData.get("id") as string);
  };

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary">Prospects</h1>
        <p className="text-foreground/50 mt-1">Potenciais pacientes em prospecção</p>
      </div>

      <form action={createProspect} className="glass-card rounded-[24px] p-5 grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2 flex items-center gap-2 text-primary font-semibold text-sm">
          <UserPlus className="w-4 h-4" /> Novo prospect
        </div>
        <input name="name" required placeholder="Nome *" className={inputCls} />
        <input name="phone" placeholder="Telefone" className={inputCls} />
        <input name="email" type="email" placeholder="E-mail" className={inputCls} />
        <input name="sessionFee" inputMode="decimal" placeholder="Valor previsto (R$)" className={inputCls} />
        <textarea name="prospectObservacoes" rows={2} placeholder="Observações" className={`${inputCls} sm:col-span-2`} />
        <button className="sm:col-span-2 bg-primary text-white py-2.5 rounded-xl font-bold">Adicionar prospect</button>
      </form>

      {list.length === 0 ? (
        <p className="text-center py-16 text-foreground/40">Nenhum prospect no momento.</p>
      ) : (
        <div className="grid gap-3">
          {list.map((p) => (
            <div key={p.id} className="glass-card rounded-[24px] p-5 flex items-center gap-4">
              <Link href={`/dashboard/patients/${p.id}`} className="flex items-center gap-4 flex-1 min-w-0 group">
                <div className="w-11 h-11 rounded-2xl bg-secondary-container/40 text-primary flex items-center justify-center font-display font-bold shrink-0">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate group-hover:text-primary transition">{p.name}</p>
                  <p className="text-sm text-foreground/50 truncate">
                    {p.phone || "—"} · prospecção {formatDate(p.prospectDate)}
                    {p.prospectFechou ? ` · ${p.prospectFechou}` : ""}
                  </p>
                  <p className="text-[11px] text-accent font-semibold mt-0.5">Abrir para agendar / ver histórico →</p>
                </div>
              </Link>
              <form action={convert}>
                <input type="hidden" name="id" value={p.id} />
                <button className="flex items-center gap-1.5 bg-primary text-white text-sm px-4 py-2 rounded-xl font-semibold hover:scale-[1.02] transition">
                  Converter <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

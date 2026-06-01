import { auth } from "@/auth";
import Link from "next/link";
import { ChevronRight, ShieldCheck } from "lucide-react";
import { getClinicalFlags } from "@/lib/clinical";
import { FlagChips } from "@/components/dashboard/FlagChips";

export const dynamic = "force-dynamic";

export default async function ClinicoPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const flagged = await getClinicalFlags(session.user.id);

  return (
    <div className="max-w-4xl space-y-8 pb-20">
      <div>
        <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary">Atenção clínica</h1>
        <p className="text-foreground/50 mt-1">Pacientes que merecem um olhar agora.</p>
      </div>

      {flagged.length === 0 ? (
        <div className="glass-card rounded-[28px] p-10 text-center space-y-3">
          <ShieldCheck className="w-10 h-10 text-[#047857] mx-auto" />
          <p className="font-display text-xl text-primary">Tudo tranquilo por aqui</p>
          <p className="text-foreground/50 text-sm">Nenhum paciente em alerta no momento.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {flagged.map(({ id, name, flags }) => (
            <Link key={id} href={`/dashboard/patients/${id}`} className="glass-card rounded-[24px] p-5 flex items-center gap-4 hover:shadow-lg transition group">
              <div className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-display font-bold shrink-0">
                {name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold truncate">{name}</p>
                <div className="mt-1.5"><FlagChips flags={flags} /></div>
              </div>
              <ChevronRight className="w-5 h-5 text-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

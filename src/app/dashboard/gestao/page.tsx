import { auth } from "@/auth";
import { getManagementFlags, MGMT_FLAG_LABELS } from "@/lib/management";
import { Wallet, ChevronRight } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function GestaoPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const flagged = await getManagementFlags(session.user.id);

  return (
    <div className="max-w-3xl space-y-6 pb-20">
      <div>
        <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary flex items-center gap-2">
          <Wallet className="w-7 h-7" /> Atenção de gestão
        </h1>
        <p className="text-foreground/50 mt-1">Pacientes com pendência financeira ou de contrato: pagamento, créditos do pacote e reajuste.</p>
      </div>

      {flagged.length === 0 ? (
        <div className="glass-card rounded-[24px] p-10 text-center text-foreground/40">Nada pendente. Tudo em dia! 🌿</div>
      ) : (
        <div className="grid gap-2">
          {flagged.map(({ id, name, flags }) => (
            <Link key={id} href={`/dashboard/patients/${id}`} className="flex items-center gap-3 bg-white rounded-2xl border border-border px-4 py-3 hover:border-primary/30 transition group">
              <span className="w-10 h-10 rounded-xl bg-[#fffbeb] text-[#92400e] flex items-center justify-center font-display font-bold shrink-0">{name.charAt(0).toUpperCase()}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{name}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {flags.map((f) => (
                    <span key={f} className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#fef3c7] text-[#92400e]">{MGMT_FLAG_LABELS[f]}</span>
                  ))}
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-foreground/30 group-hover:text-primary transition" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

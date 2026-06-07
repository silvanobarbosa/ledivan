import { db } from "@/db";
import { auth } from "@/auth";
import { therapySessions } from "@/db/schema";
import { and, eq, gte, sql } from "drizzle-orm";
import { Clock, Stethoscope, Check, Video, MapPin } from "lucide-react";
import Link from "next/link";
import { formatDateTime } from "@/lib/therapy";
import { confirmSession } from "../sessions/actions";

export const dynamic = "force-dynamic";

export default async function ReservasPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const now = new Date();
  const list = await db.query.therapySessions.findMany({
    where: and(eq(therapySessions.userId, session.user.id), eq(therapySessions.pendingConfirmation, true), gte(therapySessions.date, now)),
    with: { patient: { columns: { name: true, id: true } } },
    orderBy: [therapySessions.date],
  });

  const confirmar = async (formData: FormData) => {
    "use server";
    await confirmSession(formData.get("id") as string);
  };

  return (
    <div className="max-w-3xl space-y-6 pb-20">
      <div>
        <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary flex items-center gap-2">
          <Clock className="w-7 h-7" /> Reservas a confirmar
        </h1>
        <p className="text-foreground/50 mt-1">Agendas reservadas (ainda não confirmadas), do mais próximo ao mais futuro.</p>
      </div>

      {list.length === 0 ? (
        <div className="glass-card rounded-[24px] p-10 text-center text-foreground/40">Nenhuma reserva pendente. 🌿</div>
      ) : (
        <div className="grid gap-2">
          {list.map((s) => (
            <div key={s.id} className="flex items-center gap-3 bg-white rounded-2xl border border-[#fde68a] px-4 py-3">
              <span className="text-[#92400e] shrink-0">{s.isOnline ? <Video className="w-5 h-5" /> : <MapPin className="w-5 h-5" />}</span>
              <div className="flex-1 min-w-0">
                <Link href={`/dashboard/patients/${s.patient?.id ?? ""}`} className="font-semibold truncate hover:text-primary transition block">{s.patient?.name ?? "—"}</Link>
                <p className="text-sm text-foreground/50 capitalize">{formatDateTime(s.date as unknown as string)} · {s.duration}min</p>
              </div>
              <a href={`/atender/${s.id}`} className="text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"><Stethoscope className="w-3.5 h-3.5" /> Atender</a>
              <form action={confirmar}>
                <input type="hidden" name="id" value={s.id} />
                <button className="inline-flex items-center gap-1.5 bg-primary text-white px-3 py-2 rounded-xl font-bold text-sm"><Check className="w-4 h-4" /> Confirmar</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

import { db } from "@/db";
import { auth } from "@/auth";
import { therapySessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { AgendaClient } from "./AgendaClient";

export default async function AgendaPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const list = await db.query.therapySessions.findMany({
    where: eq(therapySessions.userId, session.user.id),
    with: { patient: { columns: { name: true } } },
  });

  return (
    <div className="max-w-5xl space-y-8">
      <div>
        <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary">Agenda</h1>
        <p className="text-foreground/50 mt-1">Sessões da semana</p>
      </div>
      <AgendaClient
        sessions={list.map((s) => ({
          id: s.id,
          date: s.date as unknown as string,
          duration: s.duration,
          status: s.status,
          patientName: s.patient?.name ?? "—",
        }))}
      />
    </div>
  );
}

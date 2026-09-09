import { db } from "@/db";
import { auth } from "@/auth";
import { patients, prospectContacts } from "@/db/schema";
import { and, eq, desc, inArray } from "drizzle-orm";
import { ListaProspects } from "./ListaProspects";
import { UserPlus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ProspectsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const list = await db.query.patients.findMany({
    where: and(eq(patients.userId, session.user.id), eq(patients.patientStatus, "prospect")),
    orderBy: [desc(patients.prospectDate)],
  });

  // Contatos de todos os prospects numa consulta só, em vez de uma por linha da lista.
  const contatos = list.length
    ? await db.select().from(prospectContacts)
        .where(inArray(prospectContacts.patientId, list.map((p) => p.id)))
        .orderBy(desc(prospectContacts.date))
    : [];

  const iso = (d: Date | null) => (d ? (d as unknown as string) : null);

  return (
    <div className="max-w-5xl space-y-6 pb-20">
      <div>
        <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary flex items-center gap-2">
          <UserPlus className="w-7 h-7" /> Prospects
        </h1>
        <p className="text-foreground/50 mt-1">Potenciais pacientes em prospecção, com o histórico de contatos de cada um.</p>
      </div>

      <ListaProspects
        prospects={list.map((p) => ({
          id: p.id,
          name: p.name,
          phone: p.phone,
          email: p.email,
          gender: p.gender,
          birthDate: iso(p.birthDate),
          prospectDate: iso(p.prospectDate),
          prospectFechou: p.prospectFechou,
          sessionFee: p.sessionFee,
        }))}
        contatos={contatos.map((c) => ({
          id: c.id,
          patientId: c.patientId,
          date: c.date as unknown as string,
          observacao: c.observacao,
        }))}
      />
    </div>
  );
}

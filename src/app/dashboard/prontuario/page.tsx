import { db } from "@/db";
import { auth } from "@/auth";
import { patients } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { ClipboardList } from "lucide-react";
import { ProntuarioPicker } from "./ProntuarioPicker";

export const dynamic = "force-dynamic";

export default async function ProntuarioIndexPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const list = await db.select({ id: patients.id, name: patients.name, status: patients.patientStatus, avatar: patients.avatar })
    .from(patients)
    .where(and(eq(patients.userId, session.user.id), ne(patients.patientStatus, "inativo")))
    .orderBy(patients.name);

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <div>
        <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary flex items-center gap-2">
          <ClipboardList className="w-7 h-7" /> Prontuário
        </h1>
        <p className="text-foreground/50 mt-1">Escolha um paciente para abrir o prontuário (evolução, anamnese, escalas, metas).</p>
      </div>
      <ProntuarioPicker patients={list} />
    </div>
  );
}

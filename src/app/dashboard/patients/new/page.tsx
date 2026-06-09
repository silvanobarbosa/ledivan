import { createPatient } from "../actions";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SubmitButton } from "@/components/SubmitButton";
import { PatientFormFields } from "@/components/dashboard/PatientFormFields";
import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { parseLocations } from "@/lib/locations";

export default async function NewPatientPage() {
  const session = await auth();
  const me = session?.user?.id ? await db.query.users.findFirst({ where: eq(users.id, session.user.id) }) : null;
  const locations = parseLocations(me?.attendanceLocations);
  return (
    <div className="max-w-2xl space-y-8">
      <Link href="/dashboard/patients" className="inline-flex items-center gap-2 text-foreground/50 hover:text-primary transition">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Link>

      <div>
        <h1 className="text-3xl font-display font-bold text-primary">Novo paciente</h1>
        <p className="text-foreground/50 mt-1">Cadastre os dados do paciente</p>
      </div>

      <form action={createPatient} className="space-y-5">
        <PatientFormFields locations={locations} />
        <div className="flex gap-3 pt-2">
          <SubmitButton pendingLabel="Cadastrando…" className="flex-1 inline-flex items-center justify-center gap-2 bg-primary text-white py-3.5 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.01] transition">
            Cadastrar paciente
          </SubmitButton>
          <Link href="/dashboard/patients" className="px-6 py-3.5 rounded-2xl font-semibold text-foreground/60 hover:bg-white/60 transition">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}

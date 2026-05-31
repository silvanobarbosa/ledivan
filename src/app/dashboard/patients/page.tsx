import { db } from "@/db";
import { auth } from "@/auth";
import { patients } from "@/db/schema";
import { and, eq, desc, ne } from "drizzle-orm";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PatientsClient } from "./PatientsClient";

export default async function PatientsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const list = await db.query.patients.findMany({
    where: and(eq(patients.userId, session.user.id), ne(patients.patientStatus, "prospect")),
    orderBy: [desc(patients.createdAt)],
  });

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary">Pacientes</h1>
          <p className="text-foreground/50 mt-1">{list.length} paciente(s) no consultório</p>
        </div>
        <Link
          href="/dashboard/patients/new"
          className="flex items-center gap-2 bg-primary text-white px-5 py-3 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          <Plus className="w-5 h-5" /> <span>Novo paciente</span>
        </Link>
      </div>

      <PatientsClient
        patients={list.map((p) => ({
          id: p.id,
          name: p.name,
          phone: p.phone,
          patientStatus: p.patientStatus,
          paymentStatus: p.paymentStatus,
          sessionFee: p.sessionFee,
          frequency: p.frequency,
        }))}
      />
    </div>
  );
}

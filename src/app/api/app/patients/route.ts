import { NextResponse } from "next/server";
import { db } from "@/db";
import { patients } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { userFromBearer } from "@/lib/app-auth";

export const dynamic = "force-dynamic";

/** Lista os pacientes do profissional (para a lista e o cache offline do app). */
export async function GET(req: Request) {
  const user = await userFromBearer(req);
  if (!user) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const rows = await db
    .select({
      id: patients.id,
      name: patients.name,
      phone: patients.phone,
      status: patients.patientStatus,
      fee: patients.sessionFee,
      frequency: patients.frequency,
    })
    .from(patients)
    .where(eq(patients.userId, user.id))
    .orderBy(asc(patients.name));

  return NextResponse.json({ patients: rows });
}

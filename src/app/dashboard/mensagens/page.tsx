import { db } from "@/db";
import { auth } from "@/auth";
import { messages, patients } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import { MensagensClient, type Thread } from "./MensagensClient";

export const dynamic = "force-dynamic";

export default async function MensagensPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const uid = session.user.id;

  const [rows, pats] = await Promise.all([
    db.select().from(messages).where(eq(messages.userId, uid)).orderBy(desc(messages.createdAt)).limit(600),
    db.query.patients.findMany({ where: eq(patients.userId, uid), columns: { id: true, name: true } }),
  ]);
  const nameById = new Map(pats.map((p) => [p.id, p.name]));

  // agrupa por paciente (ou por contato, quando não casou)
  const map = new Map<string, Thread>();
  for (const m of rows) { // desc (mais novo primeiro)
    const key = m.patientId ?? `c:${m.contact ?? "?"}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        patientId: m.patientId ?? null,
        contact: m.contact ?? null,
        name: m.patientId ? (nameById.get(m.patientId) ?? "Paciente") : (m.contact ?? "Contato"),
        messages: [],
      });
    }
    map.get(key)!.messages.push({ direction: m.direction, text: m.text, channel: m.channel, at: (m.createdAt as Date).toISOString() });
  }
  const threads = [...map.values()].map((t) => ({ ...t, messages: t.messages.slice().reverse() }));

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl lg:text-4xl font-display font-bold text-primary">Mensagens</h1>
        <p className="text-foreground/50 mt-1">Conversas com seus pacientes (WhatsApp)</p>
      </div>
      <MensagensClient threads={threads} />
    </div>
  );
}

import { db } from "@/db";
import { patients, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Logo } from "@/components/landing/Logo";
import { MoodForm } from "./MoodForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Como você está? — Ledivan+" };

export default async function MoodPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const patient = await db.query.patients.findFirst({ where: eq(patients.moodToken, token) });
  if (!patient) notFound();
  const therapist = await db.query.users.findFirst({ where: eq(users.id, patient.userId) });

  return (
    <div className="bg-ornaments min-h-screen flex flex-col">
      <header className="mx-auto w-full max-w-2xl px-6 py-6">
        <Logo />
      </header>
      <main className="flex-1 flex items-start justify-center px-6 py-6">
        <div className="w-full max-w-md">
          <div className="glass-card-lg p-8 reveal-up">
            <p className="text-sm text-[color:var(--muted-foreground)]">
              Diário de humor · acompanhado por {therapist?.name ?? "seu terapeuta"}
            </p>
            <h1 className="font-display mt-1 text-3xl font-medium text-[color:var(--brand-eggplant)]">
              Como você está se sentindo?
            </h1>
            <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
              Registre rapidinho. Pode voltar quantas vezes quiser.
            </p>
            <MoodForm token={token} />
          </div>
          <p className="mt-5 text-center text-[11px] text-[color:var(--muted-foreground)]">
            Privado · visível apenas ao seu terapeuta · Ledivan+
          </p>
        </div>
      </main>
    </div>
  );
}

import { db } from "@/db";
import { scaleApplications, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Logo } from "@/components/landing/Logo";
import { ScaleForm } from "./ScaleForm";
import { SCALES, type ScaleType } from "@/lib/scales";
import { Check } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Questionário — Ledivan+" };

export default async function ScalePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const app = await db.query.scaleApplications.findFirst({ where: eq(scaleApplications.token, token) });
  if (!app) notFound();
  const scale = SCALES[app.scaleType as ScaleType];
  if (!scale) notFound();
  const therapist = await db.query.users.findFirst({ where: eq(users.id, app.userId) });

  const answered = app.status === "respondida";

  return (
    <div className="bg-ornaments min-h-screen flex flex-col">
      <header className="mx-auto w-full max-w-2xl px-6 py-6">
        <Logo />
      </header>
      <main className="flex-1 flex items-start justify-center px-6 py-6">
        <div className="w-full max-w-lg">
          <div className="glass-card-lg p-8 reveal-up">
            <p className="text-sm text-[color:var(--muted-foreground)]">
              Questionário enviado por {therapist?.name ?? "seu terapeuta"}
            </p>
            <h1 className="font-display mt-1 text-2xl font-medium text-[color:var(--brand-eggplant)]">{scale.name}</h1>

            {answered ? (
              <div className="mt-6 rounded-2xl border border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.08)] p-5 text-center">
                <Check className="mx-auto h-6 w-6 text-[color:var(--accent-violet)]" />
                <p className="font-display mt-2 text-lg font-medium text-[color:var(--brand-eggplant)]">Respondido!</p>
                <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">Obrigado. Seu terapeuta vai avaliar o resultado.</p>
              </div>
            ) : (
              <ScaleForm token={token} scaleType={app.scaleType as ScaleType} />
            )}
          </div>
          <p className="mt-5 text-center text-[11px] text-[color:var(--muted-foreground)]">
            Privado · visível apenas ao seu terapeuta · não substitui avaliação clínica · Ledivan+
          </p>
        </div>
      </main>
    </div>
  );
}

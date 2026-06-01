import { db } from "@/db";
import { assignments, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Logo } from "@/components/landing/Logo";
import { ResponseForm } from "./ResponseForm";
import { Check } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sua tarefa — Ledivan+" };

export default async function PatientTaskPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const a = await db.query.assignments.findFirst({ where: eq(assignments.token, token) });
  if (!a) notFound();
  const therapist = await db.query.users.findFirst({ where: eq(users.id, a.userId) });

  const answered = a.status === "respondida";

  return (
    <div className="bg-ornaments min-h-screen flex flex-col">
      <header className="mx-auto w-full max-w-2xl px-6 py-6">
        <Logo />
      </header>
      <main className="flex-1 flex items-start justify-center px-6 py-6">
        <div className="w-full max-w-lg">
          <div className="glass-card-lg p-8 reveal-up">
            <p className="text-sm text-[color:var(--muted-foreground)]">
              Tarefa enviada por {therapist?.name ?? "seu terapeuta"}
            </p>
            <h1 className="font-display mt-1 text-3xl font-medium text-[color:var(--brand-eggplant)]">{a.title}</h1>
            {a.instructions && (
              <p className="mt-3 text-sm text-[color:var(--ink)]/80 whitespace-pre-wrap leading-relaxed">{a.instructions}</p>
            )}
            {a.dueDate && (
              <p className="mt-2 text-xs text-[color:var(--muted-foreground)]">
                Prazo: {new Date(a.dueDate).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}
              </p>
            )}

            <div className="mt-6 border-t border-[rgba(43,24,48,0.08)] pt-6">
              {answered ? (
                <div className="rounded-2xl border border-[rgba(139,92,246,0.3)] bg-[rgba(139,92,246,0.08)] p-5 text-center">
                  <Check className="mx-auto h-6 w-6 text-[color:var(--accent-violet)]" />
                  <p className="font-display mt-2 text-lg font-medium text-[color:var(--brand-eggplant)]">Resposta enviada!</p>
                  <p className="mt-1 text-sm text-[color:var(--muted-foreground)]">Seu terapeuta vai ver na próxima sessão. Obrigado!</p>
                </div>
              ) : (
                <ResponseForm token={token} responseType={a.responseType} />
              )}
            </div>
          </div>
          <p className="mt-5 text-center text-[11px] text-[color:var(--muted-foreground)]">
            Suas respostas são privadas e visíveis apenas ao seu terapeuta. · Ledivan+
          </p>
        </div>
      </main>
    </div>
  );
}

import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Logo } from "@/components/landing/Logo";
import { BookingForm } from "./BookingForm";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const therapist = await db.query.users.findFirst({ where: eq(users.bookingSlug, slug) });
  return { title: therapist ? `Agendar com ${therapist.name ?? "terapeuta"} — Ledivan` : "Agendar — Ledivan" };
}

export default async function BookingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const therapist = await db.query.users.findFirst({ where: eq(users.bookingSlug, slug) });
  if (!therapist) notFound();

  return (
    <div className="bg-ornaments min-h-screen flex flex-col">
      <header className="mx-auto w-full max-w-3xl px-6 py-6">
        <Logo />
      </header>
      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <div className="glass-card-lg p-8 md:p-10 reveal-up">
            <p className="text-sm text-[color:var(--muted-foreground)]">Agendar sessão com</p>
            <h1 className="font-display mt-1 text-3xl font-medium text-[color:var(--brand-eggplant)]">
              {therapist.name ?? "Terapeuta"}
            </h1>
            <p className="mt-2 text-sm text-[color:var(--muted-foreground)]">
              Escolha um horário e deixe seus dados. Você receberá a confirmação.
            </p>
            <BookingForm slug={slug} />
          </div>
          <p className="mt-6 text-center text-xs text-[color:var(--muted-foreground)]">
            Powered by Ledivan · Cuidando de quem cuida.
          </p>
        </div>
      </main>
    </div>
  );
}

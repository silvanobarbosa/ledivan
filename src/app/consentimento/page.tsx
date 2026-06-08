import { auth } from "@/auth";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { ConsentForm } from "./ConsentForm";
import { ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ConsentimentoPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const u = await db.query.users.findFirst({ where: eq(users.id, session.user.id) });
  if (u?.acceptedTermsAt && u?.acceptedPrivacyAt) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-ornaments flex items-center justify-center p-4">
      <div className="glass-card-lg w-full max-w-md p-8 space-y-5">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center"><ShieldCheck className="w-7 h-7" /></div>
          <h1 className="font-display text-2xl font-bold text-primary">Bem-vindo(a) ao Ledivan</h1>
          <p className="text-sm text-foreground/60">Antes de começar, confirme que leu e concorda com nossos termos. Você lida com dados sensíveis de pacientes — levamos a privacidade a sério.</p>
        </div>
        <ConsentForm />
      </div>
    </div>
  );
}

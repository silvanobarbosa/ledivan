import { Sidebar } from "@/components/dashboard/Sidebar";
import { MobileSidebar } from "@/components/dashboard/MobileSidebar";
import { ScanButton } from "@/components/dashboard/ScanButton";
import { BottomNavBar } from "@/components/dashboard/BottomNavBar";
import { OnboardingTour } from "@/components/dashboard/OnboardingTour";
import { AreaTint } from "@/components/dashboard/AreaTint";
import { HelpButton } from "@/components/dashboard/HelpButton";
import { HeaderUser } from "@/components/dashboard/HeaderUser";
import { photoSrc } from "@/lib/photo";
import { Bell, Plus } from "lucide-react";
import { db } from "@/db";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { redirect } from "next/navigation";
import { isAdminUser } from "@/lib/admin";
import Link from "next/link";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const user = session?.user?.id
    ? await db.query.users.findFirst({ where: eq(users.id, session.user.id) })
    : null;

  // Consentimento obrigatório no 1º acesso (contas demo são isentas).
  if (user && !user.isDemo && (!user.acceptedTermsAt || !user.acceptedPrivacyAt)) {
    redirect("/consentimento");
  }
  const isAdmin = isAdminUser(user);
  const isDemo = !!user?.isDemo;

  return (
    <div className="flex min-h-screen bg-surface selection:bg-primary selection:text-white">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-20 lg:h-24 bg-white/80 backdrop-blur-md border-b border-border flex items-center justify-between px-6 lg:px-8 shrink-0 z-10">
          <div className="flex items-center gap-3 lg:gap-4 min-w-0">
            <MobileSidebar />
            <Link href="/dashboard" className="lg:hidden flex items-center shrink-0">
              <img src="/ledivan-color.png" alt="Ledivan" className="h-9 w-auto object-contain" />
            </Link>
            <HeaderUser name={user?.name} photoUrl={photoSrc(user?.photo3x4 ?? user?.image)} />
          </div>

          <div className="flex items-center gap-2 lg:gap-4 ml-4">
            {isAdmin && (
              <Link href="/dashboard/admin" className="hidden sm:inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-2xl bg-primary/10 text-primary hover:bg-primary/20 transition">
                ★ Admin
              </Link>
            )}
            <HelpButton />
            <button aria-label="Notificações" className="p-2 lg:p-3 bg-white border border-border rounded-2xl text-foreground/60 hover:text-primary hover:border-primary transition-all">
              <Bell className="w-5 h-5" />
            </button>
            <Link href="/dashboard/patients/new" className="hidden sm:flex items-center gap-2 bg-primary text-white px-5 lg:px-6 py-3 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
              <Plus className="w-5 h-5" />
              <span className="hidden md:inline">Novo paciente</span>
            </Link>
          </div>
        </header>

        {isDemo && (
          <div className="bg-[#dbeafe] border-b border-[#93c5fd] text-[#1e40af] text-xs sm:text-sm px-4 py-2 text-center shrink-0">
            🧪 <strong>Modo demonstração</strong> — explore à vontade. Tudo que você fizer é descartado ao fim da visita (até 2h). Os dados originais ficam intactos.
          </div>
        )}
        <main className="flex-1 overflow-y-auto">
          <AreaTint>{children}</AreaTint>
        </main>
      </div>

      <BottomNavBar />
      <ScanButton userId={user?.id || ""} />
      <OnboardingTour />
    </div>
  );
}

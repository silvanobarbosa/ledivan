import { Sidebar } from "@/components/dashboard/Sidebar";
import { ScanButton } from "@/components/dashboard/ScanButton";
import { HeaderSearch } from "@/components/dashboard/HeaderSearch";
import { BottomNavBar } from "@/components/dashboard/BottomNavBar";
import { Bell, Plus } from "lucide-react";
import { db } from "@/db";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
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

  return (
    <div className="flex min-h-screen bg-surface selection:bg-primary selection:text-white">
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        <header className="h-20 lg:h-24 bg-white/80 backdrop-blur-md border-b border-border flex items-center justify-between px-6 lg:px-8 shrink-0 z-10">
          <div className="flex items-center gap-4 flex-1">
            <Link href="/dashboard" className="lg:hidden flex items-center">
              <img src="/ledivan-color.png" alt="Ledivan" className="h-9 w-auto object-contain" />
            </Link>
            <HeaderSearch />
            
            <nav className="hidden xl:flex items-center gap-6 ml-8">
              {["Metodologia", "Funcionalidades", "Segurança"].map((item) => (
                <Link 
                  key={item} 
                  href={`/#${item.toLowerCase()}`} 
                  className="text-xs font-bold text-foreground/40 hover:text-primary transition-colors uppercase tracking-widest"
                >
                  {item}
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3 lg:gap-4 ml-4">
            <button className="p-2 lg:p-3 bg-white border border-border rounded-2xl text-foreground/60 hover:text-primary hover:border-primary transition-all">
              <Bell className="w-5 h-5" />
            </button>
            <Link href="/dashboard/patients/new" className="hidden sm:flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
              <Plus className="w-5 h-5" />
              <span>Novo paciente</span>
            </Link>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 lg:p-12 space-y-12 pb-32 lg:pb-12">
          {children}
        </main>
      </div>

      <BottomNavBar />
      <ScanButton userId={user?.id || ""} />
    </div>
  );
}

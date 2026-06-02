import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { User, Bell, Shield, Smartphone, LogOut } from "lucide-react";
import { signOut } from "@/auth";
import { updateProfile } from "./actions";
import { TelegramSync } from "./TelegramSync";
import { AutoLinkToggle } from "./AutoLinkToggle";
import { IntegrationsCard } from "./IntegrationsCard";
import { BookingCard } from "./BookingCard";
import { TranscriptionToggle } from "./TranscriptionToggle";
import { SmtpCard } from "./SmtpCard";
import { WhatsappCard } from "./WhatsappCard";
import { MeetingCard } from "./MeetingCard";
import { getPreferences } from "@/lib/preferences";
import { hasGoogleAccount } from "@/lib/googleCalendar";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user) return null;

  const prefs = await getPreferences(user.id);
  const googleConnected = await hasGoogleAccount(user.id);

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      <section className="space-y-2">
        <h2 className="text-4xl font-display font-bold text-foreground tracking-tight">Configurações</h2>
        <p className="text-lg text-foreground/40 font-medium">Gerencie sua conta e preferências do Ledivan.</p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        {/* Navigation */}
        <aside className="space-y-2">
          {[
            { icon: User, label: "Perfil", active: true },
            { icon: Bell, label: "Notificações", active: false },
            { icon: Smartphone, label: "Telegram", active: false },
            { icon: Shield, label: "Segurança", active: false },
          ].map((item) => (
            <button 
              key={item.label}
              className={`w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all ${
                item.active ? "bg-primary text-white shadow-lg" : "text-foreground/40 hover:bg-white hover:text-primary"
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          ))}
          
          <form action={async () => {
            "use server";
            await signOut();
          }}>
            <button className="w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold text-red-500 hover:bg-red-50 transition-all mt-8">
              <LogOut className="w-5 h-5" />
              <span>Sair da Conta</span>
            </button>
          </form>
        </aside>

        {/* Content */}
        <div className="md:col-span-2 space-y-8">
          <div className="p-10 bg-white rounded-[48px] shadow-sm border border-border space-y-8">
            <h3 className="text-xl font-bold">Informações do Perfil</h3>
            
            <form action={updateProfile} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground/30 uppercase tracking-widest">Nome Completo</label>
                <input 
                  name="name"
                  type="text" 
                  defaultValue={user.name || ""} 
                  className="w-full p-4 bg-surface rounded-2xl border border-border focus:border-primary outline-none font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground/30 uppercase tracking-widest">E-mail</label>
                <input 
                  type="email" 
                  defaultValue={user.email} 
                  disabled
                  className="w-full p-4 bg-surface rounded-2xl border border-border opacity-50 cursor-not-allowed font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground/30 uppercase tracking-widest">Integração Telegram</label>
                <TelegramSync currentId={user.telegramId} />
              </div>

              <div className="pt-6 border-t border-border">
                <button type="submit" className="bg-primary text-white px-10 py-4 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all">
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>

          <MeetingCard initial={(prefs.meetingProvider as "jitsi" | "meet") ?? "jitsi"} hasGoogle={googleConnected} />

          <WhatsappCard connected={user.whatsappConnected} />

          <SmtpCard configured={user.emailConfigured} currentEmail={user.smtpUser} loginEmail={user.email} />

          <BookingCard initialSlug={user.bookingSlug} />

          <IntegrationsCard initial={prefs.integrations ?? {}} />

          <AutoLinkToggle initial={!!prefs.autoLinkPayments} />

          <TranscriptionToggle initial={!!prefs.transcriptionEnabled} />

          <div className="p-10 bg-primary/5 rounded-[48px] border border-primary/10 flex items-center gap-6">
            <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center text-3xl shadow-sm">
              ✨
            </div>
            <div>
              <h4 className="font-bold text-primary">Ledivan</h4>
              <p className="text-sm text-primary/60 font-medium">Gestão de consultório e finanças em um só lugar.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

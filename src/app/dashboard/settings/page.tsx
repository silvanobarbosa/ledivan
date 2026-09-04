import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { User, Video, MessageCircle, Mail, LogOut } from "lucide-react";
import { signOut } from "@/auth";
import { updateProfile } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";
import { SinglePhoto } from "@/components/dashboard/PhotoSlots";
import { LocationsCard } from "./LocationsCard";
import { parseLocations } from "@/lib/locations";
import { TelegramSync } from "./TelegramSync";
import { IntegrationsCard } from "./IntegrationsCard";
import { BookingCard } from "./BookingCard";
import { TranscriptionToggle } from "./TranscriptionToggle";
import { SmtpCard } from "./SmtpCard";
import { WhatsappCard } from "./WhatsappCard";
import { MeetingCard } from "./MeetingCard";
import { PasswordCard } from "./PasswordCard";
import { getPreferences } from "@/lib/preferences";
import { FeaturesCard } from "./FeaturesCard";
import { ConsentCard } from "./ConsentCard";
import { getConsentForm } from "./consent-actions";
import { PixCard } from "./PixCard";
import { AiKeyCard } from "./AiKeyCard";
import { hasGoogleAccount, hasCalendarScope } from "@/lib/googleCalendar";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user) return null;

  const prefs = await getPreferences(user.id);
  const consentForm = await getConsentForm();
  const googleConnected = await hasGoogleAccount(user.id);
  const calendarAuthorized = await hasCalendarScope(user.id);

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      <section className="space-y-2">
        <h2 className="text-4xl font-display font-bold text-foreground tracking-tight">Configurações</h2>
        <p className="text-lg text-foreground/40 font-medium">Gerencie sua conta e preferências do Ledivan.</p>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
        {/* Navigation (âncoras para as seções da página) */}
        <aside className="space-y-2 md:sticky md:top-24 self-start">
          {[
            { icon: User, label: "Perfil", href: "#perfil" },
            { icon: Video, label: "Reunião", href: "#reuniao" },
            { icon: MessageCircle, label: "WhatsApp", href: "#whatsapp" },
            { icon: Mail, label: "E-mail", href: "#email" },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold text-foreground/50 hover:bg-white hover:text-primary transition-all active:scale-[0.98]"
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </a>
          ))}

          <form action={async () => {
            "use server";
            await signOut();
          }}>
            <SubmitButton pendingLabel="Saindo…" className="w-full flex items-center gap-3 px-6 py-4 rounded-2xl font-bold text-red-500 hover:bg-red-50 transition-all mt-8">
              <LogOut className="w-5 h-5" />
              <span>Sair da Conta</span>
            </SubmitButton>
          </form>
        </aside>

        {/* Content */}
        <div className="md:col-span-2 space-y-8 scroll-smooth">
          <div id="perfil" className="scroll-mt-24 p-10 bg-white rounded-[48px] shadow-sm border border-border space-y-8">
            <h3 className="text-xl font-bold">Informações do Perfil</h3>
            
            <form action={updateProfile} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground/30 uppercase tracking-widest">Sua foto 3x4</label>
                <SinglePhoto initial={user.photo3x4} label="Aparece no cabeçalho" />
              </div>

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
                <SubmitButton pendingLabel="Salvando…" className="inline-flex items-center gap-2 bg-primary text-white px-10 py-4 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all">
                  Salvar Alterações
                </SubmitButton>
              </div>
            </form>
          </div>

          <PasswordCard hasPassword={!!user.passwordHash} />

          <div id="reuniao" className="scroll-mt-24">
            <MeetingCard initial={(prefs.meetingProvider as "jitsi" | "meet") ?? "jitsi"} hasGoogle={googleConnected} />
          </div>

          <div id="whatsapp" className="scroll-mt-24">
            <WhatsappCard connected={user.whatsappConnected} />
          </div>

          <div id="email" className="scroll-mt-24">
            <SmtpCard configured={user.emailConfigured} currentEmail={user.smtpUser} loginEmail={user.email} />
          </div>

          <LocationsCard initial={parseLocations(user.attendanceLocations)} />

          <BookingCard initialSlug={user.bookingSlug} initialAutoConfirm={!!prefs.bookingAutoConfirm} />

          <IntegrationsCard initial={prefs.integrations ?? {}} calendarAuthorized={calendarAuthorized} />

          <TranscriptionToggle initial={!!prefs.transcriptionEnabled} />

          <AiKeyCard configured={!!user.aiKeyEnc} provider={user.aiProvider} />

          <FeaturesCard initial={{ modes: prefs.features ?? {}, timerShow: !!prefs.timerShowToPatient }} />

          <ConsentCard initial={consentForm ? { title: consentForm.title, body: consentForm.body } : null} />

          <PixCard initial={(prefs.pix as { key: string; name: string; city: string } | undefined) ?? null} />

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

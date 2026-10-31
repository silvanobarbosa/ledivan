import { db } from "@/db";
import { users } from "@/db/schema";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";
import { LogOut } from "lucide-react";
import { updateProfile } from "./actions";
import { SubmitButton } from "@/components/SubmitButton";
import { SingleLogo, SinglePhoto } from "@/components/dashboard/PhotoSlots";
import { LocationsCard } from "./LocationsCard";
import { parseLocations } from "@/lib/locations";
import { TelegramSync } from "./TelegramSync";
import { IntegrationsCard } from "./IntegrationsCard";
import { BookingCard } from "./BookingCard";
import { CobrancaMessageCard } from "./CobrancaMessageCard";
import { ReciboCard } from "./ReciboCard";
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
import { TaxasCard } from "./TaxasCard";
import { listarVigenciasTaxa } from "./taxas-actions";
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
  const vigenciasTaxa = await listarVigenciasTaxa();

  return (
    <div className="max-w-4xl mx-auto space-y-12 pb-20">
      <section className="space-y-2">
        <h2 className="text-4xl font-display font-bold text-foreground tracking-tight">Configurações</h2>
        <p className="text-lg text-foreground/40 font-medium">Gerencie sua conta e preferências do Ledivan.</p>
      </section>

      {/* Doc 28: as âncoras (Perfil/Reunião/WhatsApp/E-mail) saíram — a pessoa rola a página. */}
      <div className="max-w-2xl mx-auto">
        {/* Content */}
        <div className="space-y-8 scroll-smooth">
          {/* Logout por LINK GET (/auth/logout) — NÃO server action. Server action é POST, e o
              proxy recusa POST na conta demo (read-only) → o botão de sair morria e a pessoa
              ficava presa. GET /auth/logout é liberado pelo proxy (/auth/*) e deleta o cookie. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- <a> é PROPOSITAL: precisa ser navegação de documento (GET) para o route handler apagar o cookie. Trocar por <Link> volta ao bug do logout que não deslogava na conta demo. */}
          <a href="/auth/logout" className="inline-flex items-center gap-3 px-6 py-3 rounded-2xl font-bold text-red-500 hover:bg-red-50 transition-all">
            <LogOut className="w-5 h-5" />
            <span>Sair da Conta</span>
          </a>
          <div id="perfil" className="scroll-mt-24 p-10 bg-white rounded-[48px] shadow-sm border border-border space-y-8">
            <h3 className="text-xl font-bold">Informações do Perfil</h3>
            
            {/* Doc 28: a foto 3x4 saiu do perfil. */}
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
                <label className="text-xs font-bold text-foreground/30 uppercase tracking-widest">CPF</label>
                <input
                  name="therapistCpf"
                  type="text"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  defaultValue={user.therapistCpf || ""}
                  className="w-full p-4 bg-surface rounded-2xl border border-border focus:border-primary outline-none font-medium"
                />
                <p className="text-xs text-foreground/40">Usado no recibo e no contrato.</p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-foreground/30 uppercase tracking-widest">Telefone</label>
                <input
                  name="therapistPhone"
                  type="tel"
                  placeholder="(00) 00000-0000"
                  defaultValue={user.therapistPhone || ""}
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
                <label className="text-xs font-bold text-foreground/30 uppercase tracking-widest">Nº do Conselho ou Associação</label>
                <input
                  name="conselho"
                  type="text"
                  placeholder="Ex: CRP 06/00000"
                  defaultValue={user.conselho || ""}
                  className="w-full p-4 bg-surface rounded-2xl border border-border focus:border-primary outline-none font-medium"
                />
              </div>

              {/* Doc 27 — dados que só o contrato usa e que a analista precisa informar uma vez. */}
              <div className="pt-6 border-t border-border space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-foreground">Informações para o contrato</h4>
                  <p className="text-xs text-foreground/40">Preenchem o cabeçalho e o foro do contrato impresso.</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground/30 uppercase tracking-widest">Endereço</label>
                  <input
                    name="enderecoContrato"
                    type="text"
                    placeholder="Rua, número, bairro — cidade/UF"
                    defaultValue={user.enderecoContrato || ""}
                    className="w-full p-4 bg-surface rounded-2xl border border-border focus:border-primary outline-none font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground/30 uppercase tracking-widest">Cidade</label>
                    <input
                      name="cidade"
                      type="text"
                      placeholder="Cidade"
                      defaultValue={user.cidade || ""}
                      className="w-full p-4 bg-surface rounded-2xl border border-border focus:border-primary outline-none font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-foreground/30 uppercase tracking-widest">Estado (UF)</label>
                    <input
                      name="estado"
                      type="text"
                      placeholder="UF"
                      defaultValue={user.estado || ""}
                      className="w-full p-4 bg-surface rounded-2xl border border-border focus:border-primary outline-none font-medium"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground/30 uppercase tracking-widest">Plataformas do atendimento online</label>
                  <input
                    name="plataformaOnline"
                    type="text"
                    placeholder="Ex: Google Meet, Zoom"
                    defaultValue={user.plataformaOnline || ""}
                    className="w-full p-4 bg-surface rounded-2xl border border-border focus:border-primary outline-none font-medium"
                  />
                </div>

                {/* Doc 31: logotipo para o contrato e o recibo (quadro 3×3cm à direita do título nos documentos). */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-foreground/30 uppercase tracking-widest">Logotipo</label>
                  <p className="text-xs text-foreground/40">Aparece no contrato e no recibo, à direita do título. Sem imagem, o espaço fica em branco.</p>
                  <SingleLogo initial={user.logoUrl} />
                </div>
                {/* Doc 51: foto de perfil, logo abaixo do logotipo. O campo `photo3x4` já existia
                    no banco e a action de Ajustes já o salvava — só a tela nunca o mostrava, então
                    não havia como preencher. */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-foreground/30 uppercase tracking-widest">Foto de perfil</label>
                  <SinglePhoto name="photo3x4" label="Escolher ou tirar" initial={user.photo3x4} />
                </div>
              </div>

              {/* Doc 28: o Telegram saiu do formulário do perfil e virou um card próprio, abaixo do WhatsApp. */}
              <div className="pt-6 border-t border-border">
                <SubmitButton pendingLabel="Salvando…" className="inline-flex items-center gap-2 bg-primary text-white px-10 py-4 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.02] transition-all">
                  Salvar Alterações
                </SubmitButton>
              </div>
            </form>
          </div>

          <PasswordCard hasPassword={!!user.passwordHash} />

          <MeetingCard initial={(prefs.meetingProvider as "jitsi" | "meet") ?? "jitsi"} hasGoogle={googleConnected} />

          <WhatsappCard connected={user.whatsappConnected} />

          {/* Doc 28: Telegram como card próprio, no mesmo espírito do WhatsApp, logo abaixo dele. */}
          <div className="glass-card rounded-[24px] p-6 space-y-3">
            <div>
              <h3 className="font-display font-bold text-primary">Telegram do seu consultório</h3>
              <p className="text-sm text-foreground/50">Conecte seu Telegram para enviar lembretes e mensagens aos pacientes por ele.</p>
            </div>
            <TelegramSync currentId={user.telegramId} />
          </div>

          <SmtpCard configured={user.emailConfigured} currentEmail={user.smtpUser} loginEmail={user.email} />

          <LocationsCard initial={parseLocations(user.attendanceLocations)} />

          <BookingCard initialSlug={user.bookingSlug} initialAutoConfirm={!!prefs.bookingAutoConfirm} />

          <CobrancaMessageCard initial={user.cobrancaMessage} />
          <ReciboCard cpf={user.therapistCpf} descricao={user.descricaoAtendimento} nome={user.name} />

          <IntegrationsCard initial={prefs.integrations ?? {}} calendarAuthorized={calendarAuthorized} />

          <TranscriptionToggle initial={!!prefs.transcriptionEnabled} />

          <AiKeyCard configured={!!user.aiKeyEnc} provider={user.aiProvider} />

          <FeaturesCard initial={{ modes: prefs.features ?? {}, timerShow: !!prefs.timerShowToPatient }} />

          <ConsentCard initial={consentForm ? { title: consentForm.title, body: consentForm.body } : null} />

          <PixCard initial={(prefs.pix as { key: string; name: string; city: string } | undefined) ?? null} />

          <TaxasCard vigencias={vigenciasTaxa} />

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

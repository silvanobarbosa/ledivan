// Lembrete de sessão — agora passa pelo MOTOR de mensageria (canal preferido + cascata + log).
import { meetingUrl } from "@/lib/therapy";
import { jaasConfigured } from "@/lib/jaas";
import { notify } from "@/lib/messaging/engine";
import { signSession } from "@/lib/messaging/confirm-token";
import { mensagemDoLembrete } from "@/lib/lembreteDaSessao";

type PatientLite = {
  id?: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  reminderChannel: string;
};
type SessionLite = {
  id: string;
  date: Date | string;
  isOnline: boolean;
  meetingUrl?: string | null;
  /** Doc 61: pacote (mensal/quinzenal) → "Sessão 3 de 4 do pacote". Null = avulsa/gratuita. */
  pacote?: { posicao: number; total: number } | null;
  /** Doc 61: o lembrete sai na véspera ("amanhã") ou no dia ("hoje"). */
  vespera?: boolean;
};

// Link de entrada do PACIENTE (convidado): Meet salvo → JaaS convidado → sala pública.
function patientMeetingLink(s: SessionLite): string {
  if (s.meetingUrl) return s.meetingUrl;
  if (jaasConfigured()) {
    const base = (process.env.APP_URL || "https://ledivan.com.br").replace(/\/$/, "");
    return `${base}/sala-convidado/${s.id}`;
  }
  return meetingUrl(s.id);
}

// Retorna true se entregou por algum canal. userId = terapeuta dono (tenant).
export async function sendSessionReminder(userId: string, p: PatientLite, s: SessionLite): Promise<boolean> {
  const when = new Date(s.date).toLocaleString("pt-BR", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });
  const base = (process.env.APP_URL || "https://ledivan.com.br").replace(/\/$/, "");
  const confirmLink = `${base}/api/sessions/confirm?s=${s.id}&a=confirm&t=${signSession(s.id, "confirm")}`;
  const rescheduleLink = `${base}/api/sessions/confirm?s=${s.id}&a=reschedule&t=${signSession(s.id, "reschedule")}`;
  // Doc 61: a redação é a do dono, montada fora da template (ela depende de ser pacote e de que
  // número de sessão é). `when` e os links de confirmação seguem para quem ainda usa o texto antigo.
  const texto = mensagemDoLembrete({ nome: p.name, quando: s.date, vespera: !!s.vespera, pacote: s.pacote ?? null });
  const r = await notify({
    userId,
    patient: { id: p.id ?? null, name: p.name, phone: p.phone, email: p.email, reminderChannel: p.reminderChannel },
    event: "session_reminder",
    vars: { when, text: texto, isOnline: s.isOnline, meetingLink: s.isOnline ? patientMeetingLink(s) : undefined, confirmLink, rescheduleLink },
  });
  return r.ok;
}

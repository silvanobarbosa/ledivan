// Lembrete de sessão — agora passa pelo MOTOR de mensageria (canal preferido + cascata + log).
import { meetingUrl } from "@/lib/therapy";
import { jaasConfigured } from "@/lib/jaas";
import { notify } from "@/lib/messaging/engine";

type PatientLite = {
  id?: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  reminderChannel: string;
};
type SessionLite = { id: string; date: Date | string; isOnline: boolean; meetingUrl?: string | null };

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
  const r = await notify({
    userId,
    patient: { id: p.id ?? null, name: p.name, phone: p.phone, email: p.email, reminderChannel: p.reminderChannel },
    event: "session_reminder",
    vars: { when, isOnline: s.isOnline, meetingLink: s.isOnline ? patientMeetingLink(s) : undefined },
  });
  return r.ok;
}

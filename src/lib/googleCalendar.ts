// Google Calendar: cria link do Meet + sincroniza sessões (push/pull/both) com o Calendar.
import { db } from "@/db";
import { accounts, therapySessions } from "@/db/schema";
import { and, eq, gte, lte, ne, isNotNull } from "drizzle-orm";
import { getPreferences, setPreferences } from "@/lib/preferences";

// Precisa de calendar.events (eventos) + calendar (criar o calendário dedicado).
export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

/**
 * Devolve o id do calendário DEDICADO "Pacientes" no Google. Se ainda não existe, cria um
 * calendário separado e guarda o id nas preferências.
 *
 * Por que dedicado: as sessões dos pacientes vão SÓ para esse calendário, nunca para o principal
 * ("primary"). Assim a agenda pessoal da terapeuta não se mistura com a dos pacientes, e uma
 * eventual leitura de volta lê só esse calendário — os eventos pessoais nunca entram no Ledivan.
 * Se a criação falhar, cai em "primary" (nunca trava o fluxo).
 */
async function getCalendarId(userId: string, token: string): Promise<string> {
  const prefs = await getPreferences(userId);
  const existente = prefs.integrations?.googleCalendarId;
  if (existente) return existente;

  try {
    const res = await fetch("https://www.googleapis.com/calendar/v3/calendars", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: "Pacientes — Ledivan",
        description: "Agenda dos pacientes, criada e mantida pelo Ledivan. Suas sessões aparecem aqui, separadas da sua agenda pessoal.",
        timeZone: "America/Sao_Paulo",
      }),
    });
    if (!res.ok) return "primary";
    const cal = await res.json();
    await setPreferences(userId, { integrations: { ...prefs.integrations, googleCalendarId: cal.id } });
    return cal.id as string;
  } catch {
    return "primary";
  }
}

// Verifica se o profissional tem conta Google vinculada (token disponível).
export async function hasGoogleAccount(userId: string): Promise<boolean> {
  const acc = await db.query.accounts.findFirst({
    where: and(eq(accounts.userId, userId), eq(accounts.provider, "google")),
  });
  return !!acc?.refresh_token;
}

// Tem o escopo do Calendar autorizado (necessário para sincronizar)?
export async function hasCalendarScope(userId: string): Promise<boolean> {
  const acc = await db.query.accounts.findFirst({
    where: and(eq(accounts.userId, userId), eq(accounts.provider, "google")),
  });
  return !!acc?.refresh_token && !!acc.scope?.includes("calendar");
}

async function getAccessToken(userId: string): Promise<string | null> {
  const acc = await db.query.accounts.findFirst({
    where: and(eq(accounts.userId, userId), eq(accounts.provider, "google")),
  });
  if (!acc) return null;

  const now = Math.floor(Date.now() / 1000);
  if (acc.access_token && acc.expires_at && acc.expires_at - 60 > now) {
    return acc.access_token;
  }
  if (!acc.refresh_token) return acc.access_token ?? null;

  // refresh
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        grant_type: "refresh_token",
        refresh_token: acc.refresh_token,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const newToken = data.access_token as string;
    const expiresAt = Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600);
    await db.update(accounts)
      .set({ access_token: newToken, expires_at: expiresAt })
      .where(and(eq(accounts.userId, userId), eq(accounts.provider, "google")));
    return newToken;
  } catch {
    return null;
  }
}

// Cria evento no Calendar com Google Meet e retorna o link. Null se não der (sem escopo/token).
export async function createMeetLink(
  userId: string,
  opts: { summary: string; startISO: string; durationMin: number },
): Promise<string | null> {
  const token = await getAccessToken(userId);
  if (!token) return null;
  const calId = await getCalendarId(userId, token);

  const start = new Date(opts.startISO);
  const end = new Date(start.getTime() + opts.durationMin * 60000);

  try {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?conferenceDataVersion=1`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: opts.summary,
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() },
          conferenceData: {
            createRequest: {
              requestId: `ledivan-${Date.now()}`,
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          },
        }),
      },
    );
    if (!res.ok) {
      console.error("Calendar API erro:", res.status, await res.text());
      return null;
    }
    const ev = await res.json();
    const link =
      ev.hangoutLink ||
      ev.conferenceData?.entryPoints?.find((e: { entryPointType?: string; uri?: string }) => e.entryPointType === "video")?.uri ||
      null;
    return link;
  } catch (e) {
    console.error("Erro createMeetLink:", e);
    return null;
  }
}

// ---------------- Sincronização de agenda ----------------

const SESS_LABELS: Record<string, string> = { agendada: "Sessão", realizada: "Sessão (realizada)", cancelada: "Sessão (cancelada)", realocada: "Sessão (realocada)", nao_realizada: "Sessão (não realizada)" };

type SessLite = { id: string; date: Date; duration: number; status: string; googleEventId: string | null; isOnline: boolean; location: string | null; patientName: string };

// Cria/atualiza (upsert) o evento no Google p/ uma sessão. Retorna o eventId.
async function pushEvent(token: string, calId: string, s: SessLite): Promise<string | null> {
  const start = new Date(s.date);
  const end = new Date(start.getTime() + (s.duration || 50) * 60000);
  const body = {
    summary: `${SESS_LABELS[s.status] ?? "Sessão"} — ${s.patientName}`,
    location: s.isOnline ? "Online" : (s.location || undefined),
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    extendedProperties: { private: { ledivan: "1", ledivanSessionId: s.id } },
  };
  const cal = encodeURIComponent(calId);
  try {
    const url = s.googleEventId
      ? `https://www.googleapis.com/calendar/v3/calendars/${cal}/events/${s.googleEventId}`
      : `https://www.googleapis.com/calendar/v3/calendars/${cal}/events`;
    const res = await fetch(url, {
      method: s.googleEventId ? "PATCH" : "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 404 && s.googleEventId) {
      // evento sumiu no Google → recria
      return pushEvent(token, calId, { ...s, googleEventId: null });
    }
    if (!res.ok) return s.googleEventId; // mantém id atual em erro
    const ev = await res.json();
    return ev.id as string;
  } catch {
    return s.googleEventId;
  }
}

async function getEventStart(token: string, calId: string, eventId: string): Promise<Date | null> {
  try {
    const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${eventId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const ev = await res.json();
    if (ev.status === "cancelled") return null;
    const dt = ev.start?.dateTime;
    return dt ? new Date(dt) : null;
  } catch { return null; }
}

// Sincroniza a agenda do terapeuta com o Google, respeitando a direção escolhida.
// pull = Google atualiza o Ledivan; push = Ledivan sobrepõe o Google; both = ambos.
export async function syncCalendar(userId: string): Promise<{ ok: boolean; pushed?: number; pulled?: number; error?: string }> {
  const prefs = await getPreferences(userId);
  const integ = prefs.integrations || {};
  if (!integ.googleCalendar) return { ok: false, error: "Google Agenda não está conectado." };
  const mode = integ.googleSyncMode || "push";
  const token = await getAccessToken(userId);
  if (!token) return { ok: false, error: "Reautorize o acesso ao Google Agenda." };
  // calendário DEDICADO — nunca o principal. As sessões vão só pra ele.
  const calId = await getCalendarId(userId, token);

  const from = new Date(); from.setDate(from.getDate() - 7); from.setHours(0, 0, 0, 0);
  const to = new Date(); to.setDate(to.getDate() + 60); to.setHours(23, 59, 59, 999);

  const rows = await db.query.therapySessions.findMany({
    where: and(eq(therapySessions.userId, userId), gte(therapySessions.date, from), lte(therapySessions.date, to), ne(therapySessions.status, "cancelada")),
    with: { patient: { columns: { name: true } } },
  });
  const sess: SessLite[] = rows.map((r) => ({ id: r.id, date: r.date as Date, duration: r.duration, status: r.status, googleEventId: r.googleEventId, isOnline: r.isOnline, location: r.location, patientName: r.patient?.name ?? "Paciente" }));

  let pushed = 0, pulled = 0;

  if (mode === "push" || mode === "both") {
    for (const s of sess) {
      const id = await pushEvent(token, calId, s);
      if (id && id !== s.googleEventId) {
        await db.update(therapySessions).set({ googleEventId: id }).where(eq(therapySessions.id, s.id));
        pushed++;
      } else if (id) { pushed++; }
    }
  }

  if (mode === "pull" || mode === "both") {
    // adota, no Ledivan, o horário do Google p/ eventos já vinculados (Google mudou)
    const linked = await db.query.therapySessions.findMany({
      where: and(eq(therapySessions.userId, userId), isNotNull(therapySessions.googleEventId), gte(therapySessions.date, from), lte(therapySessions.date, to)),
      columns: { id: true, date: true, googleEventId: true },
    });
    for (const s of linked) {
      const gStart = await getEventStart(token, calId, s.googleEventId!);
      if (gStart && Math.abs(gStart.getTime() - new Date(s.date as Date).getTime()) > 60000) {
        await db.update(therapySessions).set({ date: gStart }).where(eq(therapySessions.id, s.id));
        pulled++;
      }
    }
  }

  return { ok: true, pushed, pulled };
}

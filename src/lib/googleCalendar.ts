// Google Calendar (cria evento com link do Google Meet) usando o token OAuth do profissional.
import { db } from "@/db";
import { accounts } from "@/db/schema";
import { and, eq } from "drizzle-orm";

// Verifica se o profissional tem conta Google vinculada (token disponível).
export async function hasGoogleAccount(userId: string): Promise<boolean> {
  const acc = await db.query.accounts.findFirst({
    where: and(eq(accounts.userId, userId), eq(accounts.provider, "google")),
  });
  return !!acc?.refresh_token;
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

  const start = new Date(opts.startISO);
  const end = new Date(start.getTime() + opts.durationMin * 60000);

  try {
    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1",
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

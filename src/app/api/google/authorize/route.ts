import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { CALENDAR_SCOPE } from "@/lib/googleCalendar";

// Autorização INCREMENTAL do Google Agenda (separada do login — mantém o login
// sem escopos sensíveis). Só quem quer sincronizar concede o acesso ao Calendar.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/login", process.env.APP_URL || "https://ledivan.com.br"));

  const base = process.env.APP_URL || "https://ledivan.com.br";
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: `${base}/api/google/callback`,
    response_type: "code",
    scope: `openid email profile ${CALENDAR_SCOPE}`,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
  });
  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Fonte da versão atual do app Android. A tela de login (web e nativa) lê daqui para mostrar o
 * link de download SEMPRE apontando para o APK mais novo, e o app compara para decidir se avisa
 * que há atualização.
 *
 * Os valores vêm de env (setados a cada build EAS): APP_VERSION, APK_URL, APP_NOTES. Assim o link
 * nunca fica preso a uma versão antiga hardcoded.
 */
export async function GET() {
  const version = process.env.APP_VERSION || "1.0.0";
  const apkUrl = process.env.APK_URL || "";
  const notes = process.env.APP_NOTES || "";
  const mandatory = process.env.APP_MANDATORY === "1";
  // a tela de login usa isso pra so mostrar o botao "Entrar com Google" quando ele esta configurado
  const googleEnabled = !!process.env.GOOGLE_CLIENT_ID;
  return NextResponse.json({ version, apkUrl, notes, mandatory, googleEnabled });
}

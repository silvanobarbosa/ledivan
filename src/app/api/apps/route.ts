import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Catálogo público dos apps Android (usado pela landing page).
 * As URLs vêm de env, setadas a cada build EAS — o link nunca fica preso a um APK velho:
 *   terapeuta: APK_URL / APP_VERSION            (mesmas do /api/app/version)
 *   paciente:  APK_URL_PACIENTE / APP_VERSION_PACIENTE
 * Sem env, o app simplesmente não aparece na landing (nada quebra).
 */
export async function GET() {
  const apps = [
    {
      key: "terapeuta",
      name: "Ledivan — Terapeuta",
      description: "Sua agenda, prontuário e financeiro no celular. Receba avisos quando o paciente chega, confirma ou pede remarcação.",
      version: process.env.APP_VERSION || "",
      apkUrl: process.env.APK_URL || "",
    },
    {
      key: "paciente",
      name: "Ledivan — Paciente",
      description: "Para seus pacientes: próxima sessão, tarefas, materiais, diário, questionários e conversa direta com você.",
      version: process.env.APP_VERSION_PACIENTE || "",
      apkUrl: process.env.APK_URL_PACIENTE || "",
    },
  ].filter((a) => !!a.apkUrl);

  return NextResponse.json({ apps });
}

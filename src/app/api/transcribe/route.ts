import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@/auth";
import { db } from "@/db";
import { patients, patientRecords } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getPreferences } from "@/lib/preferences";
import { rateLimit } from "@/lib/rateLimit";

export const maxDuration = 60;

// Transcreve o áudio da sessão (Whisper) e gera um rascunho de evolução (GPT),
// salvando no prontuário. Requer: terapeuta autenticado, transcrição habilitada
// e consentimento do paciente confirmado em tela.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
  const userId = session.user.id;

  if (!(await rateLimit(userId, "transcribe", 30, 3600))) {
    return NextResponse.json({ ok: false, error: "Muitas solicitações. Tente novamente em alguns minutos." }, { status: 429 });
  }

  const prefs = await getPreferences(userId);
  if (!prefs.transcriptionEnabled) {
    return NextResponse.json({ ok: false, error: "Transcrição não está habilitada nas configurações." }, { status: 403 });
  }

  const form = await req.formData();
  const consent = form.get("consent");
  if (consent !== "true") {
    return NextResponse.json({ ok: false, error: "Consentimento do paciente é obrigatório." }, { status: 400 });
  }

  const patientId = form.get("patientId") as string;
  const file = form.get("audio") as File | null;
  if (!patientId || !file) {
    return NextResponse.json({ ok: false, error: "Áudio e paciente são obrigatórios." }, { status: 400 });
  }

  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.userId, userId)),
  });
  if (!patient) return NextResponse.json({ ok: false, error: "Paciente não encontrado." }, { status: 404 });

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      language: "pt",
    });

    const draft = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Você é um assistente clínico para terapeutas. A partir da transcrição de uma sessão de terapia, escreva uma EVOLUÇÃO clínica concisa, objetiva e profissional em português (3ª pessoa). Não invente informações que não estejam na transcrição. Estruture em: queixa/tema, intervenções, evolução/observações e encaminhamentos quando houver.",
        },
        { role: "user", content: transcription.text },
      ],
    });

    const content = draft.choices[0].message.content?.trim() || transcription.text;

    await db.insert(patientRecords).values({
      userId,
      patientId,
      type: "evolucao",
      title: "Evolução (IA)",
      content,
    });

    return NextResponse.json({ ok: true, content });
  } catch (e) {
    console.error("Erro na transcrição:", e);
    return NextResponse.json({ ok: false, error: "Falha ao transcrever. Tente um áudio menor (até 25MB)." }, { status: 500 });
  }
}

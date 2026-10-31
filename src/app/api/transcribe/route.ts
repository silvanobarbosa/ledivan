import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@/auth";
import { db } from "@/db";
import { patients, patientRecords, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getPreferences } from "@/lib/preferences";
import { rateLimit } from "@/lib/rateLimit";
import { decryptSecret } from "@/lib/crypto";
import { audioAceitavel, dicaDeNomes, TETO_DO_AUDIO } from "@/lib/transcricao";

// Provedores aceitos para a IA do terapeuta (BYOK). O app não carrega chave própria:
// o áudio vai para o provedor DELE, com a chave DELE. Ver `lib/transcricao.ts`.
const PROVIDERS: Record<string, { baseURL?: string; stt: string; chat: string }> = {
  openai: { stt: "whisper-1", chat: "gpt-4o-mini" },
  groq: { baseURL: "https://api.groq.com/openai/v1", stt: "whisper-large-v3", chat: "llama-3.3-70b-versatile" },
};

// Áudio de sessão é longo e a transcrição acompanha o tamanho dele: 60s de teto cortava
// qualquer ditado de verdade pela metade.
export const maxDuration = 300;

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

  /**
   * Barra pelo Content-Length ANTES de ler o corpo.
   *
   * A plataforma TRUNCA o que passa do teto em vez de recusar, e aí `formData()` estoura com
   * "expected boundary after body" — um 500 cru depois de a terapeuta ter esperado o upload
   * inteiro. Conferir o cabeçalho custa nada e devolve a mesma mensagem explicada do teto.
   */
  const declarado = Number(req.headers.get("content-length") ?? 0);
  if (declarado > TETO_DO_AUDIO) {
    return NextResponse.json({ ok: false, error: "Áudio grande demais. Envie um arquivo de até 25 MB." }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    // Sem Content-Length (envio em chunks), o truncamento só aparece aqui.
    return NextResponse.json({ ok: false, error: "Áudio grande demais. Envie um arquivo de até 25 MB." }, { status: 400 });
  }
  const consent = form.get("consent");
  if (consent !== "true") {
    return NextResponse.json({ ok: false, error: "Consentimento do paciente é obrigatório." }, { status: 400 });
  }

  const patientId = form.get("patientId") as string;
  const file = form.get("audio") as File | null;
  if (!patientId || !file) {
    return NextResponse.json({ ok: false, error: "Áudio e paciente são obrigatórios." }, { status: 400 });
  }

  // Confere o tamanho ANTES de subir ao provedor: recusar aqui custa nada, e recusar lá
  // custa a espera inteira para terminar num erro cru do provedor.
  const tamanho = audioAceitavel(file.size);
  if (!tamanho.ok) return NextResponse.json({ ok: false, error: tamanho.error }, { status: 400 });

  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.userId, userId)),
  });
  if (!patient) return NextResponse.json({ ok: false, error: "Paciente não encontrado." }, { status: 404 });

  // IA do terapeuta (BYOK): sem chave cadastrada, não transcreve.
  const [me] = await db.select({ provider: users.aiProvider, keyEnc: users.aiKeyEnc })
    .from(users).where(eq(users.id, userId)).limit(1);
  const cfg = me?.provider ? PROVIDERS[me.provider] : undefined;
  if (!cfg || !me?.keyEnc) {
    return NextResponse.json({ ok: false, error: "Cadastre sua chave de IA em Configurações para usar a transcrição." }, { status: 400 });
  }
  let apiKey: string;
  try { apiKey = decryptSecret(me.keyEnc); }
  catch { return NextResponse.json({ ok: false, error: "Não foi possível ler sua chave de IA. Cadastre novamente." }, { status: 500 }); }

  try {
    const openai = new OpenAI({ apiKey, ...(cfg.baseURL ? { baseURL: cfg.baseURL } : {}) });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: cfg.stt,
      language: "pt",
      // Os nomes DESTA sessão, para o modelo não precisar adivinhá-los. Ver `dicaDeNomes`.
      prompt: dicaDeNomes([patient.name, patient.guardianName]),
    });

    const draft = await openai.chat.completions.create({
      model: cfg.chat,
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

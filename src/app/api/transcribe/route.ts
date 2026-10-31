import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { auth } from "@/auth";
import { db } from "@/db";
import { patients, patientRecords, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getPreferences } from "@/lib/preferences";
import { rateLimit } from "@/lib/rateLimit";
import { decryptSecret } from "@/lib/crypto";
import { casaAi } from "@/lib/ai-client";
import { audioAceitavel, dicaDeNomes, ordemDosMotores, TETO_DO_AUDIO, type MotorDeAudio } from "@/lib/transcricao";

// Reserva: a chave do próprio terapeuta, quando o gateway da casa não está configurado ou caiu.
// Ver `lib/transcricao.ts` para a ordem e o porquê.
const PROVIDERS: Record<string, { baseURL?: string; stt: string; chat: string }> = {
  openai: { stt: "whisper-1", chat: "gpt-4o-mini" },
  groq: { baseURL: "https://api.groq.com/openai/v1", stt: "whisper-large-v3", chat: "llama-3.3-70b-versatile" },
};

// O ouvido da casa roda em CPU, a ~1x o tempo real (medido em 31/10): um minuto ditado leva cerca
// de um minuto. 60s de teto cortava qualquer ditado de verdade pela metade.
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

  // Confere o tamanho ANTES de subir para qualquer motor: recusar aqui custa nada, e recusar lá
  // custa a espera inteira para terminar num erro cru do provedor.
  const tamanho = audioAceitavel(file.size);
  if (!tamanho.ok) return NextResponse.json({ ok: false, error: tamanho.error }, { status: 400 });

  const patient = await db.query.patients.findFirst({
    where: and(eq(patients.id, patientId), eq(patients.userId, userId)),
  });
  if (!patient) return NextResponse.json({ ok: false, error: "Paciente não encontrado." }, { status: 404 });

  const [me] = await db.select({ provider: users.aiProvider, keyEnc: users.aiKeyEnc })
    .from(users).where(eq(users.id, userId)).limit(1);
  const cfg = me?.provider ? PROVIDERS[me.provider] : undefined;
  const casa = casaAi();
  const motores = ordemDosMotores({
    optouPelaCasa: !!prefs.iaDaCasa,
    casaConfigurada: !!casa,
    terapeutaTemChave: !!(cfg && me?.keyEnc),
  });
  if (!motores.length) {
    return NextResponse.json({ ok: false, error: "Cadastre sua chave de IA em Configurações para usar a transcrição." }, { status: 400 });
  }

  /** Monta o cliente daquele motor. `null` quando a chave guardada não pôde ser lida. */
  const clienteDe = (motor: MotorDeAudio) => {
    if (motor === "casa") {
      // Teto de tempo próprio: VPS pendurada não pode consumir o orçamento inteiro da rota e
      // deixar a reserva sem tempo de rodar.
      return { openai: new OpenAI({ baseURL: process.env.REVERBLABS_AI_BASE_URL, apiKey: process.env.REVERBLABS_AI_KEY, timeout: 150_000 }), stt: casa!.sttModel, chat: casa!.chatModel };
    }
    try {
      return { openai: new OpenAI({ apiKey: decryptSecret(me!.keyEnc!), ...(cfg!.baseURL ? { baseURL: cfg!.baseURL } : {}) }), stt: cfg!.stt, chat: cfg!.chat };
    } catch { return null; }
  };

  const nomes = dicaDeNomes([patient.name, patient.guardianName]);
  let conteudo: string | null = null;
  let ultimoErro: unknown = null;

  try {
    /**
     * Tenta os motores NA ORDEM, e a reserva só entra se o primeiro falhar DE VERDADE — é o que
     * faltava na primeira versão, que escolhia um motor só e morria com ele.
     */
    for (const motor of motores) {
      const c = clienteDe(motor);
      if (!c) { ultimoErro = new Error("chave ilegível"); continue; }
      try {
        const transcription = await c.openai.audio.transcriptions.create({
          file,
          model: c.stt,
          language: "pt",
          // Os nomes DESTA sessão, para o modelo não precisar adivinhá-los. Ver `dicaDeNomes`.
          prompt: nomes,
        });

        const draft = await c.openai.chat.completions.create({
          model: c.chat,
          messages: [
            {
              role: "system",
              content:
                "Você é um assistente clínico para terapeutas. A partir da transcrição de uma sessão de terapia, escreva uma EVOLUÇÃO clínica concisa, objetiva e profissional em português (3ª pessoa). Não invente informações que não estejam na transcrição. Estruture em: queixa/tema, intervenções, evolução/observações e encaminhamentos quando houver.",
            },
            { role: "user", content: transcription.text },
          ],
        });
        conteudo = draft.choices[0].message.content?.trim() || transcription.text;
        break;
      } catch (e) {
        // Guarda e tenta o próximo. Nada foi gravado ainda, então repetir é seguro.
        ultimoErro = e;
        console.error(`Transcrição falhou no motor ${motor}:`, e);
      }
    }

    if (conteudo == null) throw ultimoErro ?? new Error("nenhum motor respondeu");

    await db.insert(patientRecords).values({
      userId,
      patientId,
      type: "evolucao",
      title: "Evolução (IA)",
      content: conteudo,
    });

    return NextResponse.json({ ok: true, content: conteudo });
  } catch (e) {
    console.error("Erro na transcrição:", e);
    return NextResponse.json({ ok: false, error: "Falha ao transcrever. Tente um áudio menor (até 25MB)." }, { status: 500 });
  }
}

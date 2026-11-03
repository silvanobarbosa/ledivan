import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/db";
import { patients } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { rateLimit } from "@/lib/rateLimit";
import { audioAceitavel, dicaDeNomes, dicaQueCabe, TETO_DO_AUDIO } from "@/lib/transcricao";
import { falhaDaEscuta } from "@/lib/motivoDoProvedor";
import { motorDoDitado, redigirComoProntuario } from "@/lib/motorDoDitado";

/**
 * O DITADO DE UM CAMPO (doc 76).
 *
 * Recebe o áudio de UM campo e devolve o texto daquele campo — nada mais. Não grava o áudio, não
 * escreve no banco e não decide nada: quem salva é a tela, depois de a terapeuta revisar, que é
 * o que o item 5 do documento pede.
 *
 * O `patientId` serve a uma coisa só: a dica de nomes próprios do Whisper. E só o nome DESTE
 * paciente entra nela — mandar a lista inteira empurraria o nome de um paciente para dentro do
 * prontuário de outro, que é pior do que um nome escrito errado (ver `dicaDeNomes`).
 */

export const maxDuration = 60;

const Entrada = z.object({
  campo: z.enum(["titulo", "registro", "anamnese"]),
  patientId: z.string().uuid(),
  rotulo: z.string().max(120).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false, error: "Não autorizado" }, { status: 401 });
  const userId = session.user.id;

  // Ditado é curto e repetido — um campo de anamnese por vez. O teto é generoso, mas existe.
  if (!(await rateLimit(userId, "ditado", 200, 3600))) {
    return NextResponse.json({ ok: false, error: "Muitas gravações seguidas. Tente de novo em alguns minutos." }, { status: 429 });
  }

  const declarado = Number(req.headers.get("content-length") ?? 0);
  if (declarado > TETO_DO_AUDIO) {
    return NextResponse.json({ ok: false, error: "Gravação longa demais." }, { status: 400 });
  }

  let form: FormData;
  try { form = await req.formData(); }
  catch { return NextResponse.json({ ok: false, error: "Gravação longa demais." }, { status: 400 }); }

  const dados = Entrada.safeParse({
    campo: form.get("campo"),
    patientId: form.get("patientId"),
    rotulo: form.get("rotulo") || undefined,
  });
  if (!dados.success) return NextResponse.json({ ok: false, error: "Pedido inválido." }, { status: 400 });

  const file = form.get("audio") as File | null;
  if (!file) return NextResponse.json({ ok: false, error: "Não recebi o áudio." }, { status: 400 });
  const tamanho = audioAceitavel(file.size);
  if (!tamanho.ok) return NextResponse.json({ ok: false, error: tamanho.error }, { status: 400 });

  // O paciente tem de ser DESTA terapeuta — é o escopo que impede ler o nome do paciente de outra.
  const [paciente] = await db.select({ id: patients.id, nome: patients.name })
    .from(patients)
    .where(and(eq(patients.id, dados.data.patientId), eq(patients.userId, userId)))
    .limit(1);
  if (!paciente) return NextResponse.json({ ok: false, error: "Paciente não encontrado." }, { status: 404 });

  const motor = await motorDoDitado(userId);
  if (!motor) {
    return NextResponse.json({
      ok: false,
      error: "O ditado não está disponível. Cadastre sua chave de IA em Ajustes, ou fale com o suporte.",
    }, { status: 400 });
  }

  try {
    const r = await motor.cliente.audio.transcriptions.create({
      file,
      model: motor.stt,
      language: "pt",
      // O corte é por BYTES UTF-8 — a unidade que o provedor mede, apesar de a mensagem de erro
      // dele dizer "characters". Ver `dicaQueCabe`, e o que custou descobrir isso.
      prompt: dicaQueCabe(dicaDeNomes([paciente.nome]) ?? "", []),
    });

    const bruto = (r.text ?? "").trim();
    if (!bruto) {
      return NextResponse.json({ ok: false, error: "Não consegui entender. Fale um pouco mais perto do microfone." }, { status: 200 });
    }

    const texto = await redigirComoProntuario(motor, bruto, dados.data.campo, dados.data.rotulo);
    // `bruto` volta junto de propósito: quando o texto redigido não agrada, ela vê exatamente o
    // que foi ouvido e corrige a partir dali, em vez de gravar tudo de novo às cegas.
    return NextResponse.json({ ok: true, texto, bruto, origem: motor.origem });
  } catch (e) {
    const falha = falhaDaEscuta(e);
    return NextResponse.json({ ok: false, error: falha.erro, motivo: falha.motivo }, { status: 200 });
  }
}

/** A tela pergunta, antes de desenhar o microfone, se existe motor para ouvir. */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ ok: false, disponivel: false }, { status: 401 });
  const motor = await motorDoDitado(session.user.id);
  return NextResponse.json({ ok: true, disponivel: !!motor, origem: motor?.origem ?? null });
}


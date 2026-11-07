import { NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { patientActivities, patientAnamnese, patientRecords, patients } from "@/db/schema";
import { getUserAiClient, SemChaveIA } from "@/lib/ai-client";
import { rateLimit } from "@/lib/rateLimit";
import { TITULO_RELATORIO, promptDoRelatorio, type FontesDoRelatorio } from "@/lib/relatorioAcompanhamento";

const Corpo = z.object({ patientId: z.string().uuid() });

/**
 * RELATÓRIO DE ACOMPANHAMENTO TERAPÊUTICO (doc 20) — o prontuário virando documento.
 *
 * A IA é a do PRÓPRIO terapeuta (BYOK, ver ai-client): é prontuário saindo do app, e o dado
 * clínico vai para o provedor dele, com a chave dele. Sem chave cadastrada o botão avisa, em vez
 * de dar 500.
 *
 * O texto gerado é RASCUNHO: nasce no campo de edição e só vira documento quando a terapeuta
 * salva — ela revisa, corta e completa antes, como o documento pede.
 */
export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const corpo = Corpo.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ error: "Paciente inválido." }, { status: 400 });
  const { patientId } = corpo.data;

  if (!(await rateLimit(userId, "relatorio", 20, 3600))) {
    return NextResponse.json({ error: "Muitas gerações seguidas. Tente de novo em alguns minutos." }, { status: 429 });
  }

  const [paciente] = await db
    .select({ id: patients.id, name: patients.name })
    .from(patients)
    .where(and(eq(patients.id, patientId), eq(patients.userId, userId)))
    .limit(1);
  if (!paciente) return NextResponse.json({ error: "Paciente não encontrado." }, { status: 404 });

  const [registros, anamnese, atividades] = await Promise.all([
    db
      .select({ title: patientRecords.title, content: patientRecords.content, createdAt: patientRecords.createdAt })
      .from(patientRecords)
      .where(and(eq(patientRecords.patientId, patientId), eq(patientRecords.userId, userId)))
      .orderBy(desc(patientRecords.createdAt))
      .limit(60),
    db
      .select({ title: patientAnamnese.title, content: patientAnamnese.content })
      .from(patientAnamnese)
      .where(and(eq(patientAnamnese.patientId, patientId), eq(patientAnamnese.userId, userId)))
      .orderBy(asc(patientAnamnese.position)),
    db
      .select({ title: patientActivities.title, description: patientActivities.description })
      .from(patientActivities)
      .where(and(eq(patientActivities.patientId, patientId), eq(patientActivities.userId, userId)))
      .orderBy(desc(patientActivities.createdAt))
      .limit(60),
  ]);

  const fontes: FontesDoRelatorio = {
    paciente: paciente.name,
    registros: registros.map((r) => ({
      titulo: r.title,
      texto: r.content,
      data: r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : null,
    })),
    anamnese: anamnese.map((a) => ({ titulo: a.title, texto: a.content })),
    atividades: atividades.map((a) => ({ titulo: a.title, texto: a.description })),
  };

  const prompt = promptDoRelatorio(fontes);
  if (!prompt) {
    return NextResponse.json(
      { error: "Ainda não há registros, anamnese ou atividades para resumir neste prontuário." },
      { status: 400 },
    );
  }

  try {
    const ai = await getUserAiClient(userId);
    const r = await ai.openai.chat.completions.create({
      model: ai.chatModel,
      temperature: 0.4,
      messages: [
        { role: "system", content: prompt.sistema },
        { role: "user", content: prompt.usuario },
      ],
    });
    const texto = (r.choices[0]?.message?.content ?? "").trim();
    if (!texto) return NextResponse.json({ error: "A IA não devolveu texto. Tente de novo." }, { status: 502 });
    return NextResponse.json({ titulo: TITULO_RELATORIO, texto });
  } catch (e) {
    if (e instanceof SemChaveIA) return NextResponse.json({ error: e.message }, { status: 400 });
    /**
     * A chave existe, é legível, e o PROVEDOR a recusou. Dizer "não deu agora" manda a terapeuta
     * esperar por uma falha que só passa se ela trocar a chave — e é a falha mais provável de
     * todas, porque chave revogada ou sem crédito não avisa ninguém.
     */
    const status = typeof e === "object" && e && "status" in e ? Number((e as { status?: unknown }).status) : 0;
    if (status === 401 || status === 403) {
      return NextResponse.json({ error: "O provedor recusou sua chave de IA. Confira em Ajustes → IA." }, { status: 400 });
    }
    if (status === 429) {
      return NextResponse.json({ error: "O provedor de IA está limitando as chamadas. Tente de novo em alguns minutos." }, { status: 429 });
    }
    console.error("relatório de acompanhamento:", e);
    return NextResponse.json({ error: "Não deu para gerar o relatório agora." }, { status: 500 });
  }
}

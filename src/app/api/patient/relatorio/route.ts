import { NextResponse } from "next/server";
import { z } from "zod";
import { and, asc, desc, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db } from "@/db";
import { patientActivities, patientAnamnese, patientRecords, patients } from "@/db/schema";
import { motorDeIA } from "@/lib/motorDeIA";
import { rateLimit } from "@/lib/rateLimit";
import { TITULO_RELATORIO, promptDoRelatorio, type FontesDoRelatorio } from "@/lib/relatorioAcompanhamento";

const Corpo = z.object({ patientId: z.string().uuid() });

/**
 * RELATÓRIO DE ACOMPANHAMENTO TERAPÊUTICO (doc 20) — o prontuário virando documento.
 *
 * A IA é a da CASA (doc 9): "o profissional consegue utilizar esse recurso diretamente no
 * sistema, sem precisar contratar outro serviço de IA, criar uma conta externa ou cadastrar uma
 * chave própria". É a mesma política do ditado (doc 76), e por isso o motor é o mesmo módulo —
 * gateway da casa primeiro, chave da terapeuta como reserva, modelo PESADO nos dois casos.
 *
 * Confidencialidade: o prontuário sai do app para o gateway da casa, que é infraestrutura nossa
 * (VPS própria), não um provedor de terceiro contratado pela terapeuta. O conteúdo clínico nunca
 * entra em log — nem no caminho feliz nem no erro: o `console.error` do fim registra a falha, não
 * o que foi enviado. Nada é guardado deste lado: o texto gerado nasce no campo de edição e só
 * existe em banco quando ela salva.
 *
 * O texto gerado é RASCUNHO: ela revisa, corta e completa antes de salvar, como o documento pede.
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

  const motor = await motorDeIA(userId);
  if (!motor) {
    return NextResponse.json(
      { error: "A IA do Le'Divan está indisponível no momento. Tente de novo em alguns minutos." },
      { status: 503 },
    );
  }

  try {
    const r = await motor.cliente.chat.completions.create({
      model: motor.chat,
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
    /**
     * Rodando pela IA da casa, a terapeuta não tem o que consertar — a mensagem diz o estado, não
     * manda ela mexer em configuração que não é dela. Rodando pela chave dela (reserva), aí sim o
     * 401/403 é acionável e precisa apontar para Ajustes → IA.
     */
    const status = typeof e === "object" && e && "status" in e ? Number((e as { status?: unknown }).status) : 0;
    if ((status === 401 || status === 403) && motor.origem === "terapeuta") {
      return NextResponse.json({ error: "O provedor recusou sua chave de IA. Confira em Ajustes → IA." }, { status: 400 });
    }
    if (status === 429) {
      return NextResponse.json({ error: "A IA está limitando as chamadas agora. Tente de novo em alguns minutos." }, { status: 429 });
    }
    // A falha, nunca o conteúdo: o prontuário não entra em log.
    console.error("relatório de acompanhamento: falha na geração", { origem: motor.origem, status });
    return NextResponse.json({ error: "Não deu para gerar o relatório agora. Tente de novo em alguns minutos." }, { status: 502 });
  }
}

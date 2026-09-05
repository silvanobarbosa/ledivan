import { NextResponse } from "next/server";
import { getUserAiClient, SemChaveIA } from "@/lib/ai-client";
import { db } from "@/db";
import { transactions, categories } from "@/db/schema";
import { and, eq, or, isNull } from "drizzle-orm";

import { auth } from "@/auth";
import { rateLimit } from "@/lib/rateLimit";


export async function POST(req: Request) {
  try {
    const session = await auth();
    const { image, userId: bodyUserId } = await req.json();
    
    // Forçar o uso do ID da sessão
    const userId = session?.user?.id;

    if (!image || !userId) {
      return NextResponse.json({ error: "Não autorizado ou imagem ausente." }, { status: 401 });
    }
    if (!(await rateLimit(userId, "scan", 40, 3600))) {
      return NextResponse.json({ error: "Muitas solicitações. Tente novamente em alguns minutos." }, { status: 429 });
    }

    const ai = await getUserAiClient(userId); // IA do próprio terapeuta (BYOK)
    const response = await ai.openai.chat.completions.create({
      model: ai.chatModel,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Analise esta nota fiscal/recibo e extraia os seguintes dados em JSON: { 'amount': number, 'description': string, 'category': string, 'date': string (ISO format) }. Se não tiver certeza da categoria, use uma das seguintes: Alimentação, Transporte, Lazer, Saúde, Outros."
            },
            {
              type: "image_url",
              image_url: { url: image },
            },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });

    // A saída do modelo é DADO não confiável: validar antes de gravar. Antes, `result.amount
    // .toString()` estourava (TypeError → 500) quando o modelo omitia `amount`.
    let result: any;
    try { result = JSON.parse(response.choices[0].message.content || "{}"); }
    catch { return NextResponse.json({ error: "Não consegui ler os dados do recibo." }, { status: 422 }); }

    const amount = Number(result?.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      return NextResponse.json({ error: "Não consegui identificar o valor no recibo." }, { status: 422 });
    }
    const description = typeof result?.description === "string" ? result.description.slice(0, 300) : "Recibo";
    const parsedDate = result?.date ? new Date(result.date) : new Date();
    const date = Number.isNaN(parsedDate.getTime()) ? new Date() : parsedDate;

    // Categoria: só do próprio terapeuta (a tabela ainda é global; filtra pelo que existe).
    const categoryList = await db.query.categories.findMany({ where: or(isNull(categories.userId), eq(categories.userId, userId)) });
    const wanted = typeof result?.category === "string" ? result.category.toLowerCase() : "";
    const category = categoryList.find(c => c.name.toLowerCase() === wanted)
                  || categoryList.find(c => c.name === "Outros");

    const [newTransaction] = await db.insert(transactions).values({
      userId,
      amount: amount.toFixed(2),
      description,
      categoryId: category?.id,
      type: "expense",
      source: "scan",
      date,
    }).returning();

    return NextResponse.json({
      success: true,
      transaction: newTransaction,
      aiAnalysis: result
    });

  } catch (error: any) {
    if (error instanceof SemChaveIA) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Erro no scan de recibo:", error);
    return NextResponse.json({ error: "Falha ao processar imagem." }, { status: 500 });
  }
}

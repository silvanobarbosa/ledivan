import { NextResponse } from "next/server";
import OpenAI from "openai";
import { db } from "@/db";
import { transactions, categories, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { checkAchievements } from "@/lib/achievements";

import { auth } from "@/auth";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    const { image, userId: bodyUserId } = await req.json();
    
    // Forçar o uso do ID da sessão
    const userId = session?.user?.id;

    if (!image || !userId) {
      return NextResponse.json({ error: "Não autorizado ou imagem ausente." }, { status: 401 });
    }

    // Chama a API do OpenAI (GPT-4o ou Vision)
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
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

    const result = JSON.parse(response.choices[0].message.content || "{}");

    // Tentar encontrar a categoria no banco
    const categoryList = await db.query.categories.findMany();
    const category = categoryList.find(c => c.name.toLowerCase() === result.category?.toLowerCase()) || 
                     categoryList.find(c => c.name === "Outros");

    // Salvar no banco
    const [newTransaction] = await db.insert(transactions).values({
      userId,
      amount: result.amount.toString(),
      description: result.description,
      categoryId: category?.id,
      type: "expense",
      source: "scan",
      date: result.date ? new Date(result.date) : new Date(),
    }).returning();

    // Verificar se desbloqueou alguma conquista
    await checkAchievements(userId);

    return NextResponse.json({ 
      success: true, 
      transaction: newTransaction,
      aiAnalysis: result 
    });

  } catch (error: any) {
    console.error("Erro no Capi-Scan:", error);
    return NextResponse.json({ error: "Falha ao processar imagem." }, { status: 500 });
  }
}

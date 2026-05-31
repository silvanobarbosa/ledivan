import { NextResponse } from "next/server";
import OpenAI from "openai";
import { db } from "@/db";
import { transactions, users } from "@/db/schema";
import { eq, desc } from "drizzle-orm";

import { auth } from "@/auth";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
  try {
    const session = await auth();
    const { userId: bodyUserId } = await req.json();
    
    // Prioritiza o ID da sessão se existir, garantindo que o usuário só veja seus próprios dados
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    // Buscar histórico recente do usuário
    const userTransactions = await db.query.transactions.findMany({
      where: eq(transactions.userId, userId),
      orderBy: [desc(transactions.date)],
      limit: 20,
    });

    const prompt = `Você é um assistente financeiro do Ledivan+, claro e profissional, voltado para terapeutas que gerenciam o consultório.
    Analise estas transações recentes e dê 3 dicas curtas e práticas de gestão financeira (receitas de sessões, despesas, organização do caixa).
    Retorne em JSON: { "insights": [ { "type": "positive" | "warning" | "tip", "content": string } ] }
    Transações: ${JSON.stringify(userTransactions)}`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("Erro ao gerar insights:", error);
    return NextResponse.json({ error: "Falha ao gerar insights." }, { status: 500 });
  }
}

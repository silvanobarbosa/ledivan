import { NextResponse } from "next/server";
import { getUserAiClient, SemChaveIA } from "@/lib/ai-client";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rateLimit";

// O modelo devolve JSON livre: TUDO é opcional e de tipo desconhecido, porque ele às vezes
// omite campo (foi assim que `result.amount.toString()` estourou 500 um dia). Declarar
// assim obriga o código a checar antes de usar — que é o que ele já faz logo abaixo.
type ReciboLido = { amount?: unknown; description?: unknown; date?: unknown; category?: unknown };

/**
 * Lê um recibo/nota pela IA do PRÓPRIO terapeuta (BYOK) e DEVOLVE os campos — não grava nada.
 *
 * A gravação é feita depois, pela tela de revisão, com `createTransaction`: OCR/IA erra, então o
 * resultado é sempre um palpite que a pessoa confere antes de virar lançamento (doc 47). Quem não
 * tem chave de IA usa o leitor grátis (Tesseract) no navegador; aqui é só o caminho "mais preciso".
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    // `userId` do corpo é IGNORADO de propósito — quem manda é a sessão. Aceitar o do cliente
    // deixaria qualquer um ler recibo dos outros.
    const { image } = await req.json();
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
              text: "Analise esta nota fiscal/recibo e extraia os seguintes dados em JSON: { 'amount': number, 'description': string, 'category': string, 'date': string (ISO format) }. Se não tiver certeza da categoria, use uma das seguintes: Alimentação, Transporte, Lazer, Saúde, Outros.",
            },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });

    // A saída do modelo é DADO não confiável: validar antes de devolver.
    let result: ReciboLido;
    try { result = JSON.parse(response.choices[0].message.content || "{}") as ReciboLido; }
    catch { return NextResponse.json({ error: "Não consegui ler os dados do recibo." }, { status: 422 }); }

    const amountNum = Number(result?.amount);
    const amount = Number.isFinite(amountNum) && amountNum >= 0 ? amountNum : null;
    const description = typeof result?.description === "string" ? result.description.slice(0, 300) : null;
    const date = typeof result?.date === "string" ? result.date.slice(0, 10) : null;
    const category = typeof result?.category === "string" ? result.category.slice(0, 60) : null;

    return NextResponse.json({ ok: true, amount, description, date, category });
  } catch (error: unknown) {
    if (error instanceof SemChaveIA) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Erro no scan de recibo:", error);
    return NextResponse.json({ error: "Falha ao processar imagem." }, { status: 500 });
  }
}

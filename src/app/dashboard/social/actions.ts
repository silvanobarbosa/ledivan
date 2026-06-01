"use server";

import { db } from "@/db";
import { socialPosts } from "@/db/schema";
import { auth } from "@/auth";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import OpenAI from "openai";

const NETWORK_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  whatsapp: "Status/WhatsApp",
  geral: "Geral",
};

export async function generateSocialPost(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  const userId = session.user.id;

  const theme = ((formData.get("theme") as string) || "").trim() || "autocuidado e saúde mental";
  const network = (formData.get("network") as string) || "instagram";
  const tone = (formData.get("tone") as string) || "acolhedor";

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = `Você é social media de um(a) terapeuta/psicólogo(a) no Brasil.
Crie uma legenda para ${NETWORK_LABELS[network] || network} sobre o tema: "${theme}".
Tom: ${tone}. Idioma: português do Brasil.
Regras éticas (CFP): seja acolhedor, NÃO prometa cura, NÃO faça sensacionalismo, NÃO exponha pacientes, evite garantias.
Inclua 1 chamada à ação suave (ex: agendar conversa).
Responda em JSON: { "caption": string, "hashtags": string } onde hashtags são 5 a 8 hashtags separadas por espaço.`;

  let caption = "";
  let hashtags = "";
  try {
    const r = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });
    const parsed = JSON.parse(r.choices[0].message.content || "{}");
    caption = parsed.caption || "";
    hashtags = parsed.hashtags || "";
  } catch (e) {
    console.error("Erro ao gerar post:", e);
    throw new Error("Falha ao gerar o post. Tente novamente.");
  }

  if (!caption) throw new Error("Não foi possível gerar o conteúdo.");

  await db.insert(socialPosts).values({ userId, theme, network, tone, content: caption, hashtags });
  revalidatePath("/dashboard/social");
}

export async function deleteSocialPost(id: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autorizado");
  await db.delete(socialPosts).where(and(eq(socialPosts.id, id), eq(socialPosts.userId, session.user.id)));
  revalidatePath("/dashboard/social");
}

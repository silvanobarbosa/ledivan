// Integração WhatsApp via Evolution API (gateway open-source).
// Recebe mensagens por webhook e envia respostas via REST.
import { db } from "@/db";
import { users, transactions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import OpenAI from "openai";

const EVO_URL = process.env.EVOLUTION_API_URL;       // ex: https://evo.seuservidor.com
const EVO_KEY = process.env.EVOLUTION_API_KEY;       // apikey global ou da instância
const EVO_INSTANCE = process.env.EVOLUTION_INSTANCE; // nome da instância conectada

// Últimos 11 dígitos (DDD + número) — chave de vínculo entre número e usuário.
export function normalizePhone(s: string): string {
  return (s.match(/\d/g) || []).join("").slice(-11);
}

// Envia texto pelo Evolution API (formato v2: { number, text }).
export async function sendWhatsapp(toNumberDigits: string, text: string) {
  if (!EVO_URL || !EVO_KEY || !EVO_INSTANCE) {
    console.error("Evolution API não configurada (EVOLUTION_API_URL/KEY/INSTANCE).");
    return;
  }
  try {
    const res = await fetch(`${EVO_URL.replace(/\/$/, "")}/message/sendText/${EVO_INSTANCE}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: EVO_KEY },
      body: JSON.stringify({ number: toNumberDigits, text }),
    });
    if (!res.ok) console.error("Evolution sendText falhou:", res.status, await res.text());
  } catch (e) {
    console.error("Erro ao enviar WhatsApp:", e);
  }
}

const fmtBRL = (n: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n);

// Processa uma mensagem recebida. `from` = número completo do remetente (dígitos).
export async function handleWhatsappMessage(from: string, rawText: string) {
  const text = (rawText || "").trim();
  if (!text) return;

  const key = normalizePhone(from);
  const user = await db.query.users.findFirst({ where: eq(users.whatsappId, key) });

  if (!user) {
    await sendWhatsapp(from,
      "👋 Olá! Eu sou o assistente do Ledivan.\n\nSeu número ainda não está vinculado. Acesse *Ajustes → Integrações* no app, ative o WhatsApp e salve este número para começar a registrar lançamentos por aqui.");
    return;
  }

  const lower = text.toLowerCase();

  // /saldo
  if (lower === "/saldo" || lower === "saldo") {
    const all = await db.query.transactions.findMany({ where: eq(transactions.userId, user.id) });
    const total = all.reduce((a, t) => (t.type === "income" ? a + parseFloat(t.amount) : a - parseFloat(t.amount)), 0);
    await sendWhatsapp(from, `💰 Saldo atual: *${fmtBRL(total)}*`);
    return;
  }

  // /status — últimos lançamentos
  if (lower === "/status" || lower === "status") {
    const last = await db.query.transactions.findMany({
      where: eq(transactions.userId, user.id),
      orderBy: [desc(transactions.date)],
      limit: 5,
    });
    if (!last.length) { await sendWhatsapp(from, "Nenhum lançamento ainda."); return; }
    let msg = "📊 *Últimos lançamentos:*\n\n";
    last.forEach((t) => { msg += `${t.type === "income" ? "✅" : "❌"} ${fmtBRL(parseFloat(t.amount))} — ${t.description || "—"}\n`; });
    await sendWhatsapp(from, msg);
    return;
  }

  // /insights — dica da IA
  if (lower === "/insights" || lower === "insights") {
    const last = await db.query.transactions.findMany({ where: eq(transactions.userId, user.id), limit: 15 });
    await sendWhatsapp(from, "🤔 Analisando seus dados...");
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const prompt = `Analise estas transações e dê uma dica curta e profissional de gestão financeira: ${JSON.stringify(last)}`;
      const r = await openai.chat.completions.create({ model: "gpt-4o-mini", messages: [{ role: "user", content: prompt }] });
      await sendWhatsapp(from, `💡 *Insight:* ${r.choices[0].message.content}`);
    } catch {
      await sendWhatsapp(from, "Não consegui gerar o insight agora.");
    }
    return;
  }

  // ajuda
  if (lower === "/ajuda" || lower === "ajuda" || lower === "/start" || lower === "menu") {
    await sendWhatsapp(from,
      `Olá, ${user.name || ""}! 👋\n\nComandos:\n• *valor descrição* — registra uma despesa (ex: 50 almoço)\n• */entrada valor descrição* — registra uma receita\n• */saldo* — saldo atual\n• */status* — últimos lançamentos\n• */insights* — dica da IA`);
    return;
  }

  // /entrada valor descrição  → receita
  const incomeMatch = text.match(/^\/entrada\s+(\d+(?:[.,]\d+)?)\s+(.+)$/i);
  if (incomeMatch) {
    const amount = incomeMatch[1].replace(",", ".");
    const description = incomeMatch[2];
    await db.insert(transactions).values({ userId: user.id, amount, type: "income", description, source: "manual" });
    await sendWhatsapp(from, `✅ Receita registrada: ${fmtBRL(parseFloat(amount))} — "${description}".`);
    return;
  }

  // "valor descrição"  (ou /add valor descrição) → despesa
  const expenseMatch = text.replace(/^\/add\s+/i, "").match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/);
  if (expenseMatch) {
    const amount = expenseMatch[1].replace(",", ".");
    const description = expenseMatch[2];
    await db.insert(transactions).values({ userId: user.id, amount, type: "expense", description, source: "manual" });
    await sendWhatsapp(from, `✅ Despesa registrada: ${fmtBRL(parseFloat(amount))} — "${description}".`);
    return;
  }

  await sendWhatsapp(from, "Não entendi. Envie *valor descrição* (ex: 50 almoço) ou */ajuda* para ver os comandos.");
}

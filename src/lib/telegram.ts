import { Telegraf } from "telegraf";
import { db } from "@/db";
import { users, transactions } from "@/db/schema";
import { eq, desc, and, gt } from "drizzle-orm";
import OpenAI from "openai";

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) throw new Error("TELEGRAM_BOT_TOKEN must be set");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
export const bot = new Telegraf(token);

// Middleware para verificar usuário vinculado
bot.use(async (ctx, next) => {
  const telegramId = ctx.from?.id.toString();
  if (!telegramId) return;

  const user = await db.query.users.findFirst({
    where: eq(users.telegramId, telegramId),
  });

  (ctx as any).dbUser = user;
  return next();
});

// Vincula a conta do profissional ao chat do Telegram pelo código.
async function linkByCode(code: string, telegramId: string): Promise<{ name: string | null } | null> {
  const user = await db.query.users.findFirst({
    where: and(
      eq(users.telegramVerificationCode, code),
      gt(users.telegramVerificationExpires, new Date())
    ),
  });
  if (!user) return null;
  await db.update(users)
    .set({ telegramId, telegramVerificationCode: null, telegramVerificationExpires: null })
    .where(eq(users.id, user.id));
  return { name: user.name };
}

const MENU = "Comandos:\n/saldo - Ver seu saldo atual\n/status - Resumo de lançamentos\n/insights - Dicas da IA\n/add [valor] [descrição] - Adicionar lançamento";

// Comando de Verificação manual (fallback)
bot.command("v", async (ctx) => {
  const code = ctx.payload;
  const telegramId = ctx.from?.id.toString();
  if (!code) return ctx.reply("❌ Informe o código. Ex: /v 123456");
  if (!telegramId) return;
  const linked = await linkByCode(code, telegramId);
  if (!linked) return ctx.reply("❌ Código inválido ou expirado. Gere um novo nas Configurações do app.");
  ctx.reply(`✅ Conta vinculada a *${linked.name}*! Agora você pode usar todos os comandos.\n\n${MENU}`, { parse_mode: "Markdown" });
});

// /start — com deep link (?start=CÓDIGO) vincula automaticamente
bot.start(async (ctx) => {
  const telegramId = ctx.from?.id.toString();
  const code = (ctx as any).startPayload as string | undefined;

  if (code && telegramId) {
    const linked = await linkByCode(code, telegramId);
    if (linked) {
      return ctx.reply(`✅ Pronto, ${linked.name}! Seu Telegram está vinculado ao Ledivan+.\n\n${MENU}`, { parse_mode: "Markdown" });
    }
    return ctx.reply("❌ Esse código de vínculo expirou. Gere um novo nas Configurações do app e toque em \"Conectar Telegram\" de novo.");
  }

  const user = (ctx as any).dbUser;
  if (!user) {
    return ctx.reply("👋 Olá! Eu sou o assistente do Ledivan+.\n\nPara conectar sua conta, vá em *Configurações → Telegram* no app e toque em \"Conectar Telegram\". É automático. 🙂", { parse_mode: "Markdown" });
  }
  ctx.reply(`Olá de novo, ${user.name}!\n\n${MENU}`);
});

bot.command("saldo", async (ctx) => {
  const user = (ctx as any).dbUser;
  if (!user) return ctx.reply("❌ Conta não vinculada. Use `/v código` primeiro.");
  
  const result = await db.query.transactions.findMany({ where: eq(transactions.userId, user.id) });
// ... (rest of the code)
  const total = result.reduce((acc, t) => t.type === "income" ? acc + parseFloat(t.amount) : acc - parseFloat(t.amount), 0);
  const formatted = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(total);
  ctx.reply(`💰 Saldo atual: *${formatted}*`, { parse_mode: "Markdown" });
});

bot.command("status", async (ctx) => {
  const user = (ctx as any).dbUser;
  if (!user) return ctx.reply("❌ Conta não vinculada.");
  const result = await db.query.transactions.findMany({ 
    where: eq(transactions.userId, user.id),
    orderBy: [desc(transactions.date)],
    limit: 5 
  });

  let message = "📊 *Últimos Gastos:*\n\n";
  result.forEach(t => {
    message += `${t.type === "income" ? "✅" : "❌"} R$ ${t.amount} - ${t.description}\n`;
  });

  ctx.reply(message, { parse_mode: "Markdown" });
});

bot.command("insights", async (ctx) => {
  const user = (ctx as any).dbUser;
  if (!user) return ctx.reply("❌ Conta não vinculada.");
  const result = await db.query.transactions.findMany({ where: eq(transactions.userId, user.id), limit: 10 });
  
  ctx.reply("🤔 Analisando seus dados...");

  const prompt = `Analise estas transações financeiras e dê uma dica curta e profissional de gestão para o usuário: ${JSON.stringify(result)}`;
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
  });

  ctx.reply(`💡 *Insight:* ${response.choices[0].message.content}`, { parse_mode: "Markdown" });
});

bot.on("text", async (ctx) => {
  const text = ctx.message.text;
  const match = text.match(/^(\d+(?:[.,]\d+)?)\s+(.+)$/);

  if (match) {
    const amount = match[1].replace(",", ".");
    const description = match[2];
    const user = (ctx as any).dbUser;
    if (!user) return;

    try {
      await db.insert(transactions).values({
        userId: user.id,
        amount: amount,
        type: "expense",
        description: description,
        source: "telegram",
      });
      ctx.reply(`✅ Registrado: R$ ${amount} em "${description}".`);
    } catch (error) {
      ctx.reply("❌ Erro ao salvar.");
    }
  }
});

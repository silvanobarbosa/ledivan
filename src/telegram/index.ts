// src/telegram/index.mts
import { getBot } from "../lib/telegram";

console.log("🚀 Iniciando bot Ledivan em modo Polling (Local)...");

const bot = getBot();

bot.launch().then(() => {
  console.log("🤖 Bot Ledivan online e ouvindo!");
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

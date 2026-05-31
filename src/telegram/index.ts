// src/telegram/index.mts
import { bot } from "../lib/telegram";

console.log("🚀 Iniciando CapiBot em modo Polling (Local)...");

bot.launch().then(() => {
  console.log("🤖 CapiBot online e ouvindo!");
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

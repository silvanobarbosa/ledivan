// Abre o histórico de contatos do primeiro prospect da lista e fotografa a tela.
// Existe porque o bloco de contatos só aparece depois de um clique, e captura sem clique
// mostraria a lista fechada — exatamente o trecho que precisa ser conferido.
//
// Uso: node scripts/visual-prospect-contatos.mjs [rótulo]

import { mkdirSync } from "node:fs";
import { abrirPlaywright, contextoDemo } from "./visual-navegador.mjs";

const { chromium } = abrirPlaywright();
const BASE = process.env.BASE_URL || "http://localhost:3000";
const SAIDA = `_visual/${process.argv[2] || "prospect-contatos"}`;
mkdirSync(SAIDA, { recursive: true });

const nav = await chromium.launch({ timeout: 40000 });
const ctx = await contextoDemo(nav, { viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const erros = [];
page.on("console", (m) => { if (m.type() === "error") erros.push(m.text().slice(0, 120)); });

await page.goto(BASE + "/dashboard/prospects", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForLoadState("load", { timeout: 30000 }).catch(() => {});
await page.getByRole("button", { name: "Fechar", exact: true }).click({ timeout: 4000 }).catch(() => {});
await page.addStyleTag({
  content: "html,body{height:auto!important;overflow:visible!important} .h-screen{height:auto!important} .overflow-hidden,.overflow-y-auto{overflow:visible!important}",
});

const botoes = page.locator("button", { hasText: /contato\(s\)/ });
console.log("botões de contato na página:", await botoes.count());
// clique via DOM: o tour pode estar sobreposto e aqui a intenção é fotografar, não testar o clique
await botoes.first().evaluate((el) => el.click());
await page.waitForTimeout(900);
await page.screenshot({ path: `${SAIDA}/expandido.png`, fullPage: true, timeout: 40000 });
console.log("erros de console:", erros.length);
for (const e of erros.slice(0, 3)) console.log("  " + e);
await nav.close();
process.exit(0);

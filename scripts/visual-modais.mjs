// Fotografa o que só existe DEPOIS de um clique: as janelas de lista dos painéis (ativos,
// inativos, quem não veio na semana, pacientes por queixa). Captura sem clique mostraria só os
// números, que é exatamente a parte que não precisa de conferência.
//
// Uso: node scripts/visual-modais.mjs [rótulo]

import { mkdirSync } from "node:fs";
import { abrirPlaywright, contextoDemo } from "./visual-navegador.mjs";

const { chromium } = abrirPlaywright();
const BASE = process.env.BASE_URL || "http://localhost:3000";
const SAIDA = `_visual/${process.argv[2] || "modais"}`;
mkdirSync(SAIDA, { recursive: true });

const nav = await chromium.launch({ timeout: 40000 });
const ctx = await contextoDemo(nav, { viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const erros = [];
page.on("console", (m) => { if (m.type() === "error") erros.push(m.text().slice(0, 140)); });

await page.goto(BASE + "/dashboard", { waitUntil: "domcontentloaded", timeout: 60000 });
await page.waitForLoadState("load", { timeout: 30000 }).catch(() => {});
await page.getByRole("button", { name: "Fechar", exact: true }).click({ timeout: 4000 }).catch(() => {});
await page.waitForTimeout(600);

/** Clica um botão pelo texto e fotografa a janela que ele abre. */
async function abrirEFotografar(nome, seletor, arquivo) {
  const alvo = page.locator(seletor).first();
  if (!(await alvo.count())) { console.log(`  ${nome}: NÃO ENCONTRADO (${seletor})`); return; }
  await alvo.evaluate((el) => el.click());
  await page.waitForTimeout(700);
  const titulo = await page.locator('div[class*="z-\\[80\\]"] p').first().textContent().catch(() => null);
  await page.screenshot({ path: `${SAIDA}/${arquivo}.png`, timeout: 30000 });
  console.log(`  ${nome}: janela "${(titulo || "—").trim()}"`);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}

await abrirEFotografar("ativos", 'button:has-text("Ativos"):has-text("ver lista")', "ativos");
await abrirEFotografar("inativos", 'button:has-text("Inativos"):has-text("ver lista")', "inativos");
await abrirEFotografar("não vieram", 'button:has-text("Não vieram na semana")', "nao-vieram");
await abrirEFotografar("queixa", 'button:text-is("abrir")', "queixa");

console.log("erros de console:", erros.length);
for (const e of erros.slice(0, 3)) console.log("  " + e);
await nav.close();
process.exit(0);

// Igual ao visual-paginas.mjs, mas para telas de dentro: entra pela conta de demonstração (/demo faz
// o submit sozinho e redireciona) e fotografa o dashboard nos dois tamanhos. No mobile abre o
// menu lateral, que é onde vive uma das logos.
//
// Uso: node scripts/_visual_dash.mjs <rótulo>

import { mkdirSync } from "node:fs";
import { abrirPlaywright } from "./visual-navegador.mjs";

const { chromium } = abrirPlaywright();

const rotulo = process.argv[2] || "estado";
const BASE = process.env.BASE_URL || "http://localhost:3000";
const SAIDA = `_visual/${rotulo}`;
mkdirSync(SAIDA, { recursive: true });

const VIEWPORTS = [
  { nome: "desktop", width: 1440, height: 900 },
  { nome: "mobile", width: 390, height: 844 },
];

const navegador = await chromium.launch({ timeout: 40000 });
for (const vp of VIEWPORTS) {
  const ctx = await navegador.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + "/demo", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForURL("**/dashboard**", { timeout: 45000 });
    await page.waitForLoadState("load", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SAIDA}/dashboard-${vp.nome}.png`, fullPage: true, timeout: 30000 });
    const m = await page.evaluate(() => ({
      altura: document.documentElement.scrollHeight,
      imagens: document.images.length,
      quebradas: Array.from(document.images).filter((i) => i.complete && i.naturalWidth === 0).length,
    }));
    console.log(`  dashboard/${vp.nome}: altura=${m.altura}px imagens=${m.imagens} quebradas=${m.quebradas}`);

    if (vp.nome === "mobile") {
      // O tour de boas-vindas abre por cima e intercepta qualquer clique. Fecha primeiro.
      await page.getByRole("button", { name: /fechar/i }).first().click({ timeout: 5000 }).catch(() => {});
      await page.keyboard.press("Escape").catch(() => {});
      await page.waitForTimeout(600);
      const botao = page.locator('button[aria-label="Abrir menu"]');
      console.log(`  (menu: ${await botao.count()} botão, visível=${await botao.first().isVisible()})`);
      // force: o tour pode continuar sobreposto e a intenção aqui é fotografar o drawer, não
      // testar a acessibilidade do clique.
      await botao.first().evaluate((b) => b.click());
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${SAIDA}/menu-mobile.png`, timeout: 30000 });
      const q = await page.evaluate(() => Array.from(document.images).filter((i) => i.complete && i.naturalWidth === 0).length);
      console.log(`  menu/mobile: quebradas=${q}`);
    }
  } catch (e) {
    console.log(`  dashboard/${vp.nome}: FALHOU — ${e.message.slice(0, 90)}`);
  }
  await ctx.close();
}
await navegador.close();
console.log("capturado:", rotulo);
process.exit(0);

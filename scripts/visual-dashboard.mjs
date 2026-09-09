// Harness visual das telas de DENTRO: entra pela conta de demonstração (/demo faz o submit
// sozinho e redireciona) e fotografa a rota pedida nos dois tamanhos. No mobile também abre o
// menu lateral.
//
// Uso:  node scripts/visual-dashboard.mjs <rótulo> [rota]
//       ROTA=/dashboard/reservas node scripts/visual-dashboard.mjs reservas
//
// Armadilha específica desta área: o layout do dashboard é `h-screen overflow-hidden` com a
// coluna de conteúdo rolando por dentro. Nesse arranjo `fullPage: true` captura só a primeira
// tela, porque o DOCUMENTO não rola — quem rola é uma div. Por isso soltamos as travas de
// altura antes de fotografar (ver `soltarTravas`).

import { mkdirSync } from "node:fs";
import { abrirPlaywright, revelarTudo } from "./visual-navegador.mjs";

const { chromium } = abrirPlaywright();

const rotulo = process.argv[2] || "estado";
const ROTA = process.argv[3] || process.env.ROTA || "/dashboard";
const BASE = process.env.BASE_URL || "http://localhost:3000";
const SAIDA = `_visual/${rotulo}`;
mkdirSync(SAIDA, { recursive: true });

const VIEWPORTS = [
  { nome: "desktop", width: 1440, height: 900 },
  { nome: "mobile", width: 390, height: 844 },
];

/** Deixa o documento crescer, para o screenshot de página inteira ver a tela toda. */
const soltarTravas = (page) =>
  page.addStyleTag({
    content: `
      html, body { height: auto !important; overflow: visible !important; }
      .h-screen { height: auto !important; min-height: 100vh; }
      .overflow-hidden, .overflow-y-auto, .overflow-auto { overflow: visible !important; }
      .max-h-56, .max-h-40 { max-height: none !important; }
    `,
  });

const navegador = await chromium.launch({ timeout: 40000 });
for (const vp of VIEWPORTS) {
  const ctx = await navegador.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  const erros = [];
  page.on("console", (m) => { if (m.type() === "error") erros.push(m.text().slice(0, 120)); });
  try {
    await page.goto(BASE + "/demo", { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForURL("**/dashboard**", { timeout: 45000 });
    if (ROTA !== "/dashboard") await page.goto(BASE + ROTA, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("load", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1200);

    // O tour de boas-vindas abre por cima; fechar antes deixa a tela legível na foto.
    // Nome EXATO "Fechar": com /fechar/i o primeiro casamento no mobile era o "Fechar menu" do
    // drawer, que está no DOM mesmo fechado — o clique ia para o botão errado e o tour ficava.
    await page.getByRole("button", { name: "Fechar", exact: true }).click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(400);

    await soltarTravas(page);
    await page.waitForTimeout(300);
    await revelarTudo(page).catch(() => {});
    await page.screenshot({ path: `${SAIDA}/dashboard-${vp.nome}.png`, fullPage: true, timeout: 40000 });
    const m = await page.evaluate(() => ({
      altura: document.documentElement.scrollHeight,
      imagens: document.images.length,
      quebradas: Array.from(document.images).filter((i) => i.complete && i.naturalWidth === 0).length,
    }));
    console.log(`  ${ROTA}/${vp.nome}: altura=${m.altura}px imagens=${m.imagens} quebradas=${m.quebradas}${erros.length ? ` ERROS no console: ${erros.length}` : ""}`);
    for (const e of erros.slice(0, 3)) console.log(`    console: ${e}`);

    if (vp.nome === "mobile") {
      const botao = page.locator('button[aria-label="Abrir menu"]');
      if (await botao.count()) {
        await botao.first().evaluate((b) => b.click());
        await page.waitForTimeout(900);
        await page.screenshot({ path: `${SAIDA}/menu-mobile.png`, timeout: 30000 });
        console.log("  menu/mobile: capturado");
      }
    }
  } catch (e) {
    console.log(`  ${ROTA}/${vp.nome}: FALHOU — ${e.message.slice(0, 90)}`);
  }
  await ctx.close();
}
await navegador.close();
console.log("capturado:", rotulo);
process.exit(0);

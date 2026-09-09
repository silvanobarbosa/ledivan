// Harness visual: screenshot de página inteira para comparar ANTES e DEPOIS de mudança de
// layout, nas telas públicas.
//
// Uso: node scripts/visual-paginas.mjs <rótulo>      (ex.: antes | depois)
// Depois: python scripts/visual-diff.py  compara _visual/antes com _visual/depois.
//
// Duas armadilhas que já custaram tempo aqui:
//  - `waitUntil: "networkidle"` NUNCA assenta no dev server: o websocket do hot reload
//    mantém a rede ocupada e o goto pendura até o timeout.
//  - esperar `img.decode()` de todas as imagens trava se alguma nunca carrega. Prazo sempre.

import { mkdirSync } from "node:fs";
import { abrirPlaywright, comPrazo } from "./visual-navegador.mjs";

const { chromium } = abrirPlaywright();

const rotulo = process.argv[2] || "estado";
const BASE = process.env.BASE_URL || "http://localhost:3000";
const SAIDA = `_visual/${rotulo}`;
mkdirSync(SAIDA, { recursive: true });

const PAGINAS = [
  { nome: "landing", url: "/" },
  { nome: "login", url: "/login" },
];
const VIEWPORTS = [
  { nome: "desktop", width: 1440, height: 900 },
  { nome: "mobile", width: 390, height: 844 },
];

const navegador = await chromium.launch({ timeout: 40000 });
for (const vp of VIEWPORTS) {
  const ctx = await navegador.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  for (const p of PAGINAS) {
    try {
      await page.goto(BASE + p.url, { waitUntil: "domcontentloaded", timeout: 30000 });
      // dá tempo das imagens assentarem, mas com prazo: imagem quebrada não pode travar tudo
      await comPrazo(page.waitForLoadState("load", { timeout: 15000 }), 16000, "load").catch(() => {});
      await page.waitForTimeout(800);
      const arquivo = `${SAIDA}/${p.nome}-${vp.nome}.png`;
      await comPrazo(page.screenshot({ path: arquivo, fullPage: true, timeout: 30000 }), 35000, "screenshot");
      const m = await page.evaluate(() => ({
        altura: document.documentElement.scrollHeight,
        imagens: document.images.length,
        quebradas: Array.from(document.images).filter((i) => i.complete && i.naturalWidth === 0).length,
      }));
      console.log(`  ${p.nome}/${vp.nome}: altura=${m.altura}px imagens=${m.imagens} quebradas=${m.quebradas}`);
    } catch (e) {
      console.log(`  ${p.nome}/${vp.nome}: FALHOU — ${e.message.slice(0, 70)}`);
    }
  }
  await ctx.close();
}
await navegador.close();
console.log("capturado:", rotulo);
process.exit(0);

// Lista TODA imagem da página com a situação de carregamento, depois de rolar a página inteira
// (é rolando que as imagens em lazy e as seções com Reveal entram em cena).
//
// Uso: BASE_URL=https://ledivan.com.br node scripts/visual-imagens.mjs [rota]

import { abrirPlaywright, revelarTudo } from "./visual-navegador.mjs";

const { chromium } = abrirPlaywright();
const BASE = process.env.BASE_URL || "http://localhost:3000";
const rota = process.argv[2] || "/";

const navegador = await chromium.launch({ timeout: 40000 });
const page = await navegador.newPage({ viewport: { width: 1440, height: 900 } });

const respostas = [];
page.on("response", (r) => {
  if (r.request().resourceType() === "image" && r.status() >= 400) respostas.push(`${r.status()} ${r.url()}`);
});

await page.goto(BASE + rota, { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForLoadState("load", { timeout: 20000 }).catch(() => {});
await revelarTudo(page);

const imagens = await page.evaluate(() =>
  Array.from(document.images).map((i) => ({
    src: i.currentSrc || i.src,
    ok: i.complete && i.naturalWidth > 0,
    largura: i.naturalWidth,
  })),
);

for (const i of imagens) {
  if (!i.ok) console.log(`  QUEBRADA  ${decodeURIComponent(i.src).slice(0, 160)}`);
}
console.log(`total=${imagens.length} quebradas=${imagens.filter((i) => !i.ok).length}`);
if (respostas.length) {
  console.log("respostas HTTP de erro em imagem:");
  for (const r of respostas) console.log("  " + decodeURIComponent(r).slice(0, 180));
}
await navegador.close();
process.exit(0);

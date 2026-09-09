// Prontuário e recibo são páginas feitas para IMPRIMIR e trazem a logo. Aqui entram pela conta
// de demonstração, descobrem um id real navegando, e fotografam com emulação de mídia `print` —
// que é o cenário que importa: imagem em lazy pode não entrar no papel.
//
// Uso: node scripts/_visual_impressao.mjs <rótulo>

import { mkdirSync } from "node:fs";
import { abrirPlaywright } from "./visual-navegador.mjs";

const { chromium } = abrirPlaywright();

const rotulo = process.argv[2] || "impressao";
const BASE = process.env.BASE_URL || "http://localhost:3000";
const SAIDA = `_visual/${rotulo}`;
mkdirSync(SAIDA, { recursive: true });

const navegador = await chromium.launch({ timeout: 40000 });
const ctx = await navegador.newContext({ viewport: { width: 1200, height: 900 } });
const page = await ctx.newPage();

await page.goto(BASE + "/demo", { waitUntil: "domcontentloaded", timeout: 30000 });
await page.waitForURL("**/dashboard**", { timeout: 45000 });

const achar = async (rota, padrao) => {
  await page.goto(BASE + rota, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(800);
  return page.evaluate((p) => {
    const re = new RegExp(p);
    const a = Array.from(document.querySelectorAll("a")).find((x) => re.test(x.getAttribute("href") || ""));
    return a ? a.getAttribute("href") : null;
  }, padrao);
};

// O prontuário exportável nasce da ficha do paciente; o recibo, da lista de pagamentos.
const idPaciente = await achar("/dashboard/patients", "^/dashboard/patients/(?!new$)[^/]+$");
const alvos = [];
if (idPaciente) alvos.push({ nome: "prontuario", url: "/prontuario/" + idPaciente.split("/").pop() });
// O link do recibo mora dentro de uma aba da ficha do paciente; em vez de caçar UI, o id do
// pagamento entra por variável de ambiente (ver scripts/visual-um-pagamento.mjs).
const recibo = process.env.PAGAMENTO_ID ? "/recibo/" + process.env.PAGAMENTO_ID : null;
if (recibo) alvos.push({ nome: "recibo", url: recibo });

await page.emulateMedia({ media: "print" });
for (const alvo of alvos) {
  try {
    await page.goto(BASE + alvo.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForLoadState("load", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${SAIDA}/${alvo.nome}.png`, fullPage: true, timeout: 30000 });
    const m = await page.evaluate(() => ({
      imagens: document.images.length,
      quebradas: Array.from(document.images).filter((i) => i.complete && i.naturalWidth === 0).length,
      pendentes: Array.from(document.images).filter((i) => !i.complete).length,
    }));
    console.log(`  ${alvo.nome} (${alvo.url}): imagens=${m.imagens} quebradas=${m.quebradas} pendentes=${m.pendentes}`);
  } catch (e) {
    console.log(`  ${alvo.nome}: FALHOU — ${e.message.slice(0, 90)}`);
  }
}
if (!alvos.length) console.log("  nenhum id encontrado na demo");
await navegador.close();
process.exit(0);

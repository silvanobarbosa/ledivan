// De onde sai o Chromium para os harnesses visuais.
//
// O projeto NÃO tem playwright como dependência, de propósito: são ~300MB de navegador para uma
// ferramenta de conferência local, que nunca roda em CI. Então tentamos, em ordem:
//   1. um `playwright` instalado no projeto (se alguém adicionar, passa a valer);
//   2. o playwright que vem embutido no pacote global @playwright/mcp.
//
// Se nenhum dos dois existir, o erro diz o que instalar em vez de estourar um MODULE_NOT_FOUND.

import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);

const CAMINHOS = [
  "playwright",
  "C:/Users/User/AppData/Roaming/npm/node_modules/@playwright/mcp/node_modules/playwright",
];

export function abrirPlaywright() {
  for (const caminho of CAMINHOS) {
    try {
      return require_(caminho);
    } catch {
      // tenta o próximo
    }
  }
  throw new Error(
    "Playwright não encontrado. Instale com `npm i -D playwright && npx playwright install chromium` " +
      "ou globalmente com `npm i -g @playwright/mcp`.",
  );
}

/** Corre `promessa` com prazo. Sem isso, imagem que nunca carrega pendura o harness inteiro. */
export const comPrazo = (promessa, ms, oque) =>
  Promise.race([
    promessa,
    new Promise((_, rej) => setTimeout(() => rej(new Error("prazo estourado: " + oque)), ms)),
  ]);

/**
 * Sessão da conta de demonstração, REAPROVEITADA entre execuções.
 *
 * Por que isto existe: `/demo` tem rate-limit de 20 aberturas de sessão por hora por IP, com
 * fail-closed. O harness abria uma sessão POR VIEWPORT e por script, então algumas rodadas de
 * conferência estouravam a cota e as capturas seguintes caíam em /login?error=demo_limite —
 * parecia bug do app e era o harness gastando a cota do app.
 *
 * Agora o cookie é gravado em `_visual/.sessao-demo.json` e reutilizado. Se estiver velho ou
 * inválido, abre uma sessão nova (uma, não uma por tela).
 */
export async function contextoDemo(navegador, opcoes = {}) {
  const ARQUIVO = "_visual/.sessao-demo.json";
  const BASE = process.env.BASE_URL || "http://localhost:3000";

  if (existsSync(ARQUIVO)) {
    const ctx = await navegador.newContext({ ...opcoes, storageState: ARQUIVO });
    const page = await ctx.newPage();
    await page.goto(BASE + "/dashboard", { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});
    if (page.url().includes("/dashboard")) {
      await page.close();
      return ctx;
    }
    await ctx.close(); // sessão expirada: cai para o login abaixo
  }

  const ctx = await navegador.newContext(opcoes);
  const page = await ctx.newPage();
  await page.goto(BASE + "/demo", { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForURL("**/dashboard**", { timeout: 90000 }).catch(() => {});
  if (!page.url().includes("/dashboard")) {
    throw new Error(
      `entrada na demo falhou (parou em ${page.url()}). Se for error=demo_limite, é a cota de ` +
        "20 sessões/hora por IP — espere a janela virar ou apague a linha 'ip-desconhecido:demo-start' de rate_limits.",
    );
  }
  mkdirSync("_visual", { recursive: true });
  await ctx.storageState({ path: ARQUIVO });
  await page.close();
  return ctx;
}

/**
 * Rola a página inteira, de viewport em viewport, e volta ao topo.
 *
 * Sem isto o screenshot de página inteira MENTE: as seções embrulhadas em `<Reveal>` só ficam
 * visíveis quando o IntersectionObserver dispara, e um `fullPage: true` não rola — ele só
 * estica a captura. O resultado é meia landing em branco (opacity-0) ocupando espaço, e uma
 * comparação antes/depois que dá "idêntico" porque os dois lados estão cegos no mesmo trecho.
 *
 * Devolve quantas seções ainda restaram invisíveis, para o harness poder reclamar.
 */
export async function revelarTudo(page, { passo = 600, teto = 60 } = {}) {
  const altura = await page.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0, n = 0; y < altura + passo && n < teto; y += passo, n++) {
    await page.evaluate((pos) => window.scrollTo(0, pos), y);
    await page.waitForTimeout(120);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  // a transição do Reveal é de 900ms e alguns têm delay
  await page.waitForTimeout(1600);
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("*")).filter(
      (el) => el.className && typeof el.className === "string" && el.className.includes("opacity-0"),
    ).length,
  );
}

// O DIVÃ NO APP DE VERDADE.
//
//   1. O ícone flutuante aparece no dashboard — foi a primeira coisa que faltou.
//   2. Ele abre a janela "O que deseja fazer?" com o catálogo de tarefas.
//   3. Cada tarefa do catálogo leva a uma rota que EXISTE (sem 404).
//   4. "Marcar um atendimento" chega com a janela de novo atendimento já aberta.
//   5. "Bloquear um horário" chega com a janela de bloqueio já aberta.
//   6. Sem chave de IA, o Divã abre inteiro — só não oferece o botão de falar.
//   7. O ouvido recusa quem não tem sessão e quem não tem chave.
//
// Uso: npm run build && npm start, depois node scripts/e2e-diva.mjs

import { createRequire } from "node:module";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";
import * as jose from "jose";

const require_ = createRequire(import.meta.url);
let chromium;
for (const c of ["playwright", "C:/Users/User/Contab.AI/node_modules/playwright", "C:/Users/User/AppData/Roaming/npm/node_modules/@playwright/mcp/node_modules/playwright"]) {
  try { ({ chromium } = require_(c)); break; } catch { /* próximo */ }
}
if (!chromium) { console.log("Playwright não encontrado."); process.exit(1); }

const BASE = process.env.BASE_URL || "http://localhost:3000";
const sql = neon(process.env.DATABASE_URL);
let falhas = 0;
const check = (nome, ok, detalhe = "") => {
  console.log(`${ok ? "  ok  " : "FALHA "} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) falhas++;
};

const [qa] = await sql`SELECT id, ai_key_enc FROM "user" WHERE email = 'qa.ledivan@reverblabs.com.br'`;
if (!qa) { console.log("conta de QA não encontrada"); process.exit(1); }
const token = await new jose.SignJWT({ userId: qa.id })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1d")
  .sign(new TextEncoder().encode(process.env.AUTH0_SECRET));

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1440, height: 1100 } });
const alvo = new URL(BASE);
await ctx.addCookies([{ name: "auth-session", value: token, domain: alvo.hostname, path: "/", secure: alvo.protocol === "https:" }]);
await ctx.addInitScript(() => { try { localStorage.setItem("ledivan_onboarded_v3", "1"); localStorage.setItem("ledivan_diva_dia", new Date().toISOString().slice(0, 10)); } catch { /* sem storage */ } });
const page = await ctx.newPage();
page.setDefaultNavigationTimeout(120000);
page.setDefaultTimeout(30000);
const ir = async (url) => {
  for (let i = 0; i < 3; i++) {
    try { await page.goto(url, { waitUntil: "domcontentloaded" }); break; }
    catch { await page.waitForTimeout(2000); }
  }
  await page.waitForLoadState("networkidle").catch(() => {});
};

try {
  await ir(`${BASE}/dashboard`);

  // ───────── 1. o ícone ─────────
  const icone = page.getByRole("button", { name: /Abrir o Divã/i }).first();
  await icone.waitFor({ timeout: 45000 }).catch(() => {});
  check("o ícone flutuante do Divã aparece no dashboard", await icone.count() > 0);
  if (await icone.count()) {
    const caixa = await icone.boundingBox();
    const tela = page.viewportSize();
    check("e fica flutuando no canto, visível sem rolar",
      !!caixa && caixa.x > tela.width * 0.7 && caixa.y > tela.height * 0.4,
      caixa ? `x ${Math.round(caixa.x)} y ${Math.round(caixa.y)}` : "sem caixa");

    /**
     * E NÃO se sobrepõe aos outros flutuantes. Já houve dois botões no mesmo canto aqui, e o de
     * baixo simplesmente não recebia o toque — ninguém relatava porque o de cima funcionava.
     */
    const outros = [page.getByRole("button", { name: /Abrir suporte/i }), page.getByRole("button", { name: /recibo|escanear/i })];
    const colidiu = [];
    for (const outro of outros) {
      if (await outro.count() === 0) continue;
      const b = await outro.first().boundingBox();
      if (!b || !caixa) continue;
      const sobrepoe = caixa.x < b.x + b.width && caixa.x + caixa.width > b.x && caixa.y < b.y + b.height && caixa.y + caixa.height > b.y;
      if (sobrepoe) colidiu.push(`${Math.round(b.x)},${Math.round(b.y)}`);
    }
    check("e não cobre os outros botões flutuantes", colidiu.length === 0, colidiu.join(" | "));
  }

  // Está em TODA tela do dashboard, não só na inicial.
  await ir(`${BASE}/dashboard/agenda`);
  check("o ícone segue presente nas outras telas", await page.getByRole("button", { name: /Abrir o Divã/i }).count() > 0);

  // ───────── 2. a janela ─────────
  await page.getByRole("button", { name: /Abrir o Divã/i }).first().click();
  await page.waitForTimeout(600);
  const janela = page.locator('[aria-label="Divã"]').first();
  check('a janela "O que deseja fazer?" abre', await janela.count() > 0 && /O que deseja fazer/.test(await janela.innerText()));
  const corpo = await janela.innerText().catch(() => "");
  check("o catálogo oferece tarefas", /Ver a agenda de hoje/.test(corpo) && /Marcar um atendimento/.test(corpo), corpo.split("\n").slice(0, 3).join(" · "));
  check("e diz em voz alta que não opina sobre conduta clínica", /não opina sobre conduta clínica/.test(corpo));

  // Sem chave de IA, nada de botão de falar — mas a janela abre inteira.
  if (!qa.ai_key_enc) {
    check("sem chave de IA, o Divã não oferece o microfone", !/Falar com o Divã/.test(corpo));
  } else {
    check("com chave de IA, o Divã oferece o microfone", /Falar com o Divã/.test(corpo));
  }

  // ───────── 3. toda rota do catálogo existe ─────────
  const { TAREFAS } = await import("../src/lib/diva.ts").catch(() => ({ TAREFAS: null }));
  const rotas = TAREFAS
    ? [...new Set(TAREFAS.map((t) => t.rota))]
    : ["/dashboard/agenda", "/dashboard/agenda?novo=1", "/dashboard/agenda?bloquear=1", "/dashboard/pagamentos",
       "/dashboard/fechamento", "/dashboard/patients/new", "/dashboard/patients", "/dashboard/settings", "/dashboard/ajuda"];
  const quebradas = [];
  for (const rota of rotas) {
    const r = await page.request.get(`${BASE}${rota}`);
    if (r.status() >= 400) quebradas.push(`${rota} → ${r.status()}`);
  }
  check(`todas as ${rotas.length} rotas do catálogo respondem`, quebradas.length === 0, quebradas.join(" | "));

  // ───────── 4 e 5. chegar com a janela certa já aberta ─────────
  await ir(`${BASE}/dashboard/agenda?novo=1`);
  await page.waitForTimeout(1200);
  check('"Marcar um atendimento" chega com a janela de novo atendimento aberta',
    await page.locator('[aria-label="Novo agendamento"]').count() > 0);
  check("e o parâmetro sai da URL (voltar não reabre)", !page.url().includes("novo=1"), page.url());

  await ir(`${BASE}/dashboard/agenda?bloquear=1`);
  await page.waitForTimeout(1500);
  const janelaBloqueio = page.locator('[role="dialog"][aria-label="Bloquear horário"]');
  check('"Bloquear um horário" chega com a janela de bloqueio aberta', await janelaBloqueio.count() > 0);
  /**
   * E o Divã fica QUIETO: chegar aqui foi pedido dele. Abrir a pergunta por cima da janela que a
   * pessoa acabou de pedir é atrapalhar justamente quem foi atendido.
   */
  check("e o Divã não abre por cima do que ele mesmo pediu", await page.locator('[role="dialog"][aria-label="Divã"]').count() === 0);

  // ───────── 7. o ouvido ─────────
  const semSessao = await page.request.post(`${BASE}/api/diva/ouvir`, { multipart: { audio: { name: "a.webm", mimeType: "audio/webm", buffer: Buffer.alloc(5000) } }, headers: { cookie: "" } });
  check("o ouvido recusa quem não tem sessão", semSessao.status() === 401, String(semSessao.status()));

  const comSessao = await page.request.post(`${BASE}/api/diva/ouvir`, { multipart: { audio: { name: "a.webm", mimeType: "audio/webm", buffer: Buffer.alloc(5000) } } });
  const jr = await comSessao.json().catch(() => ({}));
  if (qa.ai_key_enc) {
    check("com chave, o ouvido tenta ouvir", comSessao.status() !== 400 || !/cadastre sua chave/i.test(jr.error ?? ""), `${comSessao.status()} ${jr.error ?? ""}`);
  } else {
    check("sem chave, o ouvido explica o que falta", comSessao.status() === 400 && /cadastre sua chave/i.test(jr.error ?? ""), `${comSessao.status()} ${jr.error ?? ""}`);
  }
} catch (e) {
  check("o percurso chegou ao fim sem exceção", false, String(e && e.message ? e.message : e).slice(0, 300));
} finally {
  await nav.close();
  console.log(`\n${falhas ? `${falhas} FALHA(S)` : "tudo certo"}`);
  process.exit(falhas ? 1 : 0);
}

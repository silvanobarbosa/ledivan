// O PEDIDO DO DONO DE 17/11/2026 NA TELA: a semana vigente, e o Divã que não abre sozinho.
//
// O que o teste puro não prova:
//   - que o painel passou a receber as SESSÕES DA SEMANA com status (a consulta mudou de forma:
//     antes trazia todas as realizadas/faltadas do profissional, sem corte de data);
//   - que quem só tem sessão agendada na semana saiu da lista — era o "status vazio" do pedido de 17/11, e
//     é a mudança que inverte o sinal do cartão;
//   - que a janela do Divã NÃO aparece ao abrir o sistema, e aparece no clique do ícone. Isso só
//     se vê no navegador: o estado nascia `false` e um efeito o ligava.
//
// Uso: npm run build && npm start, depois `node scripts/e2e-doc75.mjs`.

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
const check = (n, ok, d = "") => { console.log(`${ok ? "  ok  " : "FALHA "} ${n}${d ? ` — ${d}` : ""}`); if (!ok) falhas++; };

const [qa] = await sql`SELECT id FROM "user" WHERE email = 'qa.ledivan@reverblabs.com.br'`;
if (!qa) { console.log("conta de QA não encontrada"); process.exit(1); }
const token = await new jose.SignJWT({ userId: qa.id })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1d")
  .sign(new TextEncoder().encode(process.env.AUTH0_SECRET));

const criados = [];
const nav = await chromium.launch();
const alvo = new URL(BASE);
const ctx = await nav.newContext({ viewport: { width: 1280, height: 950 } });
await ctx.addCookies([{ name: "auth-session", value: token, domain: alvo.hostname, path: "/", secure: alvo.protocol === "https:" }]);
const page = await ctx.newPage();

/**
 * O texto SÓ da janela da lista.
 *
 * Ler o `body` inteiro acusa falso: outros cartões do painel (as sessões do dia, por exemplo)
 * também escrevem o nome do paciente na tela, e um nome que está ali não está nesta lista.
 */
const textoDaJanela = () => page.evaluate(() => {
  const titulo = [...document.querySelectorAll("p")].find((x) => x.textContent?.includes("Desmarcaram, faltaram"));
  return titulo?.closest("div.bg-white")?.innerText ?? "";
});
const janelaDoDivaAberta = () => page.evaluate(() => !!document.querySelector('[role="dialog"][aria-label="Divã"]'));

// A semana vigente, de domingo a sábado, no relógio desta máquina — a mesma conta do servidor.
const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
const domingo = new Date(hoje.getTime() - hoje.getDay() * 86400000);
const noDia = (n, hora = 19) => { const d = new Date(domingo.getTime() + n * 86400000); d.setHours(hora, 0, 0, 0); return d; };

/** Cria um cadastro ativo de QA com uma sessão na data e status pedidos. */
const comSessao = async (nome, data, status) => {
  const [p] = await sql`
    INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status, started_at)
    VALUES (${qa.id}, ${nome}, 'sessao', '100.00', 'ativo', ${new Date(hoje.getTime() - 90 * 86400000)})
    RETURNING id`;
  criados.push(p.id);
  await sql`
    INSERT INTO therapy_sessions (user_id, patient_id, date, duration, fee, status)
    VALUES (${qa.id}, ${p.id}, ${data}, 50, '100.00', ${status})`;
  return p.id;
};

try {
  for (const velho of await sql`SELECT id FROM patients WHERE user_id = ${qa.id} AND name LIKE 'QA75 %'`) {
    await sql`DELETE FROM therapy_sessions WHERE patient_id = ${velho.id}`;
    await sql`DELETE FROM session_payments WHERE patient_id = ${velho.id}`;
    await sql`DELETE FROM patients WHERE id = ${velho.id}`;
  }

  // ------------------------------------------------------- 1) o Divã não abre sozinho
  // Contexto novo = localStorage limpo, que é exatamente a situação em que a janela abria sozinha
  // (primeira visita do dia, e o aviso da voz ainda não lido).
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(3000);
  check("ao abrir o sistema, a janela do Divã NÃO aparece", !(await janelaDoDivaAberta()));
  // Clique direto no DOM: o ícone é FLUTUANTE e, dependendo do layout, fica fora da área visível —
  // o clique do Playwright rola a página atrás dele para sempre.
  await page.evaluate(() => document.querySelector('button[aria-label="Abrir o Divã"]')?.click());
  await page.waitForTimeout(700);
  check("clicar no ícone abre a janela", await janelaDoDivaAberta());
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  check("a janela fecha", !(await janelaDoDivaAberta()));

  // --------------------------------------- 2) "Não vieram na semana" = a semana de domingo a sábado
  await comSessao("QA75 faltou nesta semana", noDia(hoje.getDay()), "nao_realizada");
  await comSessao("QA75 desmarcou nesta semana", noDia(0), "cancelada");
  await comSessao("QA75 atestado no sabado", noDia(6), "atestado");
  // Os que NÃO podem aparecer:
  await comSessao("QA75 so tem agendada", noDia(hoje.getDay()), "agendada");
  await comSessao("QA75 veio nesta semana", noDia(hoje.getDay()), "realizada");
  await comSessao("QA75 faltou na semana passada", noDia(-2), "nao_realizada");
  await comSessao("QA75 vai faltar na proxima", noDia(8), "nao_realizada");
  await comSessao("QA75 profissional desmarcou", noDia(hoje.getDay()), "prof_desmarcou");
  // Sem sessão nenhuma na semana — o "status vazio" que o pedido de 17/11 mandou não considerar.
  const [semNada] = await sql`
    INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status, started_at)
    VALUES (${qa.id}, ${"QA75 sem sessao na semana"}, 'sessao', '100.00', 'ativo', ${new Date(hoje.getTime() - 90 * 86400000)})
    RETURNING id`;
  criados.push(semNada.id);

  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    const alvo = [...document.querySelectorAll("*")].find((e) => e.children.length === 0 && e.textContent?.trim() === "Não vieram na semana");
    (alvo?.closest("button") ?? alvo?.parentElement?.closest("button") ?? alvo?.parentElement)?.click();
  });
  await page.waitForTimeout(900);
  const lista = await textoDaJanela();
  check("a lista abriu com o título novo", lista.includes("Desmarcaram, faltaram ou apresentaram atestado nesta semana"));

  for (const nome of ["QA75 faltou nesta semana", "QA75 desmarcou nesta semana", "QA75 atestado no sabado"]) {
    check(`'${nome}' está na lista`, lista.includes(nome));
  }
  for (const nome of [
    "QA75 so tem agendada",
    "QA75 veio nesta semana",
    "QA75 faltou na semana passada",
    "QA75 vai faltar na proxima",
    "QA75 profissional desmarcou",
    "QA75 sem sessao na semana",
  ]) {
    check(`'${nome}' NÃO está na lista`, !lista.includes(nome));
  }
} catch (e) {
  console.error("\nERRO NO PERCURSO:", e?.message ?? e);
  falhas++;
} finally {
  await nav.close();
  for (const pid of criados) {
    await sql`DELETE FROM session_payments WHERE patient_id = ${pid}`;
    await sql`DELETE FROM therapy_sessions WHERE patient_id = ${pid}`;
    await sql`DELETE FROM patient_price_history WHERE patient_id = ${pid}`;
    await sql`DELETE FROM patient_payment_format_history WHERE patient_id = ${pid}`;
    await sql`DELETE FROM patients WHERE id = ${pid}`;
  }
  console.log(falhas ? `\n${falhas} FALHA(S)` : "\ntudo certo");
  process.exit(falhas ? 1 : 0);
}

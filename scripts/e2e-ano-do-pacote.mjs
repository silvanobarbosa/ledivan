// O PACOTE QUE COMEÇA EM DEZEMBRO APARECE NO ANO EM QUE COMEÇOU (dono, 13/11/2026).
//
// O que o teste puro não prova: que a linha de cobrança da tela conhece as datas das suas sessões.
// A regra é pura, mas o mapa que a alimenta é montado na própria tabela — e era justamente ali que
// o cabeçalho se perdia: ia pelo vencimento (janeiro) e as sessões de dezembro ficavam sem onde
// lançar o pagamento.
//
// O percurso usa um cadastro de QA próprio, com o mesmo formato do caso real (mensal de 4, pacote
// começando em 09/12 e vencendo em janeiro).
//
// Uso: npm run build && npm start, depois `node scripts/e2e-ano-do-pacote.mjs`.

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

const NOME = "QA pacote de dezembro";
const criados = [];
const nav = await chromium.launch();
const alvo = new URL(BASE);
const ctx = await nav.newContext({ viewport: { width: 1280, height: 950 } });
await ctx.addCookies([{ name: "auth-session", value: token, domain: alvo.hostname, path: "/", secure: alvo.protocol === "https:" }]);
const page = await ctx.newPage();

/** Troca o ano no seletor da guia Geral e devolve o que a tabela mostra. */
const naVisaoDoAno = async (pid, ano) => {
  await page.goto(`${BASE}/dashboard/patients/${pid}?tab=geral`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector('[data-testid="guia-geral"]', { timeout: 30000 }).catch(() => {});
  await page.evaluate((a) => {
    const sel = [...document.querySelectorAll("select")].find((s) => [...s.options].some((o) => o.text.trim() === a));
    if (!sel) return;
    sel.value = [...sel.options].find((o) => o.text.trim() === a).value;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  }, String(ano));
  await page.waitForTimeout(900);
  const linhas = await page.evaluate(() => ({
    cobrancas: [...document.querySelectorAll("tr[data-chave]")].map((t) => t.getAttribute("data-chave")),
    sessoes: [...document.querySelectorAll("tr[data-sessao]")].map((t) => t.getAttribute("data-sessao")),
  }));
  return linhas;
};

try {
  const [p] = await sql`
    INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status, payment_day, sessions_in_packet, pacote_tipo, started_at, times_per_period)
    VALUES (${qa.id}, ${NOME}, 'mensal', '100.00', 'ativo', 10, 4, 'completo', ${new Date(2026, 11, 9)}, 1)
    RETURNING id`;
  criados.push(p.id);
  // Pacote que começa em 09/12/2026 e atravessa o ano — vence em janeiro de 2027.
  const dias = [new Date(2026, 11, 9, 18), new Date(2026, 11, 16, 18), new Date(2026, 11, 23, 18), new Date(2027, 0, 6, 18)];
  const ids = [];
  for (const d of dias) {
    const [s] = await sql`
      INSERT INTO therapy_sessions (user_id, patient_id, date, duration, fee, status)
      VALUES (${qa.id}, ${p.id}, ${d}, 50, '100.00', 'agendada') RETURNING id`;
    ids.push(s.id);
  }

  const em2026 = await naVisaoDoAno(p.id, 2026);
  check("as sessões de dezembro aparecem em 2026", em2026.sessoes.includes(ids[0]) && em2026.sessoes.includes(ids[2]), `${em2026.sessoes.length} sessões`);
  check("o cabeçalho do pacote aparece JUNTO, em 2026", em2026.cobrancas.some((c) => c && c.startsWith("pacote:")), JSON.stringify(em2026.cobrancas));

  const em2027 = await naVisaoDoAno(p.id, 2027);
  check("a sessão de janeiro aparece em 2027", em2027.sessoes.includes(ids[3]), `${em2027.sessoes.length} sessões`);

  /** "Todos" continua mostrando tudo — era a única visão onde a dona conseguia ver o pacote. */
  const todos = await naVisaoDoAno(p.id, "TODOS");
  check("a visão 'Todos' segue completa", todos.sessoes.length >= 4, `${todos.sessoes.length} sessões`);
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

// A SÉRIE PULA O HORÁRIO BLOQUEADO (documento de 18/09), no app de verdade.
//
// O cenário dela, ao pé da letra: série semanal começando segunda 14/09 às 14h, com a segunda
// seguinte bloqueada. O sistema não pode marcar na data bloqueada, e a série segue na próxima.
//
// IMPORTANTE: suba o servidor com TZ=UTC, como a Vercel roda.
// Uso: TZ=UTC npx next start -p 3000   e então   node scripts/e2e-serie-bloqueio.mjs

import { createRequire } from "node:module";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";

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

const [qa] = await sql`SELECT id FROM "user" WHERE email = 'qa.ledivan@reverblabs.com.br'`;
if (!qa) { console.log("conta de QA não encontrada."); process.exit(1); }

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1440, height: 1100 }, storageState: "_visual/.sessao-qa.json" });
const page = await ctx.newPage();
const erros = [];
page.on("console", (m) => { if (m.type() === "error") erros.push(m.text().slice(0, 160)); });

let pid = null, bloqueioId = null;
try {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
  if (page.url().includes("/login")) throw new Error("sessão de QA expirada");

  const nome = `QA Bloqueio ${Date.now().toString().slice(-5)}`;
  const [p] = await sql`INSERT INTO patients (user_id, name, payment_format, pacote_tipo, session_fee, started_at, patient_status)
                        VALUES (${qa.id}, ${nome}, 'sessao', null, '100.00', '2026-09-01', 'ativo') RETURNING id`;
  pid = p.id;

  // A segunda 21/09 às 14h fica bloqueada (supervisão, curso, o que for).
  const [b] = await sql`INSERT INTO blocked_slots (user_id, date, duration, note)
                        VALUES (${qa.id}, '2026-09-21 14:00:00', 50, 'Supervisão') RETURNING id`;
  bloqueioId = b.id;

  // Marca a série pela janela da agenda: segunda 14/09 14h, semanal, até 05/10.
  await page.goto(`${BASE}/dashboard/agenda`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector('button[title^="Agendar"]', { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => [...document.querySelectorAll("div")].filter((d) => d.className && String(d.className).includes("z-[100]")).forEach((e) => e.remove()));
  await page.locator('button[title="Agendar 14:00"]').first().click();
  await page.waitForSelector('select[name="patientId"]', { timeout: 20000 });
  const janela = page.locator("form").filter({ has: page.locator('select[name="patientId"]') });
  await page.selectOption('select[name="patientId"]', pid);
  await page.locator('input[name="date"]').fill("2026-09-14T14:00");
  await page.waitForTimeout(500);
  await janela.locator('select[name="freq"]').selectOption("semanal");
  await page.waitForTimeout(600);
  await janela.locator('input[name="until"]').fill("2026-10-05");
  await janela.getByRole("button", { name: "Agendar", exact: true }).click();
  await page.waitForTimeout(4000);

  const linhas = await sql`SELECT to_char(date, 'DD/MM HH24h') AS quando FROM therapy_sessions
                           WHERE patient_id = ${pid} ORDER BY date`;
  const datas = linhas.map((l) => l.quando);
  check("marcou a série pulando a data bloqueada", datas.join(" · ") === "14/09 14h · 28/09 14h · 05/10 14h", datas.join(" · "));
  check("nenhuma sessão caiu em 21/09", !datas.some((d) => d.startsWith("21/09")));

  // O bloqueio continua de pé, intocado — ele não virou sessão.
  const [restou] = await sql`SELECT count(*)::int AS n FROM blocked_slots WHERE id = ${bloqueioId}`;
  check("o bloqueio continua sendo bloqueio, não virou sessão", restou.n === 1);

  check("sem erro no console do navegador", erros.length === 0, erros.slice(0, 2).join(" | "));
} catch (e) {
  check("percurso", false, String(e?.message ?? e).replace(/postgresql:\/\/[^\s]*/g, "[url omitida]"));
} finally {
  if (pid) await sql`DELETE FROM patients WHERE id = ${pid}`;
  if (bloqueioId) await sql`DELETE FROM blocked_slots WHERE id = ${bloqueioId}`;
  check("limpeza: paciente, sessões e bloqueio apagados", true);
  await nav.close();
}

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo no app de verdade");
process.exit(falhas ? 1 : 0);

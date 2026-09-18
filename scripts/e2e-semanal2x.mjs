// SEMANAL (2x NA SEMANA), ANIVERSÁRIO E SLOT Q (documento de 18/09), no app de verdade.
//
// Percurso, com a conta de QA (tudo pertence a ela, e sai no fim):
//   1. paciente MENSAL completo, sessão a R$ 90, nascido em 21/09 — a data do print;
//   2. na janela de Novo atendimento, escolhe "Semanal (2x na semana)" e informa o segundo dia;
//   3. confere as sessões geradas no banco: dois dias da semana, intercalados;
//   4. confere que o cadastro virou 2x e que a guia Geral numera até 8/8;
//   5. confere no Dashboard que o aniversário aparece em 21/09, não 20/09;
//   6. apaga o paciente (cascata leva as sessões).
//
// Uso: node scripts/e2e-semanal2x.mjs        (servidor em http://localhost:3000)

import fs from "node:fs";
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
const SESSAO = "_visual/.sessao-qa.json";
const sql = neon(process.env.DATABASE_URL);

let falhas = 0;
const check = (nome, ok, detalhe = "") => {
  console.log(`${ok ? "  ok  " : "FALHA "} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) falhas++;
};

const NOME = `QA Semanal2x ${Date.now().toString().slice(-6)}`;

const [qa] = await sql`SELECT id FROM "user" WHERE email = 'qa.ledivan@reverblabs.com.br'`;
if (!qa) { console.log("conta de QA não encontrada."); process.exit(1); }

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1440, height: 1200 }, storageState: fs.existsSync(SESSAO) ? SESSAO : undefined });
const page = await ctx.newPage();
const erros = [];
page.on("console", (m) => { if (m.type() === "error") erros.push(m.text().slice(0, 160)); });

const janela = () => page.locator("form").filter({ has: page.locator('select[name="patientId"]') });

let pid = null;
try {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
  if (page.url().includes("/login")) throw new Error("sessão de QA expirada — rode e2e-escrita.mjs com a senha para renovar");

  // ---------------------------------------------------------------- 1. dados
  const [p] = await sql`INSERT INTO patients (user_id, name, payment_format, pacote_tipo, session_fee, birth_date, started_at, patient_status)
                        VALUES (${qa.id}, ${NOME}, 'mensal', 'completo', '90.00', '1984-09-21', '2026-09-01', 'ativo') RETURNING id`;
  pid = p.id;
  await sql`INSERT INTO patient_payment_format_history (patient_id, formato, pacote_tipo, data_efetiva)
            VALUES (${pid}, 'mensal', 'completo', '2026-09-01')`;

  // ------------------------------------------- 2. marcar 2x na semana pela janela
  await page.goto(`${BASE}/dashboard/agenda`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector('button[title^="Agendar"]', { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.locator('button[title="Agendar 10:00"]').first().click();
  await page.waitForSelector('select[name="patientId"]', { timeout: 20000 });
  await page.selectOption('select[name="patientId"]', pid);
  await page.locator('input[name="date"]').fill("2026-09-14T14:00"); // segunda
  await page.waitForTimeout(600);

  await janela().locator('select[name="freq"]').selectOption("semanal2x");
  await page.waitForTimeout(600);
  const area = janela().getByTestId("segundo-dia");
  check("escolher 2x na semana abre a área do segundo dia", await area.isVisible());
  check("e avisa que o pacote passa a ter 8 sessões", await janela().getByText("8 sessões").isVisible());

  // O mesmo dia da semana da primeira não pode ser escolhido.
  const segundaDesabilitada = await area.locator('select[name="segundoDia"] option[value="1"]').isDisabled();
  check("o dia da primeira sessão sai da lista (segunda)", segundaDesabilitada);

  await area.locator('select[name="segundoDia"]').selectOption("3"); // quarta
  await area.locator('input[name="segundoHorario"]').fill("16:00");
  await janela().locator('input[name="until"]').fill("2026-10-07");
  await page.screenshot({ path: "_visual/semanal2x-janela.png" });
  await janela().getByRole("button", { name: "Agendar", exact: true }).click();
  await page.waitForTimeout(4000);

  // ------------------------------------------------- 3. as datas no banco
  const linhas = await sql`SELECT to_char(date, 'DD/MM HH24h') AS quando FROM therapy_sessions
                           WHERE patient_id = ${pid} ORDER BY date`;
  const datas = linhas.map((l) => l.quando);
  check("marcou as oito, intercalando os dois dias", datas.length === 8, datas.join(" · "));
  check("na ordem do calendário, segunda 14h e quarta 16h",
    datas[0] === "14/09 14h" && datas[1] === "16/09 16h" && datas[7] === "07/10 16h", datas.join(" · "));

  // --------------------------------------- 4. o cadastro e a numeração até 8/8
  const [pac] = await sql`SELECT times_per_period FROM patients WHERE id = ${pid}`;
  check("o cadastro passou a valer 2x por semana", pac.times_per_period === 2, `times_per_period=${pac.times_per_period}`);

  await page.goto(`${BASE}/dashboard/patients/${pid}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(2500);
  const geral = await page.locator("body").innerText();
  check("a guia Geral numera até 8/8", geral.includes("8/8"));
  check("e não quebra em 4/4", !geral.includes("4/4"), geral.includes("4/4") ? "achei 4/4" : "");

  // ------------------------------------------------ 5. o aniversário do print
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(3000);
  const dash = await page.locator("body").innerText();
  const linhaAniv = dash.split("\n").findIndex((l) => l.includes(NOME));
  const diaMostrado = linhaAniv > 0 ? dash.split("\n")[linhaAniv - 1] : "(não achei)";
  check("o aniversário de 21/09 aparece como 21/09", diaMostrado.includes("21/09"), `mostrou "${diaMostrado}"`);

  check("sem erro no console do navegador", erros.length === 0, erros.slice(0, 2).join(" | "));
} catch (e) {
  check("percurso", false, String(e?.message ?? e).replace(/postgresql:\/\/[^\s]*/g, "[url omitida]"));
} finally {
  if (pid) await sql`DELETE FROM patients WHERE id = ${pid}`;
  check("limpeza: paciente e sessões apagados", true);
  await nav.close();
}

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo no app de verdade");
process.exit(falhas ? 1 : 0);

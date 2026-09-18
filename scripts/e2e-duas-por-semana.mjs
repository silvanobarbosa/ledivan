// 2x POR SEMANA = UM PACOTE DE OITO (documento de 17/09), no app de verdade.
//
// Reproduz o print do documento: paciente atendida terças e quintas recebia DOIS pagamentos de
// 4 sessões no mês (R$ 360 cada). Agora é um pacote só, de 1/8 a 8/8, com uma cobrança.
//
// Percurso, com a conta de QA (tudo pertence a ela, e sai no fim):
//   1. paciente MENSAL completo, sessão a R$ 90, marcado como 2x por semana;
//   2. oito sessões, terças e quintas, de 12/11 a 08/12 (as datas do print);
//   3. confere na guia Geral: uma cobrança de 8 sessões, R$ 720,00, e a numeração 1/8..8/8;
//   4. controle: o mesmo paciente a 1x por semana volta a ser dois pacotes de quatro;
//   5. apaga o paciente (cascata leva as sessões).
//
// Uso: node scripts/e2e-duas-por-semana.mjs        (servidor em http://localhost:3000)

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

const NOME = `QA 2x Semana ${Date.now().toString().slice(-6)}`;

const [qa] = await sql`SELECT id FROM "user" WHERE email = 'qa.ledivan@reverblabs.com.br'`;
if (!qa) { console.log("conta de QA não encontrada."); process.exit(1); }

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1440, height: 1200 }, storageState: fs.existsSync(SESSAO) ? SESSAO : undefined });
const page = await ctx.newPage();
const erros = [];
page.on("console", (m) => { if (m.type() === "error") erros.push(m.text().slice(0, 160)); });

const geral = async (pid) => {
  await page.goto(`${BASE}/dashboard/patients/${pid}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(2500);
  return page.locator("body").innerText();
};

let pid = null;
try {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
  if (page.url().includes("/login")) throw new Error("sessão de QA expirada — rode e2e-escrita.mjs com a senha para renovar");

  // ---------------------------------------------------------------- 1. dados
  const [p] = await sql`INSERT INTO patients (user_id, name, payment_format, pacote_tipo, session_fee, frequency, times_per_period, started_at, patient_status)
                        VALUES (${qa.id}, ${NOME}, 'mensal', 'completo', '90.00', 'semanal', 2, '2026-11-01', 'ativo') RETURNING id`;
  pid = p.id;
  await sql`INSERT INTO patient_payment_format_history (patient_id, formato, pacote_tipo, data_efetiva)
            VALUES (${pid}, 'mensal', 'completo', '2026-11-01')`;
  // Terças e quintas, exatamente as datas do print do documento.
  for (const d of ["2026-11-12", "2026-11-17", "2026-11-19", "2026-11-24", "2026-11-26", "2026-12-01", "2026-12-03", "2026-12-08"]) {
    await sql`INSERT INTO therapy_sessions (user_id, patient_id, date, status)
              VALUES (${qa.id}, ${pid}, ${`${d} 11:00:00`}, 'realizada')`;
  }

  // ------------------------------------------------------- 2. um pacote de 8
  const corpo = await geral(pid);
  check("a numeração vai até 8/8", corpo.includes("8/8"));
  check("não quebra em 4/4 no meio do caminho", !corpo.includes("4/4"), corpo.includes("4/4") ? "achei 4/4 na tela" : "");
  check("uma cobrança de 8 sessões", /8\s*sess/.test(corpo));
  check("no valor das oito (R$ 720,00)", corpo.includes("720,00"));
  check("e NÃO dois pagamentos de R$ 360,00", !corpo.includes("360,00"), corpo.includes("360,00") ? "achei R$ 360,00 na tela" : "");
  await page.screenshot({ path: "_visual/duas-por-semana.png", fullPage: true });

  // ------------------------------------------ 3. controle: 1x volta ao de antes
  await sql`UPDATE patients SET times_per_period = 1 WHERE id = ${pid}`;
  const corpo1x = await geral(pid);
  check("a 1x por semana, volta a ser dois pacotes de quatro", corpo1x.includes("4/4") && corpo1x.includes("360,00"));

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

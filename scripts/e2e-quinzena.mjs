// A QUINZENA É DO CALENDÁRIO (documento de 17/09), no app de verdade.
//
// Reproduz o caso que o dono fotografou: paciente semanal 1x, pagamento quinzenal fragmentado, com
// as sessões começando no dia 18. Antes o sistema cobrava R$ 115 + R$ 115, com a primeira vencendo
// no dia 05 — de uma quinzena em que não houve atendimento.
//
// Percurso, com a conta de QA (tudo pertence a ela, e sai no fim):
//   1. paciente quinzenal FRACIONADO, sessão a R$ 115, vencimentos dia 05 e 20;
//   2. setembro com duas sessões, ambas na SEGUNDA quinzena (18 e 25);
//   3. outubro com cinco: duas na primeira (02, 09) e três na segunda (16, 23, 30);
//   4. confere na guia Geral: setembro = uma cobrança de R$ 230,00; outubro = R$ 230,00 + R$ 345,00;
//   5. apaga o paciente (cascata leva as sessões).
//
// Uso: node scripts/e2e-quinzena.mjs        (servidor em http://localhost:3000)

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

const NOME = `QA Quinzena ${Date.now().toString().slice(-6)}`;

const [qa] = await sql`SELECT id FROM "user" WHERE email = 'qa.ledivan@reverblabs.com.br'`;
if (!qa) { console.log("conta de QA não encontrada."); process.exit(1); }

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1440, height: 1200 }, storageState: fs.existsSync(SESSAO) ? SESSAO : undefined });
const page = await ctx.newPage();
const erros = [];
page.on("console", (m) => { if (m.type() === "error") erros.push(m.text().slice(0, 160)); });

let pid = null;
try {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
  if (page.url().includes("/login")) throw new Error("sessão de QA expirada — rode e2e-escrita.mjs com a senha para renovar");

  // ---------------------------------------------------------------- 1. dados
  const [p] = await sql`INSERT INTO patients (user_id, name, payment_format, pacote_tipo, session_fee, payment_day, payment_day_2, started_at, patient_status)
                        VALUES (${qa.id}, ${NOME}, 'quinzenal', 'fragmentado', '115.00', 5, 20, '2026-09-01', 'ativo') RETURNING id`;
  pid = p.id;
  await sql`INSERT INTO patient_payment_format_history (patient_id, formato, pacote_tipo, data_efetiva)
            VALUES (${pid}, 'quinzenal', 'fragmentado', '2026-09-01')`;
  const dias = ["2026-09-18", "2026-09-25", "2026-10-02", "2026-10-09", "2026-10-16", "2026-10-23", "2026-10-30"];
  for (const d of dias) {
    await sql`INSERT INTO therapy_sessions (user_id, patient_id, date, status)
              VALUES (${qa.id}, ${pid}, ${`${d} 10:00:00`}, 'realizada')`;
  }

  // ------------------------------------------------------------- 2. a conta
  await page.goto(`${BASE}/dashboard/patients/${pid}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(2500);
  const corpo = await page.locator("body").innerText();

  check("setembro cobra as duas sessões inteiras (R$ 230,00)", corpo.includes("230,00"));
  check("NÃO cobra metade do mês (R$ 115,00) como antes", !corpo.includes("R$ 115,00"),
    corpo.includes("R$ 115,00") ? "achei R$ 115,00 na tela" : "");
  check("outubro reparte 2 e 3: a segunda quinzena vale R$ 345,00", corpo.includes("345,00"));
  check("NÃO divide outubro ao meio (R$ 287,50)", !corpo.includes("287,50"),
    corpo.includes("287,50") ? "achei R$ 287,50 na tela" : "");

  // As linhas de cobrança dizem quantas sessões cobram — o par (quantas, quanto) tem de fechar.
  check("uma cobrança de 2 sessões e uma de 3", /3\s*sess/.test(corpo) && /2\s*sess/.test(corpo));

  await page.screenshot({ path: "_visual/quinzena-geral.png", fullPage: true });
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

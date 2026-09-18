// O CALENDÁRIO DA DONA, no app de verdade (documento de 18/09).
//
// Ela montou o caso inteiro: sessões toda sexta a partir de 16/10, R$ 100 a sessão, quinzenal com
// dias de pagamento 10 e 20 — e escreveu o que espera ver na guia Geral. Este percurso reproduz os
// dois cenários dela, completo e fracionado, e confere a tela contra o que ela escreveu.
//
// IMPORTANTE: suba o servidor com TZ=UTC, como a Vercel roda (ver e2e-semanal2x.mjs).
//
// Uso: TZ=UTC npx next start -p 3000   e então   node scripts/e2e-quinzena-pacote.mjs

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
const sql = neon(process.env.DATABASE_URL);

let falhas = 0;
const check = (nome, ok, detalhe = "") => {
  console.log(`${ok ? "  ok  " : "FALHA "} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) falhas++;
};

const [qa] = await sql`SELECT id FROM "user" WHERE email = 'qa.ledivan@reverblabs.com.br'`;
if (!qa) { console.log("conta de QA não encontrada."); process.exit(1); }

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1440, height: 1400 }, storageState: "_visual/.sessao-qa.json" });
const page = await ctx.newPage();
const erros = [];
page.on("console", (m) => { if (m.type() === "error") erros.push(m.text().slice(0, 160)); });

/** As sextas do exemplo dela. */
const SEXTAS = ["2026-10-16", "2026-10-23", "2026-10-30", "2026-11-06", "2026-11-13", "2026-11-20", "2026-11-27", "2026-12-04"];

async function paciente(pacoteTipo) {
  const nome = `QA Quinz ${pacoteTipo} ${Date.now().toString().slice(-5)}`;
  const [p] = await sql`INSERT INTO patients (user_id, name, payment_format, pacote_tipo, session_fee, payment_day, payment_day_2, started_at, patient_status)
                        VALUES (${qa.id}, ${nome}, 'quinzenal', ${pacoteTipo}, '100.00', 10, 20, '2026-10-01', 'ativo') RETURNING id`;
  await sql`INSERT INTO patient_payment_format_history (patient_id, formato, pacote_tipo, data_efetiva)
            VALUES (${p.id}, 'quinzenal', ${pacoteTipo}, '2026-10-01')`;
  for (const d of SEXTAS) {
    await sql`INSERT INTO therapy_sessions (user_id, patient_id, date, status)
              VALUES (${qa.id}, ${p.id}, ${`${d} 08:00:00`}, 'realizada')`;
  }
  return p.id;
}

const criados = [];
try {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
  if (page.url().includes("/login")) throw new Error("sessão de QA expirada");

  // ----------------------------------------------------------- pacote completo
  const pidC = await paciente("completo"); criados.push(pidC);
  await page.goto(`${BASE}/dashboard/patients/${pidC}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(2500);
  const completo = await page.locator("body").innerText();

  // O Intl separa "R$" do valor com espaco NAO-SEPARAVEL (codigo 160), nao com espaco comum.
  // Comparar com espaco normal nunca casa — dai a regex com \s, que casa os dois.
  const quantos = (texto, v) => (texto.match(new RegExp('R\\$\\s' + v.replace(',', ','), 'g')) || []).length;
  const contar = (texto, v) => (texto.split(new RegExp('R\\$\\s' + v)).length - 1);
  check("completo: quatro pagamentos de R$ 200,00", contar(completo, '200,00') >= 4, `${contar(completo, '200,00')} ocorrencias`);
  check("completo: nenhum pagamento de R$ 300,00 (era o defeito do print)", contar(completo, '300,00') === 0);
  for (const venc of ["20/10/26", "10/11/26", "20/11/26", "10/12/26"]) {
    check(`completo: vence em ${venc}`, completo.includes(venc));
  }
  await page.screenshot({ path: "_visual/quinzena-completo.png", fullPage: true });

  // --------------------------------------------------------- pacote fracionado
  const pidF = await paciente("fragmentado"); criados.push(pidF);
  await page.goto(`${BASE}/dashboard/patients/${pidF}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(2500);
  const frag = await page.locator("body").innerText();

  check("fracionado: outubro é um pagamento de R$ 300,00", contar(frag, '300,00') >= 1);
  check("fracionado: novembro reparte em dois de R$ 200,00", contar(frag, '200,00') >= 2);
  check("fracionado: o de outubro vence em 20/10", frag.includes("20/10/26"));
  await page.screenshot({ path: "_visual/quinzena-fragmentado.png", fullPage: true });

  check("sem erro no console do navegador", erros.length === 0, erros.slice(0, 2).join(" | "));
} catch (e) {
  check("percurso", false, String(e?.message ?? e).replace(/postgresql:\/\/[^\s]*/g, "[url omitida]"));
} finally {
  for (const id of criados) await sql`DELETE FROM patients WHERE id = ${id}`;
  check("limpeza: pacientes e sessões apagados", true);
  await nav.close();
}

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo no app de verdade");
process.exit(falhas ? 1 : 0);

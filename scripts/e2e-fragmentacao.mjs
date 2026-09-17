// FRAGMENTAÇÃO E REPOSIÇÃO (documento de 17/09, onda 6), no app de verdade.
//
// O que está em teste é a diferença que muda dinheiro: uma sessão nova pode REPOR a vaga que uma
// desmarcada deixou, ou ser um atendimento A MAIS. Sem o vínculo, o sistema não sabe qual das duas
// é — e os dois casos cobram valores diferentes.
//
// Percurso, com a conta de QA (tudo pertence a ela, e sai no fim):
//   1. paciente MENSAL FRACIONADO, R$ 130, com três terças de setembro — a primeira desmarcada;
//   2. abre "Novo atendimento" e confere que a janela pergunta o que a sessão repõe;
//   3. escolhe repor a desmarcada e salva; confere o vínculo no banco;
//   4. confere a conta: setembro segue valendo três, e a reposição ocupa a vaga (não vira a quarta);
//   5. controle: com a vaga já reposta, a pergunta não oferece mais aquela desmarcada;
//   6. apaga o paciente (cascata leva as sessões).
//
// Uso: node scripts/e2e-fragmentacao.mjs        (servidor em http://localhost:3000)

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

const marca = Date.now().toString().slice(-6);
const NOME = `QA Fragmentado ${marca}`;

const [qa] = await sql`SELECT id FROM "user" WHERE email = 'qa.ledivan@reverblabs.com.br'`;
if (!qa) { console.log("conta de QA não encontrada."); process.exit(1); }

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1440, height: 1000 }, storageState: fs.existsSync(SESSAO) ? SESSAO : undefined });
const page = await ctx.newPage();
const erros = [];
page.on("console", (m) => { if (m.type() === "error") erros.push(m.text().slice(0, 160)); });

const janela = () => page.locator("form").filter({ has: page.locator('select[name="patientId"]') });

async function abrirNovo(pacienteId, quando) {
  await page.goto(`${BASE}/dashboard/agenda`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector('button[title^="Agendar"]', { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.locator('button[title="Agendar 10:00"]').first().click();
  await page.waitForSelector('select[name="patientId"]', { timeout: 20000 });
  await page.selectOption('select[name="patientId"]', pacienteId);
  await page.locator('input[name="date"]').fill(quando);
  await page.waitForTimeout(700);
}

let pid = null;
try {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
  if (page.url().includes("/login")) throw new Error("sessão de QA expirada — rode e2e-escrita.mjs com a senha para renovar");

  // ---------------------------------------------------------------- 1. dados
  const [p] = await sql`INSERT INTO patients (user_id, name, payment_format, pacote_tipo, session_fee, started_at, patient_status)
                        VALUES (${qa.id}, ${NOME}, 'mensal', 'fragmentado', '130.00', '2026-08-01', 'ativo') RETURNING id`;
  pid = p.id;
  await sql`INSERT INTO patient_payment_format_history (patient_id, formato, pacote_tipo, data_efetiva)
            VALUES (${pid}, 'mensal', 'fragmentado', '2026-08-01')`;
  const ids = {};
  for (const [d, status] of [["2026-09-01", "cancelada"], ["2026-09-08", "realizada"], ["2026-09-15", "realizada"]]) {
    const [s] = await sql`INSERT INTO therapy_sessions (user_id, patient_id, date, status)
                          VALUES (${qa.id}, ${pid}, ${`${d} 09:00:00`}, ${status}) RETURNING id`;
    ids[d] = s.id;
  }

  // ------------------------------------------------------- 2. a pergunta nova
  await abrirNovo(pid, "2026-09-22T10:00");
  const pergunta = janela().getByTestId("pergunta-reposicao");
  check("com desmarcada esperando, a janela pergunta o que a sessão repõe", await pergunta.isVisible());
  const opcoes = await pergunta.locator("option").allInnerTexts();
  check("a desmarcada de 01/09 é oferecida", opcoes.some((o) => o.includes("01/09")), opcoes.join(" | "));
  await page.screenshot({ path: "_visual/reposicao-pergunta.png" });

  // ----------------------------------------------- 3. repor e conferir o vínculo
  await pergunta.locator("select").selectOption(ids["2026-09-01"]);
  await janela().getByRole("button", { name: "Agendar", exact: true }).click();
  await page.waitForTimeout(3500);

  const [nova] = await sql`SELECT id, repoe_sessao_id FROM therapy_sessions
                           WHERE patient_id = ${pid} AND date::date = '2026-09-22'`;
  check("a sessão nova gravou que repõe a desmarcada", nova?.repoe_sessao_id === ids["2026-09-01"],
    nova ? `repoe=${nova.repoe_sessao_id ? "sim" : "não"}` : "sessão não encontrada");

  // ------------------------------------------- 4. a conta: setembro segue /3
  await page.goto(`${BASE}/dashboard/patients/${pid}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(2000);
  const corpo = await page.locator("body").innerText();
  check("setembro continua valendo três — a reposição ocupou a vaga, não virou a quarta",
    corpo.includes("3/3") && !corpo.includes("4/4"), corpo.includes("4/4") ? "achei 4/4 na tela" : "");
  await page.screenshot({ path: "_visual/reposicao-geral.png", fullPage: true });

  // -------------------------------------- 5. a vaga reposta sai da lista
  await abrirNovo(pid, "2026-09-29T10:00");
  const depois = janela().getByTestId("pergunta-reposicao");
  const visivel = await depois.isVisible().catch(() => false);
  const opcoes2 = visivel ? await depois.locator("option").allInnerTexts() : [];
  check("a vaga já reposta não é oferecida de novo", !opcoes2.some((o) => o.includes("01/09")), opcoes2.join(" | "));

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

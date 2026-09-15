// SESSÃO FORA DA SEQUÊNCIA DO PACOTE, NO APP DE VERDADE (regra do dono, 15/09/2026).
//
// Percurso, com a conta de QA (tudo pertence a ela, e sai no fim):
//   1. paciente MENSAL completo, R$ 130, com vigência desde 01/08 e quatro terças realizadas em
//      setembro (01, 08, 15, 22) — direto no banco: cadastro e série não são o que está em teste;
//   2. pela JANELA "Novo atendimento" da agenda, insere uma sessão em 10/09 10h:
//      "Não adicionar à sequência do pacote" → "Sim (AVUL)" → R$ 150;
//   3. tenta outra em 17/09 10h marcando "Sim (AVUL)" com valor vazio → a tela recusa;
//   4. insere a de 17/09 como "Não (GRAT)";
//   5. confere no banco: extra/valor_extra gravados;
//   6. confere o rótulo que a agenda recebe: 1/4..4/4 intactos, AVUL e GRAT nas extras;
//   7. controle: paciente "a cada sessão" não recebe a pergunta;
//   8. apaga os pacientes (cascata leva sessões e vigências).
//
// Uso: node scripts/e2e-sessao-extra.mjs        (servidor em http://localhost:3000)

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
const NOME = `Extra QA ${marca}`;
const NOME_SESSAO = `Extra Controle QA ${marca}`;
const criados = [];

const [qa] = await sql`SELECT id FROM "user" WHERE email = 'qa.ledivan@reverblabs.com.br'`;
if (!qa) { console.log("conta de QA não encontrada"); process.exit(1); }

async function paciente(nome, formato) {
  const [p] = await sql`INSERT INTO patients (user_id, name, payment_format, pacote_tipo, session_fee, started_at)
                        VALUES (${qa.id}, ${nome}, ${formato}, ${formato === "mensal" ? "completo" : null}, '130.00', '2026-08-01')
                        RETURNING id`;
  criados.push({ id: p.id, nome });
  await sql`INSERT INTO patient_payment_format_history (patient_id, formato, pacote_tipo, data_efetiva)
            VALUES (${p.id}, ${formato}, ${formato === "mensal" ? "completo" : null}, '2026-08-01')`;
  return p.id;
}

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1440, height: 1000 }, storageState: fs.existsSync(SESSAO) ? SESSAO : undefined });
const page = await ctx.newPage();
const errosConsole = [];
page.on("console", (m) => { if (m.type() === "error") errosConsole.push(m.text().slice(0, 160)); });

async function abrirNovo(pacienteId, quando) {
  await page.goto(`${BASE}/dashboard/agenda`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector('button[title^="Agendar"]', { timeout: 60000 });
  await page.waitForTimeout(2500);
  await page.locator('button[title="Agendar 10:00"]').first().click();
  await page.waitForSelector('select[name="patientId"]', { timeout: 20000 });
  await page.selectOption('select[name="patientId"]', pacienteId);
  await page.locator('input[name="date"]').fill(quando);
  await page.waitForTimeout(500);
}
const janela = () => page.locator("form").filter({ has: page.locator('select[name="patientId"]') });
const salvar = async () => {
  await janela().getByRole("button", { name: "Agendar", exact: true }).click();
  await page.waitForTimeout(3000);
};

try {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
  if (page.url().includes("/login")) throw new Error("sessão de QA expirada — rode e2e-escrita.mjs com a senha para renovar");

  // ---------------------------------------------------------------- 1. dados
  const pid = await paciente(NOME, "mensal");
  const terças = ["2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22"];
  const seq = [];
  for (const d of terças) {
    const [s] = await sql`INSERT INTO therapy_sessions (user_id, patient_id, date, status)
                          VALUES (${qa.id}, ${pid}, ${`${d} 09:00:00`}, 'realizada') RETURNING id`;
    seq.push(s.id);
  }
  const pidSessao = await paciente(NOME_SESSAO, "sessao");

  // ---------------------------------------------------------------- 2. AVUL
  await abrirNovo(pid, "2026-09-10T10:00");
  const pergunta = janela().getByTestId("pergunta-sequencia");
  check("paciente de pacote: a janela pergunta sobre a sequência", await pergunta.isVisible());
  await pergunta.getByRole("button", { name: "Não adicionar à sequência do pacote" }).click();
  check("fora da sequência: pergunta se será cobrada", await pergunta.getByText("Esta sessão será cobrada?").isVisible());
  await pergunta.getByRole("button", { name: "Sim (AVUL)" }).click();
  const valor = pergunta.locator('input[name="valorExtra"]');
  check("cobrada: pede o valor, sugerindo o preço da sessão", (await valor.inputValue()) === "130,00", await valor.inputValue());
  await valor.fill("150,00");
  await page.screenshot({ path: "_visual/extra-avul.png" });
  await salvar();

  // ---------------------------------------------------------------- 3. recusa sem valor
  await abrirNovo(pid, "2026-09-17T10:00");
  await janela().getByRole("button", { name: "Não adicionar à sequência do pacote" }).click();
  await janela().getByRole("button", { name: "Sim (AVUL)" }).click();
  await janela().locator('input[name="valorExtra"]').fill("");
  // O navegador bloqueia pelo `required`; tira-o para provar que o SERVIDOR também recusa.
  await page.evaluate(() => document.querySelector('input[name="valorExtra"]')?.removeAttribute("required"));
  await salvar();
  const [{ n: semValor }] = await sql`SELECT COUNT(*)::int n FROM therapy_sessions WHERE patient_id = ${pid} AND date = '2026-09-17 10:00:00'`;
  check("AVUL sem valor: o servidor recusa e não grava", semValor === 0, `linhas=${semValor}`);
  check("… e a janela diz o motivo", await janela().getByText("Informe o valor da sessão avulsa.").isVisible().catch(() => false));

  // ---------------------------------------------------------------- 4. GRAT
  await janela().getByRole("button", { name: "Não (GRAT)" }).click();
  await salvar();

  // ---------------------------------------------------------------- 5. banco
  const extras = await sql`SELECT to_char(date, 'YYYY-MM-DD') d, extra, valor_extra FROM therapy_sessions
                           WHERE patient_id = ${pid} AND extra IS NOT NULL ORDER BY date`;
  console.log("       extras gravadas:", JSON.stringify(extras));
  check("10/09 gravada como AVUL de R$ 150", extras[0]?.d === "2026-09-10" && extras[0]?.extra === "avul" && Number(extras[0]?.valor_extra) === 150);
  check("17/09 gravada como GRAT sem valor", extras[1]?.d === "2026-09-17" && extras[1]?.extra === "grat" && extras[1]?.valor_extra === null);

  // ---------------------------------------------------------------- 6. agenda
  await page.goto(`${BASE}/dashboard/agenda`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(2500);
  const html = (await page.content()).replace(/\\"/g, '"');
  const codigoDe = (id) => {
    const i = html.indexOf(`"id":"${id}"`);
    if (i < 0) return "(fora da janela)";
    return (html.slice(i, i + 2000).match(/"codigo":"([^"]*)"/) || [])[1] ?? "(sem codigo)";
  };
  const todas = await sql`SELECT id, to_char(date, 'YYYY-MM-DD') d FROM therapy_sessions WHERE patient_id = ${pid} ORDER BY date`;
  console.log("       rótulos:", todas.map((s) => `${s.d}=${codigoDe(s.id)}`).join("  "));
  // A agenda abre na semana de hoje; os códigos das outras semanas não vêm no HTML. Onde vierem,
  // têm de estar certos — e o motor é o mesmo para todas (provado no teste unitário).
  const esperado = new Map([...seq.map((id, i) => [id, `${i + 1}/4`]), ...todas.filter((s) => !seq.includes(s.id)).map((s) => [s.id, s.d === "2026-09-10" ? "AVUL" : "GRAT"])]);
  const vistos = todas.filter((s) => codigoDe(s.id) !== "(fora da janela)");
  check("rótulos da semana visível corretos (sequência intacta, extras com rótulo próprio)",
    vistos.length > 0 && vistos.every((s) => codigoDe(s.id) === esperado.get(s.id)),
    vistos.map((s) => `${s.d}=${codigoDe(s.id)}`).join(" "));

  // ---------------------------------------------------------------- 7. controle
  await abrirNovo(pidSessao, "2026-09-18T10:00");
  check("paciente 'a cada sessão': sem pergunta de sequência", !(await janela().getByTestId("pergunta-sequencia").isVisible().catch(() => false)));
  await page.keyboard.press("Escape");

  check("sem erro no console do navegador", errosConsole.length === 0, errosConsole.slice(0, 2).join(" | "));
} catch (e) {
  check("percurso chegou ao fim", false, String(e).slice(0, 200));
} finally {
  // ---------------------------------------------------------------- 8. limpeza
  for (const c of criados) await sql`DELETE FROM patients WHERE id = ${c.id} AND name = ${c.nome} AND user_id = ${qa.id}`;
  const ids = criados.map((c) => c.id);
  const [{ n }] = ids.length ? await sql`SELECT COUNT(*)::int n FROM therapy_sessions WHERE patient_id = ANY(${ids})` : [{ n: 0 }];
  check("limpeza: pacientes e sessões apagados", n === 0);
  await nav.close();
}

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo no app de verdade");
process.exit(falhas ? 1 : 0);

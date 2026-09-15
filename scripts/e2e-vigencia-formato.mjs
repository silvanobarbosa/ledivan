// A REGRA DO DONO, NO APP DE VERDADE: trocar o formato vale a partir da data escolhida.
//
// Teste unitário prova o motor; este prova o CAMINHO — formulário → ação → banco → Fechamento →
// agenda. É o caminho que já escondeu defeito aqui antes (a hora que andava 3h só existia em
// produção; a dívida inventada tinha 24 testes verdes).
//
// Percurso, com a conta de QA (tudo pertence a ela, e sai no fim):
//   1. cadastra um paciente GRATUITO com início em 01/08/2026;
//   2. dá a ele 4 sessões realizadas em agosto e 2 em setembro (direto no banco — a agenda não é o
//      que está em teste aqui);
//   3. pela TELA de edição, troca para "A cada sessão", R$ 200, valendo a partir de 01/09/2026;
//   4. confere no banco a vigência gravada;
//   5. confere na Fechamento: agosto R$ 0, setembro R$ 400 (as duas sessões de setembro);
//   6. confere o rótulo que a agenda recebe: GRAT em agosto, AVUL em setembro;
//   7. apaga o paciente (cascata leva sessões e históricos).
//
// Uso: node scripts/e2e-vigencia-formato.mjs        (servidor em http://localhost:3000)

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
const NOME = `Vigencia QA ${marca}`;
let pacienteId = null;

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1440, height: 1000 }, storageState: fs.existsSync(SESSAO) ? SESSAO : undefined });
const page = await ctx.newPage();
const errosConsole = [];
page.on("console", (m) => { if (m.type() === "error") errosConsole.push(m.text().slice(0, 160)); });

try {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
  check("sessão de QA válida", !page.url().includes("/login"), page.url());
  if (page.url().includes("/login")) throw new Error("sessão expirada — rode e2e-escrita.mjs com a senha para renovar");

  // ---------------------------------------------------------------- 1. cadastro
  await page.goto(`${BASE}/dashboard/patients/new`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector('input[name="name"]', { timeout: 60000 });
  await page.fill('input[name="name"]', NOME);
  // As abas escondem com `hidden`: os campos estão no DOM, então preenche direto.
  await page.evaluate(() => {
    const ini = document.querySelector('input[name="startedAt"]');
    if (ini) { ini.value = "2026-08-01"; ini.dispatchEvent(new Event("input", { bubbles: true })); }
    const grat = document.querySelector('input[name="paymentFormat"][value="gratuito"]');
    grat?.click();
  });
  await page.click('button:has-text("Cadastrar paciente")');
  await page.waitForURL((u) => /\/dashboard\/patients\/[0-9a-f-]{36}$/.test(u.pathname), { timeout: 60000 }).catch(() => {});
  pacienteId = (page.url().match(/patients\/([0-9a-f-]{36})/) || [])[1] ?? null;
  check("cadastrou o paciente", !!pacienteId, page.url());
  if (!pacienteId) throw new Error("sem paciente, sem percurso");

  const [pac] = await sql`SELECT user_id, payment_format FROM patients WHERE id = ${pacienteId}`;
  check("nasceu gratuito", pac?.payment_format === "gratuito", pac?.payment_format);
  const vig0 = await sql`SELECT formato FROM patient_payment_format_history WHERE patient_id = ${pacienteId}`;
  check("o cadastro gravou a primeira vigência", vig0.length === 1 && vig0[0].formato === "gratuito", JSON.stringify(vig0));

  // ---------------------------------------------------------------- 2. sessões
  const datas = ["2026-08-04", "2026-08-11", "2026-08-18", "2026-08-25", "2026-09-01", "2026-09-08"];
  const sessoes = [];
  for (const d of datas) {
    const [s] = await sql`INSERT INTO therapy_sessions (user_id, patient_id, date, status)
                          VALUES (${pac.user_id}, ${pacienteId}, ${`${d} 09:00:00`}, 'realizada') RETURNING id`;
    sessoes.push({ id: s.id, d });
  }
  check("6 sessões realizadas no banco", sessoes.length === 6);

  // ---------------------------------------------------------------- 3. troca pela tela
  await page.goto(`${BASE}/dashboard/patients/${pacienteId}/edit`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector('input[name="paymentFormat"][value="sessao"]', { state: "attached", timeout: 60000 });
  // Age como uma pessoa: abre a aba Financeiro e clica no CARTÃO do formato. Clicar no rádio
  // dentro de uma aba fechada muda o DOM mas a tela não reage — foi o que as duas primeiras
  // rodadas deste teste mostraram, e uma sonda passo a passo confirmou que o defeito era do teste.
  await page.waitForTimeout(4000);
  await page.locator('button:has-text("Financeiro")').first().click();
  let temCampoData = false;
  for (const limite = Date.now() + 30000; Date.now() < limite && !temCampoData; ) {
    await page.locator('label:has-text("A cada sessão")').first().click().catch(() => {});
    await page.waitForTimeout(900);
    temCampoData = (await page.locator('input[name="formatoDesde"]').count()) > 0;
  }
  check("ao trocar o formato, a tela pergunta 'Vale a partir de'", temCampoData);
  await page.evaluate(() => {
    const set = (sel, v) => {
      const el = document.querySelector(sel);
      if (!el) return;
      const proto = Object.getPrototypeOf(el);
      Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
    };
    set('input[name="formatoDesde"]', "2026-09-01");
    set('input[name="sessionFee"]', "200");
  });
  await page.screenshot({ path: "_visual/vigencia-troca.png", fullPage: false });
  // Clica no botão de SALVAR pelo texto exato — um script anterior clicou em "Excluir paciente".
  await page.locator('button[type="submit"]:has-text("Salvar alterações")').click();
  await page.waitForURL((u) => !u.pathname.endsWith("/edit"), { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(1500);

  // ---------------------------------------------------------------- 4. banco
  const [depois] = await sql`SELECT payment_format, session_fee FROM patients WHERE id = ${pacienteId}`;
  check("o cadastro passou a 'sessao' com R$ 200", depois?.payment_format === "sessao" && Number(depois?.session_fee) === 200, JSON.stringify(depois));
  const vig = await sql`SELECT formato, to_char(data_efetiva, 'YYYY-MM-DD') d FROM patient_payment_format_history
                        WHERE patient_id = ${pacienteId} ORDER BY data_efetiva, data_criacao`;
  check("vigência: gratuito desde 01/08, sessão desde 01/09",
    vig.length === 2 && vig[0].formato === "gratuito" && vig[1].formato === "sessao" && vig[1].d === "2026-09-01",
    JSON.stringify(vig));
  const precos = await sql`SELECT valor, to_char(data_efetiva, 'YYYY-MM-DD') d FROM patient_price_history
                           WHERE patient_id = ${pacienteId} ORDER BY data_efetiva`;
  console.log("       preços gravados:", JSON.stringify(precos));

  // ---------------------------------------------------------------- 5. Fechamento
  async function linhaDaFechamento(mes) {
    await page.goto(`${BASE}/dashboard/fechamento?ano=2026&mes=${mes}`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForTimeout(2500);
    return page.evaluate((nome) => {
      const alvo = Array.from(document.querySelectorAll("tr, li, [data-paciente], div"))
        .filter((el) => el.textContent?.includes(nome))
        .sort((a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0))[0];
      return (alvo?.closest("tr") ?? alvo)?.textContent?.replace(/\s+/g, " ").trim() ?? "";
    }, NOME);
  }
  const ago = await linhaDaFechamento(8);
  const set = await linhaDaFechamento(9);
  console.log("       agosto  :", ago.slice(0, 200));
  console.log("       setembro:", set.slice(0, 200));
  check("agosto (gratuito) NÃO cobra — nada de R$ 800", !/800/.test(ago) && !/a receber/i.test(ago), ago.slice(0, 90));
  check("setembro cobra as duas sessões: R$ 400", /400/.test(set), set.slice(0, 90));
  await page.screenshot({ path: "_visual/vigencia-fechamento-set.png", fullPage: false });

  // ---------------------------------------------------------------- 6. agenda
  await page.goto(`${BASE}/dashboard/agenda`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(2500);
  const html = (await page.content()).replace(/\\"/g, '"');
  const codigoDe = (id) => {
    const i = html.indexOf(`"id":"${id}"`);
    if (i < 0) return "(fora da janela)";
    const trecho = html.slice(i, i + 2000);
    return (trecho.match(/"codigo":"([^"]*)"/) || [])[1] ?? "(sem codigo)";
  };
  const rotulos = sessoes.map((s) => `${s.d}=${codigoDe(s.id)}`);
  console.log("       rótulos na agenda:", rotulos.join("  "));
  check("agosto aparece como GRAT na agenda", sessoes.slice(0, 4).every((s) => codigoDe(s.id) === "GRAT"));
  check("setembro aparece como AVUL na agenda", sessoes.slice(4).every((s) => codigoDe(s.id) === "AVUL"));

  check("sem erro no console do navegador", errosConsole.length === 0, errosConsole.slice(0, 2).join(" | "));
} catch (e) {
  check("percurso chegou ao fim", false, String(e).slice(0, 200));
} finally {
  // ---------------------------------------------------------------- 7. limpeza
  if (pacienteId) {
    await sql`DELETE FROM patients WHERE id = ${pacienteId} AND name = ${NOME}`;
    const [{ n }] = await sql`SELECT COUNT(*)::int n FROM therapy_sessions WHERE patient_id = ${pacienteId}`;
    check("limpeza: paciente e sessões apagados", n === 0);
  }
  await nav.close();
}

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo no app de verdade");
process.exit(falhas ? 1 : 0);

// A GUIA GERAL E O "LANÇAR PAGAMENTO", NO APP DE VERDADE (especificação do dono, 15/09/2026).
//
// Percurso, com a conta de QA (tudo pertence a ela, e sai no fim):
//   1. paciente MENSAL completo, R$ 130, vigência desde 01/08, quatro terças de setembro e uma
//      AVUL de R$ 150 em 10/09 — direto no banco;
//   2. abre o paciente, clica na guia "Geral";
//   3. confere a ordem: Pagamento R$ 520 → 1/4 → 2/4 → AVUL R$ 150 → 3/4 → 4/4, e a data do
//      pagamento em branco (__/__/__);
//   4. "Lançar pagamento" na linha do pacote: data 03/09, responsável "Mãe QA", PIX;
//   5. confere no banco: R$ 520 com a chave da cobrança, quem pagou, forma, e a transação no caixa;
//   6. confere na tela: Pago, 03/09/26, Mãe QA, PIX; a AVUL continua com o botão;
//   7. lança a AVUL em dinheiro; confere R$ 150 com sessionId preenchido;
//   8. apaga as transações criadas e o paciente (cascata leva sessões, pagamentos e vigências).
//
// Uso: node scripts/e2e-guia-geral.mjs        (servidor em http://localhost:3000)

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
const NOME = `Geral QA ${marca}`;
let pid = null;

const [qa] = await sql`SELECT id FROM "user" WHERE email = 'qa.ledivan@reverblabs.com.br'`;
if (!qa) { console.log("conta de QA não encontrada"); process.exit(1); }

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1440, height: 1000 }, storageState: fs.existsSync(SESSAO) ? SESSAO : undefined });
const page = await ctx.newPage();
const errosConsole = [];
page.on("console", (m) => { if (m.type() === "error") errosConsole.push(m.text().slice(0, 160)); });

const lerTabela = () =>
  page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-testid="guia-geral"] tbody tr'))
      .filter((tr) => tr.querySelectorAll("td").length >= 3)
      .map((tr) => Array.from(tr.querySelectorAll("td")).map((td) => td.textContent.replace(/\s+/g, " ").trim())),
  );

async function abrirGeral() {
  await page.goto(`${BASE}/dashboard/patients/${pid}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(3000);
  await page.getByRole("button", { name: "Geral", exact: true }).click();
  await page.waitForSelector('[data-testid="guia-geral"]', { timeout: 30000 });
}

try {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
  if (page.url().includes("/login")) throw new Error("sessão de QA expirada — rode e2e-escrita.mjs com a senha para renovar");

  // ---------------------------------------------------------------- 1. dados
  [{ id: pid }] = await sql`INSERT INTO patients (user_id, name, payment_format, pacote_tipo, session_fee, started_at)
                            VALUES (${qa.id}, ${NOME}, 'mensal', 'completo', '130.00', '2026-08-01') RETURNING id`;
  await sql`INSERT INTO patient_payment_format_history (patient_id, formato, pacote_tipo, data_efetiva) VALUES (${pid}, 'mensal', 'completo', '2026-08-01')`;
  await sql`INSERT INTO patient_price_history (patient_id, valor, data_efetiva) VALUES (${pid}, '130.00', '2026-08-01')`;
  for (const d of ["2026-09-01", "2026-09-08", "2026-09-15", "2026-09-22"]) {
    await sql`INSERT INTO therapy_sessions (user_id, patient_id, date, status) VALUES (${qa.id}, ${pid}, ${`${d} 09:00:00`}, 'realizada')`;
  }
  const [{ id: avulId }] = await sql`INSERT INTO therapy_sessions (user_id, patient_id, date, status, extra, valor_extra, is_online)
                                      VALUES (${qa.id}, ${pid}, '2026-09-10 10:00:00', 'realizada', 'avul', '150.00', true) RETURNING id`;

  // ---------------------------------------------------------------- 2-3. a guia
  await abrirGeral();
  let t = await lerTabela();
  console.log("       tabela:", t.map((r) => r.slice(0, 3).join(" | ")).join("  //  "));
  const col2 = t.map((r) => r[1].replace(/ ·.*$/, "").replace(/\d+ sess(ão|ões).*/, "").trim());
  check("ordem: Pagamento → 1/4 → 2/4 → AVUL → 3/4 → 4/4",
    JSON.stringify(col2.map((x) => (x.startsWith("Pagamento") ? "Pagamento" : x))) === JSON.stringify(["Pagamento", "1/4", "2/4", "AVUL", "3/4", "4/4"]), JSON.stringify(col2));
  check("pagamento do pacote: R$ 520,00", /520,00/.test(t[0][2]), t[0][2]);
  check("pagamento sem data até ser pago: __/__/__", t[0][0] === "__/__/__", t[0][0]);
  check("AVUL: R$ 150,00 na linha dela", /150,00/.test(t[3][2]), t[3][2]);
  check("AVUL online traz o ícone", await page.locator(`tr[data-sessao="${avulId}"] [aria-label="online"]`).count() === 1);
  await page.screenshot({ path: "_visual/geral-antes.png", fullPage: true });

  // ---------------------------------------------------------------- 4. lança o pacote
  const linhaPacote = page.locator("tr[data-chave^='pacote:']").first();
  await linhaPacote.getByRole("button", { name: "Lançar pagamento" }).click();
  const form = page.getByTestId("lancar-pagamento");
  await form.locator('input[name="data"]').fill("2026-09-03");
  await form.locator('input[name="pagoPor"]').fill("Mãe QA");
  await form.locator('select[name="metodo"]').selectOption("pix");
  check("o botão de confirmar mostra o valor que vai gravar", /520,00/.test(await form.getByRole("button", { name: /Confirmar/ }).innerText()));
  await form.getByRole("button", { name: /Confirmar/ }).click();
  await page.waitForTimeout(4000);

  // ---------------------------------------------------------------- 5. banco
  const pg = await sql`SELECT amount, method, pago_por, cobranca_chave, session_id, linked_transaction_id, to_char(date, 'YYYY-MM-DD') d
                       FROM session_payments WHERE patient_id = ${pid} ORDER BY created_at`;
  console.log("       pagamentos:", JSON.stringify(pg));
  check("gravou R$ 520, PIX, Mãe QA, 03/09, com a chave do pacote",
    pg.length === 1 && Number(pg[0].amount) === 520 && pg[0].method === "pix" && pg[0].pago_por === "Mãe QA" && pg[0].d === "2026-09-03" && /^pacote:/.test(pg[0].cobranca_chave ?? ""));
  const [tx] = pg[0]?.linked_transaction_id ? await sql`SELECT amount, type FROM transactions WHERE id = ${pg[0].linked_transaction_id}` : [];
  check("entrou no caixa como receita", tx && Number(tx.amount) === 520 && tx.type === "income", JSON.stringify(tx));

  // ---------------------------------------------------------------- 6. tela
  await abrirGeral();
  t = await lerTabela();
  check("linha do pacote: Pago, 03/09/26, Mãe QA, PIX", t[0][0] === "03/09/26" && t[0][3] === "Pago" && t[0][4] === "03/09/26" && t[0][5] === "Mãe QA" && t[0][6] === "PIX", JSON.stringify(t[0]));
  check("AVUL continua a lançar", await page.locator(`tr[data-sessao="${avulId}"]`).getByRole("button", { name: "Lançar pagamento" }).count() === 1);

  // ---------------------------------------------------------------- 7. lança a AVUL
  await page.locator(`tr[data-sessao="${avulId}"]`).getByRole("button", { name: "Lançar pagamento" }).click();
  const f2 = page.getByTestId("lancar-pagamento");
  await f2.locator('select[name="metodo"]').selectOption("cash");
  check("responsável sugerido é o nome do paciente (sem responsável no cadastro)", (await f2.locator('input[name="pagoPor"]').inputValue()) === NOME);
  await f2.getByRole("button", { name: /Confirmar/ }).click();
  await page.waitForTimeout(4000);
  const [av] = await sql`SELECT amount, method, session_id FROM session_payments WHERE patient_id = ${pid} AND cobranca_chave = ${`extra:${avulId}`}`;
  check("AVUL: R$ 150 em dinheiro, com a sessão vinculada", av && Number(av.amount) === 150 && av.method === "cash" && av.session_id === avulId, JSON.stringify(av));
  await abrirGeral();
  t = await lerTabela();
  check("AVUL aparece paga", t[3][3] === "Pago", JSON.stringify(t[3]));
  await page.screenshot({ path: "_visual/geral-depois.png", fullPage: true });

  check("sem erro no console do navegador", errosConsole.length === 0, errosConsole.slice(0, 2).join(" | "));
} catch (e) {
  check("percurso chegou ao fim", false, String(e).slice(0, 300));
} finally {
  // ---------------------------------------------------------------- 8. limpeza
  if (pid) {
    const txs = await sql`SELECT linked_transaction_id id FROM session_payments WHERE patient_id = ${pid} AND linked_transaction_id IS NOT NULL`;
    await sql`DELETE FROM patients WHERE id = ${pid} AND name = ${NOME} AND user_id = ${qa.id}`;
    for (const x of txs) await sql`DELETE FROM transactions WHERE id = ${x.id} AND user_id = ${qa.id}`;
    const [{ n }] = await sql`SELECT COUNT(*)::int n FROM therapy_sessions WHERE patient_id = ${pid}`;
    const ids = txs.map((x) => x.id);
    const [{ m }] = ids.length ? await sql`SELECT COUNT(*)::int m FROM transactions WHERE id = ANY(${ids})` : [{ m: 0 }];
    check("limpeza: paciente, sessões, pagamentos e transações apagados", n === 0 && m === 0, `sessões=${n} transações=${m}`);
  }
  await nav.close();
}

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo no app de verdade");
process.exit(falhas ? 1 : 0);

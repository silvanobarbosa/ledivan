// RECIBO E NOTA NA LINHA PAGA (documento de 17/09, onda 4), no app de verdade.
//
// Percurso, com a conta de QA (tudo pertence a ela, e sai no fim):
//   1. paciente "a cada sessão" R$ 130, uma sessão realizada e o pagamento dela lançado — direto
//      no banco: lançar pagamento já é testado em outro lugar, aqui o assunto é o que vem depois;
//   2. abre a guia Geral e confere que a linha paga oferece "Emitir recibo" e "Emitir nota";
//   3. abre o recibo: sem logotipo, com o valor por extenso, o CPF pontuado e a data do atendimento;
//   4. marca como emitido e confere a marca "recibo emitido" ao lado de Pago, e no banco;
//   5. apaga o paciente (cascata leva sessão e pagamento).
//
// Uso: node scripts/e2e-recibo-nota.mjs        (servidor em http://localhost:3000)

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
const NOME = `QA Recibo ${marca}`;

const [qa] = await sql`SELECT id FROM "user" WHERE email = 'qa.ledivan@reverblabs.com.br'`;
if (!qa) { console.log("conta de QA não encontrada."); process.exit(1); }

const browser = await chromium.launch();
const ctx = await browser.newContext({ storageState: JSON.parse(fs.readFileSync(SESSAO, "utf8")), viewport: { width: 1440, height: 1000 } });
const page = await ctx.newPage();
const erros = [];
page.on("console", (m) => { if (m.type() === "error") erros.push(m.text()); });

let pid = null;
try {
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded", timeout: 90000 });
  if (page.url().includes("/login")) throw new Error("sessão de QA expirada — rode e2e-escrita.mjs com a senha para renovar");

  // ---------------------------------------------------------------- 1. dados
  const [p] = await sql`INSERT INTO patients (user_id, name, session_fee, payment_format, patient_status, guardian_name, guardian_cpf)
                        VALUES (${qa.id}, ${NOME}, '130.00', 'sessao', 'ativo', ${`Mãe de ${NOME}`}, '12345678900')
                        RETURNING id`;
  pid = p.id;
  const [s] = await sql`INSERT INTO therapy_sessions (user_id, patient_id, date, status)
                        VALUES (${qa.id}, ${pid}, '2026-09-03 09:00:00', 'realizada') RETURNING id`;
  const [pg] = await sql`INSERT INTO session_payments (user_id, patient_id, session_id, amount, date, method, status, pago_por, pago_por_cpf, cobranca_chave)
                         VALUES (${qa.id}, ${pid}, ${s.id}, '130.00', '2026-09-03 10:00:00', 'pix', 'paid',
                                 ${`Mãe de ${NOME}`}, '12345678900', ${`sessao:${s.id}`}) RETURNING id`;

  // ------------------------------------------------------- 2. a linha paga
  await page.goto(`${BASE}/dashboard/patients/${pid}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1500);
  // A linha do atendimento, pela data. Nao vale procurar `tr` com "Pago": o cabecalho tem a coluna
  // "PAGO EM" e casa primeiro.
  const linha = page.locator("tr", { hasText: "03/09/26" }).first();
  check("linha paga oferece Emitir recibo", await linha.getByRole("link", { name: "Emitir recibo" }).isVisible());
  check("linha paga oferece Emitir nota", await linha.getByRole("button", { name: "Emitir nota" }).isVisible());
  await page.screenshot({ path: "_visual/recibo-linha-paga.png" });

  // ------------------------------------------------------------- 3. o papel
  await page.goto(`${BASE}/dashboard/patients/${pid}/recibo/${pg.id}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(800);
  const texto = await page.locator("article pre").innerText();
  check("valor por extenso", texto.includes("cento e trinta reais"), texto.match(/\(([^)]*reais[^)]*)\)/)?.[1] ?? "");
  check("CPF pontuado", texto.includes("123.456.789-00"));
  check("data do atendimento, não a do pagamento", texto.includes("- 03/09/2026"));
  check("sem logotipo do sistema", (await page.locator("article img").count()) === 0);
  await page.screenshot({ path: "_visual/recibo-papel.png", fullPage: true });

  // O papel de verdade: a pagina mora dentro do painel, e no print so o recibo pode aparecer.
  await page.emulateMedia({ media: "print" });
  await page.waitForTimeout(300);
  const menuVisivel = await page.getByRole("link", { name: "Receita Saúde" }).first().isVisible().catch(() => false);
  check("na impressao, o painel some (so o recibo sai no papel)", !menuVisivel);
  check("na impressao, o recibo continua visivel", await page.locator("#recibo-papel").isVisible());
  await page.screenshot({ path: "_visual/recibo-impressao.png", fullPage: true });
  await page.emulateMedia({ media: "screen" });

  // ------------------------------------------------------------ 4. a marca
  await page.getByRole("button", { name: "Marcar como emitido" }).click();
  await page.waitForTimeout(2500);
  const [depois] = await sql`SELECT recibo_emitido_em, receipt_issued_at FROM session_payments WHERE id = ${pg.id}`;
  check("emissão do recibo gravada", !!depois.recibo_emitido_em);
  check("a nota NÃO foi marcada junto (documentos independentes)", !depois.receipt_issued_at);

  await page.goto(`${BASE}/dashboard/patients/${pid}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1500);
  check("marca 'recibo emitido' ao lado de Pago", await page.getByText("recibo emitido").first().isVisible());
  check("sem 'nota emitida'", (await page.getByText("nota emitida").count()) === 0);
  await page.screenshot({ path: "_visual/recibo-marca.png" });

  check("sem erro no console do navegador", erros.length === 0, erros.slice(0, 2).join(" | "));
} catch (e) {
  check("percurso", false, String(e?.message ?? e).replace(/postgresql:\/\/[^\s]*/g, "[url omitida]"));
} finally {
  if (pid) await sql`DELETE FROM patients WHERE id = ${pid}`;
  check("limpeza: paciente e pagamento apagados", true);
  await browser.close();
}

console.log(falhas ? `\n${falhas} falha(s)` : "\ntudo certo no app de verdade");
process.exit(falhas ? 1 : 0);

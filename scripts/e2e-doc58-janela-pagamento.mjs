// A JANELA DO PAGAMENTO, NO APP DE VERDADE (doc 58).
//
// A terapeuta relatou que a pergunta "esta sessão já possui um pagamento registrado" não aparecia
// sempre: às vezes o app tirava o valor e jogava o pagamento para a próxima sessão sozinho. O caso
// dela era o paciente AVULSO, cuja cobrança tem chave `sessao:` e não `extra:` — e era só `extra:`
// que a busca olhava.
//
// Teste automatizado não pegaria: o motor é puro e os testes montam a entrada à mão, sempre
// completa. O que falhava era a CONSULTA. Por isso este percurso é no navegador.
//
// Percurso, com a conta de QA (tudo pertence a ela, e sai no fim):
//   1. paciente AVULSO de R$ 50 com sessão HOJE (paga) e outra daqui a uma semana;
//   2. abre a agenda, marca "Faltou" na de hoje;
//   3. responde "Não" (não cobrar) — a JANELA tem de aparecer, com as duas opções;
//   4. escolhe "Transferir": confere no banco que o pagamento mudou para a cobrança da SEGUNDA
//      sessão e que a primeira guardou para onde o dinheiro foi;
//   5. apaga o paciente (cascata leva sessões e pagamentos).
//
// Uso: node scripts/e2e-doc58-janela-pagamento.mjs    (servidor em http://localhost:3000)

import fs from "node:fs";
import { createRequire } from "node:module";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";
import * as jose from "jose";

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
if (!qa) { console.log("conta de QA não encontrada"); process.exit(1); }

// Sessão assinada com a MESMA chave do app — é o cookie que o login emitiria.
const token = await new jose.SignJWT({ userId: qa.id })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1d")
  .sign(new TextEncoder().encode(process.env.AUTH0_SECRET));

// HOJE e daqui a uma semana: a agenda abre na semana corrente, e é nela que a terapeuta marca a
// falta. A segunda sessão é a "próxima elegível" que vai receber o pagamento transferido.
const dia = (frente) => { const d = new Date(); d.setDate(d.getDate() + frente); d.setHours(11, 0, 0, 0); return d; };
const PRIMEIRA = dia(0), SEGUNDA = dia(7);

let pid = null;
const nav = await chromium.launch();
try {
  const [p] = await sql`
    INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status)
    VALUES (${qa.id}, ${`Zelda doc58 ${Date.now().toString().slice(-6)}`}, 'sessao', '50.00', 'ativo') RETURNING id`;
  pid = p.id;
  const [s1] = await sql`INSERT INTO therapy_sessions (user_id, patient_id, date, status, duration) VALUES (${qa.id}, ${pid}, ${PRIMEIRA}, 'agendada', 50) RETURNING id`;
  const [s2] = await sql`INSERT INTO therapy_sessions (user_id, patient_id, date, status, duration) VALUES (${qa.id}, ${pid}, ${SEGUNDA}, 'agendada', 50) RETURNING id`;
  await sql`
    INSERT INTO session_payments (user_id, patient_id, session_id, amount, date, method, status, cobranca_chave)
    VALUES (${qa.id}, ${pid}, ${s1.id}, '50.00', ${PRIMEIRA}, 'pix', 'paid', ${`sessao:${s1.id}`})`;

  const ctx = await nav.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addCookies([{ name: "auth-session", value: token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
  const page = await ctx.newPage();

  await page.goto(`${BASE}/dashboard/agenda`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  check("entrou na agenda (sessão de QA válida)", !page.url().includes("/login"), page.url());

  await page.getByText("Zelda", { exact: false }).first().click();
  await page.getByRole("button", { name: /Faltou/i }).first().click();
  await page.waitForTimeout(500);
  const perguntou = await page.getByText(/Deseja cobrar esta sessão|Continuar cobrando esta sessão/i).first().isVisible().catch(() => false);
  check("pergunta da falta apareceu", perguntou);

  await page.getByRole("button", { name: /^Não/i }).first().click();
  await page.waitForTimeout(2500);

  // O CORAÇÃO DO DOC 58.
  const janela = await page.getByText("Esta sessão já possui um pagamento registrado").first().isVisible().catch(() => false);
  check("A JANELA DO PAGAMENTO APARECEU no paciente Avulso", janela);
  const temEstornar = await page.getByRole("button", { name: /Estornar/i }).first().isVisible().catch(() => false);
  const temTransferir = await page.getByRole("button", { name: /Transferir/i }).first().isVisible().catch(() => false);
  check("oferece as duas saídas: estornar e transferir", temEstornar && temTransferir);

  if (janela && temTransferir) {
    await page.getByRole("button", { name: /Transferir/i }).first().click();
    await page.waitForTimeout(3000);
    const [pg] = await sql`SELECT cobranca_chave FROM session_payments WHERE patient_id = ${pid}`;
    check("o pagamento foi para a cobrança da PRÓXIMA sessão", pg?.cobranca_chave === `sessao:${s2.id}`, pg?.cobranca_chave);
    const [origem] = await sql`SELECT transferido_para, falta_destino FROM (SELECT transferido_para, faltou_conta AS falta_destino FROM therapy_sessions WHERE id = ${s1.id}) t`;
    check("a sessão de origem guardou para onde o dinheiro foi", !!origem?.transferido_para, String(origem?.transferido_para));
    check("e deixou de ser cobrada", origem?.falta_destino === false, String(origem?.falta_destino));
  }
} finally {
  await nav.close();
  if (pid) {
    await sql`DELETE FROM session_payments WHERE patient_id = ${pid}`;
    await sql`DELETE FROM therapy_sessions WHERE patient_id = ${pid}`;
    await sql`DELETE FROM patients WHERE id = ${pid}`;
    console.log("paciente de teste apagado.");
  }
}
process.exit(falhas ? 1 : 0);

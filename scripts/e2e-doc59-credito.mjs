// O CRÉDITO E A EXCLUSÃO DO PAGAMENTO, NO APP DE VERDADE (doc 59).
//
// Duas coisas que só acontecem com alguém logado, e por isso não dá para conferir só no motor:
//
//   1. REMOVER a aplicação automática do crédito. O documento permite mover o crédito "de um lugar
//      para colocar em outro" — e, como ele agora anda sozinho, sem uma trava ele voltaria à mesma
//      cobrança no instante seguinte, e mover seria impossível.
//   2. REMOVER um pagamento que deixou marcas. "Como se ele nunca tivesse existido": a sessão de
//      ORIGEM da transferência tem de parar de anunciar para onde foi um dinheiro que já não está
//      em lugar nenhum.
//
// Percurso, com a conta de QA (tudo pertence a ela, e sai no fim):
//   1. paciente AVULSO com sessão antiga convertida em GRAT e crédito já aplicado na sessão nova;
//   2. abre a guia Geral e remove o lançamento "Crédito do saldo";
//   3. confere: o crédito voltou ao saldo, marcado para NÃO voltar sozinho, e a sessão de origem
//      volta a dizer que o crédito espera;
//   4. um segundo paciente com pagamento TRANSFERIDO: remove o pagamento e confere que a marca na
//      sessão de origem sumiu junto;
//   5. apaga os dois.
//
// Uso: node scripts/e2e-doc59-credito.mjs    (servidor em http://localhost:3000)

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
const token = await new jose.SignJWT({ userId: qa.id })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1d")
  .sign(new TextEncoder().encode(process.env.AUTH0_SECRET));

const dia = (frente) => { const d = new Date(); d.setDate(d.getDate() + frente); d.setHours(11, 0, 0, 0); return d; };
const marca = Date.now().toString().slice(-6);
const nav = await chromium.launch();
const criados = [];

const novoPaciente = async (nome) => {
  const [p] = await sql`
    INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status)
    VALUES (${qa.id}, ${nome}, 'sessao', '50.00', 'ativo') RETURNING id`;
  criados.push(p.id);
  return p.id;
};

try {
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 1200 } });
  await ctx.addCookies([{ name: "auth-session", value: token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());

  // ---- 1. CRÉDITO JÁ APLICADO, e a terapeuta quer movê-lo.
  const pid = await novoPaciente(`Credito doc59 ${marca}`);
  const [a] = await sql`
    INSERT INTO therapy_sessions (user_id, patient_id, date, status, duration, faltou_conta, credito_valor, credito_usado_em)
    VALUES (${qa.id}, ${pid}, ${dia(-7)}, 'nao_realizada', 50, false, '50.00', ${dia(7)}) RETURNING id`;
  const [b] = await sql`
    INSERT INTO therapy_sessions (user_id, patient_id, date, status, duration)
    VALUES (${qa.id}, ${pid}, ${dia(7)}, 'agendada', 50) RETURNING id`;
  const [origem] = await sql`
    INSERT INTO session_payments (user_id, patient_id, session_id, amount, date, method, status, cobranca_chave, estornado_em)
    VALUES (${qa.id}, ${pid}, ${a.id}, '50.00', ${dia(-7)}, 'pix', 'paid', ${`sessao:${a.id}`}, now()) RETURNING id`;
  const [aplicado] = await sql`
    INSERT INTO session_payments (user_id, patient_id, session_id, amount, date, method, status, cobranca_chave, kind)
    VALUES (${qa.id}, ${pid}, ${b.id}, '50.00', ${dia(-7)}, 'pix', 'paid', ${`sessao:${b.id}`}, 'credito') RETURNING id`;
  await sql`
    INSERT INTO patient_credits (user_id, patient_id, valor, origem_pagamento_id, consumido_pagamento_id, consumido_em)
    VALUES (${qa.id}, ${pid}, '50.00', ${origem.id}, ${aplicado.id}, now())`;

  await page.goto(`${BASE}/dashboard/patients/${pid}?tab=geral`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  check("entrou na guia Geral", !page.url().includes("/login"), page.url());
  check("a sessão de origem diz que o crédito foi utilizado",
    (await page.innerText("body")).includes("Crédito desta sessão foi utilizado na sessão do dia"));

  const linhaCredito = page.locator("div", { hasText: /Crédito do saldo/ }).last();
  await linhaCredito.getByRole("button", { name: /Remover este pagamento/i }).first().click();
  await page.waitForTimeout(3000);

  const sobrou = await sql`SELECT id FROM session_payments WHERE id = ${aplicado.id}`;
  check("o lançamento de crédito foi removido", sobrou.length === 0);
  const [credito] = await sql`SELECT consumido_em, nao_auto FROM patient_credits WHERE patient_id = ${pid}`;
  check("o crédito voltou ao saldo", credito?.consumido_em === null);
  check("e NÃO volta sozinho para o mesmo lugar", credito?.nao_auto === true, String(credito?.nao_auto));
  const [sessaoA] = await sql`SELECT credito_usado_em FROM therapy_sessions WHERE id = ${a.id}`;
  check("a origem volta a dizer que o crédito espera", sessaoA?.credito_usado_em === null);

  // ---- 2. PAGAMENTO TRANSFERIDO: removê-lo tem de limpar a marca da ORIGEM.
  //
  // Depois da transferência o pagamento aponta para o destino, e a sessão de origem guarda a data
  // para onde o dinheiro foi. Removido o pagamento, essa frase não pode sobreviver: ela apontaria
  // para um dinheiro que já não está em lugar nenhum.
  const pid2 = await novoPaciente(`Transferido doc59 ${marca}`);
  const [c] = await sql`
    INSERT INTO therapy_sessions (user_id, patient_id, date, status, duration, faltou_conta, transferido_para)
    VALUES (${qa.id}, ${pid2}, ${dia(-7)}, 'nao_realizada', 50, false, ${dia(7)}) RETURNING id`;
  const [d2] = await sql`
    INSERT INTO therapy_sessions (user_id, patient_id, date, status, duration)
    VALUES (${qa.id}, ${pid2}, ${dia(7)}, 'agendada', 50) RETURNING id`;
  const [pgTransferido] = await sql`
    INSERT INTO session_payments (user_id, patient_id, session_id, origem_sessao_id, amount, date, method, status, cobranca_chave)
    VALUES (${qa.id}, ${pid2}, ${d2.id}, ${c.id}, '50.00', ${dia(-7)}, 'pix', 'paid', ${`sessao:${d2.id}`}) RETURNING id`;

  await page.goto(`${BASE}/dashboard/patients/${pid2}?tab=geral`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  check("a origem diz para onde o pagamento foi",
    (await page.innerText("body")).includes("este pagamento foi transferido para a data"));

  await page.getByRole("button", { name: /Remover este pagamento/i }).first().click();
  await page.waitForTimeout(3000);

  const restou = await sql`SELECT id FROM session_payments WHERE id = ${pgTransferido.id}`;
  check("o pagamento sumiu", restou.length === 0);
  const [origemLimpa] = await sql`SELECT transferido_para FROM therapy_sessions WHERE id = ${c.id}`;
  check("e a marca na ORIGEM sumiu junto — como se nunca tivesse existido",
    origemLimpa?.transferido_para === null, String(origemLimpa?.transferido_para));
  await page.reload({ waitUntil: "networkidle" });
  check("a guia Geral não fala mais em transferência",
    !(await page.innerText("body")).includes("este pagamento foi transferido para a data"));
} finally {
  await nav.close();
  for (const pid of criados) {
    await sql`DELETE FROM patient_credits WHERE patient_id = ${pid}`;
    await sql`DELETE FROM session_payments WHERE patient_id = ${pid}`;
    await sql`DELETE FROM therapy_sessions WHERE patient_id = ${pid}`;
    await sql`DELETE FROM patients WHERE id = ${pid}`;
  }
  console.log("pacientes de teste apagados.");
}
process.exit(falhas ? 1 : 0);

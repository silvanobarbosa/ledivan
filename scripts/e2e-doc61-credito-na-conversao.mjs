// O CRÉDITO QUE PRECISA DE UM "SIM" (doc 61), NO APP DE VERDADE.
//
// O que o motor puro não consegue provar, porque o que muda é QUANDO se pergunta:
//
//   1. Converter uma GRAT em AVUL tendo saldo passa a PERGUNTAR se o crédito entra agora. Dito
//      "Não", ele não pode ser abatido pela aplicação automática do doc 59 — que roda no mesmo
//      instante, dentro da gravação do valor.
//   2. A pergunta VOLTA em cada "Lançar pagamento" enquanto sobrar crédito marcado.
//   3. Excluído o agendamento, o pagamento e a transação do caixa saem com ele. Sobrevivendo, o
//      pagamento perde a sessão mas guarda a chave, e a guia Geral o redistribui por vencimento:
//      ele vai abater sozinho a próxima cobrança do paciente (o caso da paciente Marcela).
//
// Uso: node scripts/e2e-doc61-credito-na-conversao.mjs    (servidor em http://localhost:3000)

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
// `formatBRL` usa Intl pt-BR, que separa "R$" do número com espaço NÃO-QUEBRÁVEL (doc 60).
const texto = async (page) => (await page.innerText("body")).replace(/\u00a0/g, " ");

const [qa] = await sql`SELECT id FROM "user" WHERE email = 'qa.ledivan@reverblabs.com.br'`;
if (!qa) { console.log("conta de QA não encontrada"); process.exit(1); }
const token = await new jose.SignJWT({ userId: qa.id })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1d")
  .sign(new TextEncoder().encode(process.env.AUTH0_SECRET));

const hoje = (() => { const d = new Date(); d.setHours(11, 0, 0, 0); return d; })();
const marca = Date.now().toString().slice(-6);
const nav = await chromium.launch();
const criados = [];

const gratuitoComCredito = async (nome, valorDoCredito) => {
  const [p] = await sql`
    INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status)
    VALUES (${qa.id}, ${nome}, 'gratuito', '0.00', 'ativo') RETURNING id`;
  criados.push(p.id);
  const [s] = await sql`
    INSERT INTO therapy_sessions (user_id, patient_id, date, status, duration)
    VALUES (${qa.id}, ${p.id}, ${hoje}, 'agendada', 50) RETURNING id`;
  await sql`INSERT INTO patient_credits (user_id, patient_id, valor) VALUES (${qa.id}, ${p.id}, ${valorDoCredito})`;
  return { pid: p.id, sid: s.id };
};

/** Abre a sessão na agenda e marca "Faltou", até a janela da pergunta do tipo. */
const marcarFaltou = async (page, primeiroNome) => {
  await page.goto(`${BASE}/dashboard/agenda`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await page.getByText(primeiroNome, { exact: false }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /Faltou/i }).first().click();
  await page.waitForTimeout(700);
};

try {
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 1200 } });
  await ctx.addCookies([{ name: "auth-session", value: token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());

  // ============ 1. CONVERSÃO COM "NÃO": o crédito fica parado, e a pergunta passa a voltar.
  const nomeA = `ZeldaNao${marca}`;
  const a = await gratuitoComCredito(nomeA, "50.00");

  await marcarFaltou(page, nomeA);
  await page.getByRole("button", { name: /^Sim/i }).first().click();
  await page.waitForTimeout(2500);
  check("a conversão pergunta pelo crédito do cadastro",
    (await texto(page)).includes("Este cadastro possui um crédito de R$ 50,00. Deseja utilizá-lo agora?"));

  await page.getByRole("button", { name: /^Não$/ }).first().click();
  await page.waitForTimeout(700);
  check("e segue para o valor da sessão", (await texto(page)).includes("Qual o valor desta sessão?"));
  await page.locator('input[aria-label="Valor da sessão"]').type("8000");
  await page.getByRole("button", { name: /^OK$/ }).first().click();
  await page.waitForTimeout(3000);

  const [sessaoA] = await sql`SELECT valor_extra FROM therapy_sessions WHERE id = ${a.sid}`;
  check("o valor digitado virou o valor da sessão", Number(sessaoA?.valor_extra) === 80, String(sessaoA?.valor_extra));
  const [credA] = await sql`SELECT valor, consumido_em, nao_auto, confirmar_abatimento FROM patient_credits WHERE patient_id = ${a.pid}`;
  check("o crédito NÃO foi abatido sozinho", credA?.consumido_em === null, String(credA?.consumido_em));
  check("e ficou marcado para pedir confirmação a cada lançamento",
    credA?.confirmar_abatimento === true && credA?.nao_auto === true, JSON.stringify(credA));
  const semPagamento = await sql`SELECT id FROM session_payments WHERE patient_id = ${a.pid}`;
  check("nenhum pagamento foi criado pela conversão", semPagamento.length === 0, String(semPagamento.length));

  // ---- A pergunta do lançamento, e a REPETIÇÃO dela (itens 2 e 3 do documento).
  await page.goto(`${BASE}/dashboard/patients/${a.pid}?tab=geral`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /Lançar pagamento/i }).first().click();
  await page.waitForTimeout(600);
  check("o lançamento pergunta se o crédito deve ser abatido",
    (await texto(page)).includes("Deseja abater o crédito de R$ 50,00 deste pagamento?"));

  await page.locator('[data-testid="perguntar-credito"]').getByRole("button", { name: /^Não$/ }).click();
  await page.waitForTimeout(500);
  const corpoSemCredito = await texto(page);
  check("dito Não, o formulário abre sem abater o saldo",
    corpoSemCredito.includes("Crédito no saldo: R$ 50,00") && corpoSemCredito.includes("não será abatido neste pagamento"));

  // Fecha e reabre: a pergunta VOLTA, porque o crédito continua lá.
  await page.getByRole("button", { name: /Fechar/i }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /Lançar pagamento/i }).first().click();
  await page.waitForTimeout(600);
  check("e a pergunta VOLTA no lançamento seguinte",
    (await texto(page)).includes("Deseja abater o crédito de R$ 50,00 deste pagamento?"));

  // Agora "Sim": o crédito abate, e o campo já nasce com o DINHEIRO que falta depois dele.
  await page.locator('[data-testid="perguntar-credito"]').getByRole("button", { name: /^Sim$/ }).click();
  await page.waitForTimeout(600);
  check("dito Sim, o crédito entra nesta cobrança",
    (await texto(page)).includes("R$ 50,00 será aplicado nesta cobrança"));
  check("e o campo pede só o dinheiro que falta",
    (await page.locator("#valor-pg").inputValue()).replace(/\u00a0/g, " ") === "R$ 30,00",
    await page.locator("#valor-pg").inputValue());

  await page.getByRole("button", { name: /^Confirmar/i }).first().click();
  await page.waitForTimeout(3500);

  const pagosA = await sql`
    SELECT amount, kind FROM session_payments WHERE patient_id = ${a.pid} ORDER BY amount`;
  check("dois lançamentos: R$ 30,00 em dinheiro e R$ 50,00 de crédito",
    pagosA.length === 2 && Number(pagosA[0].amount) === 30 && pagosA[0].kind === null
    && Number(pagosA[1].amount) === 50 && pagosA[1].kind === "credito", JSON.stringify(pagosA));
  const [credUsado] = await sql`SELECT consumido_em FROM patient_credits WHERE patient_id = ${a.pid}`;
  check("o crédito foi consumido", credUsado?.consumido_em !== null);

  await page.reload({ waitUntil: "networkidle" });
  const corpoPagoA = await texto(page);
  check("a guia Geral mostra a linha do Crédito do saldo", corpoPagoA.includes("Crédito do saldo"));
  check("e não há mais o que perguntar — o crédito acabou",
    !corpoPagoA.includes("Deseja abater o crédito"));

  // ============ 2. CONVERSÃO COM "SIM": o crédito abate a sessão que está nascendo.
  const nomeB = `ZeldaSim${marca}`;
  const b = await gratuitoComCredito(nomeB, "50.00");

  await marcarFaltou(page, nomeB);
  await page.getByRole("button", { name: /^Sim/i }).first().click();
  await page.waitForTimeout(2500);
  check("a pergunta do crédito aparece também aqui",
    (await texto(page)).includes("Deseja utilizá-lo agora?"));
  await page.getByRole("button", { name: /^Sim$/ }).first().click();
  await page.waitForTimeout(700);
  await page.locator('input[aria-label="Valor da sessão"]').type("5000");
  await page.getByRole("button", { name: /^OK$/ }).first().click();
  await page.waitForTimeout(3500);

  const pagosB = await sql`SELECT amount, kind FROM session_payments WHERE patient_id = ${b.pid}`;
  check("crédito igual ao valor da sessão: ela nasce quitada pelo saldo",
    pagosB.length === 1 && Number(pagosB[0].amount) === 50 && pagosB[0].kind === "credito", JSON.stringify(pagosB));
  const [credB] = await sql`SELECT consumido_em FROM patient_credits WHERE patient_id = ${b.pid}`;
  check("e o saldo foi consumido", credB?.consumido_em !== null);

  await page.goto(`${BASE}/dashboard/patients/${b.pid}?tab=geral`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  const corpoB = await texto(page);
  check("a guia Geral mostra R$ 50,00 · Crédito do saldo",
    corpoB.includes("Crédito do saldo") && corpoB.includes("R$ 50,00"));

  // ============ 2b. CRÉDITO MAIOR QUE A SESSÃO: usa só o necessário, e o resto continua marcado.
  const nomeD = `ZeldaSobra${marca}`;
  const d = await gratuitoComCredito(nomeD, "80.00");

  await marcarFaltou(page, nomeD);
  await page.getByRole("button", { name: /^Sim/i }).first().click();
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: /^Não$/ }).first().click();
  await page.waitForTimeout(700);
  await page.locator('input[aria-label="Valor da sessão"]').type("5000");
  await page.getByRole("button", { name: /^OK$/ }).first().click();
  await page.waitForTimeout(3000);

  await page.goto(`${BASE}/dashboard/patients/${d.pid}?tab=geral`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /Lançar pagamento/i }).first().click();
  await page.waitForTimeout(600);
  check("a pergunta traz o saldo inteiro",
    (await texto(page)).includes("Deseja abater o crédito de R$ 80,00 deste pagamento?"));
  await page.locator('[data-testid="perguntar-credito"]').getByRole("button", { name: /^Sim$/ }).click();
  await page.waitForTimeout(600);
  check("o crédito cobre a sessão inteira e não há dinheiro a receber",
    (await texto(page)).includes("Confirmar com o crédito (R$ 50,00)"));
  await page.getByRole("button", { name: /^Confirmar com o crédito/i }).first().click();
  await page.waitForTimeout(3500);

  const pagosD = await sql`SELECT amount, kind, linked_transaction_id FROM session_payments WHERE patient_id = ${d.pid}`;
  check("um lançamento só, de crédito, e nada entrou no caixa",
    pagosD.length === 1 && pagosD[0].kind === "credito" && Number(pagosD[0].amount) === 50
    && pagosD[0].linked_transaction_id === null, JSON.stringify(pagosD));
  const sobraD = await sql`
    SELECT valor, confirmar_abatimento, nao_auto FROM patient_credits
    WHERE patient_id = ${d.pid} AND consumido_em IS NULL`;
  check("o que sobrou continua no saldo, ainda pedindo confirmação",
    sobraD.length === 1 && Number(sobraD[0].valor) === 30 && sobraD[0].confirmar_abatimento === true
    && sobraD[0].nao_auto === true, JSON.stringify(sobraD));

  // ============ 3. EXCLUIR O AGENDAMENTO LEVA O DINHEIRO JUNTO (o caso da Marcela).
  const nomeC = `ZeldaExcluir${marca}`;
  const [c] = await sql`
    INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status)
    VALUES (${qa.id}, ${nomeC}, 'sessao', '50.00', 'ativo') RETURNING id`;
  criados.push(c.id);
  const [sC] = await sql`
    INSERT INTO therapy_sessions (user_id, patient_id, date, status, duration)
    VALUES (${qa.id}, ${c.id}, ${hoje}, 'realizada', 50) RETURNING id`;
  const [txC] = await sql`
    INSERT INTO transactions (user_id, amount, type, description, date, source)
    VALUES (${qa.id}, '50.00', 'income', 'Sessão — teste doc61', ${hoje}, 'session_payment') RETURNING id`;
  const [pgC] = await sql`
    INSERT INTO session_payments (user_id, patient_id, session_id, amount, date, method, status, cobranca_chave, linked_transaction_id)
    VALUES (${qa.id}, ${c.id}, ${sC.id}, '50.00', ${hoje}, 'pix', 'paid', ${`sessao:${sC.id}`}, ${txC.id}) RETURNING id`;

  await page.goto(`${BASE}/dashboard/agenda`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await page.getByText(nomeC, { exact: false }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Excluir", exact: true }).first().click();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: /Apenas este/i }).first().click();
  await page.waitForTimeout(3000);

  const restouSessao = await sql`SELECT id FROM therapy_sessions WHERE id = ${sC.id}`;
  check("o agendamento saiu", restouSessao.length === 0);
  const restouPg = await sql`SELECT id, session_id, cobranca_chave FROM session_payments WHERE id = ${pgC.id}`;
  check("e o pagamento saiu junto — sem dinheiro solto para abater outra cobrança",
    restouPg.length === 0, JSON.stringify(restouPg));
  const restouTx = await sql`SELECT id FROM transactions WHERE id = ${txC.id}`;
  check("a transação do caixa também saiu", restouTx.length === 0);
} finally {
  await nav.close();
  for (const pid of criados) {
    const pgs = await sql`SELECT linked_transaction_id FROM session_payments WHERE patient_id = ${pid}`;
    for (const x of pgs) if (x.linked_transaction_id) await sql`DELETE FROM transactions WHERE id = ${x.linked_transaction_id}`;
    await sql`DELETE FROM patient_credits WHERE patient_id = ${pid}`;
    await sql`DELETE FROM session_payments WHERE patient_id = ${pid}`;
    await sql`DELETE FROM therapy_sessions WHERE patient_id = ${pid}`;
    await sql`DELETE FROM patients WHERE id = ${pid}`;
  }
  console.log("pacientes de teste apagados.");
}
process.exit(falhas ? 1 : 0);

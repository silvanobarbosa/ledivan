// A GUIA GERAL E AS MOVIMENTAÇÕES DO DOC 62, NO APP DE VERDADE.
//
// O que o motor puro não prova, porque o que muda é a TELA e o caminho até ela:
//
//   1. O abatimento de crédito mostra a FORMA do dinheiro que o originou, junto de "Crédito do
//      saldo" — e não "Crédito do saldo" sozinho.
//   2. Um lápis ao lado do valor de CADA sessão edita o valor daquela sessão, sem tocar nas outras
//      nem no preço do cadastro. No pacote ele não é oferecido.
//   3. "Valores recebidos em xxxx" lista o dinheiro REAL, um por linha (valor, forma, dia). O
//      estornado e o abatimento de crédito saem — era o que fazia o ano somar o dobro.
//   4. Movimentações diz "Pagamento · Fulano · Sessão dd/mm/aa", e o estorno fica logo abaixo do
//      pagamento que ele desfez.
//   5. Trocar o formato para Mensal passa a valer do começo do mês: a guia deixa de cobrar as
//      sessões do mês uma a uma.
//
// Uso: node scripts/e2e-doc62-geral-e-movimentacoes.mjs    (servidor em http://localhost:3000)

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
// `formatBRL` usa Intl pt-BR, que separa "R$" do número com espaço NÃO-QUEBRÁVEL.
const texto = async (page) => (await page.innerText("body")).replace(/\u00a0/g, " ");
const linhasDaGeral = (page) => page.$$eval('[data-testid="guia-geral"] tbody tr', (trs) =>
  trs.map((tr) => [...tr.querySelectorAll("td")].map((td) => td.innerText.replace(/\s+/g, " ").trim()).join(" | ")));

const [qa] = await sql`SELECT id FROM "user" WHERE email = 'qa.ledivan@reverblabs.com.br'`;
if (!qa) { console.log("conta de QA não encontrada"); process.exit(1); }
const token = await new jose.SignJWT({ userId: qa.id })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1d")
  .sign(new TextEncoder().encode(process.env.AUTH0_SECRET));

const marca = Date.now().toString().slice(-6);
const criados = [];
const hoje = (() => { const d = new Date(); d.setHours(11, 0, 0, 0); return d; })();
const noMes = (dia) => new Date(hoje.getFullYear(), hoje.getMonth(), dia, 11, 0, 0);
const dois = (n) => String(n).padStart(2, "0");
const ddmmaa = (d) => `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${dois(d.getFullYear() % 100)}`;

const paciente = async (nome, formato, fee) => {
  const [p] = await sql`
    INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status, payment_day, sessions_in_packet, started_at)
    VALUES (${qa.id}, ${nome}, ${formato}, ${fee}, 'ativo', 10, 4, ${new Date(hoje.getFullYear(), 0, 5)}) RETURNING id`;
  criados.push(p.id);
  return p.id;
};
const sessao = async (pid, quando, status = "realizada") => {
  const [s] = await sql`INSERT INTO therapy_sessions (user_id, patient_id, date, status, duration)
    VALUES (${qa.id}, ${pid}, ${quando}, ${status}, 50) RETURNING id`;
  return s.id;
};

const nav = await chromium.launch();
const ctx = await nav.newContext();
await ctx.addCookies([{ name: "auth-session", value: token, domain: "localhost", path: "/" }]);
const page = await ctx.newPage();
const abrir = async (pid) => { await page.goto(`${BASE}/dashboard/patients/${pid}`, { waitUntil: "networkidle" }); };

try {
  // ───────────────────────────────── 1. O LÁPIS NO VALOR DA SESSÃO ──────────────────────────────
  console.log("\n— o lápis edita o valor de UMA sessão —");
  const avulso = await paciente(`QA doc62 avulso ${marca}`, "sessao", "100.00");
  const s1 = await sessao(avulso, noMes(5));
  await sessao(avulso, noMes(12));
  await abrir(avulso);

  let linhas = await linhasDaGeral(page);
  check("as duas sessões nascem a R$ 100,00", linhas.filter((l) => l.includes("R$ 100,00")).length === 2, linhas.join(" / "));
  check("cada linha de sessão tem o lápis", (await page.getByRole("button", { name: "Editar o valor desta sessão" }).count()) === 2);

  await page.locator(`tr[data-sessao="${s1}"]`).getByRole("button", { name: "Editar o valor desta sessão" }).click();
  const campo = page.locator('input[aria-label="Valor desta sessão"]');
  await campo.fill("");
  await campo.type("8000");
  check("o campo mascara em reais enquanto digita", (await campo.inputValue()).replace(/\u00a0/g, " ") === "R$ 80,00", await campo.inputValue());
  await page.getByRole("button", { name: "Salvar valor da sessão" }).click();
  await page.waitForTimeout(2500);

  linhas = await linhasDaGeral(page);
  const daEditada = linhas.find((l) => l.includes(ddmmaa(noMes(5))));
  const daOutra = linhas.find((l) => l.includes(ddmmaa(noMes(12))));
  check("a sessão editada passa a R$ 80,00", !!daEditada && daEditada.includes("R$ 80,00"), daEditada);
  check("a OUTRA sessão continua a R$ 100,00", !!daOutra && daOutra.includes("R$ 100,00"), daOutra);
  const [cad] = await sql`SELECT session_fee FROM patients WHERE id = ${avulso}`;
  check("o preço do CADASTRO não foi tocado", Number(cad.session_fee) === 100, String(cad.session_fee));
  const [gravado] = await sql`SELECT valor_extra FROM therapy_sessions WHERE id = ${s1}`;
  check("o valor ficou na sessão (valor_extra)", Number(gravado.valor_extra) === 80, String(gravado.valor_extra));

  // ──────────────────────── 2. NO PACOTE NÃO HÁ VALOR PRÓPRIO DE SESSÃO ─────────────────────────
  console.log("\n— no pacote o lápis não é oferecido —");
  const mensal = await paciente(`QA doc62 mensal ${marca}`, "mensal", "100.00");
  for (const d of [4, 11, 18, 25]) await sessao(mensal, noMes(d));
  await abrir(mensal);
  check("nenhum lápis nas sessões do pacote", (await page.getByRole("button", { name: "Editar o valor desta sessão" }).count()) === 0);
  check("o pacote cobra o mês inteiro numa linha só", (await linhasDaGeral(page)).some((l) => l.includes("4 sessões")), (await linhasDaGeral(page))[0]);

  // ───────────────── 3. "VALORES RECEBIDOS": só dinheiro real, um por linha ──────────────────────
  console.log("\n— valores recebidos: só o que entrou de verdade —");
  const recebidos = await paciente(`QA doc62 recebidos ${marca}`, "sessao", "50.00");
  const r1 = await sessao(recebidos, noMes(2));
  const r2 = await sessao(recebidos, noMes(9));
  const r3 = await sessao(recebidos, noMes(16));
  // R$ 50 pix (vale), R$ 50 pix estornado (não vale), R$ 5 pix (vale), R$ 50 de crédito (não vale).
  await sql`INSERT INTO session_payments (user_id, patient_id, session_id, amount, date, method, status, cobranca_chave)
            VALUES (${qa.id}, ${recebidos}, ${r1}, '50.00', ${hoje}, 'pix', 'paid', ${"sessao:" + r1})`;
  await sql`INSERT INTO session_payments (user_id, patient_id, session_id, amount, date, method, status, cobranca_chave, estornado_em)
            VALUES (${qa.id}, ${recebidos}, ${r2}, '50.00', ${hoje}, 'pix', 'paid', ${"sessao:" + r2}, ${hoje})`;
  await sql`INSERT INTO session_payments (user_id, patient_id, session_id, amount, date, method, status, cobranca_chave)
            VALUES (${qa.id}, ${recebidos}, ${r3}, '5.00', ${hoje}, 'pix', 'paid', ${"sessao:" + r3})`;
  await sql`INSERT INTO session_payments (user_id, patient_id, session_id, amount, date, method, status, cobranca_chave, kind)
            VALUES (${qa.id}, ${recebidos}, ${r3}, '50.00', ${hoje}, 'pix', 'paid', ${"sessao:" + r3}, 'credito')`;
  await abrir(recebidos);

  const tabela = (await page.innerText('[data-testid="valores-recebidos"]')).replace(/\u00a0/g, " ");
  const dia = ddmmaa(hoje);
  check("mostra R$ 50,00 Pix com o dia", tabela.includes(`R$ 50,00 Pix ${dia}`), tabela.replace(/\n/g, " ⏎ "));
  check("mostra R$ 5,00 Pix com o dia", tabela.includes(`R$ 5,00 Pix ${dia}`));
  check("o total do ano é R$ 55,00 (não R$ 110,00)", /Total\s+R\$ 55,00/.test(tabela), tabela.replace(/\n/g, " ⏎ "));
  check("o estorno não aparece mais na tabela", !/estornado/i.test(tabela));
  check("o abatimento de crédito não vira receita", (tabela.match(/R\$ 50,00 Pix/g) || []).length === 1);

  // ───────────────────────── 4. A FORMA JUNTO DE "CRÉDITO DO SALDO" ─────────────────────────────
  console.log("\n— o abatimento mostra a forma do dinheiro de origem —");
  const geral = await texto(page);
  // "PIX" é o rótulo da casa em `PAYMENT_METHOD_LABELS` — é assim que ele aparece em toda a tela.
  check('a linha do crédito diz "PIX · Crédito do saldo"', geral.includes("PIX · Crédito do saldo"),
    geral.split("\n").filter((l) => l.includes("Crédito do saldo")).join(" / "));

  // ──────────────────────────────────── 5. MOVIMENTAÇÕES ────────────────────────────────────────
  console.log("\n— movimentações: descrição com a sessão, estorno logo abaixo —");
  // O estorno do caixa é da SESSÃO (doc 57): ela guarda valor e dia.
  await sql`UPDATE therapy_sessions SET estorno_valor = '50.00', estorno_em = ${hoje} WHERE id = ${r2}`;
  await page.goto(`${BASE}/dashboard/transactions`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => !document.body.innerText.includes("Montando o extrato"), null, { timeout: 30_000 });
  const movs = await page.$$eval("table tbody tr", (trs) =>
    trs.map((tr) => [...tr.querySelectorAll("td")].map((td) => td.innerText.replace(/\s+/g, " ").trim()).join(" | ")));
  const meus = movs.filter((l) => l.includes(`QA doc62 recebidos ${marca}`));
  const sessaoDoEstorno = ddmmaa(noMes(9));
  check("a descrição traz Pagamento · nome · Sessão dd/mm/aa",
    meus.some((l) => l.includes(`Pagamento · QA doc62 recebidos ${marca} · Sessão `)), meus.join(" / "));
  check("o estorno traz Estorno · nome · Sessão dd/mm/aa",
    meus.some((l) => l.includes(`Estorno · QA doc62 recebidos ${marca} · Sessão ${sessaoDoEstorno}`)), meus.join(" / "));
  const iPag = meus.findIndex((l) => l.includes(`Pagamento ·`) && l.includes(`Sessão ${sessaoDoEstorno}`));
  const iEst = meus.findIndex((l) => l.includes("Estorno ·"));
  check("o estorno vem LOGO ABAIXO do pagamento da sessão referente", iPag >= 0 && iEst === iPag + 1, `pagamento ${iPag}, estorno ${iEst}`);

  // ──────────────── 6. TROCAR PARA MENSAL PASSA A VALER DO COMEÇO DO MÊS ────────────────────────
  console.log("\n— trocar para Mensal leva o mês inteiro —");
  const troca = await paciente(`QA doc62 troca ${marca}`, "sessao", "100.00");
  for (const d of [3, 10, 17, 24]) await sessao(troca, noMes(d));
  await page.goto(`${BASE}/dashboard/patients/${troca}/edit`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Financeiro", exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByRole("radio").nth(2).check(); // Gratuito, Avulso, Mensal, Quinzenal
  await page.waitForTimeout(400);
  const desde = await page.locator('input[name="formatoDesde"]').inputValue();
  const primeiroDoMes = `${hoje.getFullYear()}-${dois(hoje.getMonth() + 1)}-01`;
  check('"Vale a partir de" nasce no 1º dia do mês', desde === primeiroDoMes, desde);
  await page.getByRole("button", { name: /Salvar/i }).first().click();
  await page.waitForTimeout(3000);

  await abrir(troca);
  linhas = await linhasDaGeral(page);
  check("a guia passa a cobrar o mês numa linha só", linhas.some((l) => l.includes("4 sessões") && l.includes("R$ 400,00")), linhas.join(" / "));
  check("nenhuma sessão do mês continua AVUL", !linhas.some((l) => l.includes("AVUL")), linhas.join(" / "));
  check("as sessões aparecem numeradas no pacote", linhas.some((l) => l.includes("| 4/4 |")), linhas.join(" / "));

  // E o avulso continua avulso: a mudança é da TROCA, não de todo mundo.
  await abrir(avulso);
  check("quem não trocou de formato segue cobrado a cada sessão",
    (await linhasDaGeral(page)).filter((l) => l.includes("AVUL")).length === 2);
} finally {
  await nav.close();
  for (const id of criados) {
    await sql`DELETE FROM session_payments WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_credits WHERE patient_id = ${id}`;
    await sql`DELETE FROM therapy_sessions WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_payment_format_history WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_price_history WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_contract_history WHERE patient_id = ${id}`;
    await sql`DELETE FROM patients WHERE id = ${id}`;
  }
  console.log(`\n${falhas ? `${falhas} FALHA(S)` : "tudo certo"} · ${criados.length} cadastro(s) de teste apagado(s)`);
  process.exit(falhas ? 1 : 0);
}

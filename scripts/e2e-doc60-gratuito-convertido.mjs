// O PACIENTE GRATUITO QUE VIROU AVUL, NO APP DE VERDADE (doc 60).
//
// Três coisas que o motor puro não consegue provar, porque o que falhava não era a conta:
//
//   1. A cobrança que ainda ESPERA O VALOR (a falta do gratuito nasce AVUL de R$ 0,00, doc 54)
//      perguntava se o dinheiro digitado deveria virar crédito no saldo — e o servidor recusava o
//      lançamento com "Esta cobrança já está paga". O valor digitado é o VALOR DA SESSÃO.
//   2. O aviso "Sessão GRAT que foi convertida para AVUL" sumia assim que a cobrança ficava paga:
//      ele só era desenhado no ramo da cobrança em aberto.
//   3. Desfeita a cobrança, a modalidade AVUL — que no gratuito é DERIVADA, não gravada —
//      desaparecia, e com ela a mensagem do estorno. E o lançamento do caixa continuava lá,
//      mostrando uma receita que voltou para o paciente.
//
// Percurso, com a conta de QA (tudo pertence a ela, e sai no fim):
//   1. paciente GRATUITO com uma falta de HOJE considerada cobrada e SEM valor;
//   2. guia Geral: o aviso aparece, a pergunta do crédito NÃO, e R$ 50,00 viram o valor da sessão;
//   3. depois de pago: o aviso continua lá;
//   4. agenda: "Faltou" → "Não" → Estornar;
//   5. a mensagem do estorno aparece, o lançamento sai do caixa e a tabela anual registra a saída;
//   6. apaga o paciente.
//
// Uso: node scripts/e2e-doc60-gratuito-convertido.mjs    (servidor em http://localhost:3000)

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

const hoje = (() => { const d = new Date(); d.setHours(11, 0, 0, 0); return d; })();
const nome = `Zelda doc60 ${Date.now().toString().slice(-6)}`;
const nav = await chromium.launch();
let pid = null;

try {
  // Paciente GRATUITO: não cobra nada por desenho. A falta considerada cobrada é a única cobrança
  // que ele gera, e ela nasce sem valor.
  const [p] = await sql`
    INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status)
    VALUES (${qa.id}, ${nome}, 'gratuito', '0.00', 'ativo') RETURNING id`;
  pid = p.id;
  const [s1] = await sql`
    INSERT INTO therapy_sessions (user_id, patient_id, date, status, duration, faltou_conta)
    VALUES (${qa.id}, ${pid}, ${hoje}, 'nao_realizada', 50, true) RETURNING id`;

  const ctx = await nav.newContext({ viewport: { width: 1440, height: 1100 } });
  await ctx.addCookies([{ name: "auth-session", value: token, domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax" }]);
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.accept());

  // ---- 1. A GUIA GERAL com a cobrança que espera o valor.
  await page.goto(`${BASE}/dashboard/patients/${pid}?tab=geral`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  check("entrou na guia Geral", !page.url().includes("/login"), page.url());
  check("o aviso da conversão aparece antes de pagar",
    (await page.innerText("body")).includes("Sessão GRAT que foi convertida para AVUL"));

  await page.getByRole("button", { name: /Lançar pagamento/i }).first().click();
  await page.waitForTimeout(400);
  const campo = page.locator("#valor-pg");
  await campo.fill("");
  await campo.type("5000");
  await page.waitForTimeout(300);

  // O CORAÇÃO DO ITEM 4 DO DOCUMENTO.
  const perguntouCredito = (await page.innerText("body")).includes("entram como crédito no saldo");
  check("NÃO pergunta se o valor vira crédito — ele é o valor da sessão", !perguntouCredito);

  await page.getByRole("button", { name: /^Confirmar/i }).first().click();
  await page.waitForTimeout(3500);

  const [sessao] = await sql`SELECT valor_extra FROM therapy_sessions WHERE id = ${s1.id}`;
  check("o valor digitado virou o VALOR DA SESSÃO", Number(sessao?.valor_extra) === 50, String(sessao?.valor_extra));
  const pagos = await sql`SELECT id, amount, cobranca_chave, kind, linked_transaction_id FROM session_payments WHERE patient_id = ${pid}`;
  check("um pagamento de R$ 50,00 na cobrança da sessão", pagos.length === 1 && Number(pagos[0].amount) === 50 && pagos[0].cobranca_chave === `extra:${s1.id}`, JSON.stringify(pagos));
  const creditos = await sql`SELECT id FROM patient_credits WHERE patient_id = ${pid}`;
  check("e NENHUM crédito foi criado", creditos.length === 0, String(creditos.length));

  // ---- 2. PAGA, a linha continua explicando por que um gratuito cobrou.
  await page.reload({ waitUntil: "networkidle" });
  const corpoPago = await page.innerText("body");
  check("depois de pago a cobrança fica Pago", corpoPago.includes("Pago"));
  check("e o aviso da conversão CONTINUA aparecendo (item 5 do doc)",
    corpoPago.includes("Sessão GRAT que foi convertida para AVUL"));

  const txAntes = await sql`
    SELECT t.id FROM transactions t WHERE t.id = ${pagos[0]?.linked_transaction_id ?? null}`;
  check("o pagamento entrou no caixa", txAntes.length === 1);

  // ---- 3. A TERAPEUTA DESFAZ A COBRANÇA e escolhe estornar.
  await page.goto(`${BASE}/dashboard/agenda`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await page.getByText("Zelda", { exact: false }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /Faltou/i }).first().click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /^Não/i }).first().click();
  await page.waitForTimeout(2500);
  const janela = await page.getByText("Esta sessão já possui um pagamento registrado").first().isVisible().catch(() => false);
  check("a janela do pagamento apareceu", janela);
  if (janela) {
    await page.getByRole("button", { name: /Estornar/i }).first().click();
    await page.waitForTimeout(3500);
  }

  const [depois] = await sql`SELECT estorno_valor, estorno_em, faltou_conta, status FROM therapy_sessions WHERE id = ${s1.id}`;
  check("a sessão guardou o estorno", Number(depois?.estorno_valor) === 50, String(depois?.estorno_valor));
  check("e continua Faltou na agenda (item 1 do doc)", depois?.status === "nao_realizada", String(depois?.status));

  // ITEM 3 DO DOCUMENTO: o valor estornado sai da tabela de lançamentos.
  const txDepois = await sql`SELECT id FROM transactions WHERE id = ${pagos[0]?.linked_transaction_id ?? null}`;
  check("o lançamento do caixa SAIU — o dinheiro voltou para o paciente", txDepois.length === 0);

  // ITENS 1 E 2: a mensagem volta, e a tabela anual registra a saída.
  await page.goto(`${BASE}/dashboard/patients/${pid}?tab=geral`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  // `formatBRL` usa Intl pt-BR, que separa "R$" do número com espaço NÃO-QUEBRÁVEL. Procurar com
  // espaço comum não acha — e o teste reprovaria um texto que está certo na tela.
  const corpoFinal = (await page.innerText("body")).replace(/ /g, " ");
  check("a mensagem do estorno aparece na coluna Pagamento (item 1 do doc)",
    corpoFinal.includes("Sessão AVUL, que foi convertida para GRAT - Estorno realizado no valor de R$ 50,00"));
  // O item 2 do doc 60 pedia a saída à mostra nesta tabela. O doc 62 reviu: "Valores recebidos"
  // passou a ser só o dinheiro REAL recebido, e o estorno tem o lugar dele em Movimentações, onde
  // as duas pontas aparecem. O que fica provado aqui é que ele NÃO soma mais no ano.
  check("o estorno saiu da tabela de valores recebidos (doc 62 revê o item 2 do doc 60)",
    !corpoFinal.includes("estornado"));
  check("e o pagamento estornado não conta como recebido",
    !/Valores recebidos[\s\S]{0,400}Total\s*R\$ 50,00/.test(corpoFinal));

  // ---- 4. A TELA DE TRANSAÇÕES: o estorno nas Movimentações, e NÃO na lista de lançamentos.
  await page.goto(`${BASE}/dashboard/transactions`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2500);
  const corpoTx = (await page.innerText("body")).replace(/ /g, " ");
  check("Movimentações mostra as DUAS pontas do dinheiro que voltou",
    corpoTx.includes(`Pagamento · ${nome}`) && corpoTx.includes(`Estorno · ${nome}`));
  check("e a lista de lançamentos não mostra mais a receita estornada (item 3 do doc)",
    !corpoTx.includes(`Sessão — ${nome}`));
} finally {
  await nav.close();
  if (pid) {
    const pgs = await sql`SELECT linked_transaction_id FROM session_payments WHERE patient_id = ${pid}`;
    for (const x of pgs) if (x.linked_transaction_id) await sql`DELETE FROM transactions WHERE id = ${x.linked_transaction_id}`;
    await sql`DELETE FROM patient_credits WHERE patient_id = ${pid}`;
    await sql`DELETE FROM session_payments WHERE patient_id = ${pid}`;
    await sql`DELETE FROM therapy_sessions WHERE patient_id = ${pid}`;
    await sql`DELETE FROM patients WHERE id = ${pid}`;
    console.log("paciente de teste apagado.");
  }
}
process.exit(falhas ? 1 : 0);

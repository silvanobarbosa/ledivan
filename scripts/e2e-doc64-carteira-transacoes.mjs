// O DOC 64 NO APP DE VERDADE.
//
// O que o motor puro não prova, porque o que muda é a TELA e o caminho até ela:
//
//   1. "Valores recebidos" mostra o dinheiro que entrou e VIROU CRÉDITO — sem contá-lo duas vezes
//      quando o crédito é usado.
//   2. Na Carteira: vencimento/atrasado/em aberto centralizados, "Pago em" em preto, uma linha de
//      total por mês e um botão "Gerenciar" por cobrança.
//   3. "Gerenciar" abre a guia Geral do cadastro JÁ no ano daquela cobrança, com a linha destacada.
//   4. O quadro "Por cadastro — mês a mês" saiu da Carteira.
//   5. Transações: filtro no alto com MÊS ATUAL ligado ao entrar, totais por área obedecendo ao
//      recorte, a tabela de lançamentos (e o filtro dela) fora, e a pizza abaixo do extrato.
//
// Uso: node scripts/e2e-doc64-carteira-transacoes.mjs    (servidor em http://localhost:3000)

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
const texto = async (page) => (await page.innerText("body")).replace(/\u00a0/g, " ");

const [qa] = await sql`SELECT id FROM "user" WHERE email = 'qa.ledivan@reverblabs.com.br'`;
if (!qa) { console.log("conta de QA não encontrada"); process.exit(1); }
const token = await new jose.SignJWT({ userId: qa.id })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1d")
  .sign(new TextEncoder().encode(process.env.AUTH0_SECRET));

const marca = Date.now().toString().slice(-6);
const criados = [];
const dois = (n) => String(n).padStart(2, "0");
const hoje = (() => { const d = new Date(); d.setHours(11, 0, 0, 0); return d; })();
const ANO_ANTERIOR = hoje.getFullYear() - 1;
const noMes = (dia, mes = hoje.getMonth(), ano = hoje.getFullYear()) => new Date(ano, mes, dia, 16, 0, 0);

const paciente = async (nome, formato, fee, extra = {}) => {
  const [p] = await sql`
    INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status, payment_day, sessions_in_packet, started_at, phone, cadastro_kind)
    VALUES (${qa.id}, ${nome}, ${formato}, ${fee}, 'ativo', 10, 4, ${new Date(ANO_ANTERIOR - 1, 0, 5)}, '11999990000', ${extra.kind ?? "paciente"})
    RETURNING id`;
  criados.push(p.id);
  return p.id;
};
const sessao = async (pid, quando, status = "realizada") => {
  const [s] = await sql`INSERT INTO therapy_sessions (user_id, patient_id, date, status, duration)
    VALUES (${qa.id}, ${pid}, ${quando}, ${status}, 50) RETURNING id`;
  return s.id;
};
const pagamento = async (pid, valor, quando, chave, extra = {}) => {
  const [p] = await sql`
    INSERT INTO session_payments (user_id, patient_id, session_id, amount, date, method, status, cobranca_chave, kind, estornado_em)
    VALUES (${qa.id}, ${pid}, ${extra.sessionId ?? null}, ${valor}, ${quando}, ${extra.metodo ?? "pix"}, 'paid', ${chave}, ${extra.kind ?? null}, ${extra.estornadoEm ?? null})
    RETURNING id`;
  return p.id;
};

const nav = await chromium.launch();
const ctx = await nav.newContext();
const alvo = new URL(BASE);
await ctx.addCookies([{ name: "auth-session", value: token, domain: alvo.hostname, path: "/", secure: alvo.protocol === "https:" }]);
await ctx.addInitScript(() => { try { localStorage.setItem("ledivan_onboarded_v3", "1"); localStorage.setItem("ledivan_diva_dia", new Date().toISOString().slice(0, 10)); localStorage.setItem("ledivan_diva_aviso_voz", "1"); } catch { /* sem localStorage */ } });
const page = await ctx.newPage();

try {
  // ───────────── 1. O DINHEIRO QUE VIROU CRÉDITO APARECE — UMA VEZ SÓ ─────────────
  console.log("\n— valores recebidos: o crédito entrou e não voltou —");
  const comCredito = await paciente(`QA doc64 credito ${marca}`, "sessao", "50.00");
  const s1 = await sessao(comCredito, noMes(5));
  const s2 = await sessao(comCredito, noMes(12));
  // R$ 50 entraram no Pix e viraram CRÉDITO (o pagamento é desfeito, mas o dinheiro fica);
  // depois o crédito paga a outra sessão (kind="credito") — mesmo dinheiro, não é entrada nova.
  const origem = await pagamento(comCredito, "50.00", noMes(5), `sessao:${s1}`, { sessionId: s1, estornadoEm: noMes(6) });
  const abatimento = await pagamento(comCredito, "50.00", noMes(12), `sessao:${s2}`, { sessionId: s2, kind: "credito" });
  await sql`INSERT INTO patient_credits (user_id, patient_id, valor, origem_pagamento_id, consumido_pagamento_id)
    VALUES (${qa.id}, ${comCredito}, '50.00', ${origem}, ${abatimento})`;

  await page.goto(`${BASE}/dashboard/patients/${comCredito}`, { waitUntil: "networkidle" });
  const tabela = (await page.locator('[data-testid="valores-recebidos"]').first().innerText()).replace(/\u00a0/g, " ");
  check("o dinheiro que virou crédito aparece nos valores recebidos", tabela.includes("R$ 50,00 Pix"), tabela.replace(/\n+/g, " · ").slice(0, 200));
  check("a linha diz que ele virou crédito", tabela.includes("virou crédito"));
  check("o ano soma uma vez só — o abatimento não é dinheiro novo", /Total\s*R\$ 50,00/.test(tabela), tabela.replace(/\n+/g, " · ").slice(-120));

  // ───────────── 2 a 4. A CARTEIRA ─────────────
  console.log("\n— a Carteira —");
  // Uma cobrança PAGA no ano passado (é ela que prova o ano do "Gerenciar") e uma em aberto hoje.
  const naCarteira = await paciente(`QA doc64 carteira ${marca}`, "sessao", "100.00");
  const velha = await sessao(naCarteira, noMes(10, 2, ANO_ANTERIOR));
  await pagamento(naCarteira, "100.00", noMes(11, 2, ANO_ANTERIOR), `sessao:${velha}`, { sessionId: velha });
  await sessao(naCarteira, noMes(15));

  await page.goto(`${BASE}/dashboard/pagamentos?year=${ANO_ANTERIOR}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3500);
  check('o quadro "Por cadastro — mês a mês" saiu da Carteira', !(await texto(page)).includes("Por cadastro"));

  const mes = page.locator("button", { hasText: /^Março/ }).first();
  await mes.click();
  await page.waitForTimeout(800);
  const linha = page.locator("tr", { hasText: `QA doc64 carteira ${marca}` }).first();
  check("a cobrança do ano passado aparece", await linha.count() > 0);

  const centrado = async (coluna) => page.evaluate((i) => {
    const tr = [...document.querySelectorAll("tbody tr")].find((t) => t.innerText.includes("QA doc64 carteira"));
    return tr ? getComputedStyle(tr.children[i]).textAlign : "?";
  }, coluna);
  check("a coluna Vencimento está centralizada", (await centrado(1)) === "center", await centrado(1));
  check("a coluna Atrasado está centralizada", (await centrado(2)) === "center", await centrado(2));
  check("a coluna Em aberto está centralizada", (await centrado(3)) === "center", await centrado(3));

  const corDoPago = await page.evaluate(() => {
    const span = [...document.querySelectorAll("span")].find((s) => s.innerText.startsWith("Pago em"));
    return span ? getComputedStyle(span).color : "?";
  });
  // Preto = a cor do texto da tela (não o verde #047857 = rgb(4, 120, 87), que é a cor do líquido).
  check('"Pago em" não está mais em verde', corDoPago !== "rgb(4, 120, 87)", corDoPago);

  // `count()` antes de ler o texto: sem a linha, o `innerText` estoura por tempo e a verificação
  // morre em vez de REPROVAR — e um arnês que morre não diz qual mecanismo quebrou.
  const totalLoc = page.locator("tr", { hasText: "Total do mês" });
  const temTotal = (await totalLoc.count()) > 0;
  check("o mês ganhou uma linha de total", temTotal);
  const totalLinha = temTotal ? await totalLoc.first().innerText() : "";
  check("o total do mês soma o pago daquele mês", totalLinha.replace(/\u00a0/g, " ").includes("R$ 100,00"), totalLinha.replace(/\s+/g, " "));

  // "Gerenciar" → guia Geral, no ANO da cobrança.
  await linha.getByRole("link", { name: /Gerenciar/i }).click();
  await page.waitForURL(/\/dashboard\/patients\//, { timeout: 15000 });
  await page.waitForTimeout(2500);
  const anoNaTela = await page.locator("#ano-do-paciente").inputValue();
  check("o Gerenciar abre a guia Geral no ano da cobrança", anoNaTela === String(ANO_ANTERIOR), `${anoNaTela} ≠ ${ANO_ANTERIOR}`);
  const destacada = await page.locator(`[data-chave="sessao:${velha}"]`).count();
  check("a linha da cobrança está na tela", destacada === 1);

  // ───────────── 5. TRANSAÇÕES ─────────────
  console.log("\n— Transações —");
  await page.goto(`${BASE}/dashboard/transactions`, { waitUntil: "networkidle" });
  await page.waitForTimeout(6000);
  const corpo = await texto(page);
  check('ao entrar, "Mês atual" é o recorte ligado',
    await page.locator('button:has-text("Mês atual")').first().evaluate((b) => b.className.includes("bg-primary")));
  check("o filtro antigo (Período → Filtrar) saiu", !corpo.includes("Período:"));
  check("a tabela de lançamentos saiu", !corpo.includes("CATEGORIA") && !corpo.includes("ORIGEM"), corpo.includes("CATEGORIA") ? "ainda tem CATEGORIA" : "");
  check("o extrato tem uma linha de total", corpo.includes("TOTAL") && corpo.includes("entradas"));
  check("a pizza das áreas está abaixo do extrato", corpo.includes("Comparativo por área"));

  // O recorte muda o que a tela conta: a cobrança do ano passado só aparece em "Tudo".
  const soMes = await texto(page);
  check("no mês atual, o pagamento do ano passado não entra", !soMes.includes(`Sessão ${dois(10)}/03/${String(ANO_ANTERIOR).slice(2)}`));
  await page.getByRole("button", { name: "Tudo", exact: true }).click();
  await page.waitForTimeout(6000);
  const tudo = await texto(page);
  check("em Tudo, ele entra", tudo.includes(`Sessão 10/03/${String(ANO_ANTERIOR).slice(2)}`), tudo.slice(tudo.indexOf("Movimentações"), tudo.indexOf("Movimentações") + 300).replace(/\n+/g, " · "));
  check("o rótulo do recorte acompanha o filtro", tudo.includes("Tudo · entradas"), "");
} catch (e) {
  check("o percurso chegou ao fim sem exceção", false, String(e && e.message ? e.message : e).slice(0, 300));
} finally {
  await nav.close();
  for (const id of criados) {
    await sql`DELETE FROM patient_credits WHERE patient_id = ${id}`;
    await sql`DELETE FROM session_payments WHERE patient_id = ${id}`;
    await sql`DELETE FROM therapy_sessions WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_payment_format_history WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_price_history WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_contract_history WHERE patient_id = ${id}`;
    await sql`DELETE FROM patients WHERE id = ${id}`;
  }
  console.log(`\n${falhas ? `${falhas} FALHA(S)` : "tudo certo"} · ${criados.length} cadastro(s) de teste apagado(s)`);
  process.exit(falhas ? 1 : 0);
}

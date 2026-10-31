// O DOC 63 NO APP DE VERDADE.
//
// O que o motor puro não prova, porque o que muda é a TELA, o caminho até ela, ou a ordem das
// gravações no banco:
//
//   1. A cobrança do pacote em "Vencimentos por dia" diz QUAIS sessões ela cobra.
//   2. No computador, cobrar não abre mais a página "Abrir app / WhatsApp Web": vai direto ao
//      aplicativo instalado, e a confirmação guarda a saída pela web.
//   3. O histórico de reajuste mostra a alteração de VALOR com o acordeão ainda recolhido.
//   4. Registrada a alteração de valor, o paciente sai dos "Reajustes a vencer" — e CONTINUA fora
//      depois de salvar o Financeiro de novo por outro motivo.
//   5. O segundo menu chama "Caixa Pessoal" e o primeiro item, "Carteira".
//   6. Paciente gratuito não volta a aparecer como avulso nas sessões futuras.
//
// Uso: node scripts/e2e-doc63-cobranca-reajuste-vigencia.mjs   (servidor em http://localhost:3000)

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
const linhasDaGeral = (page) => page.$$eval('[data-testid="guia-geral"] tbody tr', (trs) =>
  trs.map((tr) => [...tr.querySelectorAll("td")].map((td) => td.innerText.replace(/\s+/g, " ").trim()).join(" | ")));

const [qa] = await sql`SELECT id FROM "user" WHERE email = 'qa.ledivan@reverblabs.com.br'`;
if (!qa) { console.log("conta de QA não encontrada"); process.exit(1); }
const token = await new jose.SignJWT({ userId: qa.id })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1d")
  .sign(new TextEncoder().encode(process.env.AUTH0_SECRET));

const marca = Date.now().toString().slice(-6);
const criados = [];
const dois = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;
const ddmmaa = (d) => `${dois(d.getDate())}/${dois(d.getMonth() + 1)}/${dois(d.getFullYear() % 100)}`;
const hoje = (() => { const d = new Date(); d.setHours(11, 0, 0, 0); return d; })();
const emDias = (n) => { const d = new Date(hoje); d.setDate(d.getDate() + n); return d; };
const mesesAtras = (n) => { const d = new Date(hoje); d.setMonth(d.getMonth() - n); return d; };

const paciente = async (nome, formato, fee, extra = {}) => {
  const [p] = await sql`
    INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status, payment_day,
                          sessions_in_packet, started_at, phone, pacote_tipo, validade_preco_meses, price_review_date)
    VALUES (${qa.id}, ${nome}, ${formato}, ${fee}, 'ativo', ${extra.diaPagamento ?? 1}, 4,
            ${extra.inicio ?? mesesAtras(14)}, '11999990000', ${extra.pacoteTipo ?? null},
            ${extra.validade ?? null}, ${extra.review ?? null})
    RETURNING id`;
  criados.push(p.id);
  return p.id;
};
const sessao = async (pid, quando, status = "agendada") => {
  const [s] = await sql`INSERT INTO therapy_sessions (user_id, patient_id, date, status, duration)
    VALUES (${qa.id}, ${pid}, ${quando}, ${status}, 50) RETURNING id`;
  return s.id;
};
const vigencia = async (pid, formato, desde, pacoteTipo = null) => {
  await sql`INSERT INTO patient_payment_format_history (patient_id, formato, pacote_tipo, data_efetiva)
    VALUES (${pid}, ${formato}, ${pacoteTipo}, ${desde})`;
};
const preco = async (pid, valor, desde) => {
  await sql`INSERT INTO patient_price_history (patient_id, valor, data_efetiva) VALUES (${pid}, ${valor}, ${desde})`;
};

const nav = await chromium.launch();
const ctx = await nav.newContext();
const alvo = new URL(BASE);
await ctx.addCookies([{ name: "auth-session", value: token, domain: alvo.hostname, path: "/", secure: alvo.protocol === "https:" }]);
// O tour de boas-vindas é um modal por cima do Dashboard: sem dispensá-lo, o clique em "Cobrar"
// resolve o botão e nunca chega nele. Marca a chave que o próprio tour grava ao fechar.
await ctx.addInitScript(() => { try { localStorage.setItem("ledivan_onboarded_v3", "1"); localStorage.setItem("ledivan_diva_dia", new Date().toISOString().slice(0, 10)); } catch { /* sem localStorage */ } });
const page = await ctx.newPage();
// Aba nova aberta pelo app (o caminho da WEB). No computador NÃO deve abrir nenhuma.
let abasNovas = 0;
ctx.on("page", () => { abasNovas++; });

const salvarFinanceiro = async (pid, dentro) => {
  await page.goto(`${BASE}/dashboard/patients/${pid}/edit`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Financeiro", exact: true }).click();
  await page.waitForTimeout(500);
  await dentro();
  await page.getByRole("button", { name: /Salvar/i }).first().click();
  await page.waitForTimeout(3000);
};

try {
  // ──────────────── 1 e 2. A COBRANÇA DO PACOTE: QUAIS SESSÕES, E POR ONDE ELA ABRE ─────────────
  console.log("\n— a mensagem do pacote diz quais sessões cobra —");
  // Pacote mensal fragmentado com vencimento no dia 1: as quatro sessões do mês que vem.
  const proximoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1, 11, 0, 0);
  const diasDoPacote = [8, 15, 22, 29].map((d) => new Date(proximoMes.getFullYear(), proximoMes.getMonth(), d, 16, 0, 0));
  const pacote = await paciente(`QA doc63 pacote ${marca}`, "mensal", "60.00", { diaPagamento: 1, pacoteTipo: "fragmentado" });
  await vigencia(pacote, "mensal", mesesAtras(14), "fragmentado");
  // O mês corrente também tem sessões: sem um ciclo anterior, o pacote de novembro seria o PRIMEIRO
  // e o vencimento encostaria na primeira sessão (regra da dona, 18/09) em vez de cair no dia 1.
  for (const d of [2, 9, 16, 23]) await sessao(pacote, new Date(hoje.getFullYear(), hoje.getMonth(), d, 16, 0, 0), "realizada");
  for (const d of diasDoPacote) await sessao(pacote, d);

  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.getByLabel("Data dos vencimentos").fill(iso(proximoMes));
  await page.waitForTimeout(2500);
  const linhaDoPacote = page.locator("tr", { hasText: `QA doc63 pacote ${marca}` }).first();
  check("o pacote aparece vencendo no dia 1", await linhaDoPacote.count() > 0);
  await linhaDoPacote.getByRole("button", { name: /Cobrar/i }).click();
  await page.waitForTimeout(800);

  const corpo = await texto(page);
  check("a confirmação de envio abriu", corpo.includes("Você enviou a mensagem?"));
  check("no computador, nenhuma aba de wa.me foi aberta (vai pelo aplicativo)", abasNovas === 0, `abas: ${abasNovas}`);
  const saida = page.getByRole("link", { name: /Abrir no WhatsApp Web/i });
  check("a confirmação oferece a saída pela web", await saida.count() === 1);
  const mensagem = decodeURIComponent((await saida.getAttribute("href")) ?? "");
  const esperado = `referente às sessões de ${diasDoPacote.map(ddmmaa).join(", ").replace(/, ([^,]*)$/, " e $1")}`;
  check("a mensagem lista os dias das sessões do pacote", mensagem.includes(esperado), mensagem.slice(mensagem.indexOf("Passando"), mensagem.indexOf("Peço")).trim());
  check("a mensagem não fala mais só da data de início", !mensagem.includes("data de início em"));
  check("o link de saída é o wa.me, com o mesmo texto", /^https:\/\/wa\.me\/\d+\?text=/.test((await saida.getAttribute("href")) ?? ""));

  // ─────────────────── 3 e 4. O HISTÓRICO MOSTRA O VALOR, E O REAJUSTE DÁ BAIXA ─────────────────
  console.log("\n— a alteração de valor aparece, e tira o paciente da lista de reajustes —");
  // Paciente da dona: começou há 14 meses a R$ 80, com reajuste anual — portanto VENCIDO hoje.
  const inicio = mesesAtras(14);
  const reajustar = await paciente(`QA doc63 reajuste ${marca}`, "mensal", "80.00", {
    inicio, validade: 12, review: new Date(inicio.getFullYear() + 1, inicio.getMonth(), inicio.getDate()), pacoteTipo: "completo",
  });
  await vigencia(reajustar, "mensal", inicio, "completo");
  await preco(reajustar, "80.00", inicio);

  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  check("o paciente está na lista de reajustes a vencer (antes)", (await texto(page)).includes(`QA doc63 reajuste ${marca}`));

  const vigenciaDoReajuste = emDias(-5);
  await salvarFinanceiro(reajustar, async () => {
    await page.locator('input[name="sessionFee"]').fill("90,00");
    await page.locator('input[name="formatoDesde"]').fill(iso(vigenciaDoReajuste));
  });

  await page.goto(`${BASE}/dashboard/patients/${reajustar}/edit`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Financeiro", exact: true }).click();
  await page.waitForTimeout(500);
  const cabecalho = (await page.locator("summary", { hasText: `vigência ${ddmmaa(vigenciaDoReajuste).slice(0, 6)}` }).first().innerText()).replace(/\u00a0/g, " ");
  check("o cabeçalho da vigência mostra a alteração de valor, recolhido",
    cabecalho.includes("valor R$ 80,00 → R$ 90,00"), cabecalho.replace(/\n/g, " "));

  const [depoisDoReajuste] = await sql`SELECT price_review_date FROM patients WHERE id = ${reajustar}`;
  const proximoReajuste = new Date(vigenciaDoReajuste.getFullYear() + 1, vigenciaDoReajuste.getMonth(), vigenciaDoReajuste.getDate());
  check("o próximo reajuste passou a contar da vigência do valor novo",
    iso(new Date(depoisDoReajuste.price_review_date)) === iso(proximoReajuste),
    `${depoisDoReajuste.price_review_date} ≠ ${iso(proximoReajuste)}`);

  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  check("o paciente saiu da lista de reajustes a vencer", !(await texto(page)).includes(`QA doc63 reajuste ${marca}`));

  // A armadilha do doc: salvar o Financeiro DE NOVO, por outro motivo, não pode desfazer a baixa.
  await salvarFinanceiro(reajustar, async () => {
    await page.locator('select[name="paymentDay"], input[name="paymentDay"]').first().fill("5").catch(() => {});
    await page.locator('input[name="agendaId"]').first().fill(`QA63-${marca}`).catch(() => {});
  });
  const [depoisDeSalvarDeNovo] = await sql`SELECT price_review_date FROM patients WHERE id = ${reajustar}`;
  check("salvar o cadastro de novo NÃO devolve o reajuste já feito",
    iso(new Date(depoisDeSalvarDeNovo.price_review_date)) === iso(proximoReajuste),
    String(depoisDeSalvarDeNovo.price_review_date));
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  check("e o paciente continua fora da lista", !(await texto(page)).includes(`QA doc63 reajuste ${marca}`));

  // ─────────────────────────── 5. O SEGUNDO MENU: CAIXA PESSOAL / CARTEIRA ──────────────────────
  console.log("\n— o segundo menu —");
  // `innerText` já vem com o text-transform aplicado: o título do grupo aparece em CAIXA ALTA.
  const menu = (await texto(page)).toLowerCase();
  check('o grupo chama "Caixa Pessoal"', menu.includes("caixa pessoal"));
  check('o primeiro item chama "Carteira"', menu.includes("carteira"));
  const barra = (await page.locator("aside").first().innerText()).toLowerCase();
  check('"Pagamentos" saiu do menu (era o nome que confundia)',
    barra.includes("carteira") && !barra.includes("pagamentos"), barra.replace(/\n+/g, " · "));
  await page.goto(`${BASE}/dashboard/pagamentos`, { waitUntil: "networkidle" });
  check("a própria tela também se chama Carteira", (await page.locator("h1").first().innerText()).includes("Carteira"));

  // ──────────────────── 6. GRATUITO NÃO VOLTA A APARECER COMO AVULSO NO FUTURO ──────────────────
  console.log("\n— o gratuito continua gratuito nas sessões futuras —");
  // O caminho exato da dona: cadastro salvo primeiro como "A cada sessão" (sem data de Início, a
  // vigência nasceu valendo de HOJE) e corrigido em seguida para Gratuito, valendo de antes.
  const gratuito = await paciente(`QA doc63 gratuito ${marca}`, "sessao", "100.00", { inicio: mesesAtras(3) });
  await vigencia(gratuito, "sessao", hoje);
  for (const d of [-21, -14, -7, 0, 7, 14]) await sessao(gratuito, emDias(d));

  await salvarFinanceiro(gratuito, async () => {
    await page.getByRole("radio").nth(0).check(); // Gratuito, Avulso, Mensal, Quinzenal
    await page.waitForTimeout(400);
    await page.locator('input[name="formatoDesde"]').fill(iso(mesesAtras(3)));
  });

  await page.goto(`${BASE}/dashboard/patients/${gratuito}`, { waitUntil: "networkidle" });
  const linhasGrat = await linhasDaGeral(page);
  check("nenhuma sessão do gratuito é cobrada como avulsa",
    !linhasGrat.some((l) => l.includes("AVUL")), linhasGrat.join(" / "));
  check("as sessões futuras aparecem como gratuitas",
    linhasGrat.filter((l) => l.includes("GRAT")).length >= 6, linhasGrat.join(" / "));
  const vigenciasNoBanco = await sql`SELECT formato, data_efetiva FROM patient_payment_format_history WHERE patient_id = ${gratuito} ORDER BY data_efetiva`;
  check("a vigência contraditória, posterior à declarada, saiu do banco",
    vigenciasNoBanco.every((v) => v.formato === "gratuito"), vigenciasNoBanco.map((v) => `${v.formato}@${iso(new Date(v.data_efetiva))}`).join(" | "));
} catch (e) {
  check("o percurso chegou ao fim sem exceção", false, String(e && e.message ? e.message : e).slice(0, 300));
} finally {
  await nav.close();
  for (const id of criados) {
    await sql`DELETE FROM session_payments WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_credits WHERE patient_id = ${id}`;
    await sql`DELETE FROM therapy_sessions WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_payment_format_history WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_price_history WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_package_history WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_reajuste_changes WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_contract_history WHERE patient_id = ${id}`;
    await sql`DELETE FROM patients WHERE id = ${id}`;
  }
  console.log(`\n${falhas ? `${falhas} FALHA(S)` : "tudo certo"} · ${criados.length} cadastro(s) de teste apagado(s)`);
  process.exit(falhas ? 1 : 0);
}

// O CRÉDITO QUE ABRE A SESSÃO AVULSA JÁ PREENCHIDA (dono, 13/11/2026), no app de verdade.
//
// O teste puro prova a regra; o que ele não prova é a TRAVESSIA: o saldo sai de uma consulta
// agrupada no servidor, atravessa a lista de pacientes e chega num campo que só lê o valor na
// MONTAGEM. Qualquer elo frouxo aí aparece como "o campo abriu com o preço do cadastro" — que é
// exatamente o estado anterior, e passaria por "funciona" num olhar rápido.
//
// Uso: npm run build && npm start, depois `node scripts/e2e-credito-na-avulsa.mjs`.

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
const check = (n, ok, d = "") => { console.log(`${ok ? "  ok  " : "FALHA "} ${n}${d ? ` — ${d}` : ""}`); if (!ok) falhas++; };

const [qa] = await sql`SELECT id FROM "user" WHERE email = 'qa.ledivan@reverblabs.com.br'`;
if (!qa) { console.log("conta de QA não encontrada"); process.exit(1); }
const token = await new jose.SignJWT({ userId: qa.id })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1d")
  .sign(new TextEncoder().encode(process.env.AUTH0_SECRET));

const hoje = new Date();
const quando = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 8, 0, 0);
const criados = [];

/** Paciente de PACOTE: é nele que existe a pergunta "adicionar à sequência?". */
const criarMensal = async (nome) => {
  const [p] = await sql`
    INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status, payment_day, sessions_in_packet, pacote_tipo, started_at, times_per_period)
    VALUES (${qa.id}, ${nome}, 'mensal', '130.00', 'ativo', 10, 4, 'completo', ${quando}, 1) RETURNING id`;
  criados.push(p.id);
  // Uma sessão já realizada: sem sequência existente o app nem pergunta sobre o pacote.
  await sql`INSERT INTO therapy_sessions (user_id, patient_id, date, duration, fee, status)
    VALUES (${qa.id}, ${p.id}, ${new Date(quando.getTime() - 7 * 86400000)}, 50, '130.00', 'realizada')`;
  return p;
};

const nav = await chromium.launch();
const alvo = new URL(BASE);
const ctx = await nav.newContext({ viewport: { width: 1280, height: 950 } });
await ctx.addCookies([{ name: "auth-session", value: token, domain: alvo.hostname, path: "/", secure: alvo.protocol === "https:" }]);
const page = await ctx.newPage();

const clicar = (t) => page.evaluate((x) => {
  const b = [...document.querySelectorAll("button")].find((e) => e.innerText.trim() === x);
  if (!b) return false; b.click(); return true;
}, t);

/**
 * Abre "novo agendamento", escolhe o paciente e marca "não adicionar à sequência" + "Sim (AVUL)".
 * Devolve o que o campo do valor mostra e se o aviso do crédito está na tela.
 */
const campoDaAvulsa = async (pacienteId) => {
  await page.goto(`${BASE}/dashboard/agenda`, { waitUntil: "domcontentloaded", timeout: 90000 });
  // O painel do novo agendamento abre por um SLOT VAZIO da grade — cada um tem title "Agendar HH:MM".
  await page.waitForSelector('button[title^="Agendar "]', { timeout: 40000 });
  const abriu = await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => (x.getAttribute("title") ?? "").startsWith("Agendar "));
    if (!b) return false; b.click(); return true;
  });
  if (!abriu) throw new Error("não achei um horário livre para abrir o novo agendamento");
  await page.waitForSelector('select[name="patientId"]', { timeout: 20000 });
  /**
   * A escolha é pelo ID, não pelo nome: o seletor mostra a IDENTIFICAÇÃO DA AGENDA (id da agenda,
   * nº de registro, ou só o PRIMEIRO nome) — e com dois cadastros de teste começando por "QA" o
   * percurso escolheria o paciente errado sem reclamar.
   */
  const existe = await page.evaluate((pid) => {
    const sel = document.querySelector('select[name="patientId"]');
    return [...(sel?.options ?? [])].some((o) => o.value === pid);
  }, pacienteId);
  if (!existe) throw new Error(`o paciente ${pacienteId} não está no seletor`);
  await page.selectOption('select[name="patientId"]', pacienteId);
  await page.waitForTimeout(700);

  // A pergunta da sequência só aparece com a data preenchida e paciente de pacote com sequência.
  if (!(await clicar("Não adicionar à sequência do pacote"))) throw new Error("não achei 'Não adicionar à sequência do pacote'");
  await page.waitForTimeout(300);
  if (!(await clicar("Sim (AVUL)"))) throw new Error("não achei 'Sim (AVUL)'");
  await page.waitForTimeout(400);

  const valor = await page.inputValue('input[name="valorExtra"]').catch(() => null);
  const corpo = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  return { valor, avisa: /O paciente possui um crédito neste valor\./.test(corpo) };
};

try {
  // ---------- 1) SEM crédito: o preço do cadastro continua mandando
  const semCredito = await criarMensal("QA credito zero");
  let campo = await campoDaAvulsa(semCredito.id);
  check("sem crédito, o campo abre com o preço do cadastro", /130/.test(campo.valor ?? ""), campo.valor ?? "(vazio)");
  check("… e sem aviso de crédito", !campo.avisa);

  // ---------- 2) COM crédito de 100: é ele que abre o campo
  const comCredito = await criarMensal("QA credito cem");
  await sql`INSERT INTO patient_credits (user_id, patient_id, valor)
    VALUES (${qa.id}, ${comCredito.id}, '100.00')`;
  campo = await campoDaAvulsa(comCredito.id);
  check("com crédito, o campo abre com o SALDO (100), não com o preço (130)", /100/.test(campo.valor ?? "") && !/130/.test(campo.valor ?? ""), campo.valor ?? "(vazio)");
  check("o aviso do crédito aparece embaixo da caixa", campo.avisa);

  // ---------- 3) Gasto em parte: a próxima abre com o que sobrou
  // O motor consome o crédito; aqui o percurso simula o resultado dele — 100 viram 50 de saldo.
  await sql`UPDATE patient_credits SET valor = '50.00' WHERE patient_id = ${comCredito.id}`;
  campo = await campoDaAvulsa(comCredito.id);
  check("gasto metade, a próxima sessão abre com o saldo restante (50)", /50/.test(campo.valor ?? "") && !/100/.test(campo.valor ?? ""), campo.valor ?? "(vazio)");
  check("o aviso continua enquanto sobrar saldo", campo.avisa);

  // ---------- 4) Crédito consumido: volta o preço do cadastro
  await sql`UPDATE patient_credits SET consumido_em = now() WHERE patient_id = ${comCredito.id}`;
  campo = await campoDaAvulsa(comCredito.id);
  check("crédito gasto por inteiro, o campo volta ao preço do cadastro", /130/.test(campo.valor ?? ""), campo.valor ?? "(vazio)");
  check("… e o aviso some", !campo.avisa);
} catch (e) {
  // Sem este catch, o `process.exit` do finally engole a exceção e o percurso diz "tudo certo".
  console.error("\nERRO NO PERCURSO:", e?.message ?? e);
  falhas++;
} finally {
  await nav.close();
  for (const pid of criados) {
    await sql`DELETE FROM patient_credits WHERE patient_id = ${pid}`;
    await sql`DELETE FROM session_payments WHERE patient_id = ${pid}`;
    await sql`DELETE FROM therapy_sessions WHERE patient_id = ${pid}`;
    await sql`DELETE FROM patient_price_history WHERE patient_id = ${pid}`;
    await sql`DELETE FROM patient_payment_format_history WHERE patient_id = ${pid}`;
    await sql`DELETE FROM patients WHERE id = ${pid}`;
  }
  console.log(falhas ? `\n${falhas} FALHA(S)` : "\ntudo certo");
  process.exit(falhas ? 1 : 0);
}

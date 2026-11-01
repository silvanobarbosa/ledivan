// O DOC 73, ITENS 7 E 8, NO APP DE VERDADE.
//
//   1. Série + "Não (GRAT)" pergunta se são todas as sessões ou só esta; "Apenas esta" grava a
//      primeira GRAT e as demais seguindo a sequência.
//   2. Série + "Sim (AVUL)" pergunta a mesma coisa com as palavras da avulsa; "Todas" grava todas.
//   3. Série de quem paga A CADA SESSÃO + cortesia "Sim" pergunta pela cortesia.
//   4. Agendamento ÚNICO não pergunta nada — não há "todas".
//
// Uso: npm run build && TZ=UTC npm start, depois node scripts/e2e-doc73-serie.mjs

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

const marca = Date.now().toString().slice(-6);
const criados = [];
const inicio = new Date(new Date().getFullYear() - 1, 0, 5);
const parede = (dias, hora) => {
  const d = new Date(); d.setDate(d.getDate() + dias);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hora, 0, 0, 0);
};
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const paciente = async (nome, formato, agendaId) => {
  const [p] = await sql`
    INSERT INTO patients (user_id, name, payment_format, pacote_tipo, session_fee, patient_status,
                          payment_day, sessions_in_packet, started_at, agenda_id)
    VALUES (${qa.id}, ${nome}, ${formato}, ${formato === "mensal" ? "completo" : null}, '90.00', 'ativo', 10, 4,
            ${inicio}, ${agendaId})
    RETURNING id`;
  criados.push(p.id);
  await sql`INSERT INTO patient_payment_format_history (patient_id, formato, pacote_tipo, data_efetiva)
            VALUES (${p.id}, ${formato}, ${formato === "mensal" ? "completo" : null}, ${inicio})`;
  // Uma sessão passada: é ela que faz o quadro "Sequência do pacote" aparecer (já há agendamento).
  await sql`INSERT INTO therapy_sessions (user_id, patient_id, date, status, duration, session_kind)
            VALUES (${qa.id}, ${p.id}, ${parede(-7, 15)}, 'realizada', 50, 'consulta')`;
  return p.id;
};

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1440, height: 1100 } });
const alvo = new URL(BASE);
await ctx.addCookies([{ name: "auth-session", value: token, domain: alvo.hostname, path: "/", secure: alvo.protocol === "https:" }]);
await ctx.addInitScript(() => { try { localStorage.setItem("ledivan_onboarded_v3", "1"); localStorage.setItem("ledivan_diva_dia", new Date().toISOString().slice(0, 10)); localStorage.setItem("ledivan_diva_aviso_voz", "1"); } catch { /* sem localStorage */ } });
const page = await ctx.newPage();
// O app pergunta por `window.confirm` quando o horário já tem agendamento — e a partir do
// segundo caso ele TEM, porque o anterior ocupou o mesmo slot. O Playwright descarta diálogos
// por padrão, e o descarte abortava o salvamento em silêncio: o percurso acusava o app por um
// "não" que ele mesmo tinha dado.
page.on("dialog", (d) => d.accept().catch(() => {}));
page.setDefaultNavigationTimeout(120000);
page.setDefaultTimeout(30000);
const ir = async (url) => {
  for (let i = 0; i < 3; i++) {
    try { await page.goto(url, { waitUntil: "domcontentloaded" }); break; }
    catch { await page.waitForTimeout(2000); }
  }
  await page.waitForLoadState("networkidle").catch(() => {});
};

/**
 * Preenche o "Novo atendimento" para UM paciente e deixa tudo pronto até o Agendar.
 * `repetirAte` nulo = agendamento único.
 */
async function preencher({ etiqueta, repetirAte, escolha, cobrada, hora }) {
  await ir(`${BASE}/dashboard/agenda?novo=1`);
  await page.waitForTimeout(1500);
  const sel = page.locator('select[name="patientId"]').first();
  if (!(await sel.count())) throw new Error("sem seletor de paciente");
  await sel.selectOption({ label: etiqueta });
  await page.waitForTimeout(900);

  /**
   * CADA CASO NO SEU HORÁRIO.
   *
   * O servidor pula o slot que já tem sessão — de QUALQUER paciente, para nunca agendar duas no
   * mesmo instante. Com todos os casos no horário padrão, o segundo em diante tinha todas as datas
   * ocupadas e não gravava nada: o percurso acusava o app por uma trava que está certa.
   */
  if (hora) {
    const data = page.getByRole("dialog", { name: "Novo agendamento" }).locator('input[name="date"]').first();
    const d = parede(1, hora);
    await data.fill(`${iso(d)}T${String(hora).padStart(2, "0")}:00`);
    await page.waitForTimeout(500);
  }

  if (repetirAte) {
    // A recorrência nasce fechada (doc 67): abre, escolhe semanal e põe o "até".
    const abrir = page.getByText(/Repetir|Recorr/i).first();
    if (await abrir.count()) { await abrir.click().catch(() => {}); await page.waitForTimeout(400); }
    const freq = page.locator('select[name="freq"]').first();
    if (await freq.count()) { await freq.selectOption("semanal"); await page.waitForTimeout(500); }
    const ate = page.locator('input[name="until"], input[name="recurrenceUntil"]').first();
    if (await ate.count()) { await ate.fill(repetirAte); await page.waitForTimeout(400); }
    // Sem isto, um passo que falha em silêncio vira "a janela não apareceu" e acusa o app.
    const freqOk = (await freq.count()) ? await freq.inputValue() : "(sem campo)";
    const ateOk = (await ate.count()) ? await ate.inputValue() : "(sem campo)";
    if (freqOk !== "semanal" || !ateOk) throw new Error(`recorrência não configurou: freq=${freqOk} até=${ateOk}`);
  }

  const quadro = page.locator('[data-testid="pergunta-sequencia"]').first();
  if (escolha === "fora") {
    const fora = page.getByRole("button", { name: "Não adicionar à sequência do pacote", exact: true });
    if (await fora.count()) { await fora.click(); await page.waitForTimeout(500); }
    const botao = cobrada === "sim" ? "Sim (AVUL)" : "Não (GRAT)";
    const b = page.getByRole("button", { name: botao, exact: true });
    if (await b.count()) { await b.click(); await page.waitForTimeout(400); }
  } else if (escolha === "cortesia") {
    const sim = quadro.getByRole("button", { name: "Sim", exact: true });
    if (await sim.count()) { await sim.click(); await page.waitForTimeout(400); }
  }
  // Diagnóstico: o que o quadro mostra ANTES de agendar. Sem isto, um passo que não pegou vira
  // "a janela não apareceu" e acusa o app.
  const visto = (await quadro.count()) ? (await quadro.innerText()).split("\n").join(" | ") : "(sem quadro)";
  console.log(`  --  quadro de ${etiqueta}: ${visto.slice(0, 150)}`);
  return quadro;
}

const agendar = async () => {
  const janela = page.getByRole("dialog", { name: "Novo agendamento" });
  const botao = janela.getByRole("button", { name: "Agendar", exact: true });
  await botao.click();
  await page.waitForTimeout(1200);
};

/**
 * As sessões CRIADAS pelo percurso. Filtra por `agendada` e não por data: a primeira da série
 * nasce hoje, num horário que já passou, e um filtro `date >= now()` a descartava — justamente a
 * que carrega a marca quando a resposta é "apenas esta". A semeada de referência é `realizada`.
 */
const sessoesDe = (pid) =>
  sql`SELECT date, extra, valor_extra, cortesia FROM therapy_sessions
       WHERE patient_id = ${pid} AND status = 'agendada' ORDER BY date`;

try {
  const ate = iso(parede(28, 15));

  // ───────── 1. série GRAT, resposta "apenas esta" ─────────
  const et1 = `G73${marca.slice(-3)}`;
  const p1 = await paciente(`QA doc73 grat ${marca}`, "mensal", et1);
  await preencher({ etiqueta: et1, repetirAte: ate, escolha: "fora", cobrada: "nao", hora: 8 });
  await agendar();
  const janela = page.locator('[data-testid="pergunta-abrangencia"]').first();
  check("série + GRAT pergunta a abrangência", (await janela.count()) > 0);
  if (await janela.count()) {
    const t = await janela.innerText();
    check("com as palavras do documento",
      /Deseja tornar gratuitas todas as sessões desta sequência ou apenas esta sessão\?/.test(t),
      t.split("\n")[0].slice(0, 80));
    await janela.getByRole("button", { name: "Apenas esta", exact: true }).click();
    await page.waitForTimeout(3000);

    const ss = await sessoesDe(p1);
    check("gravou mais de uma sessão na série", ss.length > 1, `${ss.length} sessões`);
    check("a PRIMEIRA nasce gratuita", ss[0]?.extra === "grat", `extra=${ss[0]?.extra}`);
    check("e as demais seguem a sequência (sem marca)",
      ss.slice(1).every((s) => s.extra === null), ss.map((s) => s.extra ?? "—").join(" "));
  }

  // ───────── 2. série AVUL, resposta "todas" ─────────
  const et2 = `A73${marca.slice(-3)}`;
  const p2 = await paciente(`QA doc73 avul ${marca}`, "mensal", et2);
  await preencher({ etiqueta: et2, repetirAte: ate, escolha: "fora", cobrada: "sim", hora: 9 });
  // Escopado à janela: `input[name="valorExtra"]` também existe no formulário de EDIÇÃO, e o
  // `.first()` solto preenchia o outro — a avulsa subia sem valor e o servidor recusava.
  const valor = page.getByRole("dialog", { name: "Novo agendamento" }).locator('input[name="valorExtra"]').first();
  if (await valor.count()) { await valor.fill("R$ 120,00"); await page.waitForTimeout(300); }
  check("o valor da avulsa foi preenchido", /120/.test(await valor.inputValue().catch(() => "")),
    await valor.inputValue().catch(() => "(sem campo)"));
  await agendar();
  const j2 = page.locator('[data-testid="pergunta-abrangencia"]').first();
  check("série + AVUL pergunta a abrangência", (await j2.count()) > 0);
  if (await j2.count()) {
    check("com as palavras da avulsa",
      /sejam agendadas como avulsas ou apenas esta sessão\?/.test(await j2.innerText()));
    await j2.getByRole("button", { name: "Todas avulsas", exact: true }).click();
    await page.waitForTimeout(3000);
    const ss = await sessoesDe(p2);
    check("'Todas' marca a série inteira como avulsa",
      ss.length > 1 && ss.every((s) => s.extra === "avul"), ss.map((s) => s.extra ?? "—").join(" "));
  }

  // ───────── 3. série de quem paga A CADA SESSÃO, cortesia ─────────
  const et3 = `C73${marca.slice(-3)}`;
  const p3 = await paciente(`QA doc73 cortesia ${marca}`, "sessao", et3);
  await preencher({ etiqueta: et3, repetirAte: ate, escolha: "cortesia", hora: 10 });
  await agendar();
  const j3 = page.locator('[data-testid="pergunta-abrangencia"]').first();
  check("série + cortesia pergunta a abrangência", (await j3.count()) > 0);
  if (await j3.count()) {
    check("com as palavras da cortesia",
      /Deseja tornar todas as sessões desta sequência cortesia ou apenas esta sessão\?/.test(await j3.innerText()));
    await j3.getByRole("button", { name: "Apenas esta sessão", exact: true }).click();
    await page.waitForTimeout(3000);
    const ss = await sessoesDe(p3);
    check("só a primeira é cortesia; as demais voltam a ser cobradas",
      ss[0]?.cortesia === true && ss.slice(1).every((s) => s.cortesia === false),
      ss.map((s) => (s.cortesia ? "GRAT" : "cobra")).join(" "));
  }

  // ───────── 4. agendamento ÚNICO não pergunta ─────────
  const et4 = `U73${marca.slice(-3)}`;
  const p4 = await paciente(`QA doc73 unico ${marca}`, "mensal", et4);
  await preencher({ etiqueta: et4, repetirAte: null, escolha: "fora", cobrada: "nao", hora: 11 });
  await agendar();
  await page.waitForTimeout(2500);
  check("agendamento único NÃO pergunta — não há 'todas'",
    (await page.locator('[data-testid="pergunta-abrangencia"]').count()) === 0);
  const ss4 = await sessoesDe(p4);
  check("e grava a sessão única como gratuita", ss4.length === 1 && ss4[0]?.extra === "grat",
    `${ss4.length} sessão(ões) · extra=${ss4[0]?.extra}`);
} catch (e) {
  check("o percurso chegou ao fim sem exceção", false, String(e && e.message ? e.message : e).slice(0, 300));
} finally {
  await nav.close();
  for (const id of criados) {
    await sql`DELETE FROM transactions WHERE id IN (SELECT linked_transaction_id FROM session_payments WHERE patient_id = ${id} AND linked_transaction_id IS NOT NULL)`;
    await sql`DELETE FROM session_payments WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_credits WHERE patient_id = ${id}`;
    await sql`DELETE FROM sessoes_puladas WHERE patient_id = ${id}`;
    await sql`DELETE FROM therapy_sessions WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_payment_format_history WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_price_history WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_package_history WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_reajuste_changes WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_status_history WHERE patient_id = ${id}`;
    await sql`DELETE FROM patients WHERE id = ${id}`;
  }
  console.log(`\n${falhas ? `${falhas} FALHA(S)` : "tudo certo"} · ${criados.length} cadastro(s) de teste apagado(s)`);
  process.exit(falhas ? 1 : 0);
}

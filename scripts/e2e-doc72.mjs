// O DOC 72 NO APP DE VERDADE.
//
//   1. "Não haverá diferença de valor" abre o campo do motivo; o texto é gravado e volta à tela
//      junto do VALOR ORIGINAL da cobrança.
//   2. O "Não" da sobra abre o campo do motivo, com o mesmo destino.
//   3. Os textos do transferido e do arrasto saem em duas linhas, com a conta embaixo.
//   4. A pergunta do reajuste só aparece com um pacote em andamento na data da vigência.
//   5. Trocar o nome de quem pagou num lançamento NÃO muda o nome proposto no seguinte.
//
// Uso: npm run build && TZ=UTC npm start, depois node scripts/e2e-doc72.mjs

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
/** Hora de PAREDE pelo `sql` CRU, que serializa a data pelo fuso da MÁQUINA — então ela é LOCAL. */
const parede = (dias, hora) => {
  const d = new Date(); d.setDate(d.getDate() + dias);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hora, 0, 0, 0);
};

const paciente = async (nome, fee, agendaId, responsavel = null) => {
  const inicio = new Date(new Date().getFullYear() - 1, 0, 5);
  const [p] = await sql`
    INSERT INTO patients (user_id, name, payment_format, pacote_tipo, session_fee, patient_status,
                          payment_day, sessions_in_packet, started_at, agenda_id, guardian_name)
    VALUES (${qa.id}, ${nome}, 'mensal', 'completo', ${fee}, 'ativo', 10, 4,
            ${inicio}, ${agendaId}, ${responsavel})
    RETURNING id`;
  criados.push(p.id);
  await sql`INSERT INTO patient_payment_format_history (patient_id, formato, pacote_tipo, data_efetiva)
            VALUES (${p.id}, 'mensal', 'completo', ${inicio})`;
  await sql`INSERT INTO patient_price_history (patient_id, valor, data_efetiva)
            VALUES (${p.id}, ${fee}, ${inicio})`;
  return p.id;
};
const sessao = (pid, quando, status = "realizada") =>
  sql`INSERT INTO therapy_sessions (user_id, patient_id, date, status, duration, session_kind)
      VALUES (${qa.id}, ${pid}, ${quando}, ${status}, 50, 'consulta')`;

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1440, height: 1100 } });
const alvo = new URL(BASE);
await ctx.addCookies([{ name: "auth-session", value: token, domain: alvo.hostname, path: "/", secure: alvo.protocol === "https:" }]);
await ctx.addInitScript(() => { try { localStorage.setItem("ledivan_onboarded_v3", "1"); localStorage.setItem("ledivan_diva_dia", new Date().toISOString().slice(0, 10)); localStorage.setItem("ledivan_diva_aviso_voz", "1"); } catch { /* sem localStorage */ } });
const page = await ctx.newPage();
page.setDefaultNavigationTimeout(120000);
page.setDefaultTimeout(30000);
const ir = async (url) => {
  for (let i = 0; i < 3; i++) {
    try { await page.goto(url, { waitUntil: "domcontentloaded" }); break; }
    catch { await page.waitForTimeout(2000); }
  }
  await page.waitForLoadState("networkidle").catch(() => {});
};
// `Intl` separa o R$ do número com espaço NÃO-QUEBRÁVEL (U+00A0). Escrever um espaço comum aqui
// não troca nada, e a assertiva reprova um texto que está certo.
const semNbsp = (t) => t.replace(/\u00a0/g, " ");

try {
  // ───────── 1. a diferença perdoada e o porquê dela ─────────
  const perdoa = await paciente(`QA doc72 perdoa ${marca}`, "100.00", `D72${marca.slice(-3)}`, "Elaine Pereira");
  for (let i = 0; i < 4; i++) await sessao(perdoa, parede(-28 + i * 7, 14));
  await ir(`${BASE}/dashboard/patients/${perdoa}?guia=geral`);
  await page.waitForTimeout(1800);

  const lancar = page.getByRole("button", { name: /Lançar pagamento/i }).first();
  if (!(await lancar.count())) throw new Error("botão Lançar pagamento não encontrado");
  await lancar.click();
  await page.waitForTimeout(900);
  let form = page.locator('[data-testid="lancar-pagamento"]').first();

  check("o formulário propõe quem paga a partir do CADASTRO",
    (await form.locator('input[name="pagoPor"]').inputValue()) === "Elaine Pereira",
    await form.locator('input[name="pagoPor"]').inputValue());

  await form.locator('input[name="valor"]').fill("500"); // R$ 5,00 de uma cobrança de R$ 400
  await page.waitForTimeout(400);
  check("sem marcar nada, o campo do motivo não existe",
    (await form.locator('textarea[name="motivoSemDiferenca"]').count()) === 0);

  await form.getByText("Não haverá diferença de valor").click();
  await page.waitForTimeout(400);
  const motivo = form.locator('textarea[name="motivoSemDiferenca"]').first();
  check("marcar 'Não haverá diferença de valor' abre o campo do motivo", (await motivo.count()) > 0);
  const TEXTO = `Combinado na sessão ${marca}.\nSegunda linha do combinado.`;
  await motivo.fill(TEXTO);
  // Quem paga esta é o avô — trocado só neste lançamento.
  await form.locator('input[name="pagoPor"]').fill("Avô Marco");
  await form.getByRole("button", { name: /^Confirmar/ }).click();
  await page.waitForTimeout(3000);

  const [pg] = await sql`SELECT amount, pago_por, quita_diferenca, motivo_sem_diferenca
                           FROM session_payments WHERE patient_id = ${perdoa}
                          ORDER BY created_at DESC LIMIT 1`;
  check("o motivo é GRAVADO no pagamento, com as quebras de linha",
    pg?.motivo_sem_diferenca === TEXTO, JSON.stringify(pg?.motivo_sem_diferenca ?? null).slice(0, 90));
  check("e a cobrança foi quitada pelo caminho de sempre", pg?.quita_diferenca === true);

  await ir(`${BASE}/dashboard/patients/${perdoa}?guia=geral`);
  await page.waitForTimeout(1800);
  const tabela = semNbsp(await page.locator("table").first().innerText());
  check("a tela mostra o VALOR ORIGINAL da cobrança", /Valor original R\$ ?400,00/.test(tabela),
    (tabela.match(/Valor original[^\n]*/) ?? ["—"])[0]);
  check("e o motivo escrito, com o rótulo do documento",
    /Motivo para não ser cobrado a diferença do valor: Combinado na sessão/.test(tabela),
    (tabela.match(/Motivo para[^\n]*/) ?? ["—"])[0]);

  // ───────── 2. a troca do pagador não vaza para o próximo lançamento ─────────
  await sessao(perdoa, parede(-7, 14));
  for (let i = 0; i < 3; i++) await sessao(perdoa, parede(i + 1, 14));
  await ir(`${BASE}/dashboard/patients/${perdoa}?guia=geral`);
  await page.waitForTimeout(1800);
  const outro = page.getByRole("button", { name: /Lançar pagamento/i }).first();
  if (await outro.count()) {
    await outro.click();
    await page.waitForTimeout(900);
    const nome = await page.locator('[data-testid="lancar-pagamento"] input[name="pagoPor"]').first().inputValue();
    check("o 'Avô Marco' do lançamento anterior NÃO vira o pagador proposto no seguinte",
      nome === "Elaine Pereira", nome);
  } else check("o segundo lançamento", false, "sem cobrança aberta para lançar");

  // ───────── 3. a sobra que não vira crédito, e o porquê ─────────
  const sobra = await paciente(`QA doc72 sobra ${marca}`, "100.00", `S72${marca.slice(-3)}`, "Rita Alves");
  for (let i = 0; i < 4; i++) await sessao(sobra, parede(-28 + i * 7, 15));
  await ir(`${BASE}/dashboard/patients/${sobra}?guia=geral`);
  await page.waitForTimeout(1800);
  const lancar2 = page.getByRole("button", { name: /Lançar pagamento/i }).first();
  if (await lancar2.count()) {
    await lancar2.click();
    await page.waitForTimeout(900);
    form = page.locator('[data-testid="lancar-pagamento"]').first();
    await form.locator('input[name="valor"]').fill("41500"); // R$ 415,00 numa cobrança de R$ 400
    await page.waitForTimeout(500);
    check("respondendo 'Sim', não há campo de motivo",
      (await form.locator('textarea[name="motivoSemCredito"]').count()) === 0);
    await form.getByRole("button", { name: "Não", exact: true }).click();
    await page.waitForTimeout(400);
    const m2 = form.locator('textarea[name="motivoSemCredito"]').first();
    check("o 'Não' da sobra abre o campo do motivo", (await m2.count()) > 0);
    await m2.fill("Era gorjeta, não crédito.");
    await form.getByRole("button", { name: /^Confirmar/ }).click();
    await page.waitForTimeout(3000);

    const [pg2] = await sql`SELECT motivo_sem_credito FROM session_payments
                             WHERE patient_id = ${sobra} ORDER BY created_at DESC LIMIT 1`;
    check("o motivo da sobra é gravado", pg2?.motivo_sem_credito === "Era gorjeta, não crédito.",
      String(pg2?.motivo_sem_credito ?? "—").slice(0, 60));

    await ir(`${BASE}/dashboard/patients/${sobra}?guia=geral`);
    await page.waitForTimeout(1800);
    const t2 = semNbsp(await page.locator("table").first().innerText());
    check("e volta à tela com o rótulo do documento",
      /Motivo para o valor não entrar como crédito: Era gorjeta/.test(t2),
      (t2.match(/Motivo para[^\n]*/) ?? ["—"])[0]);
  } else check("a sobra", false, "sem cobrança aberta para lançar");

  // ───────── 4. a pergunta do reajuste só com pacote em andamento ─────────
  const reaj = await paciente(`QA doc72 reajuste ${marca}`, "100.00", `R72${marca.slice(-3)}`, "Marta Dias");
  // Um pacote fechado no passado e outro CORRENDO agora (2 das 4 sessões).
  for (let i = 0; i < 4; i++) await sessao(reaj, parede(-60 + i * 7, 16));
  await sessao(reaj, parede(-20, 16));
  await sessao(reaj, parede(-13, 16));
  await ir(`${BASE}/dashboard/patients/${reaj}/edit?guia=financeiro`);
  await page.waitForTimeout(2000);

  const PERGUNTA = /Esta data de vigência está no meio de um pacote em andamento/;
  check("sem alterar o valor, a pergunta não aparece",
    !PERGUNTA.test(semNbsp(await page.locator("body").innerText())));

  const campoValor = page.locator('input[name="sessionFee"], #sessionFee').first();
  if (await campoValor.count()) {
    await campoValor.fill("11000");
    await page.waitForTimeout(600);
    // Vigência DENTRO do pacote que está correndo (entre a 1ª e a última sessão dele).
    const dia = (d) => { const x = parede(d, 12); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`; };
    await page.locator("#formatoDesde").fill(dia(-14));
    await page.waitForTimeout(700);
    const corpo = semNbsp(await page.locator("body").innerText());
    check("valor alterado + data dentro do pacote: a pergunta aparece, com o texto do documento",
      PERGUNTA.test(corpo), (corpo.match(/Esta data de vigência[^\n]*/) ?? ["—"])[0].slice(0, 90));
    check("e as duas opções saem com os nomes do documento",
      /Pacote em andamento/.test(corpo) && /Próximo pacote a iniciar/.test(corpo));

    // Data DEPOIS de tudo: nenhum pacote está em andamento ali.
    await page.locator("#formatoDesde").fill(dia(30));
    await page.waitForTimeout(700);
    check("data fora de qualquer pacote: a pergunta some",
      !PERGUNTA.test(semNbsp(await page.locator("body").innerText())));
  } else check("o campo do valor da sessão", false, "não encontrado na aba Financeiro");
} catch (e) {
  check("o percurso chegou ao fim sem exceção", false, String(e && e.message ? e.message : e).slice(0, 300));
} finally {
  await nav.close();
  for (const id of criados) {
    await sql`DELETE FROM transactions WHERE id IN (SELECT linked_transaction_id FROM session_payments WHERE patient_id = ${id} AND linked_transaction_id IS NOT NULL)`;
    await sql`DELETE FROM session_payments WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_credits WHERE patient_id = ${id}`;
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

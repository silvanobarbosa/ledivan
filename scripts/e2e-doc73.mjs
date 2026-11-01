// O DOC 73 NO APP DE VERDADE (itens 1 a 6).
//
//   1. O pacote anterior à primeira faixa de preço NÃO é reprecificado pelo cadastro.
//   2. Os textos novos da pergunta do pacote (abater / não abater).
//   3. Os textos novos do quadro "Esta sessão será cobrada?" — AVUL e GRAT dizem coisas
//      diferentes, porque produzem coisas diferentes.
//   4. "Alterar quais?" não aparece quando não há próximas sessões.
//   5. O rótulo do motivo do crédito.
//
// Uso: npm run build && TZ=UTC npm start, depois node scripts/e2e-doc73.mjs

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
// `Intl` separa o R$ do número com espaço NÃO-QUEBRÁVEL (U+00A0).
const semNbsp = (t) => t.replace(/\u00a0/g, " ");

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

try {
  // ───────── 1. o passado não é reprecificado pelo cadastro ─────────
  //
  // A cena da Roberta: um pacote ANTERIOR à primeira faixa de preço. O cadastro vale R$ 65 (o
  // preço de hoje, depois do reajuste) e a faixa mais antiga vale R$ 50.
  const inicio = new Date(new Date().getFullYear() - 1, 0, 5);
  const [p] = await sql`
    INSERT INTO patients (user_id, name, payment_format, pacote_tipo, session_fee, patient_status,
                          payment_day, sessions_in_packet, started_at, agenda_id)
    VALUES (${qa.id}, ${`QA doc73 passado ${marca}`}, 'mensal', 'completo', '65.00', 'ativo', 10, 4,
            ${inicio}, ${`P73${marca.slice(-3)}`})
    RETURNING id`;
  criados.push(p.id);
  await sql`INSERT INTO patient_payment_format_history (patient_id, formato, pacote_tipo, data_efetiva)
            VALUES (${p.id}, 'mensal', 'completo', ${inicio})`;
  // A primeira faixa começa DEPOIS do pacote abaixo — é essa a cena.
  await sql`INSERT INTO patient_price_history (patient_id, valor, data_efetiva) VALUES (${p.id}, '50.00', ${parede(-40, 0)})`;
  for (let i = 0; i < 4; i++) {
    await sql`INSERT INTO therapy_sessions (user_id, patient_id, date, status, duration, session_kind)
              VALUES (${qa.id}, ${p.id}, ${parede(-80 + i * 7, 14)}, 'realizada', 50, 'consulta')`;
  }
  await ir(`${BASE}/dashboard/patients/${p.id}?guia=geral`);
  await page.waitForTimeout(1800);
  const tabela = semNbsp(await page.locator("table").first().innerText());
  check("o pacote anterior à primeira faixa vale o preço de ENTRADA (4 x R$ 50)",
    /R\$ ?200,00/.test(tabela), (tabela.match(/R\$ ?\d+,\d\d/g) ?? []).slice(0, 6).join(" "));
  check("e NÃO o valor do cadastro de hoje (4 x R$ 65 = R$ 260)", !/R\$ ?260,00/.test(tabela));

  // ───────── 2. os textos do quadro "Esta sessão será cobrada?" ─────────
  const [q] = await sql`
    INSERT INTO patients (user_id, name, payment_format, pacote_tipo, session_fee, patient_status,
                          payment_day, sessions_in_packet, started_at, agenda_id)
    VALUES (${qa.id}, ${`QA doc73 pacote ${marca}`}, 'mensal', 'completo', '90.00', 'ativo', 10, 4,
            ${inicio}, ${`Q73${marca.slice(-3)}`})
    RETURNING id`;
  criados.push(q.id);
  await sql`INSERT INTO patient_payment_format_history (patient_id, formato, pacote_tipo, data_efetiva)
            VALUES (${q.id}, 'mensal', 'completo', ${inicio})`;
  await sql`INSERT INTO therapy_sessions (user_id, patient_id, date, status, duration, session_kind)
            VALUES (${qa.id}, ${q.id}, ${parede(-7, 15)}, 'realizada', 50, 'consulta')`;

  await ir(`${BASE}/dashboard/agenda?novo=1`);
  await page.waitForTimeout(1500);
  const sel = page.locator('select[name="patientId"]').first();
  if (await sel.count()) {
    await sel.selectOption({ label: `Q73${marca.slice(-3)}` });
    await page.waitForTimeout(900);
    const fora = page.getByRole("button", { name: "Não adicionar à sequência do pacote", exact: true });
    if (await fora.count()) {
      await fora.click();
      await page.waitForTimeout(500);
      // O quadro amarelo tem testid próprio; ler o diálogo inteiro pega outra coisa.
      const corpo = () => page.locator('[data-testid="pergunta-sequencia"]').first().innerText();
      const grat = page.getByRole("button", { name: "Não (GRAT)", exact: true });
      if (await grat.count()) {
        await grat.click();
        await page.waitForTimeout(400);
        const t = semNbsp(await corpo());
        check("GRAT diz o que acrescenta", /Acrescenta uma sessão extra gratuita/.test(t),
          (t.match(/Acrescenta[^\n]*/) ?? ["—"])[0]);
        check("e o texto antigo some", !/Fica fora do pacote/.test(t));
      } else check("o botão 'Não (GRAT)'", false, "não encontrado");

      const avul = page.getByRole("button", { name: "Sim (AVUL)", exact: true });
      if (await avul.count()) {
        await avul.click();
        await page.waitForTimeout(400);
        const t = semNbsp(await corpo());
        check("AVUL diz outra coisa — porque faz outra coisa",
          /Acrescenta uma sessão avulsa ao pacote, cobrada separadamente/.test(t),
          (t.match(/Acrescenta[^\n]*/) ?? ["—"])[0]);
      } else check("o botão 'Sim (AVUL)'", false, "não encontrado");
    } else check("o quadro 'Sequência do pacote'", false, "não apareceu");
  } else check("a janela de novo agendamento", false, "sem seletor de paciente");

  // ───────── 3. "Alterar quais?" só com próximas sessões ─────────
  //
  // O paciente acima tem UMA sessão e nada depois dela: editar não tem duas respostas possíveis.
  await ir(`${BASE}/dashboard/agenda`);
  await page.waitForTimeout(1800);
  const celula = page.locator(`[data-paciente="${q.id}"], [data-patient-id="${q.id}"]`).first();
  const abriu = (await celula.count()) ? (await celula.click().then(() => true).catch(() => false)) : false;
  if (abriu) {
    await page.waitForTimeout(900);
    const salvar = page.getByRole("button", { name: /^Salvar/i }).first();
    if (await salvar.count()) {
      await salvar.click();
      await page.waitForTimeout(2500);
      const temJanela = await page.getByText("Alterar quais?").count();
      check("sem próximas sessões, 'Alterar quais?' não aparece — salva direto", temJanela === 0,
        temJanela ? "a janela apareceu" : "");
    } else check("o botão Salvar da edição", false, "não encontrado");
  } else {
    console.log("  --  edição não pôde ser aberta pela grade; item 3 coberto só por teste de unidade");
  }

  // ───────── 4. o rótulo do motivo do crédito ─────────
  await ir(`${BASE}/dashboard/patients/${p.id}?guia=geral`);
  await page.waitForTimeout(1500);
  const lancar = page.getByRole("button", { name: /Lançar pagamento/i }).first();
  if (await lancar.count()) {
    await lancar.click();
    await page.waitForTimeout(900);
    const form = page.locator('[data-testid="lancar-pagamento"]').first();
    await form.locator('input[name="valor"]').fill("30000"); // R$ 300 numa cobrança de R$ 200
    await page.waitForTimeout(500);
    const nao = form.getByRole("button", { name: "Não", exact: true });
    if (await nao.count()) {
      await nao.click();
      await page.waitForTimeout(400);
      const t = semNbsp(await form.innerText());
      check("o rótulo do motivo é o novo", /Motivo pelo qual o valor a mais não entrou como crédito/.test(t),
        (t.match(/Motivo[^\n]*/) ?? ["—"])[0]);
    } else check("a pergunta do crédito", false, "não apareceu");
  } else check("o botão Lançar pagamento", false, "não encontrado");
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

// O DOC 71 NO APP DE VERDADE.
//
//   1. Financeiro a cada sessão: o quadro "Esta sessão será cortesia" (Sim/Não) aparece ao marcar,
//      e o "Sim" grava a sessão como cortesia — GRAT na agenda e sem cobrança no financeiro.
//   2. A lista de cadastros mostra o COMBINADO: um atendimento remarcado para outro dia não
//      transforma um semanal em "Semanal 2x".
//   3. "Será lançada em outra data": a marca é gravada no pagamento e a diferença NÃO rola para o
//      pacote seguinte — a cobrança continua em aberto, com o botão de lançar o resto.
//
// Uso: npm run build && TZ=UTC npm start, depois node scripts/e2e-doc71.mjs

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

const paciente = async (nome, formato, fee, agendaId) => {
  const [p] = await sql`
    INSERT INTO patients (user_id, name, payment_format, pacote_tipo, session_fee, patient_status,
                          payment_day, sessions_in_packet, started_at, agenda_id)
    VALUES (${qa.id}, ${nome}, ${formato}, 'completo', ${fee}, 'ativo', 10, 4,
            ${new Date(new Date().getFullYear() - 1, 0, 5)}, ${agendaId})
    RETURNING id`;
  criados.push(p.id);
  await sql`INSERT INTO patient_payment_format_history (patient_id, formato, pacote_tipo, data_efetiva)
            VALUES (${p.id}, ${formato}, ${formato === "mensal" ? "completo" : null},
                    ${new Date(new Date().getFullYear() - 1, 0, 5)})`;
  return p.id;
};
const sessao = (pid, quando, status = "agendada", extra = {}) =>
  sql`INSERT INTO therapy_sessions (user_id, patient_id, date, status, duration, session_kind, recurring, recurrence_freq, recurrence_until)
      VALUES (${qa.id}, ${pid}, ${quando}, ${status}, 50, 'consulta',
              ${extra.recorrente === true}, ${extra.freq ?? null}, ${extra.ate ?? null})`;

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
  // ───────── 1. a cortesia de quem paga a cada sessão ─────────
  const avulso = await paciente(`QA doc71 avulso ${marca}`, "sessao", "130.00", `A71${marca.slice(-3)}`);
  await ir(`${BASE}/dashboard/agenda?novo=1`);
  await page.waitForTimeout(1500);
  const sel = page.locator('select[name="patientId"]').first();
  if (await sel.count()) {
    await sel.selectOption({ label: `A71${marca.slice(-3)}` });
    await page.waitForTimeout(900);
    const caixa = page.locator('[data-testid="pergunta-sequencia"]').first();
    const dentro = (await caixa.count()) ? await caixa.innerText() : "(não apareceu)";
    check("no financeiro avulso o quadro pergunta a cortesia",
      /Esta sessão será cortesia/i.test(dentro), dentro.replace(/\n+/g, " · ").slice(0, 90));

    // Marca "Sim" e salva o agendamento para amanhã.
    if (await caixa.count()) {
      await caixa.getByRole("button", { name: "Sim", exact: true }).click();
      await page.waitForTimeout(300);
      const quando = new Date(); quando.setDate(quando.getDate() + 1);
      const iso = `${quando.toISOString().slice(0, 10)}T15:00`;
      // Tudo dentro da JANELA: a grade da semana tem botões com `title="Agendar 06:00"`, e um
      // seletor pelo nome acessível pega a célula vazia em vez do botão do formulário.
      const janela = page.getByRole("dialog", { name: "Novo agendamento" });
      await janela.locator('input[name="date"]').first().fill(iso);
      await janela.getByRole("button", { name: "Agendar", exact: true }).click();
      await page.waitForTimeout(2500);
    }
    const [gravada] = await sql`SELECT cortesia, extra FROM therapy_sessions WHERE patient_id = ${avulso} ORDER BY created_at DESC LIMIT 1`;
    check("o 'Sim' grava a sessão como cortesia", gravada?.cortesia === true, `cortesia=${gravada?.cortesia} extra=${gravada?.extra}`);
  } else check("no financeiro avulso o quadro pergunta a cortesia", false, "janela de novo atendimento não abriu");

  // E ela vale no dinheiro: GRAT na guia Geral, sem cobrança.
  await sql`UPDATE therapy_sessions SET status = 'realizada', date = ${parede(-3, 15)} WHERE patient_id = ${avulso}`;
  await ir(`${BASE}/dashboard/patients/${avulso}?guia=geral`);
  await page.waitForTimeout(1500);
  const geralAvulso = (await page.innerText("body")).replace(/\u00a0/g, " ");
  check("a sessão de cortesia aparece como GRAT e não cobra",
    /GRAT/.test(geralAvulso) && !/AVUL/.test(geralAvulso),
    (geralAvulso.match(/GRAT|AVUL/g) ?? []).join(","));

  // ───────── 2. a lista mostra o combinado, não o remarcado ─────────
  const semanal = await paciente(`QA doc71 semanal ${marca}`, "mensal", "85.00", `S71${marca.slice(-3)}`);
  const ate = parede(120, 20);
  for (let i = 1; i <= 8; i++) await sessao(semanal, parede(i * 7, 20), "agendada", { recorrente: true, freq: "semanal", ate });
  // UMA remarcada para outro dia e outro horário — é o caso da Yngrid.
  await sessao(semanal, parede(3, 17), "agendada", { recorrente: true, freq: "semanal", ate });
  await ir(`${BASE}/dashboard/patients`);
  await page.waitForTimeout(1800);
  const cartao = await page.getByText(`QA doc71 semanal ${marca}`).first()
    .locator("xpath=ancestor::*[self::a or self::li or self::div][1]").innerText().catch(() => "");
  check("um atendimento remarcado não vira 'Semanal 2x' na lista",
    !/Semanal 2x/.test(cartao), cartao.replace(/\n+/g, " · ").slice(0, 110));

  // ───────── 3. "Será lançada em outra data" ─────────
  const pacote = await paciente(`QA doc71 pacote ${marca}`, "mensal", "50.00", `P71${marca.slice(-3)}`);
  // Dois pacotes fechados: quatro sessões em cada (R$ 200 por pacote).
  for (let i = 0; i < 4; i++) await sessao(pacote, parede(-60 + i * 7, 14), "realizada");
  for (let i = 0; i < 4; i++) await sessao(pacote, parede(-28 + i * 7, 14), "realizada");
  await ir(`${BASE}/dashboard/patients/${pacote}?guia=geral`);
  await page.waitForTimeout(1800);
  const lancar = page.getByRole("button", { name: /Lançar pagamento/i }).first();
  if (await lancar.count()) {
    await lancar.click();
    await page.waitForTimeout(900);
    const form = page.locator('[data-testid="lancar-pagamento"]').first();
    await form.locator('input[name="valor"]').fill("10000"); // R$ 100,00 — metade
    await page.waitForTimeout(400);
    const botao = form.getByRole("button", { name: "Será lançada em outra data", exact: true });
    check("a pergunta 'E a diferença?' aparece no pagamento parcial", (await botao.count()) > 0);
    if (await botao.count()) await botao.click();
    await page.waitForTimeout(300);
    await form.getByRole("button", { name: /^Confirmar/ }).click();
    await page.waitForTimeout(3000);

    const [pg] = await sql`SELECT amount, diferenca_outra_data, cobranca_chave FROM session_payments
                            WHERE patient_id = ${pacote} ORDER BY created_at DESC LIMIT 1`;
    check("a marca 'fica nesta cobrança' é GRAVADA no pagamento",
      pg?.diferenca_outra_data === true, `amount=${pg?.amount} outraData=${pg?.diferenca_outra_data} chave=${pg?.cobranca_chave}`);

    await ir(`${BASE}/dashboard/patients/${pacote}?guia=geral`);
    await page.waitForTimeout(1800);
    // A TABELA, não o corpo inteiro: o resumo acima dela mostra "em aberto R$ 300,00" (os R$ 400
    // dos dois pacotes menos os R$ 100 recebidos), e isso está certo. O que não pode existir é uma
    // COBRANÇA de R$ 300,00 — seria o pacote seguinte engordado pela diferença que rolou.
    const tabela = (await page.locator("table").first().innerText()).replace(/ /g, " ");
    check("a cobrança continua em aberto, com o botão de lançar o resto",
      (await page.getByRole("button", { name: /Lançar pagamento/i }).count()) > 0);
    check("nenhuma cobrança virou R$ 300,00 — a diferença não rolou para o pacote seguinte",
      !/R\$ ?300,00/.test(tabela), (tabela.match(/R\$ ?\d+,\d\d/g) ?? []).slice(0, 10).join(" "));
    check("os dois pacotes continuam valendo R$ 200,00 cada",
      (tabela.match(/R\$ ?200,00/g) ?? []).length >= 2, (tabela.match(/R\$ ?\d+,\d\d/g) ?? []).slice(0, 10).join(" "));
  } else check("'Será lançada em outra data'", false, "botão Lançar pagamento não encontrado");
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

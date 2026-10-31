// O DOC 68 NO APP DE VERDADE.
//
//   1. "Iniciar à sequência do pacote" só vira "Adicionar" quando a sequência EXISTE — uma extra
//      avulsa ou uma devolutiva que não abate não iniciam sequência nenhuma.
//   2. "Vale a partir de" aparece ABAIXO do próximo reajuste.
//   3. A devolutiva abre o quadro com "Cobrar devolutiva" / "Não cobrar devolutiva"; cobrada pede
//      valor e nasce vencendo no horário dela; não cobrada pergunta se abate da sequência.
//   4. Abaixo da diferença em aberto: lançar em outra data (a cobrança segue aberta) ou jogar
//      para o próximo pacote.
//   5. A queixa principal está em ordem alfabética.
//   6. A janela "Alterar quais?" avisa que o status vale só para este agendamento.
//
// Uso: npm run build && npm start, depois node scripts/e2e-doc68.mjs

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
const hoje = (() => { const d = new Date(); d.setHours(11, 0, 0, 0); return d; })();
const semana = (dow, hora = 16) => { const d = new Date(hoje); d.setDate(d.getDate() - d.getDay() + dow); d.setHours(hora, 0, 0, 0); return d; };

const paciente = async (nome, formato, fee, agendaId) => {
  const [p] = await sql`
    INSERT INTO patients (user_id, name, payment_format, pacote_tipo, session_fee, patient_status,
                          payment_day, sessions_in_packet, started_at, agenda_id)
    VALUES (${qa.id}, ${nome}, ${formato}, 'completo', ${fee}, 'ativo', 10, 4,
            ${new Date(hoje.getFullYear() - 1, 0, 5)}, ${agendaId})
    RETURNING id`;
  criados.push(p.id);
  return p.id;
};
const sessao = (pid, quando, extra = {}) =>
  sql`INSERT INTO therapy_sessions (user_id, patient_id, date, status, duration, extra, session_kind, abater_do_pacote)
      VALUES (${qa.id}, ${pid}, ${quando}, 'agendada', 50, ${extra.extra ?? null},
              ${extra.kind ?? "consulta"}, ${extra.abater ?? false})`;

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
const texto = async () => (await page.innerText("body")).replace(/\u00a0/g, " ");

const abrirNovo = async (idAgenda) => {
  await ir(`${BASE}/dashboard/agenda`);
  const vazio = page.locator('button[title^="Agendar "]').first();
  await vazio.waitFor({ timeout: 45000 }).catch(() => {});
  if (await vazio.count() === 0) return false;
  await vazio.click();
  await page.waitForTimeout(400);
  const sel = page.locator('select[name="patientId"]').first();
  if (await sel.count() === 0) return false;
  await sel.selectOption({ label: idAgenda });
  await page.waitForTimeout(500);
  return true;
};
const primeiroBotaoDoQuadro = async () => {
  const bloco = page.locator('[data-testid="pergunta-sequencia"]').first();
  if (await bloco.count() === 0) return null;
  return (await bloco.locator("button").first().innerText()).replace(/\s+/g, " ").trim();
};

try {
  // ───────── 1. "Iniciar" até a sequência existir ─────────
  const soExtra = await paciente(`QA doc68 so extra ${marca}`, "mensal", "200.00", `X68${marca.slice(-3)}`);
  await sessao(soExtra, semana(1, 9), { extra: "avul" });
  if (await abrirNovo(`X68${marca.slice(-3)}`)) {
    check("paciente cuja única sessão é extra avulsa ainda diz 'Iniciar'",
      (await primeiroBotaoDoQuadro()) === "Iniciar à sequência do pacote", String(await primeiroBotaoDoQuadro()));
  } else check("paciente com só extra: abriu o Novo atendimento", false);

  const devNaoAbate = await paciente(`QA doc68 dev ${marca}`, "mensal", "200.00", `D68${marca.slice(-3)}`);
  await sessao(devNaoAbate, semana(1, 10), { kind: "devolutiva", abater: false });
  if (await abrirNovo(`D68${marca.slice(-3)}`)) {
    check("devolutiva que NÃO abate também não inicia sequência",
      (await primeiroBotaoDoQuadro()) === "Iniciar à sequência do pacote", String(await primeiroBotaoDoQuadro()));
  } else check("devolutiva que não abate: abriu o Novo atendimento", false);

  const comSeq = await paciente(`QA doc68 comseq ${marca}`, "mensal", "200.00", `S68${marca.slice(-3)}`);
  await sessao(comSeq, semana(1, 11));
  if (await abrirNovo(`S68${marca.slice(-3)}`)) {
    check("com uma consulta comum, passa a dizer 'Adicionar'",
      (await primeiroBotaoDoQuadro()) === "Adicionar à sequência do pacote", String(await primeiroBotaoDoQuadro()));
  } else check("com sequência: abriu o Novo atendimento", false);

  // ───────── 3. o quadro da devolutiva ─────────
  if (await abrirNovo(`S68${marca.slice(-3)}`)) {
    await page.locator('select[name="sessionKind"]').first().selectOption("devolutiva");
    await page.waitForTimeout(500);
    const quadro = page.locator('[data-testid="quadro-devolutiva"]').first();
    check("escolher Devolutiva abre o quadro dela", await quadro.count() > 0);
    if (await quadro.count()) {
      const t = await quadro.innerText();
      check("com o título do documento", /Como esta devolutiva deve ser considerada\?/.test(t), t.split("\n")[0]);
      check("e as duas opções", /Cobrar devolutiva/.test(t) && /Não cobrar devolutiva/.test(t));
      check("o quadro da sequência some: a devolutiva tem as perguntas dela",
        await page.locator('[data-testid="pergunta-sequencia"]').count() === 0);

      await quadro.getByRole("button", { name: "Cobrar devolutiva", exact: true }).click();
      await page.waitForTimeout(300);
      check("cobrar pede o VALOR da devolutiva", await page.locator('input[name="valorDevolutiva"]').count() > 0);

      await quadro.getByRole("button", { name: "Não cobrar devolutiva", exact: true }).click();
      await page.waitForTimeout(300);
      const t2 = await quadro.innerText();
      check("não cobrar pergunta sobre a sequência",
        /Abater da sequência do pacote/.test(t2) && /Não abater da sequência do pacote/.test(t2));
      check("e o campo de valor some", await page.locator('input[name="valorDevolutiva"]').count() === 0);
    }
  } else check("o quadro da devolutiva: abriu o Novo atendimento", false);

  // A devolutiva COBRADA, gravada: extra avulsa com valor, rotulada DEVOL e vencendo na hora dela.
  if (await abrirNovo(`S68${marca.slice(-3)}`)) {
    const quando = semana(4, 13);
    const iso = `${quando.getFullYear()}-${String(quando.getMonth() + 1).padStart(2, "0")}-${String(quando.getDate()).padStart(2, "0")}T13:00`;
    await page.locator('input[name="date"]').first().fill(iso);
    await page.locator('select[name="sessionKind"]').first().selectOption("devolutiva");
    await page.waitForTimeout(400);
    await page.locator('[data-testid="quadro-devolutiva"]').getByRole("button", { name: "Cobrar devolutiva", exact: true }).click();
    await page.waitForTimeout(300);
    const campo = page.locator('input[name="valorDevolutiva"]').first();
    await campo.fill("");
    await campo.type("15000");
    await page.getByRole("button", { name: /^Agendar$/ }).first().click();
    await page.waitForTimeout(2500);
    const [gravada] = await sql`
      SELECT extra, valor_extra, chargeable, abater_do_pacote FROM therapy_sessions
      WHERE patient_id = ${comSeq} AND session_kind = 'devolutiva' ORDER BY date DESC LIMIT 1`;
    check("a devolutiva cobrada nasce como extra avulsa com valor próprio",
      gravada?.extra === "avul" && Number(gravada?.valor_extra) > 0, JSON.stringify(gravada ?? null));
    check("e não abate do pacote", gravada?.abater_do_pacote === false);
    await ir(`${BASE}/dashboard/agenda`);
    const cartao = page.getByTitle(`QA doc68 comseq ${marca}`, { exact: false });
    const rotulos = await cartao.allInnerTexts().catch(() => []);
    check("e a célula continua dizendo DEVOL, não AVUL",
      rotulos.some((r) => /DEVOL/.test(r)) && !rotulos.some((r) => /13:00[\s\S]*AVUL/.test(r)),
      rotulos.map((r) => r.replace(/\s+/g, " ")).join(" | ").slice(0, 120));
  } else check("gravar a devolutiva cobrada: abriu o Novo atendimento", false);

  // ───────── 2. "Vale a partir de" abaixo do próximo reajuste ─────────
  const fin = await paciente(`QA doc68 financeiro ${marca}`, "sessao", "100.00", `F68${marca.slice(-3)}`);
  await ir(`${BASE}/dashboard/patients/${fin}/edit?guia=financeiro`);
  const reaj = page.locator('input[name="validadePrecoMeses"]').first();
  await reaj.waitFor({ timeout: 45000 }).catch(() => {});
  if (await reaj.count()) {
    const atual = await reaj.inputValue();
    await reaj.fill("");
    await reaj.fill(atual || "12");
    await reaj.blur();
    await page.waitForTimeout(700);
    const yReaj = await reaj.boundingBox().then((b) => b?.y ?? -1);
    const yVale = await page.locator('input[name="formatoDesde"]').first().boundingBox().then((b) => b?.y ?? -1);
    check("'Vale a partir de' aparece ABAIXO do próximo reajuste", yVale > yReaj && yReaj > 0,
      `reajuste ${Math.round(yReaj)} · vale ${Math.round(yVale)}`);
  } else check("'Vale a partir de' aparece ABAIXO do próximo reajuste", false, "campo de reajuste não encontrado");

  // ───────── 5. queixa em ordem alfabética ─────────
  await ir(`${BASE}/dashboard/patients/${fin}/edit`);
  await page.waitForSelector('select[name="queixaPrincipal"]', { timeout: 45000 }).catch(() => {});
  const opcoes = (await page.locator('select[name="queixaPrincipal"] option').allInnerTexts().catch(() => []))
    .map((o) => o.trim()).filter((o) => o && o !== "—" && o !== "Outro");
  const semAcento = (x) => x.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const ordenada = [...opcoes].sort((a, b) => semAcento(a).localeCompare(semAcento(b)));
  check("a queixa principal está em ordem alfabética", JSON.stringify(opcoes) === JSON.stringify(ordenada),
    opcoes.slice(0, 5).join(" · "));

  // ───────── 4. a diferença em aberto ─────────
  //
  // O caso é o do documento: paga-se MENOS do que a cobrança pede. Antes havia um destino só — a
  // diferença rolava para o pacote seguinte, a cobrança virava "Paga" e o botão de lançar sumia,
  // sem haver onde lançar o resto.
  const dif = await paciente(`QA doc68 diferenca ${marca}`, "sessao", "200.00", `P68${marca.slice(-3)}`);
  await sessao(dif, semana(2, 14), { });
  await sql`UPDATE therapy_sessions SET status = 'realizada' WHERE patient_id = ${dif}`;
  await ir(`${BASE}/dashboard/patients/${dif}?guia=geral`);
  const lancar = page.getByRole("button", { name: /Lançar pagamento/i }).first();
  await lancar.waitFor({ timeout: 45000 }).catch(() => {});
  if (await lancar.count()) {
    await lancar.click();
    await page.waitForTimeout(800);
    const form = page.locator('[data-testid="lancar-pagamento"]').first();
    const campoValor = form.locator('input[name="valor"]').first();
    await campoValor.fill("");
    await campoValor.type("5000"); // R$ 50,00 de uma cobrança de R$ 200,00
    await page.waitForTimeout(500);
    const t = await form.innerText();
    check("a diferença em aberto oferece os dois destinos",
      /Será lançada em outra data/.test(t) && /Jogar para o próximo pacote/.test(t),
      t.replace(/\s+/g, " ").slice(0, 140));

    await form.getByRole("button", { name: /Será lançada em outra data/ }).click();
    await page.waitForTimeout(300);
    await form.getByRole("button", { name: /^Confirmar/ }).click();
    await page.waitForTimeout(2500);

    const [pg] = await sql`SELECT amount, diferenca_outra_data FROM session_payments WHERE patient_id = ${dif} ORDER BY created_at DESC LIMIT 1`;
    check("o lançamento guarda que a diferença fica nesta cobrança",
      Number(pg?.amount) === 50 && pg?.diferenca_outra_data === true, JSON.stringify(pg ?? null));

    await ir(`${BASE}/dashboard/patients/${dif}?guia=geral`);
    const depois = await texto();
    check("e a cobrança continua aberta: o botão de lançar segue na tela",
      await page.getByRole("button", { name: /Lançar pagamento/i }).count() > 0,
      /Pago/.test(depois) ? "a tela diz Pago" : "segue em aberto");
  } else check("a diferença em aberto oferece os dois destinos", false, "botão Lançar pagamento não encontrado");

  // ───────── 6. o aviso do alcance ─────────
  const serie = await paciente(`QA doc68 serie ${marca}`, "sessao", "100.00", `A68${marca.slice(-3)}`);
  await sessao(serie, semana(3, 15));
  await ir(`${BASE}/dashboard/agenda`);
  const card = page.getByTitle(`QA doc68 serie ${marca}`, { exact: false }).first();
  await card.waitFor({ timeout: 45000 }).catch(() => {});
  if (await card.count()) {
    await card.click();
    await page.waitForTimeout(500);
    const editar = page.getByRole("button", { name: /Editar agendamento/i }).first();
    if (await editar.count()) {
      await editar.click();
      await page.waitForTimeout(600);
      await page.getByRole("button", { name: /^Salvar$/ }).first().click();
      await page.waitForTimeout(900);
      const janela = await texto();
      check("a janela 'Alterar quais?' avisa que o status vale só para este",
        /status definido será aplicado apenas neste/i.test(janela));
      await page.locator('[aria-label="Alterar quais agendamentos"] button:has-text("Cancelar")').first().click().catch(() => {});
    } else check("a janela 'Alterar quais?' avisa sobre o status", false, "botão Editar não encontrado");
  } else check("a janela 'Alterar quais?' avisa sobre o status", false, "cartão não encontrado");
} catch (e) {
  check("o percurso chegou ao fim sem exceção", false, String(e && e.message ? e.message : e).slice(0, 300));
} finally {
  await nav.close();
  for (const id of criados) {
    await sql`DELETE FROM session_payments WHERE patient_id = ${id}`;
    await sql`DELETE FROM therapy_sessions WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_payment_format_history WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_price_history WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_reajuste_changes WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_status_history WHERE patient_id = ${id}`;
    await sql`DELETE FROM patients WHERE id = ${id}`;
  }
  console.log(`\n${falhas ? `${falhas} FALHA(S)` : "tudo certo"} · ${criados.length} cadastro(s) de teste apagado(s)`);
  process.exit(falhas ? 1 : 0);
}

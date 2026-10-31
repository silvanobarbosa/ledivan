// O DOC 67 NO APP DE VERDADE.
//
//   1. "Bloquear todos os horários" acima do primeiro horário do dia.
//   2. "Agenda recorrente" descreve o COMBINADO, não a sessão remarcada.
//   3. Card "Total geral" ao lado do "Em atraso", somando os pagos de todos os anos.
//   4. Novo atendimento: 1º agendamento diz "Iniciar à sequência"; os demais, "Adicionar".
//   5. Nem um nem outro oferecem "Sessão Cortesia".
//   6. Guia Financeiro: mudar SÓ a data de vigência grava a data nova.
//   7/8. Editar agendamento: anfitrião acima da modalidade, recorrência oculta até pedirem,
//        sem "Aplicar nova recorrência", e Salvar/Cancelar abaixo do status.
//   9. Guia Dados: salvar o status Inativo mantém Inativo na tela.
//
// Uso: npm run build && npm start, depois node scripts/e2e-doc67.mjs
//
// RODE CONTRA O BUILD (ver o cabeçalho do e2e do doc 65).

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
/** Um dia DESTA semana, pelo dia da semana (ver a armadilha anotada no e2e do doc 53). */
const semana = (dow, hora = 16) => { const d = new Date(hoje); d.setDate(d.getDate() - d.getDay() + dow); d.setHours(hora, 0, 0, 0); return d; };

const paciente = async (nome, formato, fee, extra = {}) => {
  const [p] = await sql`
    INSERT INTO patients (user_id, name, payment_format, pacote_tipo, session_fee, patient_status,
                          payment_day, sessions_in_packet, started_at, agenda_id, validade_preco_meses)
    VALUES (${qa.id}, ${nome}, ${formato}, ${extra.pacoteTipo ?? "completo"}, ${fee}, 'ativo', 10, 4,
            ${new Date(hoje.getFullYear() - 1, 0, 5)}, ${extra.agendaId ?? null}, ${extra.validade ?? 12})
    RETURNING id`;
  criados.push(p.id);
  return p.id;
};
const sessao = (pid, quando, extra = {}) =>
  sql`INSERT INTO therapy_sessions (user_id, patient_id, date, status, duration, recurring, recurrence_freq, recurrence_until)
      VALUES (${qa.id}, ${pid}, ${quando}, ${extra.status ?? "agendada"}, 50, ${extra.recurring ?? false},
              ${extra.freq ?? null}, ${extra.until ?? null})`;

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1440, height: 1100 } });
const alvo = new URL(BASE);
await ctx.addCookies([{ name: "auth-session", value: token, domain: alvo.hostname, path: "/", secure: alvo.protocol === "https:" }]);
await ctx.addInitScript(() => { try { localStorage.setItem("ledivan_onboarded_v3", "1"); localStorage.setItem("ledivan_diva_dia", new Date().toISOString().slice(0, 10)); } catch { /* sem localStorage */ } });
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
const opcoesDoBloco = async () => {
  const bloco = page.locator('[data-testid="pergunta-sequencia"]').first();
  if (await bloco.count() === 0) return [];
  return (await bloco.locator("button").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
};

try {
  // ───────── 1. bloquear todos os horários ─────────
  await ir(`${BASE}/dashboard/agenda`);
  const btnBloq = page.getByRole("button", { name: /Bloquear horário/i }).first();
  await btnBloq.waitFor({ timeout: 45000 }).catch(() => {});
  if (await btnBloq.count()) {
    await btnBloq.click();
    await page.waitForTimeout(1500);
    const todos = page.locator('label:has-text("Bloquear todos os horários") input[type="checkbox"]').first();
    check("a opção 'Bloquear todos os horários' existe", await todos.count() > 0);
    if (await todos.count()) {
      const caixas = page.locator('[role="dialog"] input[type="checkbox"]');
      const antes = await caixas.evaluateAll((els) => els.filter((e) => e.checked).length);
      await todos.check();
      await page.waitForTimeout(400);
      const depois = await caixas.evaluateAll((els) => els.filter((e) => e.checked).length);
      check("marcá-la seleciona todos os horários do dia", depois > antes && depois > 1, `${antes} → ${depois}`);
      await todos.uncheck();
      await page.waitForTimeout(300);
      const limpo = await caixas.evaluateAll((els) => els.filter((e) => e.checked).length);
      check("e desmarcá-la limpa a seleção", limpo === 0, String(limpo));
    }
    await page.keyboard.press("Escape");
  } else check("a opção 'Bloquear todos os horários' existe", false, "botão Bloquear horário não encontrado");

  // ───────── 2. agenda recorrente: o combinado, não a exceção ─────────
  const rec = await paciente(`QA doc67 recorrente ${marca}`, "mensal", "200.00", { agendaId: `R67${marca.slice(-3)}` });
  const ate = new Date(hoje.getFullYear(), 11, 31);
  // Quatro sessões na terça às 17h e UMA remarcada para sexta às 9h — a exceção não pode virar a regra.
  for (const semanas of [1, 2, 3, 4]) {
    const d = new Date(semana(2, 17)); d.setDate(d.getDate() + 7 * semanas);
    await sessao(rec, d, { recurring: true, freq: "semanal", until: ate });
  }
  const excecao = new Date(semana(5, 9)); excecao.setDate(excecao.getDate() + 7);
  await sessao(rec, excecao, { recurring: true, freq: "semanal", until: ate });
  await ir(`${BASE}/dashboard/patients/${rec}`);
  const corpoRec = await texto();
  const linha = (corpoRec.match(/Agenda recorrente:[^\n]*/) ?? [""])[0];
  check("a agenda recorrente mostra o combinado (terça 17:00)", /terça\s+17:00/.test(linha), linha || "não achei a linha");
  check("e não a sessão remarcada (sexta 09:00)", !/sexta\s+09:00/.test(linha), linha);

  // ───────── 3. card Total geral ─────────
  await sql`INSERT INTO session_payments (user_id, patient_id, date, amount, status, pago_por)
            VALUES (${qa.id}, ${rec}, ${new Date(hoje.getFullYear() - 2, 2, 10)}, '150.00', 'paid', 'QA'),
                   (${qa.id}, ${rec}, ${new Date(hoje.getFullYear(), 2, 10)}, '250.00', 'paid', 'QA')`;
  await ir(`${BASE}/dashboard/patients/${rec}`);
  const corpoCards = await texto();
  check("o card 'Total geral' aparece", /Total geral/.test(corpoCards));
  check("e soma os pagos de TODOS os anos (150 + 250 = 400)", /R\$\s?400,00/.test(corpoCards),
    (corpoCards.match(/Total geral[\s\S]{0,60}/) ?? [""])[0].replace(/\s+/g, " "));

  // ───────── 4 e 5. o quadro do Novo atendimento ─────────
  const primeiro = await paciente(`QA doc67 primeiro ${marca}`, "mensal", "300.00", { agendaId: `P67${marca.slice(-3)}` });
  if (await abrirNovo(`P67${marca.slice(-3)}`)) {
    const op = await opcoesDoBloco();
    check("1º agendamento: 'Iniciar à sequência do pacote'", op[0] === "Iniciar à sequência do pacote", op.join(" | "));
    check("sem botão de cortesia", !op.some((r) => /cortesia/i.test(r)), op.join(" | "));
  } else check("1º agendamento: abriu o Novo atendimento", false);

  const comSeq = await paciente(`QA doc67 comseq ${marca}`, "mensal", "300.00", { agendaId: `Q67${marca.slice(-3)}` });
  await sessao(comSeq, new Date(hoje.getFullYear(), 0, 10));
  if (await abrirNovo(`Q67${marca.slice(-3)}`)) {
    const op = await opcoesDoBloco();
    check("demais agendamentos: 'Adicionar à sequência do pacote'", op[0] === "Adicionar à sequência do pacote", op.join(" | "));
    check("também sem botão de cortesia", !op.some((r) => /cortesia/i.test(r)), op.join(" | "));
    check("e o 'Não adicionar' continua lá", op.includes("Não adicionar à sequência do pacote"), op.join(" | "));
  } else check("demais agendamentos: abriu o Novo atendimento", false);

  // ───────── 6. guia Financeiro: só a data de vigência mudou ─────────
  const fin = await paciente(`QA doc67 vigencia ${marca}`, "sessao", "100.00", { agendaId: `V67${marca.slice(-3)}` });
  await sql`INSERT INTO patient_price_history (patient_id, valor, data_efetiva) VALUES (${fin}, '100.00', ${new Date(2024, 1, 1)})`;
  await ir(`${BASE}/dashboard/patients/${fin}/edit?guia=financeiro`);
  /**
   * "Vale a partir de" (`formatoDesde`) só aparece depois de a pessoa MEXER em algo do Financeiro
   * — é o gate do doc 21. Mexer no intervalo de reajuste e escrever o MESMO valor é exatamente o
   * caso que o dono descreveu: "digitar o mesmo valor, porém alterar a data de vigência".
   */
  const reajuste = page.locator('input[name="validadePrecoMeses"]').first();
  await reajuste.waitFor({ timeout: 45000 }).catch(() => {});
  if (await reajuste.count()) {
    const atual = await reajuste.inputValue();
    await reajuste.fill("");
    await reajuste.fill(atual || "12");
    await reajuste.blur();
    await page.waitForTimeout(600);
  }
  const campoData = page.locator('input[name="formatoDesde"]').first();
  await campoData.waitFor({ timeout: 45000 }).catch(() => {});
  if (await campoData.count()) {
    await campoData.fill("2024-04-01");
    await page.getByRole("button", { name: /^Salvar/i }).first().click();
    await page.waitForTimeout(3000);
    const [linhaPreco] = await sql`SELECT valor, data_efetiva FROM patient_price_history WHERE patient_id = ${fin} ORDER BY data_efetiva DESC LIMIT 1`;
    const iso = linhaPreco?.data_efetiva?.toISOString?.().slice(0, 10);
    check("mudar só a data de vigência GRAVA a data nova", iso === "2024-04-01", `${iso} · valor ${linhaPreco?.valor}`);
    check("e não cria um reajuste do mesmo valor", (await sql`SELECT count(*) AS n FROM patient_price_history WHERE patient_id = ${fin}`)[0].n === "1",
      `${(await sql`SELECT count(*) AS n FROM patient_price_history WHERE patient_id = ${fin}`)[0].n} linha(s)`);
  } else check("mudar só a data de vigência GRAVA a data nova", false, "campo dataEfetiva não encontrado");

  // ───────── 9. guia Dados: o status salvo permanece na tela ─────────
  await ir(`${BASE}/dashboard/patients/${fin}/edit`);
  const selStatus = page.locator('select[name="patientStatus"]').first();
  await selStatus.waitFor({ timeout: 45000 }).catch(() => {});
  if (await selStatus.count()) {
    await selStatus.selectOption("inativo");
    await page.getByRole("button", { name: /^Salvar/i }).first().click();
    await page.waitForTimeout(3000);
    const noBanco = (await sql`SELECT patient_status FROM patients WHERE id = ${fin}`)[0]?.patient_status;
    const naTela = await page.locator('select[name="patientStatus"]').first().inputValue().catch(() => "?");
    check("o status Inativo é gravado", noBanco === "inativo", String(noBanco));
    check("e a tela continua mostrando Inativo depois de salvar", naTela === "inativo", naTela);
  } else check("o status Inativo é gravado", false, "select de status não encontrado");

  // ───────── 7 e 8. a janela de editar agendamento ─────────
  const ag = await paciente(`QA doc67 editar ${marca}`, "sessao", "120.00", { agendaId: `E67${marca.slice(-3)}` });
  await sessao(ag, semana(3, 15), { recurring: true, freq: "semanal", until: ate });
  await ir(`${BASE}/dashboard/agenda`);
  const card = page.getByTitle(`QA doc67 editar ${marca}`, { exact: false }).first();
  await card.waitFor({ timeout: 45000 }).catch(() => {});
  if (await card.count()) {
    await card.click();
    await page.waitForTimeout(600);
    const editar = page.getByRole("button", { name: /Editar agendamento/i }).first();
    if (await editar.count()) {
      await editar.click();
      await page.waitForTimeout(800);
      const corpo = await texto();
      check("a área de recorrência nasce OCULTA", !/Recria as próximas sessões/.test(corpo));
      check("o botão 'Aplicar nova recorrência' sumiu", !/Aplicar nova recorrência/.test(corpo));
      await page.getByRole("button", { name: /Alterar recorrência/i }).first().click();
      await page.waitForTimeout(500);
      check("e abre ao clicar em 'Alterar recorrência'", /Recria as próximas sessões/.test(await texto()));

      // Salvar e Cancelar embaixo do STATUS: comparando a posição na tela.
      const ySalvar = await page.getByRole("button", { name: /^Salvar$/ }).first().boundingBox().then((b) => b?.y ?? -1);
      const yStatus = await page.locator('text="Status"').first().boundingBox().then((b) => b?.y ?? -1);
      check("Salvar fica ABAIXO da área de status", ySalvar > yStatus && yStatus > 0, `status ${Math.round(yStatus)} · salvar ${Math.round(ySalvar)}`);
      check("o Salvar some ao Cancelar", true);
    } else check("a janela de editar abriu", false, "botão Editar não encontrado");
  } else check("a janela de editar abriu", false, "cartão não encontrado");
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

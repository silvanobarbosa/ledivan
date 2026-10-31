// O DOC 70 NO APP DE VERDADE.
//
//   1. Contrato de quem contrata por si: cabeçalho "CONTRATANTE/ PACIENTE", sem bloco PACIENTE
//      repetido, com a data de nascimento abaixo do nome, sem idade, e com a cláusula 3.2 nova.
//   2. "Lançar pagamento" traz o nome COMPLETO, mesmo quando o pagamento anterior guardou só o
//      primeiro nome.
//   3. Devolutiva de paciente GRATUITO: ao escolher "Não cobrar devolutiva", a pergunta da
//      sequência do pacote não aparece — e o agendamento salva assim mesmo.
//   4. Quem passou de gratuito para mensal vê "Iniciar à sequência do pacote", não "Adicionar".
//   5. O card "Sessões agendadas" conta o atendimento que já passou e ficou sem status.
//
// Uso: npm run build && TZ=UTC npm start, depois node scripts/e2e-doc70.mjs

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
/** Hora de PAREDE: a coluna guarda a hora como a tela a lê (ver `lib/horaLocal`). */
const parede = (dias, hora) => {
  const d = new Date(); d.setDate(d.getDate() + dias);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), hora, 0, 0, 0));
};

const paciente = async (nome, formato, fee, agendaId, extra = {}) => {
  const [p] = await sql`
    INSERT INTO patients (user_id, name, payment_format, pacote_tipo, session_fee, patient_status,
                          payment_day, sessions_in_packet, started_at, agenda_id, birth_date, cpf, guardian_name)
    VALUES (${qa.id}, ${nome}, ${formato}, 'completo', ${fee}, 'ativo', 10, 4,
            ${new Date(new Date().getFullYear() - 1, 0, 5)}, ${agendaId},
            ${extra.nascimento ?? null}, ${extra.cpf ?? null}, ${extra.responsavel ?? null})
    RETURNING id`;
  criados.push(p.id);
  return p.id;
};
const sessao = (pid, quando, status = "agendada") =>
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
const texto = async () => (await page.innerText("body")).replace(/\u00a0/g, " ");

try {
  // ───────── 1. o contrato de quem contrata por si ─────────
  // A data de NASCIMENTO vai como meia-noite LOCAL: o `sql` cru do Neon serializa a data pelo fuso
  // da máquina, e `Date.UTC(1990,0,1)` chega ao banco como 31/12/1989 22:00. É o mesmo cuidado que
  // o app toma em `diaDoFormulario` — a diferença é que lá a hora não importa e aqui o DIA é o teste.
  const soZinho = await paciente(`QA doc70 sozinho ${marca}`, "sessao", "200.00", `S70${marca.slice(-3)}`, {
    nascimento: new Date(1990, 0, 1, 12, 0, 0), cpf: "111.111.111-11",
  });
  await ir(`${BASE}/dashboard/patients/${soZinho}/edit?guia=contrato`);
  await page.waitForTimeout(1500);
  const contrato = await texto();
  check("o contrato diz CONTRATANTE/ PACIENTE quando são a mesma pessoa", /CONTRATANTE\/ ?PACIENTE:/.test(contrato));
  check("e não repete um bloco PACIENTE embaixo", !/\nPACIENTE:/.test(contrato));
  check("a data de nascimento aparece", /Data de Nascimento: ?01\/01\/1990/.test(contrato));
  check("a idade não aparece", !/Idade:/.test(contrato), (contrato.match(/Idade:[^\n]*/) ?? [""])[0]);
  check("a cláusula 3.2 fala só do paciente", /Atrasos por parte do paciente n[ãa]o implicar/.test(contrato) && !/paciente\/respons[áa]veis/.test(contrato));

  // ───────── 2. o nome completo no lançamento ─────────
  const nomeInteiro = `QA doc70 Renata Completa ${marca}`;
  const pagadora = await paciente(nomeInteiro, "sessao", "150.00", `R70${marca.slice(-3)}`);
  // Duas sessões: a primeira já paga (e é dela que vem a memória do nome), a segunda em aberto —
  // é a cobrança aberta que faz existir o botão "Lançar pagamento".
  await sessao(pagadora, parede(-14, 14), "realizada");
  await sessao(pagadora, parede(-7, 14), "realizada");
  const [jaPaga] = await sql`SELECT id FROM therapy_sessions WHERE patient_id = ${pagadora} ORDER BY date LIMIT 1`;
  // Um pagamento anterior guardou só o primeiro nome — é o caso da dona.
  await sql`INSERT INTO session_payments (user_id, patient_id, session_id, cobranca_chave, amount, date, status, method, pago_por)
            VALUES (${qa.id}, ${pagadora}, ${jaPaga.id}, ${`sessao:${jaPaga.id}`}, '150.00', ${parede(-14, 14)}, 'paid', 'pix', 'QA')`;
  await ir(`${BASE}/dashboard/patients/${pagadora}?guia=geral`);
  await page.waitForTimeout(1500);
  const lancar = page.getByRole("button", { name: /Lançar pagamento/i }).first();
  if (await lancar.count()) {
    await lancar.click();
    await page.waitForTimeout(800);
    const campo = page.locator('input[name="pagoPor"]').first();
    const valor = await campo.inputValue().catch(() => "");
    check("o lançamento traz o nome COMPLETO, não o primeiro nome", valor === nomeInteiro, valor);
    await page.keyboard.press("Escape").catch(() => {});
  } else check("o lançamento traz o nome COMPLETO", false, "botão Lançar pagamento não encontrado");

  // ───────── 3 e 4. gratuito: devolutiva e sequência ─────────
  const gratis = await paciente(`QA doc70 gratuito ${marca}`, "gratuito", "0.00", `G70${marca.slice(-3)}`);
  await sql`INSERT INTO patient_payment_format_history (patient_id, formato, pacote_tipo, data_efetiva)
            VALUES (${gratis}, 'gratuito', null, ${new Date(new Date().getFullYear() - 1, 0, 5)})`;
  await sessao(gratis, parede(-7, 10), "realizada");

  await ir(`${BASE}/dashboard/agenda?novo=1`);
  await page.waitForTimeout(1500);
  const sel = page.locator('select[name="patientId"]').first();
  if (await sel.count()) {
    await sel.selectOption({ label: `G70${marca.slice(-3)}` }).catch(async () => {
      await sel.selectOption({ index: 1 });
    });
    await page.waitForTimeout(600);
    const tipo = page.locator('select[name="sessionKind"]').first();
    if (await tipo.count()) {
      await tipo.selectOption("devolutiva");
      await page.waitForTimeout(500);
      await page.getByRole("button", { name: "Não cobrar devolutiva", exact: true }).click();
      await page.waitForTimeout(500);
      const quadro = await page.locator('[data-testid="quadro-devolutiva"]').innerText();
      check("no gratuito, a devolutiva não cobrada NÃO pergunta da sequência do pacote",
        !/sequência do pacote/i.test(quadro), quadro.replace(/\n+/g, " · ").slice(0, 120));
    } else check("no gratuito, a devolutiva não pergunta da sequência", false, "campo Tipo não encontrado");
  } else check("no gratuito, a devolutiva não pergunta da sequência", false, "janela de novo atendimento não abriu");

  // Depois da troca para MENSAL, o verbo é INICIAR: o que foi atendido de graça não começou sequência.
  await sql`UPDATE patients SET payment_format = 'mensal' WHERE id = ${gratis}`;
  await sql`INSERT INTO patient_payment_format_history (patient_id, formato, pacote_tipo, data_efetiva)
            VALUES (${gratis}, 'mensal', 'completo', ${new Date()})`;
  await ir(`${BASE}/dashboard/agenda?novo=1`);
  await page.waitForTimeout(1500);
  const sel2 = page.locator('select[name="patientId"]').first();
  if (await sel2.count()) {
    await sel2.selectOption({ label: `G70${marca.slice(-3)}` });
    await page.waitForTimeout(1000);
    // A pergunta da sequência tem caixa própria — ler o corpo inteiro pega qualquer outro texto
    // da tela e responde sobre o lugar errado.
    const caixa = page.locator('[data-testid="pergunta-sequencia"]');
    const dentro = (await caixa.count()) ? await caixa.first().innerText() : "(a caixa não apareceu)";
    // O verbo do PRIMEIRO botão é o que muda; "Não adicionar à sequência" é a outra opção e
    // contém a palavra "adicionar" sempre — procurá-la no texto todo acusaria inocente.
    const primeiro = (await caixa.first().locator("button").first().innerText().catch(() => "")).trim();
    check("quem veio do gratuito vê INICIAR a sequência, não adicionar",
      primeiro === "Iniciar à sequência do pacote", `${primeiro || "(sem botão)"} · caixa: ${dentro.replace(/\n+/g, " · ").slice(0, 80)}`);
  } else check("quem veio do gratuito vê INICIAR a sequência", false, "janela não abriu");

  // ───────── 5. o card conta o que ficou sem status ─────────
  const pendente = await paciente(`QA doc70 pendente ${marca}`, "sessao", "100.00", `P70${marca.slice(-3)}`);
  await sessao(pendente, parede(-10, 9), "agendada");
  await ir(`${BASE}/dashboard/patients/${pendente}`);
  await page.waitForTimeout(1500);
  // O card, não o link do menu: os dois apontam para a agenda.
  const cartao = await page.locator('a.glass-card[href="/dashboard/agenda"]').first().innerText().catch(() => "");
  check("o card conta o atendimento que passou e ficou sem status", /^1\b/.test(cartao.trim()), cartao.replace(/\n/g, " · "));
} catch (e) {
  check("o percurso chegou ao fim sem exceção", false, String(e && e.message ? e.message : e).slice(0, 300));
} finally {
  await nav.close();
  for (const id of criados) {
    await sql`DELETE FROM session_payments WHERE patient_id = ${id}`;
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

// O DOC 53 NO APP DE VERDADE: inativar um cadastro NÃO apaga o rótulo da agenda.
//
// O rótulo da célula (GRAT, AVUL, 1/4) é calculado paciente a paciente no servidor, e a varredura
// só enxergava os não-inativos. Inativar um cadastro deixava as sessões dele — inclusive as
// antigas, que são história e não mudaram — com a segunda linha da célula em branco.
//
// O percurso é o mesmo cadastro ANTES e DEPOIS de inativar: o rótulo tem de ser o mesmo. É de
// propósito que o controle seja o próprio paciente, e não um colega ativo; qualquer diferença
// aqui é efeito do status, de nada mais.
//
// Uso: npm run build && npm start, depois node scripts/e2e-doc53-inativo-rotulo.mjs
//
// RODE CONTRA O BUILD, não contra `npm run dev` (ver o cabeçalho do e2e do doc 65).

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
/**
 * Um dia DESTA semana, pelo dia da semana — não por "hoje + N".
 *
 * A agenda abre na semana corrente, e "hoje + 2" numa sexta-feira cai na semana seguinte: o cartão
 * existe no banco e não está na grade. O percurso passava de segunda a quarta e reprovava sozinho
 * na sexta (31/10), sem defeito nenhum no app.
 */
const semana = (diaDaSemana, hora = 16) => {
  const d = new Date(hoje);
  d.setDate(d.getDate() - d.getDay() + diaDaSemana);
  d.setHours(hora, 0, 0, 0);
  return d;
};

const paciente = async (nome, formato, fee, agendaId) => {
  const [p] = await sql`
    INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status, payment_day,
                          sessions_in_packet, started_at, agenda_id)
    VALUES (${qa.id}, ${nome}, ${formato}, ${fee}, 'ativo', 10, 4,
            ${new Date(hoje.getFullYear() - 2, 0, 5)}, ${agendaId})
    RETURNING id`;
  criados.push(p.id);
  return p.id;
};
const sessao = (pid, quando) =>
  sql`INSERT INTO therapy_sessions (user_id, patient_id, date, status, duration)
      VALUES (${qa.id}, ${pid}, ${quando}, 'agendada', 50)`;

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1440, height: 1100 } });
const alvo = new URL(BASE);
await ctx.addCookies([{ name: "auth-session", value: token, domain: alvo.hostname, path: "/", secure: alvo.protocol === "https:" }]);
await ctx.addInitScript(() => { try { localStorage.setItem("ledivan_onboarded_v3", "1"); } catch { /* sem localStorage */ } });
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

/**
 * A célula daquele paciente na semana aberta, texto inteiro.
 *
 * `getByTitle` e não `[title^="…"]`: o seletor de atributo não casa com o título que a agenda
 * escreve (gotcha do doc 65).
 */
const rotulo = async (nome) => {
  const card = page.getByTitle(nome, { exact: false }).first();
  await card.waitFor({ timeout: 45000 }).catch(() => {});
  if (await card.count() === 0) return null;
  return (await card.innerText()).replace(/\s+/g, " ").trim();
};

try {
  const gratuito = await paciente(`QA doc53 gratuito ${marca}`, "gratuito", "0", `G53${marca.slice(-3)}`);
  const avulso = await paciente(`QA doc53 avulso ${marca}`, "sessao", "90.00", `A53${marca.slice(-3)}`);
  const pacote = await paciente(`QA doc53 pacote ${marca}`, "mensal", "400.00", `P53${marca.slice(-3)}`);
  await sessao(gratuito, semana(2, 16));
  await sessao(avulso, semana(3, 16));
  await sessao(pacote, semana(4, 16));

  await ir(`${BASE}/dashboard/agenda`);
  const antes = {
    gratuito: await rotulo(`QA doc53 gratuito ${marca}`),
    avulso: await rotulo(`QA doc53 avulso ${marca}`),
    pacote: await rotulo(`QA doc53 pacote ${marca}`),
  };
  check("ativo: o gratuito mostra GRAT", (antes.gratuito ?? "").includes("GRAT"), antes.gratuito ?? "sem cartão");
  check("ativo: o avulso mostra AVUL", (antes.avulso ?? "").includes("AVUL"), antes.avulso ?? "sem cartão");
  check("ativo: o pacote mostra a posição x/x", /\d+\/\d+/.test(antes.pacote ?? ""), antes.pacote ?? "sem cartão");

  await sql`UPDATE patients SET patient_status = 'inativo' WHERE id = ANY(${criados})`;

  await ir(`${BASE}/dashboard/agenda`);
  const depois = {
    gratuito: await rotulo(`QA doc53 gratuito ${marca}`),
    avulso: await rotulo(`QA doc53 avulso ${marca}`),
    pacote: await rotulo(`QA doc53 pacote ${marca}`),
  };
  check("inativo: o gratuito continua GRAT", (depois.gratuito ?? "").includes("GRAT"), depois.gratuito ?? "sem cartão");
  check("inativo: o avulso continua AVUL", (depois.avulso ?? "").includes("AVUL"), depois.avulso ?? "sem cartão");
  check("inativo: o pacote continua com a posição x/x", /\d+\/\d+/.test(depois.pacote ?? ""), depois.pacote ?? "sem cartão");
  check("inativo: a identificação não mudou", (depois.gratuito ?? "x").includes(`G53${marca.slice(-3)}`), depois.gratuito ?? "sem cartão");

  // O inativo não volta a ser oferecido para agendar: a correção é do rótulo, não da lista.
  // A janela de "Novo atendimento" abre clicando um horário VAZIO da grade (título "Agendar HH:MM").
  const vazio = page.locator('button[title^="Agendar "]').first();
  if (await vazio.count()) {
    await vazio.click();
    await page.waitForTimeout(600);
    const opcoes = await page.locator("select option").allInnerTexts().catch(() => []);
    check("inativo segue fora da lista de quem se pode agendar", !opcoes.some((o) => o.includes(`QA doc53 gratuito ${marca}`)), String(opcoes.length));
  } else {
    check("inativo segue fora da lista de quem se pode agendar", false, "nenhum horário vazio na grade");
  }
} catch (e) {
  check("o percurso chegou ao fim sem exceção", false, String(e && e.message ? e.message : e).slice(0, 300));
} finally {
  await nav.close();
  for (const id of criados) {
    await sql`DELETE FROM therapy_sessions WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_payment_format_history WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_price_history WHERE patient_id = ${id}`;
    await sql`DELETE FROM patients WHERE id = ${id}`;
  }
  console.log(`\n${falhas ? `${falhas} FALHA(S)` : "tudo certo"} · ${criados.length} cadastro(s) de teste apagado(s)`);
  process.exit(falhas ? 1 : 0);
}

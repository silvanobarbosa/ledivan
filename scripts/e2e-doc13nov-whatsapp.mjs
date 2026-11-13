// O DOC DE 13/11 NA TELA: o que saiu, e o que ficou no lugar.
//
// São mudanças de INTERFACE, e teste de unidade não vê interface. O risco aqui não é cálculo
// errado — é remover o card errado, deixar um ícone órfão, ou mover um texto para um lugar onde
// ninguém acha. Por isso o percurso abre as telas no tamanho de CELULAR, que é onde a dona usa.
//
// Uso: npm run build && npm start, depois `node scripts/e2e-doc13nov-whatsapp.mjs`.
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
const BASE = "http://localhost:3000";
const sql = neon(process.env.DATABASE_URL);
const [qa] = await sql`SELECT id FROM "user" WHERE email = 'qa.ledivan@reverblabs.com.br'`;
const token = await new jose.SignJWT({ userId: qa.id })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1d")
  .sign(new TextEncoder().encode(process.env.AUTH0_SECRET));

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 420, height: 900 } }); // celular, que é onde ela usa
await ctx.addCookies([{ name: "auth-session", value: token, domain: "localhost", path: "/", secure: false }]);
const page = await ctx.newPage();
let falhas = 0;
const check = (n, ok, d = "") => { console.log(`${ok ? "  ok  " : "FALHA "} ${n}${d ? ` — ${d}` : ""}`); if (!ok) falhas++; };
const corpo = async () => (await page.locator("body").innerText()).replace(/\s+/g, " ");

const criados = [];
try {
  // ---------- Ajustes
  await page.goto(`${BASE}/dashboard/settings`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("text=Integrações", { timeout: 40000 });
  const ajustes = await corpo();
  check("o card 'Lembrete de sessão' saiu do Ajustes", !/Lembrete de sessão/i.test(ajustes));
  check("o Gmail saiu das Integrações", !/Gmail/i.test(ajustes.slice(ajustes.indexOf("Integrações"), ajustes.indexOf("Integrações") + 900)));
  check("o passo a passo da agenda saiu do Ajustes", !/Como a sua agenda de pacientes funciona/i.test(ajustes));
  check("o Google Agenda continua lá", /Google Agenda/i.test(ajustes));

  // ---------- Ajuda (para onde o texto foi)
  await page.goto(`${BASE}/dashboard/ajuda`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("text=Agenda e sessões", { timeout: 40000 });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button,summary,h3,div")].find((x) => x.innerText?.trim().startsWith("Agenda e sessões"));
    b?.click();
  });
  await page.waitForTimeout(600);
  const ajuda = await corpo();
  check("a Ajuda passou a explicar a agenda do Google", /Como a sua agenda de pacientes funciona/i.test(ajuda), ajuda.includes("Pacientes — Ledivan") ? "com o nome do calendário" : "");

  // ---------- Agendamento: canal e pergunta das horas
  const hoje = new Date();
  const quando = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 8, 0, 0);
  const [p] = await sql`
    INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status, payment_day, started_at, times_per_period)
    VALUES (${qa.id}, 'QA lembrete', 'sessao', '100.00', 'ativo', 10, ${quando}, 1) RETURNING id`;
  criados.push(p.id);
  await sql`INSERT INTO therapy_sessions (user_id, patient_id, date, duration, fee, status, confirm_channel, confirm_lead_hours)
    VALUES (${qa.id}, ${p.id}, ${quando}, 50, '100.00', 'agendada', 'whatsapp', 24)`;

  await page.goto(`${BASE}/dashboard/agenda`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector(`button[title^="QA lembrete"]`, { timeout: 40000 });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => (x.getAttribute("title") ?? "").startsWith("QA lembrete"));
    b?.click();
  });
  await page.waitForSelector("text=Status", { timeout: 20000 });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll("button")].find((x) => x.innerText.trim() === "Editar agendamento");
    b?.click();
  });
  await page.waitForTimeout(800);
  // O canal abre em "não enviar", e o campo das horas só aparece com um canal escolhido.
  await page.selectOption('select[name="confirmChannel"]', "whatsapp").catch(() => {});
  await page.waitForTimeout(400);
  const opcoes = await page.evaluate(() => {
    const sel = [...document.querySelectorAll("select")].find((s) => s.name === "confirmChannel");
    return sel ? [...sel.options].map((o) => o.text) : null;
  });
  check("o canal do lembrete não oferece mais e-mail", Array.isArray(opcoes) && !opcoes.some((o) => /mail/i.test(o)), JSON.stringify(opcoes));
  const edicao = await corpo();
  check("a pergunta das horas aparece inteira", /Quantas horas antes do atendimento deseja que o lembrete via WhatsApp seja enviado\?/.test(edicao));

  // ---------- Cadastro: só WhatsApp
  await page.goto(`${BASE}/dashboard/patients/${p.id}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("text=Exportar dados", { timeout: 40000 });
  const temBotao = async (nome) => page.evaluate((n) => {
    return [...document.querySelectorAll("button,a")].some((x) => (x.getAttribute("aria-label") ?? x.innerText ?? "").trim() === n);
  }, nome);
  check("o botão de Telegram saiu do cadastro", !(await temBotao("Telegram")));
  check("o botão de E-mail saiu do cadastro", !(await temBotao("E-mail")));
  check("o WhatsApp continua", await temBotao("Enviar mensagem no WhatsApp"));
} catch (e) {
  console.error("ERRO:", e?.message ?? e);
  falhas++;
} finally {
  await nav.close();
  for (const pid of criados) {
    await sql`DELETE FROM session_payments WHERE patient_id = ${pid}`;
    await sql`DELETE FROM therapy_sessions WHERE patient_id = ${pid}`;
    await sql`DELETE FROM patient_price_history WHERE patient_id = ${pid}`;
    await sql`DELETE FROM patient_payment_format_history WHERE patient_id = ${pid}`;
    await sql`DELETE FROM patients WHERE id = ${pid}`;
  }
  console.log(falhas ? `\n${falhas} FALHA(S)` : "\ntudo certo");
  process.exit(falhas ? 1 : 0);
}

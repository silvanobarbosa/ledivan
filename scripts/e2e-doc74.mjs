// O DOC 74 NA TELA (dono, 15/11/2026): o botão que saiu, a semana com teto, a cobrança que
// lista só o que cobra, e o aviso do prazo de reajuste no cadastro novo.
//
// O que o teste puro não prova:
//   - que o "Novo lançamento" sumiu de Transações (e que receita/despesa continuam com os seus);
//   - que a mensagem de cobrança de um pacote mensal real esconde Desmarcou/Atestado/Prof. desm.
//     (o conjunto de ids continua com elas de propósito — doc 54 —, então o recorte precisa chegar
//     justamente até a redação, e não até o motor);
//   - que o aviso do prazo de reajuste aparece no cadastro NOVO com formato que cobra, some no
//     Gratuito e não aparece na EDIÇÃO.
//
// Uso: npm run build && npm start, depois `node scripts/e2e-doc74.mjs`.

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

const criados = [];
const nav = await chromium.launch();
const alvo = new URL(BASE);
const ctx = await nav.newContext({ viewport: { width: 1280, height: 950 } });
await ctx.addCookies([{ name: "auth-session", value: token, domain: alvo.hostname, path: "/", secure: alvo.protocol === "https:" }]);
// Sem telefone no cadastro, o "Cobrar" COPIA a mensagem — é assim que o percurso lê o texto que
// o paciente receberia, sem depender de permissão de área de transferência do navegador.
await ctx.addInitScript(() => {
  window.__copiado = [];
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: (t) => { window.__copiado.push(t); return Promise.resolve(); } },
  });
});
const page = await ctx.newPage();

const textoDaPagina = () => page.evaluate(() => document.body.innerText);
const dia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** Marca um radio de formato de pagamento pelo rótulo e espera o React redesenhar. */
const marcarFormato = async (rotulo) => {
  await page.evaluate((r) => {
    const label = [...document.querySelectorAll("label")].find((l) => l.textContent?.trim().startsWith(r));
    label?.querySelector('input[type="radio"]')?.click();
  }, rotulo);
  await page.waitForTimeout(500);
};
const AVISO = "reajuste previsto para 12 meses";

try {
  for (const velho of await sql`SELECT id FROM patients WHERE user_id = ${qa.id} AND name LIKE 'QA74 %'`) {
    await sql`DELETE FROM therapy_sessions WHERE patient_id = ${velho.id}`;
    await sql`DELETE FROM session_payments WHERE patient_id = ${velho.id}`;
    await sql`DELETE FROM patients WHERE id = ${velho.id}`;
  }

  // ------------------------------------------------------- 1) Transações sem "Novo lançamento"
  await page.goto(`${BASE}/dashboard/transactions`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1200);
  const transacoes = await textoDaPagina();
  check("o botão 'Novo lançamento' saiu de Transações", !transacoes.includes("Novo lançamento"));
  check("os blocos de Receitas e Despesas continuam com o botão deles", transacoes.includes("Cadastrar Receita Pessoal") && transacoes.includes("Cadastrar despesas"));

  // O cartão "Não vieram na semana" era conferido aqui; a REGRA mudou no doc 75 (semana de
  // domingo a sábado, e só quem desmarcou/faltou/teve atestado). Passou a ser `e2e-doc75.mjs`.

  const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
  const maisDias = (n) => new Date(hoje.getTime() + n * 24 * 60 * 60 * 1000);

  // ------------------------------- 3) a mensagem do pacote lista só as sessões que ela cobra
  // Mensal de 4, uma por semana, com duas datas sem cobrança no meio — o caso do William.
  const inicio = maisDias(-21); inicio.setHours(19, 0, 0, 0);
  const [william] = await sql`
    INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status, payment_day, sessions_in_packet, pacote_tipo, started_at, times_per_period)
    VALUES (${qa.id}, ${"QA74 pacote com desmarcadas"}, 'mensal', '100.00', 'ativo', 15, 4, 'completo', ${inicio}, 1)
    RETURNING id`;
  criados.push(william.id);
  // 6 semanas: a 1ª desmarcada (cancelada) e a 3ª com atestado não ocupam posição — o pacote de 4
  // é formado pelas outras quatro, e são só elas que a mensagem deve citar.
  const semanas = [0, 7, 14, 21, 28, 35].map((n) => { const d = new Date(inicio.getTime() + n * 86400000); d.setHours(19, 0, 0, 0); return d; });
  const status = ["cancelada", "realizada", "atestado", "realizada", "agendada", "agendada"];
  for (let i = 0; i < semanas.length; i++) {
    await sql`
      INSERT INTO therapy_sessions (user_id, patient_id, date, duration, fee, status)
      VALUES (${qa.id}, ${william.id}, ${semanas[i]}, 50, '100.00', ${status[i]})`;
  }

  await page.goto(`${BASE}/dashboard/patients/${william.id}?tab=geral`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(2000);
  const clicou = await page.evaluate(() => {
    const linha = [...document.querySelectorAll("tr[data-chave]")].find((t) => (t.getAttribute("data-chave") ?? "").startsWith("pacote:"));
    const botao = [...(linha?.querySelectorAll("button") ?? [])].find((b) => b.textContent?.trim() === "Cobrar");
    botao?.click();
    return !!botao;
  });
  check("a linha do pacote tem o botão Cobrar", clicou);
  await page.waitForTimeout(900);
  const msg = (await page.evaluate(() => window.__copiado?.[0] ?? ""));
  const curta = (d) => `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
  check("a mensagem foi copiada", msg.length > 0, msg.slice(0, 60));
  // Só a LINHA das sessões — a data do vencimento também é uma data na mensagem, e procurá-la no
  // texto inteiro acusaria falha por uma linha que não é a que o doc 74 trata.
  const linhaDasSessoes = msg.split(String.fromCharCode(10)).find((l) => l.startsWith("Referente às sessões")) ?? "";
  check("a desmarcada NÃO entra na lista de sessões", !linhaDasSessoes.includes(curta(semanas[0])), linhaDasSessoes);
  check("o atestado NÃO entra na lista de sessões", !linhaDasSessoes.includes(curta(semanas[2])), curta(semanas[2]));
  for (const i of [1, 3, 4, 5]) {
    check(`a sessão cobrada de ${curta(semanas[i])} continua na lista`, linhaDasSessoes.includes(curta(semanas[i])));
  }

  // ------------------------------------- 4) o aviso do prazo de reajuste no CADASTRO NOVO
  await page.goto(`${BASE}/dashboard/patients/new`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1200);
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Financeiro")?.click();
  });
  await page.waitForTimeout(600);
  check("sem formato marcado, o aviso não aparece", !(await textoDaPagina()).includes(AVISO));
  await marcarFormato("Mensal");
  check("no Mensal o aviso aparece", (await textoDaPagina()).includes(AVISO));
  await marcarFormato("Avulso");
  check("no Avulso o aviso aparece", (await textoDaPagina()).includes(AVISO));
  await marcarFormato("Gratuito");
  check("no Gratuito o aviso NÃO aparece", !(await textoDaPagina()).includes(AVISO));

  await page.goto(`${BASE}/dashboard/patients/${william.id}?tab=financeiro`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(1500);
  check("na EDIÇÃO o aviso não aparece", !(await textoDaPagina()).includes(AVISO));
} catch (e) {
  console.error("\nERRO NO PERCURSO:", e?.message ?? e);
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

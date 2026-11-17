// O DOCUMENTO DE 17/11/2026 (2º anexo) NO APP DE VERDADE: a desmarcada que encolhe o pacote
// fracionado, e o (Q) que passa a sair só da recorrência do agendamento.
//
// O que o teste puro NÃO prova:
//   - que a janela nova abre no lugar certo (fracionado mensal/quinzenal) e NÃO abre no completo;
//   - que a resposta atravessa três camadas — janela, ação do servidor, motor — e chega ao banco;
//   - que a guia Geral recalcula o VALOR junto com a quantidade, que é o item 6 do documento;
//   - que o espelho (Q) sumiu de quem só tem o financeiro quinzenal e continua em quem tem o
//     AGENDAMENTO quinzenal.
//
// Uso: npm run build && npm start, depois `node scripts/e2e-pacote-fracionado-e-q.mjs`.
// Em `npm run dev` não roda: o Fast Refresh renavega a página e todo seletor expira.

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

const FRAC = "QA frac desmarcou";
const COMPLETO = "QA frac completo";
const Q_AGENDA = "QA Q agendamento";
const Q_FINANCEIRO = "QA Q financeiro";
const criados = [];

const hoje = new Date();
const hojeAs = (h) => new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), h, 0, 0);
const maisDias = (base, n) => new Date(base.getTime() + n * 24 * 60 * 60 * 1000);
const ultimoDoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();

/**
 * As três companheiras da sessão desmarcada, TODAS no mesmo mês dela.
 *
 * No fracionado quem agrupa é o mês do calendário: uma data que escorregasse para o mês seguinte
 * viraria outra sequência, e o percurso mediria outra coisa. Perto da virada, elas vão para trás.
 */
const paraFrente = hoje.getDate() + 3 <= ultimoDoMes;
const companheiras = [1, 2, 3].map((n) => {
  const d = maisDias(hojeAs(8), paraFrente ? n : -n);
  d.setHours(9 + n, 0, 0, 0);
  return d;
});

const limpar = async () => {
  for (const pid of criados) {
    await sql`DELETE FROM session_payments WHERE user_id = ${qa.id} AND patient_id = ${pid}`;
    await sql`DELETE FROM therapy_sessions WHERE patient_id = ${pid}`;
    await sql`DELETE FROM patient_price_history WHERE patient_id = ${pid}`;
    await sql`DELETE FROM patient_payment_format_history WHERE patient_id = ${pid}`;
    await sql`DELETE FROM patients WHERE id = ${pid}`;
  }
};

const criarPaciente = async (nome, formato, pacoteTipo) => {
  const [p] = await sql`
    INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status, payment_day, sessions_in_packet, pacote_tipo, started_at, times_per_period)
    VALUES (${qa.id}, ${nome}, ${formato}, '100.00', 'ativo', 10, 4, ${pacoteTipo}, ${hojeAs(8)}, 1)
    RETURNING id`;
  criados.push(p.id);
  return p.id;
};

const criarSessao = async (pid, quando, extra = {}) => {
  const [s] = await sql`
    INSERT INTO therapy_sessions (user_id, patient_id, date, duration, fee, status, recurring, recurrence_freq)
    VALUES (${qa.id}, ${pid}, ${quando}, 50, '100.00', ${extra.status ?? "agendada"}, ${extra.recurring ?? false}, ${extra.freq ?? null})
    RETURNING id`;
  return s.id;
};

const nav = await chromium.launch();
const alvo = new URL(BASE);
const ctx = await nav.newContext({ viewport: { width: 1280, height: 950 } });
await ctx.addCookies([{ name: "auth-session", value: token, domain: alvo.hostname, path: "/", secure: alvo.protocol === "https:" }]);
const page = await ctx.newPage();

/** O clique vai pelo DOM: o balão do Divã é um `fixed inset-0` e come o clique do ponteiro. */
const clicarPorTexto = async (texto) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll("button")].find((x) => x.innerText.trim() === t);
    if (!b) return false;
    b.click();
    return true;
  }, texto);

/** Abre o painel da sessão na agenda e clica num status. */
const marcar = async (status, quem, qual = 0) => {
  await page.goto(`${BASE}/dashboard/agenda`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector(`button[title^="${quem}"]`, { timeout: 30000 });
  const abriu = await page.evaluate(([nome, i]) => {
    const b = [...document.querySelectorAll("button")].filter((x) => (x.getAttribute("title") ?? "").startsWith(nome))[i];
    if (!b) return false;
    b.click();
    return true;
  }, [quem, qual]);
  if (!abriu) throw new Error(`não achei o bloco da sessão de ${quem} na agenda`);
  await page.waitForSelector("text=Status", { timeout: 15000 });
  if (!(await clicarPorTexto(status))) throw new Error(`não achei o botão de status "${status}"`);
};

/**
 * A janela não abre no clique: o app primeiro pergunta ao SERVIDOR se o pacote tem pagamento
 * lançado. Conferir a tela no instante do clique mediria o quadro antes de ele existir.
 */
const esperarAPergunta = async (ms = 20000) => {
  try {
    await page.waitForSelector("text=deseja considerar a cobrança desta sessão no pacote", { timeout: ms });
    return true;
  } catch {
    return false;
  }
};

const noBanco = async (id) => (await sql`SELECT status, desmarcou_cobra FROM therapy_sessions WHERE id = ${id}`)[0];
const esperarNoBanco = async (id, condicao, ms = 20000) => {
  const ate = Date.now() + ms;
  let st = await noBanco(id);
  while (!condicao(st) && Date.now() < ate) {
    await new Promise((r) => setTimeout(r, 250));
    st = await noBanco(id);
  }
  return st;
};

/** O que a guia Geral mostra da cobrança do pacote: quantas sessões e por quanto. */
const pacoteNaGeral = async (pid) => {
  await page.goto(`${BASE}/dashboard/patients/${pid}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector('[data-testid="guia-geral"]', { timeout: 30000 });
  return page.evaluate(() => {
    const linha = [...document.querySelectorAll("tr[data-chave]")].find((t) => (t.getAttribute("data-chave") ?? "").startsWith("pacote:"));
    return linha ? linha.innerText.replace(/\s+/g, " ").trim() : "";
  });
};

try {
  for (const velho of await sql`SELECT id FROM patients WHERE user_id = ${qa.id} AND name LIKE 'QA frac %' OR (user_id = ${qa.id} AND name LIKE 'QA Q %')`) {
    criados.push(velho.id);
  }
  await limpar();
  criados.length = 0;

  // ---------------------------------------------- 1) o fracionado mensal: a janela e o "Não"
  const frac = await criarPaciente(FRAC, "mensal", "fragmentado");
  const desmarcada = await criarSessao(frac, hojeAs(8));
  for (const d of companheiras) await criarSessao(frac, d);

  const antes = await pacoteNaGeral(frac);
  check("o pacote começa com 4 sessões e R$ 400,00", /4 sess/i.test(antes) && /R\$ 400,00/.test(antes), antes.slice(0, 110));

  await marcar("Desmarcou", FRAC);
  check("o Desmarcou do fracionado em aberto abre a pergunta do pacote", await esperarAPergunta());
  check("a janela diz como refazer a escolha", await page.locator('text=selecione novamente "Desmarcou"').count() > 0);

  check("a janela oferece o Não", await clicarPorTexto("Não"));
  let st = await esperarNoBanco(desmarcada, (x) => x.desmarcou_cobra === false);
  check("com o Não, a sessão CONTINUA desmarcada na agenda", st.status === "cancelada", st.status);
  check("com o Não, a resposta foi gravada", st.desmarcou_cobra === false, String(st.desmarcou_cobra));

  const depoisDoNao = await pacoteNaGeral(frac);
  check("o pacote encolheu para 3 sessões", /3 sess/i.test(depoisDoNao), depoisDoNao.slice(0, 110));
  check("… e o valor foi recalculado para R$ 300,00 (item 6 do documento)", /R\$ 300,00/.test(depoisDoNao), depoisDoNao.slice(0, 110));

  // A numeração reorganizada: a célula da desmarcada passa a dizer x/3, como o documento desenha.
  await page.goto(`${BASE}/dashboard/agenda`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector(`button[title^="${FRAC}"]`, { timeout: 30000 });
  const celula = await page.evaluate((nome) => {
    const b = [...document.querySelectorAll("button")].find((x) => (x.getAttribute("title") ?? "").startsWith(nome));
    return b ? b.innerText.replace(/\s+/g, " ").trim() : "";
  }, FRAC);
  check("a célula da desmarcada mostra a numeração sobre 3", /\/\s*3\b/.test(celula), celula);

  // ------------------------------------------------- 2) refazer: o "Sim" devolve o tamanho
  await marcar("Desmarcou", FRAC);
  check("clicar Desmarcou de novo reabre a pergunta", await esperarAPergunta());
  check("a janela oferece o Sim", await clicarPorTexto("Sim"));
  st = await esperarNoBanco(desmarcada, (x) => x.desmarcou_cobra === true);
  check("com o Sim, a sessão continua desmarcada", st.status === "cancelada", st.status);
  const depoisDoSim = await pacoteNaGeral(frac);
  check("com o Sim, o pacote volta a 4 sessões e R$ 400,00", /4 sess/i.test(depoisDoSim) && /R\$ 400,00/.test(depoisDoSim), depoisDoSim.slice(0, 110));

  // ------------------------------------- 3) o pacote COMPLETO não entra nesta regra
  const completo = await criarPaciente(COMPLETO, "mensal", "completo");
  await criarSessao(completo, hojeAs(13));
  await marcar("Desmarcou", COMPLETO);
  check("o pacote COMPLETO segue sem janela nenhuma", !(await esperarAPergunta(4000)));
  const stc = await esperarNoBanco(
    (await sql`SELECT id FROM therapy_sessions WHERE patient_id = ${completo} LIMIT 1`)[0].id,
    (x) => x.status === "cancelada",
    15000,
  );
  check("… e vai direto para Desmarcou, como sempre foi", stc.status === "cancelada", stc.status);

  // ------------------------------------------- 4) o (Q): quem decide é o AGENDAMENTO
  // A sessão de daqui a sete dias projeta o espelho no dia de HOJE, que é a semana que a agenda abre.
  const comRecorrencia = await criarPaciente(Q_AGENDA, "mensal", "completo");
  await criarSessao(comRecorrencia, maisDias(hojeAs(15), 7), { recurring: true, freq: "quinzenal" });

  const soFinanceiro = await criarPaciente(Q_FINANCEIRO, "quinzenal", "fragmentado");
  await criarSessao(soFinanceiro, maisDias(hojeAs(16), 7));

  await page.goto(`${BASE}/dashboard/agenda`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector('[title^="Horário intercalado"]', { timeout: 30000 }).catch(() => null);
  const espelhos = await page.evaluate(() =>
    [...document.querySelectorAll('button[title^="Horário intercalado"]')].map((b) => b.getAttribute("title")),
  );
  check(
    "o agendamento com recorrência quinzenal projeta o (Q)",
    espelhos.some((t) => t.includes(Q_AGENDA)),
    espelhos.join(" | ").slice(0, 160) || "(nenhum espelho)",
  );
  check(
    "quem só tem o FINANCEIRO quinzenal não projeta mais (Q)",
    !espelhos.some((t) => t.includes(Q_FINANCEIRO)),
    espelhos.join(" | ").slice(0, 160) || "(nenhum espelho)",
  );
} catch (e) {
  // Sem este catch, o `process.exit` do finally engole a exceção e o percurso diz "tudo certo".
  console.error("\nERRO NO PERCURSO:", e?.message ?? e);
  falhas++;
} finally {
  await nav.close();
  await limpar();
  console.log(falhas ? `\n${falhas} FALHA(S)` : "\ntudo certo");
  process.exit(falhas ? 1 : 0);
}

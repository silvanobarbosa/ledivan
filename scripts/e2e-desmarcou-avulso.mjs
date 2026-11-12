// O "DESMARCOU" QUE DECIDE O DINHEIRO, NO APP DE VERDADE (documento do dono, 12/11/2026).
//
// O que o teste puro NÃO prova: que a escolha feita na agenda chega ao banco e que a guia Geral
// desenha a consequência. São três camadas separadas — janela, ação do servidor e motor —, e cada
// uma passa sozinha nos testes de unidade enquanto a emenda entre elas pode não existir. Foi assim
// que `faltouConta` já chegou do banco e se perdeu no caminho (doc 58).
//
// O percurso exercita as duas respostas E o refazer: Sim (a cobrança fica de pé), depois Desmarcou
// de novo e Não (a cobrança sai). Em ambos, o status tem de continuar "Desmarcou" — é o que o
// documento pede, e é justamente o que quebraria se a janela do pagamento tivesse continuado a
// fixar "Faltou".
//
// Uso: npm run build && npm start, depois `node scripts/e2e-desmarcou-avulso.mjs`.
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

const NOME = "QA desmarcou avulso";
// AVULSO ("sessao"): é o formato que o documento alcança. A sessão nasce HOJE, às 8h, para cair na
// semana que a agenda abre sozinha — navegar semana a semana só acrescentaria passos que podem
// falhar por motivo nenhum.
const hoje = new Date();
const quando = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 8, 0, 0);

const [p] = await sql`
  INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status, payment_day, started_at, times_per_period)
  VALUES (${qa.id}, ${NOME}, 'sessao', '100.00', 'ativo', 10, ${quando}, 1)
  RETURNING id`;
const [s] = await sql`
  INSERT INTO therapy_sessions (user_id, patient_id, date, duration, fee, status)
  VALUES (${qa.id}, ${p.id}, ${quando}, 50, '100.00', 'agendada')
  RETURNING id`;

const limpar = async () => {
  await sql`DELETE FROM session_payments WHERE user_id = ${qa.id} AND cobranca_chave LIKE ${"%" + s.id}`;
  await sql`DELETE FROM therapy_sessions WHERE patient_id = ${p.id}`;
  await sql`DELETE FROM patient_price_history WHERE patient_id = ${p.id}`;
  await sql`DELETE FROM patient_payment_format_history WHERE patient_id = ${p.id}`;
  await sql`DELETE FROM patients WHERE id = ${p.id}`;
};

const nav = await chromium.launch();
const alvo = new URL(BASE);
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addCookies([{ name: "auth-session", value: token, domain: alvo.hostname, path: "/", secure: alvo.protocol === "https:" }]);
const page = await ctx.newPage();

/** O estado da sessão no banco — a única prova de que a escolha atravessou. */
const noBanco = async () => (await sql`SELECT status, desmarcou_cobra FROM therapy_sessions WHERE id = ${s.id}`)[0];

/**
 * ESPERA O FATO, não o relógio.
 *
 * A janela fecha no clique, antes de a gravação terminar — e ler o banco nesse instante media o
 * estado ANTERIOR. Sem isto o percurso reprovava o Sim e aprovava o Não com o valor do Sim: o
 * erro clássico de medir uma resposta assíncrona pela tela que já sumiu.
 */
const esperarNoBanco = async (condicao, ms = 20000) => {
  const ate = Date.now() + ms;
  let st = await noBanco();
  while (!condicao(st) && Date.now() < ate) {
    await new Promise((r) => setTimeout(r, 250));
    st = await noBanco();
  }
  return st;
};

/** A sessão aparece com cobrança na guia Geral? É a linha que a terapeuta vê. */
const temCobrancaNaGeral = async () => {
  await page.goto(`${BASE}/dashboard/patients/${p.id}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector('[data-testid="guia-geral"]', { timeout: 30000 });
  const linha = page.locator(`tr[data-sessao="${s.id}"]`).first();
  if (await linha.count() === 0) return { linha: false, chave: null };
  return { linha: true, chave: await linha.getAttribute("data-chave") };
};

/**
 * O clique vai pelo DOM, não pelo mouse.
 *
 * O balão do Divã abre sozinho na conta de QA, é um `fixed inset-0` por cima de tudo e COME o
 * clique — e volta depois de removido, então disputar o ponteiro com ele é perder tempo. O doc 63
 * já tinha aprendido isto; aqui a lição é só reusada.
 */
const clicarPorTexto = async (texto) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll("button")].find((x) => x.innerText.trim() === t);
    if (!b) return false;
    b.click();
    return true;
  }, texto);

/** Abre o painel da sessão na agenda e clica num status. */
const marcar = async (status) => {
  await page.goto(`${BASE}/dashboard/agenda`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector(`button[title^="${NOME}"]`, { timeout: 30000 });
  const abriu = await page.evaluate((nome) => {
    const b = [...document.querySelectorAll("button")].find((x) => (x.getAttribute("title") ?? "").startsWith(nome));
    if (!b) return false;
    b.click();
    return true;
  }, NOME);
  if (!abriu) throw new Error("não achei o bloco da sessão na agenda");
  await page.waitForSelector("text=Status", { timeout: 15000 });
  if (!(await clicarPorTexto(status))) throw new Error(`não achei o botão de status "${status}"`);
};

/**
 * A janela do Desmarcou não abre no clique: o app primeiro PERGUNTA AO SERVIDOR se aquela sessão
 * tem pagamento lançado — é o que decide qual das duas janelas aparece. Conferir a tela no
 * instante do clique media o quadro antes de ele existir, e o percurso reprovava o que funciona.
 */
const esperarAPergunta = async () => {
  try {
    await page.waitForSelector("text=Deseja manter o pagamento pendente", { timeout: 20000 });
    return true;
  } catch {
    return false;
  }
};

try {
  // 1) DESMARCOU num avulso: a janela tem de aparecer, em vez de o status mudar calado.
  await marcar("Desmarcou");
  const perguntou = await esperarAPergunta();
  check("o Desmarcou do avulso abre a pergunta do pagamento", perguntou);
  check("a janela diz como refazer a escolha", await page.locator('text=selecione novamente "Desmarcou"').count() > 0);

  // 2) SIM: a cobrança fica de pé e o status é Desmarcou — não Faltou.
  check("a janela oferece o Sim", await clicarPorTexto("Sim"));
  let st = await esperarNoBanco((x) => x.desmarcou_cobra === true);
  check("com o Sim, a sessão fica Desmarcou", st.status === "cancelada", st.status);
  check("com o Sim, a resposta foi gravada", st.desmarcou_cobra === true, String(st.desmarcou_cobra));

  const comSim = await temCobrancaNaGeral();
  check("com o Sim, a cobrança continua na guia Geral", comSim.linha && comSim.chave === `sessao:${s.id}`, comSim.chave ?? "(sem linha)");

  // 3) REFAZER: clicar Desmarcou de novo numa sessão JÁ desmarcada reabre a janela. Sem isto, a
  //    promessa escrita na própria janela seria mentira.
  await marcar("Desmarcou");
  check("clicar Desmarcou de novo reabre a pergunta", await esperarAPergunta());

  // 4) NÃO: a cobrança sai, o status permanece.
  check("a janela oferece o Não", await clicarPorTexto("Não"));
  st = await esperarNoBanco((x) => x.desmarcou_cobra === false);
  check("com o Não, a sessão continua Desmarcou", st.status === "cancelada", st.status);
  check("com o Não, a resposta foi gravada", st.desmarcou_cobra === false, String(st.desmarcou_cobra));

  const comNao = await temCobrancaNaGeral();
  check("com o Não, a sessão não tem mais cobrança na guia Geral", !comNao.chave, comNao.chave ?? "(sem cobrança)");

  /**
   * CASO 2 DO DOCUMENTO: a sessão JÁ PAGA.
   *
   * Aqui não há pergunta sobre manter pendente — o dinheiro já entrou, e o que falta é destino:
   * estornar ou transferir. A janela é a do doc 55, reaproveitada. O que este trecho protege é o
   * STATUS: aquela janela fixava "Faltou" na sessão, porque até agora só o Faltou a abria. Se a
   * emenda estiver errada, a sessão desmarcada aparece como falta na agenda e na guia Geral.
   */
  await sql`UPDATE therapy_sessions SET status = 'agendada', desmarcou_cobra = NULL WHERE id = ${s.id}`;
  const [pg] = await sql`
    INSERT INTO session_payments (user_id, patient_id, session_id, amount, date, method, status, cobranca_chave, pago_por)
    VALUES (${qa.id}, ${p.id}, ${s.id}, '100.00', ${quando}, 'pix', 'paid', ${`sessao:${s.id}`}, ${NOME})
    RETURNING id`;

  await marcar("Desmarcou");
  let janelaDoPago = false;
  try {
    await page.waitForSelector("text=já possui um pagamento registrado", { timeout: 20000 });
    janelaDoPago = true;
  } catch { /* o check abaixo reprova */ }
  check("sessão JÁ PAGA abre a janela do destino do pagamento", janelaDoPago);
  check("a janela não pergunta sobre manter pendente", await page.locator("text=Deseja manter o pagamento pendente").count() === 0);

  check("a janela oferece estornar", await clicarPorTexto("Estornar o valor"));
  const depois = await esperarNoBanco((x) => x.status === "cancelada");
  check("depois do estorno a sessão fica Desmarcou, não Faltou", depois.status === "cancelada", depois.status);
  const [estornado] = await sql`SELECT estornado_em FROM session_payments WHERE id = ${pg.id}`;
  check("o pagamento foi estornado", !!estornado?.estornado_em, String(estornado?.estornado_em ?? "(não estornado)"));
} catch (e) {
  // Sem este catch, o `process.exit` do finally engole a exceção e o percurso diz "tudo certo" sem
  // ter verificado nada — foi o que aconteceu no doc 63.
  console.error("\nERRO NO PERCURSO:", e?.message ?? e);
  falhas++;
} finally {
  await nav.close();
  await limpar();
  console.log(falhas ? `\n${falhas} FALHA(S)` : "\ntudo certo");
  process.exit(falhas ? 1 : 0);
}

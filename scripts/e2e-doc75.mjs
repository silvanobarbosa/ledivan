// DOC 75 NO APP DE VERDADE — os quatro itens que são de TELA.
//
// Os de regra (3/4, 5, 7) estão travados em `tests/unit/doc75.test.ts`. Aqui se prova o que teste
// de unidade não vê:
//
//   item 1 · a janela do lançamento (guia Geral) CABE no cartão — não alarga a tabela nem corta;
//   item 2 · "Excluir agendamento" sem próximos NÃO pergunta: exclui o que foi pedido;
//            e com próximos continua perguntando (o alcance ainda é escolha dela);
//   item 6 · o Financeiro de um cadastro NOVO abre sem formato marcado e sem bloco expandido;
//   item 7 · o fechamento mostra "pagou a mais" só para a sobra MARCADA.
//
// Uso: npm run build && TZ=UTC npm start, depois node scripts/e2e-doc75.mjs

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

const criados = [];
const marca = Date.now().toString().slice(-6);
const atras = (dias, hora) => {
  const d = new Date(); d.setDate(d.getDate() - dias);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hora, 0, 0, 0);
};

const nav = await chromium.launch({ headless: true });
const ctx = await nav.newContext({ viewport: { width: 1280, height: 1000 } });
const alvo = new URL(BASE);
await ctx.addCookies([{ name: "auth-session", value: token, domain: alvo.hostname, path: "/", secure: alvo.protocol === "https:" }]);
const page = await ctx.newPage();

try {
  // O Divã abre sozinho na 1ª visita do dia, e num perfil novo isso é SEMPRE: a janela dele cobre
  // a tela e nenhum clique chega. Dispensamos como a terapeuta dispensaria.
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.setItem("ledivan_diva_dispensas", "3");
    localStorage.setItem("ledivan_diva_dia", new Date().toISOString().slice(0, 10));
    localStorage.setItem("ledivan_diva_aviso_voz", "1");
  });

  const inicio = atras(120, 9);
  const [p] = await sql`
    INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status, started_at)
    VALUES (${qa.id}, ${`Doc75 ${marca}`}, 'sessao', '300.00', 'ativo', ${inicio})
    RETURNING id`;
  criados.push(p.id);
  await sql`INSERT INTO patient_payment_format_history (patient_id, formato, data_efetiva) VALUES (${p.id}, 'sessao', ${inicio})`;
  await sql`INSERT INTO patient_price_history (patient_id, valor, data_efetiva) VALUES (${p.id}, '300.00', ${inicio})`;
  await sql`
    INSERT INTO therapy_sessions (user_id, patient_id, date, duration, status, session_kind, chargeable)
    VALUES (${qa.id}, ${p.id}, ${atras(20, 9)}, 50, 'realizada', 'consulta', true)`;

  // ── ITEM 1: a janela do lançamento cabe no cartão ──
  await page.goto(`${BASE}/dashboard/patients/${p.id}`, { waitUntil: "networkidle" });
  const chave = await page.evaluate(() => document.querySelector("[data-chave]")?.getAttribute("data-chave") ?? null);
  check("a tela mostra a cobrança em aberto", !!chave, chave ?? "nenhuma");
  if (!chave) throw new Error("sem cobrança para abrir o lançamento");

  await page.getByRole("button", { name: "Lançar pagamento" }).first().click();
  await page.waitForTimeout(800);
  const form = page.locator('[data-testid="lancar-pagamento"]');
  check("o lançamento abriu", await form.count() > 0);

  /**
   * A medida do corte: a tabela não pode ser mais larga do que o container que a rola.
   *
   * Era aqui que o conteúdo "cortava" — sete colunas de grade com campos de largura fixa dentro de
   * um `<td>`, e tabela se dimensiona pelo conteúdo. 2px de tolerância para arredondamento de
   * subpixel do navegador.
   */
  const medida = await page.evaluate(() => {
    const t = document.querySelector('[data-testid="guia-geral"]');
    const rolador = t?.parentElement;
    const f = document.querySelector('[data-testid="lancar-pagamento"]');
    if (!t || !rolador || !f) return null;
    return {
      tabela: Math.round(t.getBoundingClientRect().width),
      rolador: Math.round(rolador.clientWidth),
      rolaLateral: rolador.scrollWidth - rolador.clientWidth,
      formDireita: Math.round(f.getBoundingClientRect().right),
      roladorDireita: Math.round(rolador.getBoundingClientRect().right),
    };
  });
  check("mediu a janela e a tabela", !!medida, JSON.stringify(medida));
  if (medida) {
    check("a tabela não ficou mais larga que o cartão", medida.tabela <= medida.rolador + 2,
      `tabela ${medida.tabela}px · cartão ${medida.rolador}px`);
    check("não há rolagem lateral com o lançamento aberto", medida.rolaLateral <= 2, `${medida.rolaLateral}px`);
    check("a borda direita do formulário não passa do cartão", medida.formDireita <= medida.roladorDireita + 2,
      `form ${medida.formDireita} · cartão ${medida.roladorDireita}`);
  }
  // Nenhum campo do formulário pode estar fora da área visível do cartão.
  const forasDaVista = await page.evaluate(() => {
    const f = document.querySelector('[data-testid="lancar-pagamento"]');
    const rolador = document.querySelector('[data-testid="guia-geral"]')?.parentElement;
    if (!f || !rolador) return -1;
    const lim = rolador.getBoundingClientRect();
    return [...f.querySelectorAll("input, select, button")]
      .filter((e) => e.getBoundingClientRect().right > lim.right + 2).length;
  });
  check("nenhum campo do lançamento fica fora do cartão", forasDaVista === 0, `${forasDaVista} campo(s)`);

  // ── ITEM 2: excluir sem próximos não pergunta ──
  /**
   * As sessões de teste ficam HOJE, em horas diferentes.
   *
   * A agenda abre na vista de hoje e o bloco da sessão só é clicável se estiver nela — marcar para
   * a semana que vem fazia o percurso procurar um botão que a tela não desenhou. `contarAlcance`
   * conta dali para a FRENTE, então duas horas mais tarde no mesmo dia já é "próxima".
   */
  const hojeAs = (hora) => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hora, 0, 0, 0); };
  const [soEsta] = await sql`
    INSERT INTO therapy_sessions (user_id, patient_id, date, duration, status, session_kind, chargeable)
    VALUES (${qa.id}, ${p.id}, ${hojeAs(8)}, 50, 'agendada', 'consulta', true) RETURNING id`;
  await page.goto(`${BASE}/dashboard/agenda`, { waitUntil: "networkidle" });
  // O bloco da sessão não tem id no DOM; o `title` é o nome do paciente, que aqui é único.
  const abrirSessao = async () => {
    await page.getByTitle(`Doc75 ${marca}`, { exact: false }).first().click();
    await page.waitForTimeout(800);
  };
  await abrirSessao();
  const excluir = page.getByRole("button", { name: /^Excluir$/ });
  check("o painel da sessão oferece Excluir", await excluir.count() > 0);
  if (await excluir.count() > 0) {
    await excluir.first().click();
    await page.waitForTimeout(2500);
    const perguntou = await page.getByRole("dialog", { name: "Excluir agendamento" }).count();
    check("sem próximos, a pergunta NÃO aparece", perguntou === 0, `${perguntou} janela(s)`);
    const [{ n: sobrou }] = await sql`SELECT count(*)::int AS n FROM therapy_sessions WHERE id = ${soEsta.id}`;
    check("e a sessão pedida foi excluída", sobrou === 0, `${sobrou} sobrou`);
  }

  // Com próximos, a pergunta volta — o alcance continua sendo escolha dela.
  for (const hora of [10, 14, 18]) {
    await sql`
      INSERT INTO therapy_sessions (user_id, patient_id, date, duration, status, session_kind, chargeable)
      VALUES (${qa.id}, ${p.id}, ${hojeAs(hora)}, 50, 'agendada', 'consulta', true)`;
  }
  await page.goto(`${BASE}/dashboard/agenda`, { waitUntil: "networkidle" });
  await abrirSessao();
  const excluir2 = page.getByRole("button", { name: /^Excluir$/ });
  if (await excluir2.count() > 0) {
    await excluir2.first().click();
    await page.waitForTimeout(2500);
    const perguntou = await page.getByRole("dialog", { name: "Excluir agendamento" }).count();
    check("COM próximos, a pergunta aparece (o alcance é dela)", perguntou === 1, `${perguntou} janela(s)`);
    const [{ n: intactas }] = await sql`SELECT count(*)::int AS n FROM therapy_sessions WHERE patient_id = ${p.id} AND status = 'agendada'`;
    check("e nada foi excluído antes de ela responder", intactas === 3, `${intactas} agendada(s)`);
  }

  // ── ITEM 6: cadastro novo abre o Financeiro sem formato marcado ──
  await page.goto(`${BASE}/dashboard/patients/new`, { waitUntil: "networkidle" });
  const financeiro = page.getByRole("button", { name: "Financeiro" });
  check("a aba Financeiro existe no cadastro novo", await financeiro.count() > 0);
  if (await financeiro.count() > 0) {
    await financeiro.first().click();
    await page.waitForTimeout(500);
    const marcados = await page.evaluate(() =>
      [...document.querySelectorAll('input[type="radio"]')].filter((r) => r.checked).length);
    check("nenhum formato vem marcado", marcados === 0, `${marcados} marcado(s)`);
    const formatoPost = await page.evaluate(() =>
      document.querySelector('input[type="hidden"][name="paymentFormat"]')?.value ?? "(sem campo)");
    check("o campo enviado nasce vazio", formatoPost === "", `"${formatoPost}"`);
    // Nenhum bloco de formato expandido: sem formato escolhido não há campos dele na tela.
    const camposDoFormato = await page.evaluate(() =>
      document.querySelectorAll('select[name="pacoteTipo"], input[name="sessionsInPacket"]').length);
    check("nenhum bloco de formato vem expandido", camposDoFormato === 0, `${camposDoFormato} campo(s)`);
  }

  // ── ITEM 7: "pagou a mais" só para a sobra marcada ──
  const hoje = new Date();
  const ano = hoje.getFullYear(), mes = hoje.getMonth() + 1;
  // Dois pacientes de teste: um que pagou adiantado (saldo negativo, sem marca) e um com sobra marcada.
  const fazer = async (nome, pago, excedente) => {
    const [x] = await sql`
      INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status, started_at)
      VALUES (${qa.id}, ${nome}, 'sessao', '300.00', 'ativo', ${inicio}) RETURNING id`;
    criados.push(x.id);
    await sql`INSERT INTO patient_payment_format_history (patient_id, formato, data_efetiva) VALUES (${x.id}, 'sessao', ${inicio})`;
    await sql`INSERT INTO patient_price_history (patient_id, valor, data_efetiva) VALUES (${x.id}, '300.00', ${inicio})`;
    await sql`
      INSERT INTO therapy_sessions (user_id, patient_id, date, duration, status, session_kind, chargeable)
      VALUES (${qa.id}, ${x.id}, ${new Date(ano, mes - 1, 5, 9)}, 50, 'realizada', 'consulta', true)`;
    await sql`
      INSERT INTO session_payments (user_id, patient_id, amount, date, method, status, excedente_sem_credito)
      VALUES (${qa.id}, ${x.id}, ${pago}, ${new Date(ano, mes - 1, 6, 12)}, 'pix', 'paid', ${excedente})`;
    return x.id;
  };
  await fazer(`Doc75 Adiantou ${marca}`, "900.00", null);
  await fazer(`Doc75 Sobra ${marca}`, "315.00", "15.00");

  await page.goto(`${BASE}/dashboard/fechamento?ano=${ano}&mes=${mes}`, { waitUntil: "networkidle" });
  const leLinha = async (nome) => page.evaluate((n) => {
    const tr = [...document.querySelectorAll("tr")].find((r) => r.textContent?.includes(n));
    return tr?.textContent?.replace(/\s+/g, " ").trim() ?? null;
  }, nome);

  const daSobra = await leLinha(`Doc75 Sobra ${marca}`);
  check("quem tem sobra marcada aparece como pagou a mais", /pagou a mais/.test(daSobra ?? ""), daSobra ?? "linha não encontrada");
  check("e pelo valor da sobra, não pelo saldo", /15,00/.test(daSobra ?? ""), daSobra ?? "");

  const doAdiantado = await leLinha(`Doc75 Adiantou ${marca}`);
  check("quem pagou adiantado NÃO aparece como pagou a mais", !/pagou a mais/.test(doAdiantado ?? "x"), doAdiantado ?? "linha não encontrada");
} catch (e) {
  check("o percurso chegou ao fim sem exceção", false, String(e && e.message ? e.message : e).slice(0, 300));
} finally {
  await nav.close();
  for (const id of criados) {
    await sql`DELETE FROM transactions WHERE id IN (SELECT linked_transaction_id FROM session_payments WHERE patient_id = ${id} AND linked_transaction_id IS NOT NULL)`;
    await sql`DELETE FROM session_payments WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_credits WHERE patient_id = ${id}`;
    await sql`DELETE FROM therapy_sessions WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_reajuste_changes WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_payment_format_history WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_price_history WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_status_history WHERE patient_id = ${id}`;
    await sql`DELETE FROM patients WHERE id = ${id}`;
  }
  console.log(`\n${falhas ? `${falhas} FALHA(S)` : "tudo certo"} · ${criados.length} cadastro(s) de teste apagado(s)`);
  process.exit(falhas ? 1 : 0);
}

// PAGAMENTO POR VOZ, NO APP DE VERDADE.
//
// O caso que originou isto (01/11/2026): a terapeuta ditou "dar entrada em um pagamento para a
// paciente Talita", o Divã entendeu, abriu a tela — e nada foi lançado. O que este percurso prova:
//
//   1. a URL que o Divã monta abre o LANÇAMENTO daquela cobrança, já preenchido com o valor dito;
//   2. a forma ditada chega no seletor;
//   3. NADA é gravado até ela apertar — o banco continua sem pagamento depois de a tela abrir;
//   4. apertando, o pagamento entra, com o valor dito, e aparece no caixa;
//   5. sem `pagar=1`, a tela abre fechada como sempre (o parâmetro não vaza para o uso normal).
//
// Uso: npm run build && TZ=UTC npm start, depois node scripts/e2e-pagar-por-voz.mjs

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

/** Uma sessão realizada no mês passado: nasce uma cobrança em aberto, que é o que a voz quita. */
const atras = (dias, hora) => {
  const d = new Date(); d.setDate(d.getDate() - dias);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hora, 0, 0, 0);
};

const nav = await chromium.launch({ headless: true });
const ctx = await nav.newContext({ viewport: { width: 1440, height: 1100 } });
const alvo = new URL(BASE);
await ctx.addCookies([{ name: "auth-session", value: token, domain: alvo.hostname, path: "/", secure: alvo.protocol === "https:" }]);
const page = await ctx.newPage();

try {
  const inicio = atras(120, 9);
  const [p] = await sql`
    INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status, started_at)
    VALUES (${qa.id}, ${`Voz Pagamento ${marca}`}, 'sessao', '300.00', 'ativo', ${inicio})
    RETURNING id`;
  criados.push(p.id);
  await sql`INSERT INTO patient_payment_format_history (patient_id, formato, data_efetiva) VALUES (${p.id}, 'sessao', ${inicio})`;
  await sql`INSERT INTO patient_price_history (patient_id, valor, data_efetiva) VALUES (${p.id}, '300.00', ${inicio})`;
  await sql`
    INSERT INTO therapy_sessions (user_id, patient_id, date, duration, status, session_kind, chargeable)
    VALUES (${qa.id}, ${p.id}, ${atras(20, 9)}, 50, 'realizada', 'consulta', true)`;

  // ── 1. A cobrança em aberto existe, e a tela a mostra ──
  /**
   * O Divã abre sozinho na primeira visita do dia, e num perfil de navegador novo isso é SEMPRE.
   * A janela dele cobre a tela e o clique no lançamento não chega. No uso real ele já se fechou
   * (`fechar(true)`) antes de navegar; aqui, dispensamos como a terapeuta dispensaria.
   */
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.setItem("ledivan_diva_dispensas", "3");
    localStorage.setItem("ledivan_diva_dia", new Date().toISOString().slice(0, 10));
    localStorage.setItem("ledivan_diva_aviso_voz", "1");
  });

  await page.goto(`${BASE}/dashboard/patients/${p.id}`, { waitUntil: "networkidle" });
  const chave = await page.evaluate(() => document.querySelector("[data-chave]")?.getAttribute("data-chave") ?? null);
  check("a tela mostra a cobrança em aberto", !!chave, chave ?? "nenhuma");
  if (!chave) throw new Error("sem cobrança para pagar");

  // Sem o parâmetro, o lançamento NÃO abre sozinho: o caminho normal segue igual.
  const abertoSemPedir = await page.locator('input[name="valor"], form select').count();
  check("sem ?pagar=1 a tela abre com o lançamento fechado", abertoSemPedir === 0, `campos visíveis: ${abertoSemPedir}`);

  // ── 2. A URL que o Divã monta ──
  const url = `${BASE}/dashboard/patients/${p.id}?ano=${new Date().getFullYear()}&cobranca=${encodeURIComponent(chave)}&pagar=1&valor=300.00&forma=pix`;
  await page.goto(url, { waitUntil: "networkidle" });

  const metodo = page.locator('input[name="metodo"]');
  check("o lançamento daquela cobrança abriu sozinho", await metodo.count() > 0);

  const valorNaTela = await page.evaluate(() => {
    const campos = [...document.querySelectorAll("input")];
    const c = campos.find((i) => /^R\$/.test(i.value ?? ""));
    return c?.value ?? null;
  });
  check("o valor ditado chegou preenchido", /300,00/.test(valorNaTela ?? ""), valorNaTela ?? "vazio");
  check("a forma ditada chegou no seletor", (await metodo.inputValue()) === "pix", await metodo.inputValue());

  // ── 3. NADA foi gravado só por abrir ──
  const [{ n: antes }] = await sql`SELECT count(*)::int AS n FROM session_payments WHERE patient_id = ${p.id}`;
  check("abrir a tela NÃO grava pagamento nenhum", antes === 0, `${antes} pagamento(s)`);

  // ── 4. Ela aperta, e aí sim entra ──
  await page.getByRole("button", { name: /Confirmar R\$/ }).first().click();
  await page.waitForTimeout(3500);

  const pagos = await sql`SELECT amount, method, linked_transaction_id FROM session_payments WHERE patient_id = ${p.id}`;
  check("depois do toque, o pagamento existe", pagos.length === 1, `${pagos.length} pagamento(s)`);
  check("com o valor ditado", Number(pagos[0]?.amount) === 300, String(pagos[0]?.amount));
  check("com a forma ditada", pagos[0]?.method === "pix", String(pagos[0]?.method));
  check("e entrou no caixa (é dinheiro recebido hoje)", !!pagos[0]?.linked_transaction_id);
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
    await sql`DELETE FROM patient_status_history WHERE patient_id = ${id}`;
    await sql`DELETE FROM patients WHERE id = ${id}`;
  }
  console.log(`\n${falhas ? `${falhas} FALHA(S)` : "tudo certo"} · ${criados.length} cadastro(s) de teste apagado(s)`);
  process.exit(falhas ? 1 : 0);
}

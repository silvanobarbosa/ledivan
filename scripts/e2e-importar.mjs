// A IMPORTAÇÃO POR PLANILHA, NO APP DE VERDADE.
//
//   1. O modelo é baixado e tem as quatro abas (Leia-me + as três de dados).
//   2. Uma planilha preenchida é CONFERIDA antes de gravar, e a tela mostra o que encontrou.
//   3. A linha com problema aparece e NÃO entra; as outras entram.
//   4. Confirmando, paciente, agenda e pagamento nascem no banco — com vigência e preço de entrada.
//   5. Reenviando o MESMO arquivo, nada é duplicado.
//
// Uso: npm run build && TZ=UTC npm start, depois node scripts/e2e-importar.mjs

import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";
import * as jose from "jose";
import * as XLSX from "xlsx";

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
const NOME = `QA import ${marca}`;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ledivan-import-"));
const arquivo = path.join(tmp, "preenchida.xlsx");

/** A planilha que a terapeuta mandaria: duas boas e uma com problema de propósito. */
function montar() {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["nome", "nascimento", "cpf", "telefone", "email", "responsavel", "responsavel_telefone",
     "formato_pagamento", "pacote_tipo", "valor_sessao", "sessoes_no_pacote", "dia_vencimento", "inicio"],
    [NOME, "12/03/1990", "123.456.789-00", "(11) 99999-0000", "", "", "", "mensal", "completo", "150,00", 4, 10, "05/02/2025"],
    // Esta linha tem formato inválido: deve ser ACUSADA e ficar de fora.
    [`${NOME} ruim`, "", "", "", "", "", "", "formato que não existe", "", "100,00", "", "", ""],
  ]), "Pacientes");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["paciente", "data", "hora", "duracao", "status", "modalidade"],
    [NOME, "05/02/2025", "14:00", 50, "realizada", "presencial"],
    [NOME, "12/02/2025", "14:00", 50, "realizada", "online"],
  ]), "Agenda");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["paciente", "data", "valor", "forma", "pago_por"],
    [NOME, "10/02/2025", "600,00", "pix", "Maria"],
  ]), "Pagamentos");
  // `readFile`/`writeFile` do SheetJS só existem com a ponte de fs ligada; em ESM ela não vem.
  // Passar pelo buffer dispensa a ponte e funciona igual.
  fs.writeFileSync(arquivo, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
const alvo = new URL(BASE);
await ctx.addCookies([{ name: "auth-session", value: token, domain: alvo.hostname, path: "/", secure: alvo.protocol === "https:" }]);
await ctx.addInitScript(() => { try { localStorage.setItem("ledivan_onboarded_v3", "1"); localStorage.setItem("ledivan_diva_dia", new Date().toISOString().slice(0, 10)); localStorage.setItem("ledivan_diva_aviso_voz", "1"); } catch { /* sem localStorage */ } });
const page = await ctx.newPage();
page.setDefaultNavigationTimeout(120000);
page.setDefaultTimeout(30000);

const limpar = async () => {
  const ps = await sql`SELECT id FROM patients WHERE user_id = ${qa.id} AND name LIKE ${`QA import ${marca}%`}`;
  for (const p of ps) {
    await sql`DELETE FROM session_payments WHERE patient_id = ${p.id}`;
    await sql`DELETE FROM therapy_sessions WHERE patient_id = ${p.id}`;
    await sql`DELETE FROM patient_payment_format_history WHERE patient_id = ${p.id}`;
    await sql`DELETE FROM patient_price_history WHERE patient_id = ${p.id}`;
    await sql`DELETE FROM patients WHERE id = ${p.id}`;
  }
  return ps.length;
};

try {
  // ───────── 1. o modelo ─────────
  await page.goto(`${BASE}/dashboard/settings`, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  const cartao = page.getByText("Importar dados de outro sistema").first();
  check("o cartão existe em Ajustes", (await cartao.count()) > 0);
  await cartao.scrollIntoViewIfNeeded().catch(() => {});

  const [baixado] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: /Baixar planilha modelo/i }).click(),
  ]);
  const modelo = path.join(tmp, "modelo.xlsx");
  await baixado.saveAs(modelo);
  const wbModelo = XLSX.read(fs.readFileSync(modelo));
  check("o modelo tem as quatro abas", wbModelo.SheetNames.length === 4, wbModelo.SheetNames.join(" · "));
  const cab = XLSX.utils.sheet_to_json(wbModelo.Sheets["Pacientes"], { header: 1 })[0] ?? [];
  check("a aba Pacientes vem SÓ com o cabeçalho (exemplo seria importado junto)",
    XLSX.utils.sheet_to_json(wbModelo.Sheets["Pacientes"]).length === 0, `${cab.length} colunas`);

  // ───────── 2. conferir ─────────
  montar();
  await page.locator('input[type="file"]').last().setInputFiles(arquivo);
  const painel = page.locator('[data-testid="conferencia-da-planilha"]');
  await painel.waitFor({ timeout: 30000 });
  const texto = (await painel.innerText()).replace(/\u00a0/g, " ");
  check("a conferência aparece ANTES de gravar", (await painel.count()) > 0);
  check("contou 1 paciente, 2 atendimentos e 1 pagamento",
    /\b1\b[\s\S]*paciente/.test(texto) && /\b2\b[\s\S]*atendimento/.test(texto) && /\b1\b[\s\S]*pagamento/.test(texto),
    texto.split("\n").slice(1, 5).join(" | "));
  check("acusou a linha com formato inválido",
    /formato_pagamento/.test(texto) && /linha 3/.test(texto),
    (texto.match(/Pacientes, linha[^\n]*/) ?? ["—"])[0]);
  check("avisa que o pagamento não entra no Caixa", /não.{0,3}<?\s*entram no Caixa|não<\/b> entram no Caixa|não entram no Caixa/i.test(texto) || /Caixa/.test(texto));

  const antes = await sql`SELECT count(*)::int AS n FROM patients WHERE user_id = ${qa.id} AND name LIKE ${`QA import ${marca}%`}`;
  check("NADA foi gravado antes de confirmar", antes[0].n === 0, `${antes[0].n} cadastro(s)`);

  // ───────── 3. confirmar ─────────
  await page.getByRole("button", { name: /Confirmar importação/i }).click();
  await page.locator('[data-testid="importacao-concluida"]').waitFor({ timeout: 60000 });

  const [p] = await sql`SELECT id, name, payment_format, pacote_tipo, session_fee, payment_day, sessions_in_packet, started_at
                          FROM patients WHERE user_id = ${qa.id} AND name = ${NOME}`;
  check("o paciente nasceu com o combinado da planilha",
    !!p && p.payment_format === "mensal" && p.pacote_tipo === "completo" && Number(p.session_fee) === 150 && p.payment_day === 10,
    p ? `${p.payment_format}/${p.pacote_tipo} R$ ${p.session_fee} dia ${p.payment_day}` : "não encontrado");
  check("a linha com problema NÃO virou cadastro",
    (await sql`SELECT count(*)::int AS n FROM patients WHERE user_id = ${qa.id} AND name = ${`${NOME} ruim`}`)[0].n === 0);

  const vig = await sql`SELECT formato, data_efetiva FROM patient_payment_format_history WHERE patient_id = ${p.id}`;
  const prec = await sql`SELECT valor FROM patient_price_history WHERE patient_id = ${p.id}`;
  check("nasceu com VIGÊNCIA do formato", vig.length === 1 && vig[0].formato === "mensal");
  check("e com o preço de ENTRADA (não como reajuste)", prec.length === 1 && Number(prec[0].valor) === 150);

  const ss = await sql`SELECT date, status, is_online FROM therapy_sessions WHERE patient_id = ${p.id} ORDER BY date`;
  check("os dois atendimentos entraram, com status e modalidade", ss.length === 2 && ss[0].status === "realizada" && ss[1].is_online === true,
    ss.map((s) => `${String(s.date).slice(0, 10)}/${s.status}`).join(" "));

  const pg = await sql`SELECT amount, method, pago_por, cobranca_chave, linked_transaction_id FROM session_payments WHERE patient_id = ${p.id}`;
  check("o pagamento entrou como histórico", pg.length === 1 && Number(pg[0].amount) === 600 && pg[0].method === "pix");
  check("sem chave de cobrança — o motor encaixa pela ordem de vencimento", pg[0]?.cobranca_chave === null);
  check("e sem lançamento no Caixa", pg[0]?.linked_transaction_id === null);

  // ───────── 4. reenviar não duplica ─────────
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.getByText("Importar dados de outro sistema").first().scrollIntoViewIfNeeded().catch(() => {});
  await page.locator('input[type="file"]').last().setInputFiles(arquivo);
  await painel.waitFor({ timeout: 30000 });
  const t2 = await painel.innerText();
  check("a conferência avisa o que já existe e será pulado", /pulados|serão/i.test(t2),
    (t2.match(/J[áa] existem[^\n]*/) ?? ["—"])[0].slice(0, 90));
  await page.getByRole("button", { name: /Confirmar importação/i }).click();
  await page.locator('[data-testid="importacao-concluida"]').waitFor({ timeout: 60000 });

  const dobrou = await sql`SELECT
      (SELECT count(*)::int FROM patients WHERE user_id = ${qa.id} AND name = ${NOME}) AS pac,
      (SELECT count(*)::int FROM therapy_sessions WHERE patient_id = ${p.id}) AS ses,
      (SELECT count(*)::int FROM session_payments WHERE patient_id = ${p.id}) AS pag`;
  check("reenviar o MESMO arquivo não duplica nada",
    dobrou[0].pac === 1 && dobrou[0].ses === 2 && dobrou[0].pag === 1,
    `${dobrou[0].pac} paciente · ${dobrou[0].ses} sessões · ${dobrou[0].pag} pagamento`);
} catch (e) {
  check("o percurso chegou ao fim sem exceção", false, String(e && e.message ? e.message : e).slice(0, 300));
} finally {
  await nav.close();
  const n = await limpar();
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch { /* já foi */ }
  console.log(`\n${falhas ? `${falhas} FALHA(S)` : "tudo certo"} · ${n} cadastro(s) de teste apagado(s)`);
  process.exit(falhas ? 1 : 0);
}

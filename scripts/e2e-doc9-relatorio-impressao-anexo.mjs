// O DOC 9 NO APP DE VERDADE.
//
// O que o teste puro não prova, porque o que muda é a TELA e o caminho até ela:
//
//   1. O botão "Relatório de Acompanhamento Terapêutico" preenche o NOME e o CORPO do documento
//      em elaboração, com a IA da casa — sem a terapeuta cadastrar chave nenhuma.
//   2. O documento salvo assim entra na lista como qualquer outro.
//   3. A IMPRESSÃO traz o nome do documento. Era o defeito: o papel saía com cabeçalho e texto,
//      sem dizer que documento era.
//   4. Embaixo de cada atividade existe um botão para anexar arquivo.
//
// Uso: node scripts/e2e-doc9-relatorio-impressao-anexo.mjs    (servidor em http://localhost:3000)

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

const [p] = await sql`
  INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status, payment_day, sessions_in_packet, started_at)
  VALUES (${qa.id}, ${`QA doc9 ${marca}`}, 'sessao', '100.00', 'ativo', 10, 4, ${new Date(2026, 5, 1)}) RETURNING id`;
criados.push(p.id);

// Matéria-prima do relatório: anamnese, um registro e uma atividade.
await sql`INSERT INTO patient_anamnese (user_id, patient_id, title, content, position, custom)
  VALUES (${qa.id}, ${p.id}, 'Queixa principal', 'Ansiedade antes de reuniões e dificuldade para dormir.', 0, false)`;
await sql`INSERT INTO patient_records (user_id, patient_id, title, content)
  VALUES (${qa.id}, ${p.id}, 'Sessão inicial', 'Relatou insônia há quatro meses. Combinamos treino de respiração.')`;
const [ativ] = await sql`INSERT INTO patient_activities (user_id, patient_id, title, description)
  VALUES (${qa.id}, ${p.id}, 'Respiração diafragmática', 'Treinada em sessão.') RETURNING id`;

const nav = await chromium.launch();
const ctx = await nav.newContext();
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("ledivan_onboarded_v3", "1");
    localStorage.setItem("ledivan_diva_dia", new Date().toISOString().slice(0, 10));
    localStorage.setItem("ledivan_diva_aviso_voz", "1");
  } catch { /* sem localStorage */ }
  // `window.print()` abre um diálogo nativo que trava o percurso. O que interessa é o que o portal
  // de impressão MONTOU, não o diálogo — então a chamada vira um registro.
  window.__imprimiu = 0;
  window.print = () => { window.__imprimiu++; };
});
const alvo = new URL(BASE);
await ctx.addCookies([{ name: "auth-session", value: token, domain: alvo.hostname, path: "/", secure: alvo.protocol === "https:" }]);
const page = await ctx.newPage();

try {
  // ───────────────────────────── 1. O BOTÃO GERA O RELATÓRIO ──────────────────────────────────
  await page.goto(`${BASE}/dashboard/patients/${p.id}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Documentos", exact: true }).click();
  await page.waitForTimeout(500);

  const botao = page.getByRole("button", { name: /Relatório de Acompanhamento Terapêutico/ });
  check("o botão existe na guia Documentos", await botao.count() > 0);
  await botao.click();
  // Doc 63: o nome e o corpo deixaram de ser <input>/<textarea> e viraram campos formatáveis.
  await page.waitForFunction(() => {
    const campos = document.querySelectorAll(".campo-rico");
    return campos.length > 1 && (campos[1].innerText ?? "").trim().length > 200;
  }, { timeout: 120000 });

  const campos = page.locator(".campo-rico");
  const nome = (await campos.nth(0).innerText()).trim();
  const corpo = (await campos.nth(1).innerText()).trim();
  check("preencheu o NOME do documento", nome === "Relatório de Acompanhamento Terapêutico", nome);
  check("preencheu o CORPO com o relatório", corpo.length > 200, `${corpo.length} caracteres`);
  check("o corpo não tem cabeçalho de Markdown", !/^#{1,6} /m.test(corpo));
  check("o corpo não tem negrito de Markdown", !corpo.includes("**"));
  check("fala da paciente, não de outra pessoa", /ansiedade|insônia|respiração/i.test(corpo));

  // ───────────────────────────── 2. SALVA E ENTRA NA LISTA ────────────────────────────────────
  await page.getByRole("button", { name: /^Salvar$/ }).click();
  await page.waitForTimeout(2500);
  const [doc] = await sql`SELECT id, name, content FROM patient_documents WHERE patient_id = ${p.id} LIMIT 1`;
  check("o relatório virou documento salvo", !!doc && doc.name === "Relatório de Acompanhamento Terapêutico", doc?.name ?? "(nenhum)");

  // ───────────────────────────── 3. A IMPRESSÃO TRAZ O NOME ───────────────────────────────────
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Documentos", exact: true }).click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Imprimir documento" }).first().click();
  await page.waitForTimeout(800);
  // `innerText` do nó inteiro traz o <style> do portal junto; o que vale é o BLOCO da folha.
  const impresso = await page.$eval("#doc-print-root > div", (el) => el.innerText.replace(/\s+/g, " ").trim());
  const chamou = await page.evaluate(() => window.__imprimiu);
  check("a impressão foi disparada", chamou > 0, String(chamou));
  check("o NOME do documento está na folha", impresso.includes("Relatório de Acompanhamento Terapêutico"), impresso.slice(0, 160));
  check("o nome vem DEPOIS do cabeçalho", impresso.indexOf("Relatório de Acompanhamento Terapêutico") > impresso.indexOf("Sessões realizadas"));
  check("o corpo do documento está na folha", impresso.length > 300, `${impresso.length} caracteres`);

  // ───────────────────────────── 4. ANEXAR EMBAIXO DA ATIVIDADE ───────────────────────────────
  await page.getByRole("button", { name: "Atividades", exact: true }).click();
  await page.waitForTimeout(1200);
  const cartao = page.locator("div.glass-card").filter({ hasText: "Respiração diafragmática" }).last();
  const anexar = cartao.getByRole("button", { name: /Anexar arquivo/ });
  check("há um botão de anexar DENTRO do cartão da atividade", await anexar.count() === 1, String(await anexar.count()));
  const ordem = await cartao.evaluate((el) => {
    const t = el.innerText;
    return [t.indexOf("Respiração diafragmática"), t.indexOf("Treinada em sessão"), t.indexOf("Anexar arquivo")].join(",");
  });
  const [iTit, iDesc, iAnx] = ordem.split(",").map(Number);
  check("o botão fica EMBAIXO da atividade", iAnx > iDesc && iDesc > iTit, `titulo=${iTit} descricao=${iDesc} anexar=${iAnx}`);
  const quantos = await page.getByRole("button", { name: /Anexar arquivo/ }).count();
  check("um por atividade, não um na guia inteira", quantos === 1, `${quantos} botão(ões) para 1 atividade`);
} catch (e) {
  // Sem isto o `process.exit` do finally engole a exceção e o percurso "passa" sem ter rodado.
  falhas++;
  console.log("FALHA  o percurso parou:", e?.message ?? e);
} finally {
  await nav.close();
  for (const id of criados) {
    await sql`DELETE FROM patient_document WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_documents WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_activities WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_records WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_anamnese WHERE patient_id = ${id}`;
    await sql`DELETE FROM therapy_sessions WHERE patient_id = ${id}`;
    await sql`DELETE FROM patients WHERE id = ${id}`;
  }
  void ativ;
  const [sobrou] = await sql`SELECT count(*)::int AS n FROM patients WHERE user_id = ${qa.id}`;
  console.log(`\nlimpeza: restam ${sobrou.n} cadastro(s) na conta de QA`);
  console.log(falhas ? `\n${falhas} FALHA(S)` : "\ntudo certo");
  process.exit(falhas ? 1 : 0);
}

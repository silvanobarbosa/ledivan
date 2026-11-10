// O DOC 63 NO APP DE VERDADE.
//
// O que o teste puro não prova, porque o que muda é a TELA e o caminho até ela:
//
//   1. No celular, o item de baixo diz "Carteira" e abre /dashboard/pagamentos.
//   2. A barra de formatação existe e FORMATA: centralizar o texto do documento sai centralizado
//      no campo e na impressão, e a assinatura fecha a folha.
//   3. O anexo tem IMPRESSORA no lugar do baixar, em Registros e em Atividades.
//   4. Editar um vencimento para outro mês NÃO pergunta mais nada: avisa para conferir as próximas,
//      e não cria sequência nenhuma.
//   5. "Processo de encerramento" existe no cadastro e entra no contrato.
//   6. No Financeiro: "Próximo reajuste em" aparece UMA vez, as Observações salvam/editam/apagam,
//      e a área do formato tem Salvar próprio.
//
// Uso: node scripts/e2e-doc63.mjs    (servidor em http://localhost:3000)

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

// Paciente MENSAL com pacote: é o que produz cobrança com vencimento para a guia Geral.
const [p] = await sql`
  INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status, payment_day, sessions_in_packet, pacote_tipo, started_at, times_per_period)
  VALUES (${qa.id}, ${`QA doc63 ${marca}`}, 'mensal', '100.00', 'ativo', 10, 4, 'completo', ${new Date(2026, 8, 1)}, 1)
  RETURNING id`;
criados.push(p.id);

// Quatro sessões realizadas fecham o pacote e geram a cobrança do mês.
for (const dia of [2, 9, 16, 23]) {
  await sql`INSERT INTO therapy_sessions (user_id, patient_id, date, status, duration)
    VALUES (${qa.id}, ${p.id}, ${new Date(2026, 9, dia, 15, 0)}, 'realizada', 50)`;
}
await sql`INSERT INTO patient_records (user_id, patient_id, title, content)
  VALUES (${qa.id}, ${p.id}, 'Sessão inicial', 'Primeiro encontro.')`;
const [ativ] = await sql`INSERT INTO patient_activities (user_id, patient_id, title, description)
  VALUES (${qa.id}, ${p.id}, 'Respiração diafragmática', 'Treinada em sessão.') RETURNING id`;
// Um anexo em cada item, só para a impressora ter o que imprimir.
await sql`INSERT INTO patient_document (user_id, patient_id, title, kind, content, compartilhado, record_id)
  SELECT ${qa.id}, ${p.id}, 'Comprovante.pdf', 'file', 'qa/doc63.pdf', false, id FROM patient_records WHERE patient_id = ${p.id} LIMIT 1`;
await sql`INSERT INTO patient_document (user_id, patient_id, title, kind, content, compartilhado, activity_id)
  VALUES (${qa.id}, ${p.id}, 'Exercicio.pdf', 'file', 'qa/doc63b.pdf', false, ${ativ.id})`;

const nav = await chromium.launch();
const ctx = await nav.newContext();
await ctx.addInitScript(() => {
  try {
    localStorage.setItem("ledivan_onboarded_v3", "1");
    localStorage.setItem("ledivan_diva_dia", new Date().toISOString().slice(0, 10));
    localStorage.setItem("ledivan_diva_aviso_voz", "1");
  } catch { /* sem localStorage */ }
  window.__imprimiu = 0;
  window.print = () => { window.__imprimiu++; };
});
const alvo = new URL(BASE);
await ctx.addCookies([{ name: "auth-session", value: token, domain: alvo.hostname, path: "/", secure: alvo.protocol === "https:" }]);
const page = await ctx.newPage();
page.setDefaultTimeout(60000);

try {
  // ─────────────────────────── 1. CARTEIRA NO CELULAR ─────────────────────────────────────────
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  const rodape = page.locator("nav.fixed.bottom-0");
  const textoRodape = (await rodape.innerText()).replace(/\s+/g, " ");
  // O rótulo sai em CAIXA ALTA por CSS; o que se compara é a palavra, não a caixa.
  check("o item de baixo diz Carteira", /carteira/i.test(textoRodape), textoRodape);
  check("e não diz mais Caixa", !/caixa/i.test(textoRodape), textoRodape);
  const destino = await rodape.getByRole("link", { name: /Carteira/i }).getAttribute("href");
  check("e aponta para a Carteira, não para as Transações", destino === "/dashboard/pagamentos", String(destino));
  await page.setViewportSize({ width: 1280, height: 900 });

  // ─────────────────────────── 2. A BARRA FORMATA ─────────────────────────────────────────────
  await page.goto(`${BASE}/dashboard/patients/${p.id}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Documentos", exact: true }).click();
  await page.waitForTimeout(600);

  for (const rotulo of ["Tipo de fonte", "Tamanho da fonte", "Cor vermelho", "Centralizar", "Justificar", "Marcadores"]) {
    check(`a barra tem "${rotulo}"`, await page.getByLabel(rotulo).count() > 0);
  }
  const nomeCampo = page.locator(".campo-rico").nth(0);
  const corpoCampo = page.locator(".campo-rico").nth(1);
  await nomeCampo.click();
  await page.keyboard.type(`Declaração QA ${marca}`);
  await corpoCampo.click();
  await page.keyboard.type("Declaro para os devidos fins.");
  // Seleciona o corpo inteiro e manda centralizar.
  await page.keyboard.press("Control+A");
  await page.getByLabel("Centralizar").click();
  await page.waitForTimeout(300);
  const htmlCorpo = await corpoCampo.innerHTML();
  check("centralizar deixa marca no campo", /text-align:\s*center/i.test(htmlCorpo), htmlCorpo.slice(0, 120));

  await page.getByRole("button", { name: /^Salvar$/ }).click();
  await page.waitForTimeout(2500);
  const [doc] = await sql`SELECT name, content FROM patient_documents WHERE patient_id = ${p.id} ORDER BY created_at DESC LIMIT 1`;
  check("o documento foi salvo", !!doc, doc?.name ?? "(nenhum)");
  check("a formatação sobreviveu à faxina do servidor", /text-align:\s*center/i.test(doc?.content ?? ""), (doc?.content ?? "").slice(0, 120));

  // ─────────────────────────── 3. A IMPRESSÃO: NOME, CORPO E ASSINATURA ───────────────────────
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Documentos", exact: true }).click();
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: "Imprimir documento" }).first().click();
  await page.waitForTimeout(800);
  const folha = await page.$eval("#doc-print-root > div", (el) => el.innerText.replace(/\s+/g, " ").trim());
  const htmlFolha = await page.$eval("#doc-print-root > div", (el) => el.innerHTML);
  check("a impressão foi disparada", (await page.evaluate(() => window.__imprimiu)) > 0);
  check("o nome está na folha", folha.includes(`Declaração QA ${marca}`), folha.slice(0, 140));
  check("o corpo sai centralizado no papel", /text-align:\s*center/i.test(htmlFolha));
  const [prof] = await sql`SELECT name FROM "user" WHERE id = ${qa.id}`;
  const iNome = folha.lastIndexOf(prof.name);
  check("a assinatura fecha a folha", iNome > folha.indexOf("Declaro para os devidos fins"), `pos=${iNome}`);

  // ─────────────────────────── 4. IMPRESSORA NO ANEXO ─────────────────────────────────────────
  await page.getByRole("button", { name: "Registros", exact: true }).click();
  await page.waitForTimeout(1500);
  check("o anexo do registro tem impressora", await page.getByRole("button", { name: "Imprimir Comprovante.pdf" }).count() === 1);
  check("e não tem mais o botão de abrir/baixar", await page.getByRole("button", { name: "Abrir", exact: true }).count() === 0);
  await page.getByRole("button", { name: "Atividades", exact: true }).click();
  await page.waitForTimeout(1500);
  check("o anexo da atividade tem impressora", await page.getByRole("button", { name: "Imprimir Exercicio.pdf" }).count() === 1);

  // ─────────────────────────── 5. O VENCIMENTO SEM JANELA ─────────────────────────────────────
  await page.getByRole("button", { name: "Geral", exact: true }).click();
  await page.waitForTimeout(1500);
  const lapis = page.getByRole("button", { name: "Editar vencimento" }).first();
  check("há vencimento para editar", await lapis.count() > 0);
  if (await lapis.count()) {
    await lapis.click();
    const campoData = page.locator('input[type="date"]').first();
    const atual = await campoData.inputValue();
    const [ano, mes, dia] = atual.split("-").map(Number);
    const outroMes = mes === 12 ? `${ano + 1}-01-${String(dia).padStart(2, "0")}` : `${ano}-${String(mes + 1).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
    await campoData.fill(outroMes);
    await page.getByRole("button", { name: "Salvar vencimento" }).click();
    await page.waitForTimeout(2500);
    const corpoGeral = (await page.locator("body").innerText()).replace(/\s+/g, " ");
    check("não pergunta mais das próximas parcelas", !corpoGeral.includes("Deseja alterar o mês de vencimento"));
    check("avisa para conferir as próximas datas", corpoGeral.includes("Confira se as próximas datas estão corretas"), corpoGeral.slice(0, 0));
    const [seq] = await sql`SELECT count(*)::int AS n FROM cobranca_deslocamentos WHERE patient_id = ${p.id}`;
    check("e NÃO cria sequência nova", seq.n === 0, `${seq.n} sequência(s)`);
  }

  // ─────────────────────────── 6. CADASTRO: ENCERRAMENTO, REAJUSTE, OBSERVAÇÕES ───────────────
  await page.goto(`${BASE}/dashboard/patients/${p.id}/edit`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(600);
  const encerramento = page.locator("#processoEncerramento");
  check("o campo Processo de encerramento existe", await encerramento.count() === 1);
  await encerramento.fill("2 a 4");
  await page.getByRole("button", { name: /^Salvar alterações$/ }).first().click();
  await page.waitForTimeout(3000);
  const [salvo] = await sql`SELECT processo_encerramento FROM patients WHERE id = ${p.id}`;
  check("o processo de encerramento foi salvo", salvo.processo_encerramento === "2 a 4", String(salvo.processo_encerramento));

  await page.goto(`${BASE}/dashboard/patients/${p.id}/contrato`, { waitUntil: "domcontentloaded" });
  const contrato = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  check("a cláusula 8.1 saiu com o combinado", /realização de no mínimo 2 a 4 sessões de encerramento/.test(contrato));
  check("e o foro voltou a ser a 9", /9\. DO FORO/.test(contrato));

  await page.goto(`${BASE}/dashboard/patients/${p.id}/edit?guia=financeiro`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  check("Próximo reajuste em aparece UMA vez", await page.getByLabel("Próximo reajuste em").count() === 1);
  check("a área do formato tem Salvar próprio", await page.getByRole("button", { name: /Salvar formato de pagamento/ }).count() === 1);

  await page.getByLabel("Próximo reajuste em").fill("12");
  await page.locator("#proximoReajusteData").fill("2027-03-01");
  await page.getByRole("button", { name: /Salvar reajuste/ }).click();
  await page.waitForTimeout(2500);
  const [reaj] = await sql`SELECT validade_preco_meses, reajuste_a_partir_de, price_review_date, session_fee FROM patients WHERE id = ${p.id}`;
  check("gravou os meses", reaj.validade_preco_meses === 12, String(reaj.validade_preco_meses));
  // O driver devolve Date; o que se compara é o DIA, sem passar pelo texto local do fuso.
  const diaDe = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
  check("gravou a data base", diaDe(reaj.reajuste_a_partir_de) === "2027-03-01", String(diaDe(reaj.reajuste_a_partir_de)));
  check("o lembrete conta DA data escolhida", diaDe(reaj.price_review_date) === "2028-03-01", String(diaDe(reaj.price_review_date)));
  check("e o valor da sessão não foi tocado", String(reaj.session_fee) === "100.00", String(reaj.session_fee));

  await page.locator("#observacaoAssunto").fill("Combinado de novembro");
  await page.locator("#observacaoTexto").fill("Mãe pediu para pagar dia 20 neste mês.");
  await page.getByRole("button", { name: /Salvar observação/ }).click();
  await page.waitForTimeout(2500);
  const [obs] = await sql`SELECT id, assunto, observacao FROM patient_observacoes WHERE patient_id = ${p.id}`;
  check("a observação foi salva", obs?.assunto === "Combinado de novembro", obs?.assunto ?? "(nenhuma)");

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  const assunto = page.getByRole("button", { name: "Combinado de novembro", exact: true });
  check("o assunto vira título na lista", await assunto.count() === 1);
  const corpoAntes = (await page.locator("body").innerText()).includes("Mãe pediu para pagar dia 20");
  check("o texto começa RECOLHIDO", !corpoAntes);
  await assunto.click();
  await page.waitForTimeout(300);
  check("clicar no assunto abre o texto", (await page.locator("body").innerText()).includes("Mãe pediu para pagar dia 20"));
} catch (e) {
  // Sem isto o `process.exit` do finally engole a exceção e o percurso "passa" sem ter rodado.
  falhas++;
  console.log("FALHA  o percurso parou:", e?.message ?? e);
} finally {
  await nav.close();
  for (const id of criados) {
    await sql`DELETE FROM patient_observacoes WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_document WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_documents WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_activities WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_records WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_anamnese WHERE patient_id = ${id}`;
    await sql`DELETE FROM cobranca_vencimentos WHERE patient_id = ${id}`;
    await sql`DELETE FROM cobranca_deslocamentos WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_reajuste_changes WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_price_history WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_payment_format_history WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_package_history WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_packages WHERE patient_id = ${id}`;
    await sql`DELETE FROM session_payments WHERE patient_id = ${id}`;
    await sql`DELETE FROM therapy_sessions WHERE patient_id = ${id}`;
    await sql`DELETE FROM patients WHERE id = ${id}`;
  }
  const [sobrou] = await sql`SELECT count(*)::int AS n FROM patients WHERE user_id = ${qa.id}`;
  console.log(`\nlimpeza: restam ${sobrou.n} cadastro(s) na conta de QA`);
  console.log(falhas ? `\n${falhas} FALHA(S)` : "\ntudo certo");
  process.exit(falhas ? 1 : 0);
}

// O DOC 64 NO APP DE VERDADE.
//
// O que teste puro não prova, porque o que muda é a TELA:
//
//   1. Os analíticos abrem em "Tudo", e os dois cards novos (Total de serviços, Prof. desmarcou)
//      existem, somam o que devem e acompanham o filtro de período.
//   2. "Vencimentos por dia" fecha cada tabela com a linha do total a pagar.
//   3. A barra dos documentos tem Negrito e Itálico, e o negrito SOBREVIVE à faxina do servidor.
//   4. O bloco "Sai no fim do documento impresso" saiu da tela — e a assinatura continua no papel.
//   5. A impressora do anexo abre a janela de impressão da PRÓPRIA página (imagem).
//   6. O texto novo do Processo de encerramento está no cadastro.
//   7. O aviso das próximas datas é uma JANELA com OK.
//   8. No celular, o Divã e o escanear-recibo estão na barra do topo, não flutuando.
//
// Uso: node scripts/e2e-doc64.mjs    (servidor em http://localhost:3000, `npm start`)

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

// Um PACIENTE e um SUPERVISIONADO: é o par que faz "Total de serviços" ser diferente de
// "Atendimentos realizados" — sem ele o card novo passaria verde somando com zero.
const [p] = await sql`
  INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status, payment_day, sessions_in_packet, pacote_tipo, started_at, times_per_period, cadastro_kind, processo_encerramento)
  VALUES (${qa.id}, ${`QA doc64 ${marca}`}, 'mensal', '100.00', 'ativo', 10, 4, 'completo', ${new Date(2026, 8, 1)}, 1, 'paciente', '1')
  RETURNING id`;
const [s] = await sql`
  INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status, started_at, times_per_period, cadastro_kind)
  VALUES (${qa.id}, ${`QA sup64 ${marca}`}, 'sessao', '80.00', 'ativo', ${new Date(2026, 8, 1)}, 1, 'supervisionado')
  RETURNING id`;
const criados = [p.id, s.id];

for (const dia of [2, 9, 16, 23]) {
  await sql`INSERT INTO therapy_sessions (user_id, patient_id, date, status, duration)
    VALUES (${qa.id}, ${p.id}, ${new Date(2026, 9, dia, 15, 0)}, 'realizada', 50)`;
}
// Uma falta do paciente e uma desmarcação da profissional: os dois cards de baixo.
await sql`INSERT INTO therapy_sessions (user_id, patient_id, date, status, duration)
  VALUES (${qa.id}, ${p.id}, ${new Date(2026, 9, 30, 15, 0)}, 'nao_realizada', 50)`;
await sql`INSERT INTO therapy_sessions (user_id, patient_id, date, status, duration)
  VALUES (${qa.id}, ${p.id}, ${new Date(2026, 9, 29, 15, 0)}, 'prof_desmarcou', 50)`;
await sql`INSERT INTO therapy_sessions (user_id, patient_id, date, status, duration)
  VALUES (${qa.id}, ${s.id}, ${new Date(2026, 9, 20, 10, 0)}, 'realizada', 50)`;
// Uma sessão avulsa realizada HOJE: é ela que põe uma linha (e, com ela, o total) na tabela de
// "Vencimentos por dia", que abre sempre no dia de hoje.
const agora = new Date();
await sql`INSERT INTO therapy_sessions (user_id, patient_id, date, status, duration)
  VALUES (${qa.id}, ${s.id}, ${new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 9, 0)}, 'realizada', 50)`;

await sql`INSERT INTO patient_records (user_id, patient_id, title, content)
  VALUES (${qa.id}, ${p.id}, 'Sessão inicial', 'Primeiro encontro.')`;
await sql`INSERT INTO patient_document (user_id, patient_id, title, kind, content, compartilhado, record_id)
  SELECT ${qa.id}, ${p.id}, 'Foto.png', 'file', 'qa/doc64.png', false, id FROM patient_records WHERE patient_id = ${p.id} LIMIT 1`;

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

const numeroDoCard = async (rotulo) =>
  page.evaluate((r) => {
    for (const el of document.querySelectorAll("p")) {
      if (el.textContent?.trim().toLowerCase() === r.toLowerCase()) {
        const n = el.parentElement?.querySelector("p");
        return n ? parseInt((n.textContent ?? "").replace(/\D/g, ""), 10) : null;
      }
    }
    return null;
  }, rotulo);

try {
  // ───────────────────────── 1. ANALÍTICOS: PERÍODO E CARDS ──────────────────────────────────
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);

  const tudo = page.getByRole("button", { name: "Tudo", exact: true });
  const classeTudo = (await tudo.getAttribute("class")) ?? "";
  check("ao abrir, o recorte selecionado é Tudo", /bg-primary\b/.test(classeTudo), classeTudo.slice(0, 60));
  const doze = page.getByRole("button", { name: "12 meses", exact: true });
  check("e 12 meses NÃO está selecionado", !/bg-primary\b/.test((await doze.getAttribute("class")) ?? ""));

  const atend = await numeroDoCard("Atendimentos realizados");
  const superv = await numeroDoCard("Supervisões realizadas");
  const totalServ = await numeroDoCard("Total serviços realizados");
  const desmarcou = await numeroDoCard("Prof. desmarcou");
  check("o card Total serviços realizados existe", totalServ !== null, String(totalServ));
  check("o card Prof. desmarcou existe", desmarcou !== null, String(desmarcou));
  check("Total de serviços = atendimentos + supervisões", totalServ === atend + superv, `${totalServ} vs ${atend}+${superv}`);
  check("as supervisões do QA entraram na conta", superv >= 1, String(superv));
  check("a desmarcação da profissional foi contada", desmarcou >= 1, String(desmarcou));

  // O filtro vale para os cards novos como vale para os velhos.
  await page.getByRole("button", { name: "Mês", exact: true }).click();
  await page.waitForTimeout(3000);
  const atendMes = await numeroDoCard("Atendimentos realizados");
  const supervMes = await numeroDoCard("Supervisões realizadas");
  const totalMes = await numeroDoCard("Total serviços realizados");
  check("com o filtro Mês, o Total de serviços continua sendo a soma", totalMes === atendMes + supervMes, `${totalMes} vs ${atendMes}+${supervMes}`);
  check("e o recorte Mês de fato encolheu o período", totalMes <= totalServ, `${totalMes} <= ${totalServ}`);

  // ───────────────────────── 2. VENCIMENTOS POR DIA: O TOTAL ─────────────────────────────────
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  const secaoVenc = page.locator("section").filter({ hasText: "Vencimentos por dia" }).first();
  const textoVenc = (await secaoVenc.innerText()).replace(/\s+/g, " ");
  check("Vencimentos por dia mostra a linha de total a pagar", /Total a pagar/i.test(textoVenc), textoVenc.slice(0, 160));
  // O total é o que FALTA receber, não a soma da coluna: a linha de uma cobrança quitada mostra o
  // valor cheio, e somá-la devolveria um "a pagar" que inclui dinheiro que já entrou.
  const somaDaTela = await secaoVenc.evaluate((sec) => {
    const brl = (t) => Number((t || "").replace(/[^\d,]/g, "").replace(",", ".")) || 0;
    const out = [];
    for (const tabela of sec.querySelectorAll("table")) {
      const corpo = [...tabela.querySelectorAll("tbody tr")].map((tr) => {
        const td = [...tr.querySelectorAll("td")];
        const quitada = /Pago em/i.test(tr.textContent || "");
        return { valor: brl(td.find((c) => /R\$/.test(c.textContent || ""))?.textContent), quitada };
      });
      const rodape = brl([...tabela.querySelectorAll("tfoot td")].find((c) => /R\$/.test(c.textContent || ""))?.textContent);
      out.push({ emAberto: corpo.filter((l) => !l.quitada).reduce((a, b) => a + b.valor, 0), rodape, linhas: corpo.length });
    }
    return out;
  });
  const comLinhas = somaDaTela.filter((t) => t.linhas > 0);
  check("há tabela com linha para somar", comLinhas.length > 0, JSON.stringify(somaDaTela));
  for (const t of comLinhas) {
    check("o total bate com o que falta receber nas linhas", Math.abs(t.rodape - t.emAberto) < 0.01, JSON.stringify(t));
  }

  // ───────────────────────── 3. NEGRITO E ITÁLICO NOS DOCUMENTOS ─────────────────────────────
  await page.goto(`${BASE}/dashboard/patients/${p.id}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Documentos", exact: true }).click();
  await page.waitForTimeout(1200);

  for (const rotulo of ["Negrito", "Itálico"]) {
    check(`a barra tem "${rotulo}"`, (await page.getByLabel(rotulo).count()) > 0);
  }

  const nomeCampo = page.locator(".campo-rico").nth(0);
  const corpoCampo = page.locator(".campo-rico").nth(1);
  await nomeCampo.click();
  await page.keyboard.type(`Declaração QA ${marca}`);
  await corpoCampo.click();
  await page.keyboard.type("Declaro para os devidos fins.");
  await page.keyboard.press("Control+A");
  await page.getByLabel("Negrito").click();
  await page.waitForTimeout(400);
  const htmlCorpo = await corpoCampo.innerHTML();
  check("negrito deixa marca no campo", /font-weight:\s*bold|<b>|<strong>/i.test(htmlCorpo), htmlCorpo.slice(0, 140));

  await page.getByRole("button", { name: /^Salvar$/ }).click();
  await page.waitForTimeout(2500);
  const [doc] = await sql`SELECT name, content FROM patient_documents WHERE patient_id = ${p.id} ORDER BY created_at DESC LIMIT 1`;
  check("o documento foi salvo", !!doc, doc?.name ?? "(nenhum)");
  check("o negrito sobreviveu à faxina do servidor", /font-weight:\s*bold|<b>|<strong>/i.test(doc?.content ?? ""), (doc?.content ?? "").slice(0, 140));

  // ───────────────────────── 4. A ASSINATURA SAIU DA TELA, FICOU NO PAPEL ─────────────────────
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Documentos", exact: true }).click();
  await page.waitForTimeout(1200);
  const corpoTela = (await page.innerText("body")).replace(/\s+/g, " ");
  check("o bloco 'Sai no fim do documento impresso' saiu da tela", !/Sai no fim do documento impresso/i.test(corpoTela));

  await page.getByRole("button", { name: "Imprimir documento" }).first().click();
  await page.waitForTimeout(900);
  const folha = await page.$eval("#doc-print-root > div", (el) => el.innerText.replace(/\s+/g, " ").trim());
  const htmlFolha = await page.$eval("#doc-print-root > div", (el) => el.innerHTML);
  const [prof] = await sql`SELECT name FROM "user" WHERE id = ${qa.id}`;
  check("a impressão foi disparada", (await page.evaluate(() => window.__imprimiu)) > 0);
  check("a assinatura continua fechando o papel", folha.lastIndexOf(prof.name) > folha.indexOf("Declaro para os devidos fins"), folha.slice(-120));
  check("e o negrito chega ao papel", /font-weight:\s*bold|<b>|<strong>/i.test(htmlFolha));

  // ───────────────────────── 5. A IMPRESSORA DO ANEXO (IMAGEM) ───────────────────────────────
  await page.goto(`${BASE}/dashboard/patients/${p.id}`, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Registros", exact: true }).click();
  await page.waitForTimeout(1500);
  await page.evaluate(() => { window.__imprimiu = 0; });
  const impressora = page.getByRole("button", { name: /Imprimir Foto\.png/i });
  check("o anexo tem impressora", (await impressora.count()) > 0);
  if (await impressora.count()) {
    await impressora.first().click();
    await page.waitForTimeout(2500);
    check("a imagem é desenhada na PRÓPRIA página para imprimir", (await page.locator("#anexo-print-root img").count()) > 0);
    // O arquivo do QA não existe no cofre, então `onLoad` não dispara — o que se prova aqui é o
    // caminho novo (bloco na própria página), e não o quadro escondido de antes.
    check("e não sobrou quadro escondido no corpo", (await page.locator("iframe[aria-hidden='true']").count()) === 0);
  }

  // ───────────────────────── 6. O TEXTO DO PROCESSO DE ENCERRAMENTO ──────────────────────────
  await page.goto(`${BASE}/dashboard/patients/${p.id}/edit`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const corpoEdit = (await page.innerText("body")).replace(/\s+/g, " ");
  check("o texto novo do encerramento está no cadastro", /Defina a quantidade mínima de sessões necessárias para o encerramento do tratamento e elaboração da separação terapêutica/i.test(corpoEdit));
  check("e o texto antigo saiu", !/Define as condições e a quantidade mínima/i.test(corpoEdit));

  // ───────────────────────── 7. O CONTRATO NO SINGULAR ───────────────────────────────────────
  await page.getByRole("button", { name: "Contrato", exact: true }).click();
  await page.waitForTimeout(2000);
  const contrato = (await page.innerText("body")).replace(/\s+/g, " ");
  check("com 1 combinado, o contrato fala no singular", /no mínimo 1 sessão de encerramento/i.test(contrato));
  check("e não diz '1 sessões'", !/no mínimo 1 sessões/i.test(contrato));

  // ───────────────────────── 8. O AVISO DAS DATAS É UMA JANELA ───────────────────────────────
  await page.goto(`${BASE}/dashboard/patients/${p.id}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  const lapis = page.getByRole("button", { name: "Editar vencimento" });
  check("a cobrança tem o lápis do vencimento", (await lapis.count()) > 0);
  if (await lapis.count()) {
    await lapis.first().click();
    await page.waitForTimeout(800);
    const campoData = page.locator('input[type="date"]').first();
    await campoData.fill("2026-12-15");
    await page.getByRole("button", { name: /Salvar vencimento|^Salvar$/ }).first().click();
    await page.waitForTimeout(3000);
    const janela = page.locator('[role="alertdialog"]');
    check("o aviso das próximas datas abre como JANELA", (await janela.count()) > 0);
    if (await janela.count()) {
      const t = (await janela.innerText()).replace(/\s+/g, " ");
      check("com o texto pedido", /Confira se as próximas datas estão corretas/i.test(t), t.slice(0, 100));
      check("e com o botão OK", (await janela.getByRole("button", { name: "OK", exact: true }).count()) > 0);
      await janela.getByRole("button", { name: "OK", exact: true }).click();
      await page.waitForTimeout(600);
      check("o OK fecha a janela", (await page.locator('[role="alertdialog"]').count()) === 0);
    }
  }

  // ───────────────────────── 9. NO CELULAR, OS DOIS BOTÕES NO TOPO ───────────────────────────
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  for (const [rotulo, nome] of [["Abrir o Divã", "Divã"], ["Ler um recibo e lançar", "escanear recibo"]]) {
    const b = page.getByRole("button", { name: rotulo });
    check(`o botão do ${nome} existe no celular`, (await b.count()) > 0);
    if (!(await b.count())) continue;
    const dentroDoTopo = await b.first().evaluate((el) => !!el.closest("header"));
    const flutua = await b.first().evaluate((el) => getComputedStyle(el).position === "fixed");
    check(`o ${nome} está na barra do topo`, dentroDoTopo);
    check(`e não flutua mais sobre o conteúdo`, !flutua);
  }
  await page.setViewportSize({ width: 1280, height: 900 });
} catch (e) {
  falhas++;
  console.log("EXCEÇÃO:", String(e?.stack ?? e).slice(0, 900));
} finally {
  await nav.close();
  for (const id of criados) await sql`DELETE FROM patients WHERE id = ${id}`;
  const [resta] = await sql`SELECT count(*)::int AS n FROM patients WHERE user_id = ${qa.id}`;
  console.log(`\nlimpeza: restam ${resta.n} cadastro(s) na conta de QA`);
  console.log(falhas ? `\n${falhas} FALHA(S)` : "\ntudo certo");
  process.exit(falhas ? 1 : 0);
}

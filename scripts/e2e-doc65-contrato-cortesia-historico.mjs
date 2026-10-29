// O DOC 65 NO APP DE VERDADE.
//
// O que o motor puro não prova, porque o que muda é a TELA e o caminho até ela:
//
//   1. Cadastro GRATUITO não mostra mais o preço guardado — o cabeçalho da guia Geral diz
//      "Gratuito", mesmo com um valor antigo no cadastro.
//   2. Apagar a troca de modalidade leva junto o PREÇO gravado na mesma vigência: era o preço
//      órfão que deixava a paciente gratuita com R$ 50,00 no cadastro.
//   3. O histórico de reajuste mostra o preço de entrada que tem vigência própria.
//   4. O contrato identifica CONTRATANTE e PACIENTE (nome, CPF, endereço, telefone, e-mail) e
//      assina com o nome, mesmo sem data de nascimento e sem responsável.
//   5. A cláusula 5.4 é a nova (reposição; não dando, vira crédito).
//   6. "Autoconhecimento" está na queixa principal.
//   7. A janela "Alterar quais?" não tem mais a escolha de sequência do pacote.
//   8. "Este atendimento será uma cortesia" aparece ao editar agendamento de AVULSO, QUINZENAL e
//      GRATUITO — não só do mensal.
//   9. O seletor de ano da Carteira lista TODOS os anos, não três.
//
// Uso: npm run build && npm start, depois node scripts/e2e-doc65-contrato-cortesia-historico.mjs
//
// RODE CONTRA O BUILD, não contra `npm run dev`: no servidor de desenvolvimento o fast refresh
// recarrega a tela de editar cadastro em laço (14 carregamentos do documento em 8 segundos, medido
// em 29/10). Nada disso acontece no build — lá a página carrega uma vez —, mas durante o laço todo
// clique estoura o tempo sobre um elemento que o log diz estar visível.

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
const texto = async (page) => (await page.innerText("body")).replace(/\u00a0/g, " ");

const [qa] = await sql`SELECT id FROM "user" WHERE email = 'qa.ledivan@reverblabs.com.br'`;
if (!qa) { console.log("conta de QA não encontrada"); process.exit(1); }
const token = await new jose.SignJWT({ userId: qa.id })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1d")
  .sign(new TextEncoder().encode(process.env.AUTH0_SECRET));

const marca = Date.now().toString().slice(-6);
const criados = [];
const hoje = (() => { const d = new Date(); d.setHours(11, 0, 0, 0); return d; })();
/** Uma data desta semana, às 16h — para a sessão aparecer na agenda que abre em hoje. */
const estaSemana = (somaDias = 0) => {
  const d = new Date(hoje);
  d.setDate(d.getDate() + somaDias);
  d.setHours(16, 0, 0, 0);
  return d;
};

const paciente = async (nome, formato, fee, extra = {}) => {
  const [p] = await sql`
    INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status, payment_day,
                          sessions_in_packet, started_at, phone, cpf, address, email, birth_date, guardian_name)
    VALUES (${qa.id}, ${nome}, ${formato}, ${fee}, 'ativo', 10, 4, ${new Date(hoje.getFullYear() - 2, 0, 5)},
            '11999990000', ${extra.cpf ?? null}, ${extra.endereco ?? null}, ${extra.email ?? null},
            ${extra.nascimento ?? null}, ${extra.responsavel ?? null})
    RETURNING id`;
  criados.push(p.id);
  return p.id;
};
const sessao = async (pid, quando, extra = {}) => {
  const [s] = await sql`INSERT INTO therapy_sessions (user_id, patient_id, date, status, duration, extra)
    VALUES (${qa.id}, ${pid}, ${quando}, 'agendada', 50, ${extra.extra ?? null}) RETURNING id`;
  return s.id;
};
const preco = (pid, valor, desde) =>
  sql`INSERT INTO patient_price_history (patient_id, valor, data_efetiva) VALUES (${pid}, ${valor}, ${desde})`;
const vigencia = (pid, formato, desde) =>
  sql`INSERT INTO patient_payment_format_history (patient_id, formato, pacote_tipo, data_efetiva) VALUES (${pid}, ${formato}, 'completo', ${desde})`;

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1440, height: 1100 } });
const alvo = new URL(BASE);
await ctx.addCookies([{ name: "auth-session", value: token, domain: alvo.hostname, path: "/", secure: alvo.protocol === "https:" }]);
await ctx.addInitScript(() => { try { localStorage.setItem("ledivan_onboarded_v3", "1"); } catch { /* sem localStorage */ } });
const page = await ctx.newPage();
page.setDefaultNavigationTimeout(120000);
page.setDefaultTimeout(30000);
/** O dev server compila a rota na primeira visita; `networkidle` sozinho estoura nela. */
const ir = async (url) => {
  for (let i = 0; i < 3; i++) {
    try { await page.goto(url, { waitUntil: "domcontentloaded" }); break; }
    catch { await page.waitForTimeout(2000); } // ERR_ABORTED enquanto o dev server compila a rota
  }
  await page.waitForLoadState("networkidle").catch(() => {});
};
/**
 * Abre a vigência pedida no acordeão do histórico de reajuste.
 *
 * Abre pelo DOM e CONFERE que o conteúdo ficou visível, repetindo enquanto não ficar. A página do
 * cadastro se redesenha algumas vezes depois de carregar, e nesse intervalo o `summary` resolve
 * mas some no meio da ação — foi o que fez `click`/`scrollIntoViewIfNeeded` estourarem o tempo
 * sobre um elemento que o próprio log dizia estar visível.
 */
const abrirVigencia = async (dia) => {
  const alvo = page.locator(`summary:has-text("vigência ${dia}")`).first();
  await alvo.waitFor({ timeout: 45000 }).catch(() => {});
  if (await alvo.count() === 0) return false;
  await alvo.click();
  await page.waitForTimeout(500);
  return await page.locator(`details:has(summary:has-text("vigência ${dia}")) ul`).first().isVisible().catch(() => false);
};

/** Abre a sessão do paciente na agenda e entra no "Editar agendamento". */
const abrirEdicao = async (nome) => {
  await ir(`${BASE}/dashboard/agenda`);
  // A grade da semana é desenhada depois da hidratação. Sem esperar por ela, a consulta pega a
  // página com só o menu dentro — foi o que fez os cinco cartões "sumirem" de uma vez.
  // `getByTitle` e não `[title^="…"]`: o seletor de atributo não casa com o título que a agenda
  // escreve, e o cartão existe (o dump de diagnóstico abaixo já o mostrou pelo nome).
  const card = page.getByTitle(nome, { exact: false }).first();
  await card.waitFor({ timeout: 45000 }).catch(() => {});
  if (await card.count() === 0) {
    const corpo = await texto(page);
    console.log(`       (agenda sem o cartão de ${nome}) ${corpo.slice(0, 200).replace(/\s+/g, " ")}`);
    return false;
  }
  await card.click();
  await page.waitForTimeout(500);
  const editar = page.getByRole("button", { name: /Editar agendamento/i }).first();
  if (await editar.count() === 0) return false;
  await editar.click();
  await page.waitForTimeout(500);
  return true;
};

try {
  // ───────────── 1. GRATUITO NÃO MOSTRA O PREÇO GUARDADO ─────────────
  console.log("\n— gratuito com preço antigo no cadastro —");
  // A paciente real: cadastro gratuito, mas um preço de R$ 50,00 sobrou de quando era avulsa.
  const gratuita = await paciente(`QA doc65 gratuita ${marca}`, "gratuito", "50.00");
  await vigencia(gratuita, "gratuito", new Date(hoje.getFullYear() - 2, 7, 9));
  await preco(gratuita, "50.00", new Date(hoje.getFullYear(), 9, 28));

  await ir(`${BASE}/dashboard/patients/${gratuita}?tab=geral`);
  const corpoGrat = await texto(page);
  check('o cabeçalho diz "Gratuito" no lugar do preço', /Gratuito\s+Valor da sessão/.test(corpoGrat),
    corpoGrat.slice(corpoGrat.indexOf("Valor da sessão") - 40, corpoGrat.indexOf("Valor da sessão") + 20).replace(/\n+/g, " · "));
  check("e o R$ 50,00 não aparece mais no cabeçalho", !corpoGrat.slice(0, corpoGrat.indexOf("Valor da sessão")).includes("R$ 50,00"));

  // ───────────── 2. O HISTÓRICO MOSTRA O PREÇO DE ENTRADA SOLTO ─────────────
  console.log("\n— histórico de reajuste —");
  await ir(`${BASE}/dashboard/patients/${gratuita}/edit?guia=financeiro`);
  const DIA_PRECO = `28/10/${hoje.getFullYear()}`;
  check("a vigência do preço solto virou linha no histórico", await abrirVigencia(DIA_PRECO), DIA_PRECO);
  const corpoEdit = await texto(page);
  const i0 = corpoEdit.toUpperCase().indexOf("HISTÓRICO DE REAJUSTE");
  const hist = i0 >= 0 ? corpoEdit.slice(i0, i0 + 400).replace(/\n+/g, " · ") : "(seção não encontrada)";
  check("e ela se explica como preço inicial", /Pre[çc]o inicial/i.test(hist), hist);

  // ───────────── 3. APAGAR A MODALIDADE LEVA O PREÇO DA MESMA VIGÊNCIA ─────────────
  console.log("\n— apagar o reajuste que trocou a modalidade —");
  const orfa = await paciente(`QA doc65 orfa ${marca}`, "sessao", "50.00");
  const DIA_TROCA = new Date(hoje.getFullYear(), 9, 28);
  await vigencia(orfa, "gratuito", new Date(hoje.getFullYear() - 2, 7, 9));
  await vigencia(orfa, "sessao", DIA_TROCA);
  await preco(orfa, "50.00", DIA_TROCA);

  await ir(`${BASE}/dashboard/patients/${orfa}/edit?guia=financeiro`);
  check("a vigência do Avulso abriu no acordeão", await abrirVigencia(`28/10/${hoje.getFullYear()}`));
  const lixeiras = page.locator('[aria-label="Apagar este reajuste"]:visible');
  const quantas = await lixeiras.count();
  check("a vigência do Avulso tem lixeira", quantas >= 1, `${quantas} lixeira(s)`);
  if (quantas >= 1) {
    await lixeiras.first().click({ force: true });
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Sim", exact: true }).first().click({ force: true });
    await page.waitForTimeout(4000);
  }
  const [depois] = await sql`SELECT payment_format, session_fee FROM patients WHERE id = ${orfa}`;
  const precosRestantes = await sql`SELECT valor FROM patient_price_history WHERE patient_id = ${orfa}`;
  check("o cadastro voltou a ser Gratuito", depois?.payment_format === "gratuito", String(depois?.payment_format));
  check("o preço da mesma vigência foi junto", precosRestantes.length === 0, JSON.stringify(precosRestantes));
  check("e o valor do cadastro foi a zero", Number(depois?.session_fee) === 0, String(depois?.session_fee));

  // ───────────── 4+5. O CONTRATO ─────────────
  console.log("\n— contrato —");
  // O caso real: dados preenchidos, SEM data de nascimento e SEM responsável.
  const semNasc = await paciente(`QA doc65 contrato ${marca}`, "mensal", "120.00", {
    cpf: "995.637.340-69", endereco: "Rua Barbosa, 164 — São Paulo/SP", email: "qa.doc65@exemplo.com",
  });
  await ir(`${BASE}/dashboard/patients/${semNasc}/contrato`);
  const contrato = await texto(page);
  const bloco = (de, ate) => contrato.slice(contrato.indexOf(de), contrato.indexOf(ate));
  const contratante = bloco("CONTRATANTE(S):", "PACIENTE:");
  const pacienteTxt = bloco("PACIENTE:", "2. DO OBJETO");
  check("o CONTRATANTE tem nome, CPF, endereço, telefone e e-mail",
    contratante.includes(`QA doc65 contrato ${marca}`) && contratante.includes("995.637.340-69") &&
    contratante.includes("Rua Barbosa, 164") && contratante.includes("11999990000") && contratante.includes("qa.doc65@exemplo.com"),
    contratante.replace(/\n+/g, " · ").slice(0, 220));
  check("o PACIENTE também",
    pacienteTxt.includes("995.637.340-69") && pacienteTxt.includes("Rua Barbosa, 164") &&
    pacienteTxt.includes("11999990000") && pacienteTxt.includes("qa.doc65@exemplo.com"),
    pacienteTxt.replace(/\n+/g, " · ").slice(0, 220));
  check("o nome assina no final do contrato",
    contrato.includes(`QA doc65 contrato ${marca} — Contratante / Responsável Legal`) && !contrato.includes("[NOME DO RESPONSÁVEL 1]"));
  check("a cláusula 5.4 é a nova",
    contrato.includes("deverá oferecer ao paciente a possibilidade de reposição do atendimento") &&
    contrato.includes("será convertido em crédito para o próximo atendimento") &&
    !contrato.includes("será obrigatoriamente reposta"));

  // ───────────── 6. QUEIXA PRINCIPAL ─────────────
  console.log("\n— queixa principal —");
  await ir(`${BASE}/dashboard/patients/${semNasc}/edit`);
  await page.waitForSelector('select[name="queixaPrincipal"]', { timeout: 45000 }).catch(() => {});
  const opcoes = await page.locator('select[name="queixaPrincipal"] option').allInnerTexts().catch(() => []);
  check("Autoconhecimento está na lista", opcoes.includes("Autoconhecimento"), opcoes.join(" | ").slice(0, 200));

  // ───────────── 7+8. A AGENDA: janela de alcance e cortesia ─────────────
  console.log("\n— agenda: alcance da edição e cortesia —");
  const nomeMensal = `QA doc65 mensal ${marca}`;
  const mensal = await paciente(nomeMensal, "mensal", "200.00");
  await sessao(mensal, estaSemana(0));
  if (await abrirEdicao(nomeMensal)) {
    const antesDeSalvar = await texto(page);
    check("o checkbox de cortesia aparece no mensal", antesDeSalvar.includes("Este atendimento será uma cortesia"));
    await page.getByRole("button", { name: /^Salvar/i }).first().click();
    await page.waitForTimeout(800);
    const janela = await texto(page);
    check('a janela "Alterar quais?" abriu', janela.includes("Alterar quais?"));
    check("e NÃO tem mais a escolha de sequência do pacote",
      !janela.includes("Sequência do pacote") && !janela.includes("Adicionar à sequência"));
    check("os três botões continuam lá",
      janela.includes("Apenas este") && janela.includes("Este e os próximos") && janela.includes("Cancelar"));
    // Dentro da janela: há outro "Cancelar" na página, atrás dela, e é nele que o clique batia.
    await page.locator('[aria-label="Alterar quais agendamentos"] button:has-text("Cancelar")').first().click();
  } else {
    check("a sessão do mensal abriu na agenda", false);
  }

  for (const [rotulo, formato, extra] of [["avulso", "sessao", null], ["quinzenal", "quinzenal", null], ["gratuito", "gratuito", null], ["extra AVUL", "mensal", "avul"]]) {
    const nome = `QA doc65 ${rotulo.replace(/\s/g, "")} ${marca}`;
    const pid = await paciente(nome, formato, formato === "gratuito" ? "0.00" : "150.00");
    await sessao(pid, estaSemana(1), { extra });
    if (await abrirEdicao(nome)) {
      const corpo = await texto(page);
      check(`o checkbox de cortesia aparece no ${rotulo}`, corpo.includes("Este atendimento será uma cortesia"));
      await page.keyboard.press("Escape");
    } else {
      check(`a sessão do ${rotulo} abriu na agenda`, false);
    }
  }

  // ───────────── 9. O SELETOR DE ANO DA CARTEIRA ─────────────
  console.log("\n— Carteira: todos os anos —");
  // O paciente mais antigo tem sessão em um ano bem anterior: ele precisa estar na lista.
  const ANTIGOS = [hoje.getFullYear() - 6, hoje.getFullYear() - 4];
  const veterano = await paciente(`QA doc65 veterano ${marca}`, "sessao", "100.00");
  for (const a of ANTIGOS) await sessao(veterano, new Date(a, 3, 10, 16, 0));
  await ir(`${BASE}/dashboard/pagamentos`);
  await page.waitForSelector("select option", { timeout: 45000 }).catch(() => {});
  await page.waitForTimeout(1000);
  const anos = await page.locator("select option").allInnerTexts().catch(() => []);
  check("os anos antigos estão todos no seletor", ANTIGOS.every((a) => anos.includes(String(a))), anos.join(", "));
  /**
   * O controle do defeito: a lista antiga era SEMPRE [ano-1, ano, ano+1]. Ano que vem não tem nada
   * cadastrado, então ele só apareceria se a janela fixa ainda estivesse lá.
   */
  check("a janela fixa de três anos acabou", !anos.includes(String(hoje.getFullYear() + 1)), anos.join(", "));
} catch (e) {
  check("o percurso chegou ao fim sem exceção", false, String(e && e.message ? e.message : e).slice(0, 300));
} finally {
  await nav.close();
  for (const id of criados) {
    await sql`DELETE FROM session_payments WHERE patient_id = ${id}`;
    await sql`DELETE FROM therapy_sessions WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_payment_format_history WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_price_history WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_reajuste_changes WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_contract_history WHERE patient_id = ${id}`;
    await sql`DELETE FROM patients WHERE id = ${id}`;
  }
  console.log(`\n${falhas ? `${falhas} FALHA(S)` : "tudo certo"} · ${criados.length} cadastro(s) de teste apagado(s)`);
  process.exit(falhas ? 1 : 0);
}

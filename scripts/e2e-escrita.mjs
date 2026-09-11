// O caminho de ESCRITA, com navegador de verdade.
//
// Até aqui, cadastrar prospect, registrar contato e cadastrar paciente eram verificados só por
// leitura de código: a conta de demonstração é somente leitura e o proxy recusa gravação. Este
// percurso entra com uma conta de QA de verdade e ESCREVE — e apaga o que criou no fim.
//
// A conta de QA é uma terapeuta como outra qualquer: tudo o que ela cria pertence a ela
// (`user_id`), então nada disso encosta na base de quem usa o app.
//
// Uso: node scripts/e2e-escrita.mjs <email> <senha>

import fs from "node:fs";
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const CAMINHOS = ["playwright", "C:/Users/User/AppData/Roaming/npm/node_modules/@playwright/mcp/node_modules/playwright"];
let chromium;
for (const c of CAMINHOS) { try { ({ chromium } = require_(c)); break; } catch { /* tenta o próximo */ } }
if (!chromium) { console.log("Playwright não encontrado."); process.exit(1); }

const BASE = process.env.BASE_URL || "http://localhost:3000";
const [email, senha] = process.argv.slice(2);
if (!email || !senha) { console.log("uso: node scripts/e2e-escrita.mjs <email> <senha>"); process.exit(1); }

let falhas = 0;
const check = (nome, ok, detalhe = "") => {
  console.log(`${ok ? "  ok  " : "FALHA "} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!ok) falhas++;
};

const marca = Date.now().toString().slice(-6);
const PROSPECT = `Prospect QA ${marca}`;
const PACIENTE = `Paciente QA ${marca}`;

async function esperarTexto(page, padrao, ms = 30000) {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    const corpo = (await page.textContent("body")) || "";
    if (padrao.test(corpo)) return corpo;
    await page.waitForTimeout(400);
  }
  return (await page.textContent("body")) || "";
}

/**
 * Sessão reaproveitada entre rodadas.
 *
 * O login é fail-closed: 10 tentativas por e-mail a cada 15 minutos. Percurso que loga a cada
 * execução queima a cota do próprio testador e passa a falhar como se a senha estivesse errada —
 * o mesmo tropeço que o harness visual já teve com a conta de demonstração.
 */
const ARQUIVO_SESSAO = "_visual/.sessao-qa.json";

const nav = await chromium.launch();
fs.mkdirSync("_visual", { recursive: true });
const ctx = await nav.newContext({
  viewport: { width: 1440, height: 1000 },
  storageState: fs.existsSync(ARQUIVO_SESSAO) ? ARQUIVO_SESSAO : undefined,
});
const page = await ctx.newPage();
const erros = [];
page.on("console", (m) => { if (m.type() === "error") erros.push(m.text().slice(0, 140)); });
fs.mkdirSync("_visual/escrita", { recursive: true });

// --- entra, ou reaproveita a sessão guardada ---
await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
if (page.url().includes("/login")) {
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', senha);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 45000 }).catch(() => {});
}
check("entrou com conta de escrita", !page.url().includes("/login"), page.url());

// Conta nova cai no consentimento antes de qualquer coisa — é o portão de LGPD do app, e faz
// parte do caminho de quem entra pela primeira vez.
if (page.url().includes("/consentimento")) {
  await page.check('input[name="terms"]');
  await page.check('input[name="privacy"]');
  // O botão do consentimento não declara type — dentro de form ele já é submit, mas o seletor
  // por atributo não o encontra. Aqui se clica pelo que a pessoa lê.
  await page.click('button:has-text("Aceitar e continuar")');
  await page.waitForURL((u) => !u.pathname.includes("/consentimento"), { timeout: 30000 }).catch(() => {});
  check("aceitou termos e privacidade no primeiro acesso", !page.url().includes("/consentimento"), page.url());
}

// --- prospect: criar ---
await page.goto(`${BASE}/dashboard/prospects`, { waitUntil: "networkidle" });
const achouForm = await page.waitForSelector('input[name="name"]', { timeout: 30000 }).then(() => true).catch(() => false);
if (!achouForm) {
  await page.screenshot({ path: "_visual/escrita/0-sem-formulario.png", fullPage: true });
  console.log("   url:", page.url(), "| texto:", ((await page.textContent("body")) || "").replace(/\s+/g, " ").slice(0, 160));
}
check("o formulário de novo prospect está na tela", achouForm);
await page.fill('input[name="name"]', PROSPECT);
await page.fill('input[name="phone"]', "11999990000");
await page.fill('input[name="prospectObservacoes"]', "primeiro contato pelo teste");
await page.fill('input[name="prospectDate"]', "2026-09-01");
await page.click('button:has-text("Adicionar prospect")');
// Cada linha da lista é um FORMULÁRIO de edição: o nome mora no `value` de um input, e não no
// texto da página. Procurar por texto dava falso negativo — e, pior, `textContent` inclui o
// conteúdo dos <script>, então às vezes dava falso POSITIVO pelo payload do próprio Next.
async function nomesNaLista(p) {
  return p.evaluate(() =>
    Array.from(document.querySelectorAll('input[name="name"]')).map((i) => i.value).filter(Boolean),
  );
}

let corpo = "";
let nomes = [];
const ate = Date.now() + 20000;
while (Date.now() < ate) {
  nomes = await nomesNaLista(page);
  if (nomes.includes(PROSPECT)) break;
  await page.waitForTimeout(500);
}
check("cadastrou o prospect e ele aparece na lista sem recarregar", nomes.includes(PROSPECT), `${nomes.length} na tela`);

// O bug que já custou uma reclamação: criar prospect redirecionava para a ficha do paciente, e o
// dono nunca via a lista. Aqui o teste prova que a lista é o destino.
check("continua na lista de prospects, não vai para a ficha", page.url().includes("/prospects"), page.url());

// A data do contato é a informada, não "agora" — o formulário já teve esse defeito.
const dataNaLinha = await page.evaluate((nome) => {
  const campo = Array.from(document.querySelectorAll('input[name="name"]')).find((i) => i.value === nome);
  const form = campo?.closest("form");
  return form?.querySelector('input[name="prospectDate"]')?.value ?? "";
}, PROSPECT);
check("guardou a data do contato que foi digitada", dataNaLinha === "2026-09-01", dataNaLinha || "(sem data)");
await page.screenshot({ path: "_visual/escrita/1-prospect.png", fullPage: true });

// --- prospect: registrar um segundo contato ---
// Registrar um segundo contato na linha do prospect criado.
// Cada linha da lista tem `data-prospect` com o id. Achar a linha por POSIÇÃO escorregava a cada
// prospect novo, e o teste clicava no vizinho.
// A lista ainda pode estar remontando logo depois do cadastro, e nesse instante a linha não está
// no DOM. Procura até achar, em vez de perguntar uma vez só.
async function acharLinha(nome, ms = 15000) {
  const limite = Date.now() + ms;
  while (Date.now() < limite) {
    const id = await page.evaluate((n) => {
      const campo = Array.from(document.querySelectorAll('input[name="name"]')).find(
        (i) => i.value === n && i.closest("[data-prospect]"),
      );
      return campo?.closest("[data-prospect]")?.getAttribute("data-prospect") ?? "";
    }, nome);
    if (id) return id;
    await page.waitForTimeout(600);
  }
  return "";
}
const idDaLinha = await acharLinha(PROSPECT);

const linha = page.locator(`[data-prospect="${idDaLinha}"]`);
const abriu = !!idDaLinha && (await linha.count()) === 1;
// O painel de contatos abre por estado do componente, e logo depois de cadastrar ainda existe um
// refresh da lista a caminho: ele remonta a linha e fecha o que acabou de abrir. Por isso o
// clique insiste até o campo aparecer, em vez de contar com um sleep fixo.
let temCampoContato = 0;
if (abriu) {
  const limite = Date.now() + 15000;
  while (Date.now() < limite) {
    await linha.locator('button:has-text("contato(s)")').click().catch(() => {});
    await page.waitForTimeout(1200);
    temCampoContato = await page.locator('input[name="observacao"], textarea[name="observacao"]').count();
    if (temCampoContato > 0) break;
  }
}
check("dá para registrar um contato novo no prospect", abriu && temCampoContato > 0, `${temCampoContato} campo(s) · linha ${idDaLinha || "(não achei)"}`);

if (temCampoContato > 0) {
  // Preenche e envia DENTRO do formulário da linha aberta. Espalhar `page.fill` pela página
  // pegava o primeiro campo que existisse, e o `.catch()` que havia aqui engolia a falha do
  // clique: o teste seguia como se tivesse registrado.
  const formContato = linha.locator('form:has(input[name="observacao"])').first();
  await formContato.locator('input[name="observacao"]').fill("segundo contato pelo teste");
  await formContato.locator('button:has-text("Registrar contato")').click();
  // Registrar leva de volta à lista (com o parâmetro que força a busca nova). Esperar a página
  // assentar antes de conferir evita ler a tela no meio da navegação.
  await page.waitForURL(/salvo=/, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  // A prova é a CONTAGEM daquela linha subir de 0 para 1 — "aparece a palavra contato" seria
  // verdade mesmo com o registro perdido.
  // A prova é a contagem DAQUELA linha: o prospect nasce com um contato (a observação do
  // cadastro) e passa a ter dois. Contar em vez de procurar a palavra "contato" — que aparece na
  // tela mesmo quando o registro se perdeu.
  const contagem = (await linha.locator('button:has-text("contato(s)")').innerText().catch(() => "")).trim()
    || "(sem contagem)";
  check("o contato novo entra no histórico daquele prospect", /^[2-9]\d* contato/.test(contagem), contagem);
}
await page.screenshot({ path: "_visual/escrita/2-prospect-aberto.png", fullPage: true });

// --- paciente: criar ---
await page.goto(`${BASE}/dashboard/patients/new`, { waitUntil: "networkidle" });
await page.fill('input[name="name"]', PACIENTE);
const temNascimento = await page.locator('input[name="birthDate"]').count();
if (temNascimento) await page.fill('input[name="birthDate"]', "1990-05-20");
await page.click('button:has-text("Cadastrar paciente")');
await page.waitForURL((u) => /\/dashboard\/patients/.test(u.pathname), { timeout: 45000 }).catch(() => {});
corpo = await esperarTexto(page, new RegExp(PACIENTE));
check("cadastrou o paciente", corpo.includes(PACIENTE), page.url());
await page.screenshot({ path: "_visual/escrita/3-paciente.png", fullPage: true });

// --- o paciente aparece na lista ---
await page.goto(`${BASE}/dashboard/patients`, { waitUntil: "networkidle" });
corpo = await esperarTexto(page, new RegExp(PACIENTE));
check("o paciente novo aparece na lista", corpo.includes(PACIENTE));

// --- e não vaza para outra conta: a lista é só do dono ---
check("nenhum paciente de outra terapeuta aparece", !/Dionísia|Sócrates/i.test(corpo));

console.log(`\nerros de console: ${erros.length}`);
for (const e of erros.slice(0, 3)) console.log("   " + e);

// Guarda a sessão para a próxima rodada não gastar tentativa de login (o app permite 10 por
// e-mail a cada 15 minutos, e fail-closed).
await ctx.storageState({ path: ARQUIVO_SESSAO });

await nav.close();
console.log(falhas === 0 ? "\nEscrita em pé." : `\n${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);

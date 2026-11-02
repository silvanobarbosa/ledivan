// O RECIBO DA VOZ, NO APP DE VERDADE.
//
// Pedido do dono (02/11): "ao ouvir e executar um comando, precisamos que o sistema mostre o
// comando executado, provando que fez". Aqui se prova o que teste de unidade não vê:
//
//   1 · confirmar a anotação ditada mostra o RECIBO — comando, paciente, o que ficou gravado,
//       quando e o id — e a janela NÃO se fecha sozinha (prova que desaparece não prova nada);
//   2 · o id do recibo é o da linha que está no banco (o recibo é lido de volta, não narrado);
//   3 · a falha de escuta mostra o MOTIVO técnico, que é o que faltou para consertar às cegas;
//   4 · reservar continua dizendo que nada foi gravado.
//
// A rota `/api/diva/ouvir` é interceptada de propósito: quem exercita a escuta de verdade, com voz
// sintética e a chave do cofre, é `e2e-diva-fala-que-age.mjs`. O que está em jogo AQUI é a tela e o
// que fica no banco depois do toque.
//
// Uso: npm run build && TZ=UTC npm start, depois node scripts/e2e-diva-recibo.mjs

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

const [qa] = await sql`SELECT id, ai_provider, ai_key_enc FROM "user" WHERE email = 'qa.ledivan@reverblabs.com.br'`;
if (!qa) { console.log("conta de QA não encontrada"); process.exit(1); }
const token = await new jose.SignJWT({ userId: qa.id })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1d")
  .sign(new TextEncoder().encode(process.env.AUTH0_SECRET));

const provedorAntes = qa.ai_provider;
const chaveAntes = qa.ai_key_enc;
const criados = [];
const marca = Date.now().toString().slice(-5);

// O microfone só APARECE para quem tem chave cadastrada (`podeOuvir` no layout). O valor não
// importa: a rota que a usaria está interceptada.
await sql`UPDATE "user" SET ai_provider = 'groq', ai_key_enc = 'faz-de-conta' WHERE id = ${qa.id}`;

/** O gravador do navegador precisa de um microfone. O do Chromium serve: gera áudio de verdade. */
const nav = await chromium.launch({
  headless: true,
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});
const ctx = await nav.newContext({ viewport: { width: 1280, height: 1000 }, permissions: ["microphone"] });
const alvo = new URL(BASE);
await ctx.addCookies([{ name: "auth-session", value: token, domain: alvo.hostname, path: "/", secure: alvo.protocol === "https:" }]);
const page = await ctx.newPage();

/** O que a rota vai responder no próximo comando. Trocado a cada cena. */
let resposta = null;
await page.route("**/api/diva/ouvir", async (route) => {
  await route.fulfill({
    status: resposta.status ?? 200,
    contentType: "application/json",
    body: JSON.stringify(resposta.body),
  });
});

/**
 * Os cliques são DOM, não ponteiro.
 *
 * Neste percurso o fundo escuro da própria janela (`fixed inset-0 z-[100]`) fica por cima do ponto
 * central dos botões de dentro dela, e o clique de ponteiro nunca chega — some no fundo, que fecha
 * o Divã. O que está em jogo aqui é o RECIBO, não o acerto do ponteiro; então aperta-se o botão
 * pelo próprio elemento. (A geometria de janela é medida em `e2e-doc75.mjs`.)
 */
const apertar = async (texto) => {
  await page.getByRole("button", { name: texto }).waitFor({ timeout: 15_000 });
  await page.evaluate((t) => {
    const b = [...document.querySelectorAll("button")]
      .find((x) => (x.textContent || "").includes(t) || x.getAttribute("aria-label") === t);
    if (!b) throw new Error(`botão não encontrado: ${t}`);
    b.click();
  }, texto);
};

const abrirDiva = () => page.$eval('[aria-label="Abrir o Divã"]', (b) => b.click());

/** Aperta o microfone, para, e espera a tela responder. */
const ditar = async () => {
  await apertar("Falar com o Divã");
  // O Divã recusa gravação de menos de 1 kB ("Não ouvi nada"). Com o microfone falso do Chromium,
  // isso é uma questão de segurar o botão um instante — como ela segura.
  await page.waitForTimeout(1500);
  await apertar("Parar e enviar");
};

try {
  const [p] = await sql`
    INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status, started_at)
    VALUES (${qa.id}, ${`Recibo ${marca}`}, 'sessao', '100.00', 'ativo', now()) RETURNING id, name`;
  criados.push(p.id);

  const umPaciente = { tipo: "um", paciente: { id: p.id, nome: p.name } };
  const base = { quando: null, texto: "", valor: null, forma: null, faltando: [] };

  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  // O Divã abre sozinho em perfil novo e cobre a tela: dispensa como a terapeuta dispensaria.
  await page.evaluate(() => {
    localStorage.setItem("ledivan_diva_dispensas", "3");
    localStorage.setItem("ledivan_diva_dia", new Date().toISOString().slice(0, 10));
    localStorage.setItem("ledivan_diva_aviso_voz", "1");
  });

  // ───────── 1 e 2. anotar: recibo na tela, linha no banco ─────────
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await abrirDiva();
  resposta = { body: { ok: true, fala: "anota na paciente que dormiu bem", comando: { ...base, acao: "anotar", paciente: umPaciente, texto: "dormiu bem a semana toda" }, tarefa: null } };
  await ditar();

  await page.getByRole("button", { name: "Confirmar a anotação" }).waitFor({ timeout: 15_000 });
  const antes = (await sql`SELECT count(*) AS n FROM patient_records WHERE patient_id = ${p.id}`)[0].n;
  check("a prévia aparece e ainda não gravou nada", antes === "0", `registros=${antes}`);

  await apertar("Confirmar a anotação");
  const recibo = page.getByTestId("recibo-da-voz");
  await recibo.waitFor({ timeout: 15_000 });
  const texto = (await recibo.innerText()).replace(/\s+/g, " ");
  check("o recibo diz o COMANDO executado", /Feito: anotar no prontuário/i.test(texto), texto.slice(0, 90));
  check("e diz o paciente", texto.includes(p.name), texto.slice(0, 120));
  check("e mostra o que ficou GRAVADO", texto.includes("dormiu bem a semana toda"), texto.slice(0, 200));
  check("e quando, em hora de parede", /\d{2}\/\d{2}\/\d{4} às \d{2}:\d{2}/.test(texto), texto.slice(0, 200));

  const [linha] = await sql`SELECT id, content, title FROM patient_records WHERE patient_id = ${p.id}`;
  check("gravou no prontuário, uma linha", !!linha, linha ? linha.title : "nenhuma");
  check("o conteúdo é o ditado", linha?.content === "dormiu bem a semana toda", linha?.content ?? "—");
  check("o id do recibo é o da linha do banco — o recibo é lido de volta",
    !!linha && texto.includes(linha.id.slice(0, 8)), linha ? linha.id.slice(0, 8) : "—");
  check("a janela NÃO se fechou sozinha: a prova fica à vista",
    await page.getByRole("dialog", { name: "Divã" }).isVisible());

  // "Conferir" é o único caminho de saída, e ele navega.
  await apertar("Conferir");
  await page.waitForURL(`**/dashboard/patients/${p.id}`, { timeout: 15_000 });
  check("'Conferir' leva ao prontuário", page.url().includes(`/dashboard/patients/${p.id}`), page.url());

  // ───────── 3. a falha diz o MOTIVO ─────────
  await abrirDiva();
  resposta = { status: 500, body: { ok: false, error: "Não consegui ouvir agora. Tente de novo.", motivo: "400 · prompt length must be 896 characters or fewer · áudio audio/webm 37 kB" } };
  await ditar();
  const motivo = page.getByTestId("motivo-da-falha");
  await motivo.waitFor({ timeout: 15_000 });
  const lido = await motivo.innerText();
  check("a falha mostra o motivo técnico", /prompt length must be 896/.test(lido), lido.slice(0, 140));
  check("e o formato do áudio, que é a 1a pergunta de quem conserta", /audio\/webm/.test(lido), lido.slice(0, 140));

  // ───────── 4. reservar continua avisando que nada foi gravado ─────────
  await page.reload({ waitUntil: "networkidle" });
  await abrirDiva();
  const amanha = new Date(); amanha.setDate(amanha.getDate() + 1); amanha.setHours(16, 0, 0, 0);
  resposta = { body: { ok: true, fala: "marca a paciente amanhã às 16h", tarefa: null, comando: {
    ...base, acao: "reservar", paciente: umPaciente,
    quando: { iso: `${amanha.toISOString().slice(0, 16)}`, porExtenso: "amanhã às 16h" },
  } } };
  await ditar();
  await page.getByRole("button", { name: "Abrir o agendamento preenchido" }).waitFor({ timeout: 15_000 });
  const aviso = await page.getByText("Nada é gravado agora").isVisible();
  check("reservar diz, antes do toque, que nada será gravado", aviso);
} catch (e) {
  check("o percurso chegou ao fim sem exceção", false, String(e && e.message ? e.message : e).slice(0, 300));
} finally {
  await nav.close();
  await sql`UPDATE "user" SET ai_provider = ${provedorAntes}, ai_key_enc = ${chaveAntes} WHERE id = ${qa.id}`;
  for (const id of criados) {
    await sql`DELETE FROM patient_records WHERE patient_id = ${id}`;
    await sql`DELETE FROM therapy_sessions WHERE patient_id = ${id}`;
    await sql`DELETE FROM patients WHERE id = ${id}`;
  }
  console.log(`\n${falhas ? `${falhas} FALHA(S)` : "tudo certo"} · ${criados.length} cadastro(s) apagado(s) · conta de QA devolvida`);
  process.exit(falhas ? 1 : 0);
}

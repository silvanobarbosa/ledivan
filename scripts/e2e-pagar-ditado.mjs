// O PAGAMENTO DITADO, NO APP DE VERDADE.
//
// Relato da terapeuta (02/11): ditou "registrar um pagamento de 400 reais feito pela Talita em
// 31/10", o Divã pediu confirmação, ela confirmou, "ele abriu a carteira, mas o lançamento não
// entrou". Estava certo pelo código de então: a voz levava à tela com o formulário aberto e
// preenchido, e esperava o toque dela. Quem confirma um pedido completo considera o pedido feito.
//
// O dono decidiu (02/11) que a voz GRAVA e mostra recibo. Este percurso prova as quatro coisas
// que fazem isso ser seguro, e que teste de unidade não alcança porque dependem do app inteiro:
//
//   1 · antes do toque, NADA está gravado (a prévia é só prévia);
//   2 · depois do toque, existe UMA linha de pagamento no banco — e o recibo mostra o id dela;
//   3 · o valor e, principalmente, a DATA DITADA ("em 31/10") são os que ficaram gravados —
//       não a data de hoje, que era o que aconteceria antes;
//   4 · quem pagou e a forma saem das mesmas regras do formulário, não de uma segunda política.
//
// A rota `/api/diva/ouvir` é interceptada: quem exercita a escuta de verdade é
// `e2e-diva-fala-que-age.mjs`. O que está em jogo aqui é o dinheiro que fica no banco.
//
// Uso: npm run build && TZ=UTC npm start, depois node scripts/e2e-pagar-ditado.mjs

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
// O microfone só aparece para quem tem chave cadastrada; a rota que a usaria está interceptada.
await sql`UPDATE "user" SET ai_provider = 'groq', ai_key_enc = 'faz-de-conta' WHERE id = ${qa.id}`;

const nav = await chromium.launch({
  headless: true,
  args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
});
const ctx = await nav.newContext({ viewport: { width: 1280, height: 1000 }, permissions: ["microphone"] });
const alvo = new URL(BASE);
await ctx.addCookies([{ name: "auth-session", value: token, domain: alvo.hostname, path: "/", secure: alvo.protocol === "https:" }]);
const page = await ctx.newPage();

let resposta = null;
await page.route("**/api/diva/ouvir", async (route) => {
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(resposta) });
});

// Cliques por DOM: o fundo da própria janela (`fixed inset-0 z-[100]`) cobre o centro dos botões.
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
const ditar = async () => {
  await apertar("Falar com o Divã");
  await page.waitForTimeout(1500); // abaixo de 1 kB o Divã recusa ("Não ouvi nada")
  await apertar("Parar e enviar");
};

try {
  // A MESMA configuração da paciente do relato: mensal, pacote fragmentado, R$100 a sessão,
  // vencimento no dia 1. É o formato que produz a linha "Pagamento" com cobrança em aberto —
  // uma paciente avulsa não gera essa linha, e o teste passaria falando de outra coisa.
  const [p] = await sql`
    INSERT INTO patients (user_id, name, payment_format, pacote_tipo, session_fee, payment_day,
                          patient_status, started_at)
    VALUES (${qa.id}, ${`Pagar ${marca}`}, 'mensal', 'fragmentado', '100.00', 1,
            'ativo', now() - interval '35 days')
    RETURNING id, name`;
  criados.push(p.id);
  for (let i = 1; i <= 8; i++) {
    await sql`
      INSERT INTO therapy_sessions (user_id, patient_id, date, status, fee)
      VALUES (${qa.id}, ${p.id}, now() - interval '35 days' + (${i} * interval '7 days'),
              ${i <= 5 ? "realizada" : "agendada"}, '100.00')`;
  }

  // A chave da cobrança é a que a tela mostra — a mesma que a prévia carregaria.
  await page.goto(`${BASE}/dashboard/patients/${p.id}`, { waitUntil: "networkidle" });
  const chave = await page.evaluate(() => document.querySelector("[data-chave]")?.getAttribute("data-chave") ?? null);
  check("a carteira tem uma cobrança em aberto", !!chave, chave ?? "nenhum [data-chave] na tela");
  if (!chave) throw new Error("sem cobrança para ditar");

  // A data DITADA: 31/10 deste ano — passado, diferente de hoje. É a diferença que importa.
  const ano = new Date().getFullYear();
  const ditada = new Date(ano, 9, 31, 12, 0, 0);

  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await page.evaluate(() => {
    localStorage.setItem("ledivan_diva_dispensas", "3");
    localStorage.setItem("ledivan_diva_dia", new Date().toISOString().slice(0, 10));
    localStorage.setItem("ledivan_diva_aviso_voz", "1");
  });
  await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
  await abrirDiva();

  resposta = {
    ok: true,
    fala: "registrar um pagamento de 400 reais feito pela paciente em 31/10",
    comando: {
      acao: "pagar",
      paciente: { tipo: "um", paciente: { id: p.id, nome: p.name } },
      quando: { iso: ditada.toISOString(), porExtenso: "31/10" },
      texto: "",
      valor: 400,
      forma: null,
      faltando: [],
      cobranca: { chave, porExtenso: "vence em 01/11 · faltam R$ 400,00", falta: 400, ano },
    },
    tarefa: null,
  };
  await ditar();

  await page.getByRole("button", { name: "Confirmar o pagamento" }).waitFor({ timeout: 15_000 });
  const antes = (await sql`SELECT count(*) AS n FROM session_payments WHERE patient_id = ${p.id}`)[0].n;
  check("a prévia aparece e ainda NÃO gravou dinheiro", antes === "0", `pagamentos=${antes}`);

  await apertar("Confirmar o pagamento");
  const recibo = page.getByTestId("recibo-da-voz");
  await recibo.waitFor({ timeout: 20_000 });
  const texto = (await recibo.innerText()).replace(/\s+/g, " ");
  check("o recibo diz o COMANDO executado", /Feito: lançar pagamento/i.test(texto), texto.slice(0, 90));
  check("e diz o paciente", texto.includes(p.name), texto.slice(0, 120));
  check("e mostra o VALOR gravado", /R\$ 400,00/.test(texto), texto.slice(0, 200));

  const linhas = await sql`SELECT id, amount, date, method, pago_por FROM session_payments WHERE patient_id = ${p.id}`;
  check("gravou UMA linha de pagamento", linhas.length === 1, `linhas=${linhas.length}`);
  const linha = linhas[0];
  check("o valor no banco é o ditado", Number(linha?.amount) === 400, String(linha?.amount));
  // O PONTO DO CONSERTO: a data é a que ela disse, não a de hoje.
  const d = new Date(linha?.date);
  check("a DATA no banco é a ditada (31/10), não a de hoje",
    d.getDate() === 31 && d.getMonth() === 9, d.toISOString().slice(0, 10));
  check("quem pagou sai do cadastro, não em branco", !!linha?.pago_por, linha?.pago_por ?? "vazio");
  check("a forma padrão é a mesma do formulário (pix)", linha?.method === "pix", linha?.method ?? "—");
  check("o id do recibo é o da linha do banco — lido de volta, não narrado",
    !!linha && texto.includes(linha.id.slice(0, 8)), linha ? linha.id.slice(0, 8) : "—");
  check("a janela NÃO se fecha sozinha: a prova fica à vista",
    await page.getByRole("dialog", { name: "Divã" }).isVisible());
} catch (e) {
  check("percurso completo", false, String(e.message).slice(0, 200));
} finally {
  await nav.close();
  for (const id of criados) {
    await sql`DELETE FROM session_payments WHERE patient_id = ${id}`;
    await sql`DELETE FROM therapy_sessions WHERE patient_id = ${id}`;
    await sql`DELETE FROM patients WHERE id = ${id}`;
  }
  await sql`UPDATE "user" SET ai_provider = ${provedorAntes}, ai_key_enc = ${chaveAntes} WHERE id = ${qa.id}`;
  console.log(falhas ? `\n${falhas} FALHA(S)` : "\ntudo certo");
  process.exit(falhas ? 1 : 0);
}

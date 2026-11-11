// A FALHA COM CÓDIGO, NO APP DE VERDADE.
//
// O que o teste puro não prova: que o código que a tela MOSTRA é o mesmo que o banco GUARDA. Esse
// par não depende só do nosso código — depende de o Next respeitar o `digest` que `registrarFalha`
// escreve no erro antes de ele subir. Se uma versão do Next passar a recalcular o digest, nada
// quebra em unidade; só a investigação do dia seguinte, quando a dona ditar seis caracteres que não
// acham linha nenhuma.
//
// COMO A FALHA É FORÇADA, sem gatilho de teste no código de produção: a tela de edição é aberta e o
// cadastro é apagado do banco ANTES de salvar. Aí `updatePatientInterno` cai no seu próprio
// "Paciente não encontrado", que é `throw` — caminho real, que acontece quando duas abas estão
// abertas e uma apaga o que a outra está editando.
//
// Uso: npm run build && npm start, depois `node scripts/e2e-falha-com-codigo.mjs`.
// Em `npm run dev` não roda: o Fast Refresh renavega a página e todo seletor expira.

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

// Cadastro COMPLETO de propósito: "Sessões no pacote" é obrigatório no formulário, e sem ele o
// navegador barra o envio antes de qualquer coisa chegar ao servidor — o percurso passaria sem ter
// exercido nada.
const [p] = await sql`
  INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status, payment_day, sessions_in_packet, pacote_tipo, started_at, times_per_period)
  VALUES (${qa.id}, 'QA falha com código', 'mensal', '100.00', 'ativo', 10, 4, 'completo', ${new Date(2026, 8, 1)}, 1)
  RETURNING id`;

const nav = await chromium.launch();
const alvo = new URL(BASE);
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addCookies([{ name: "auth-session", value: token, domain: alvo.hostname, path: "/", secure: alvo.protocol === "https:" }]);
const page = await ctx.newPage();

try {
  await page.goto(`${BASE}/dashboard/patients/${p.id}/edit`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[name="name"]', { timeout: 20000 });

  // O cadastro desaparece debaixo da tela aberta: é o que faz o servidor jogar.
  await sql`DELETE FROM patient_price_history WHERE patient_id = ${p.id}`;
  await sql`DELETE FROM patient_payment_format_history WHERE patient_id = ${p.id}`;
  await sql`DELETE FROM patients WHERE id = ${p.id}`;

  // O envio é pedido ao formulário, não ao mouse: o balão do Divã abre sozinho na conta de QA,
  // cobre a tela e come o clique — e ele volta depois de removido, então disputar o clique com ele
  // é perder tempo. `requestSubmit(botao)` passa o botão como SUBMITTER, que é o que decide a área
  // salva: sem ele, o primeiro submit do formulário é o "Salvar formato de pagamento", que recorta
  // o envio para o Financeiro e nem chega perto do caminho que se quer exercer.
  const pediu = await page.evaluate(() => {
    const botao = [...document.querySelectorAll("button")].find((b) => b.innerText.trim() === "Salvar alterações");
    const form = botao?.closest("form");
    if (!botao || !form) return false;
    form.requestSubmit(botao);
    return true;
  });
  check("o formulário aceitou o pedido de salvar", pediu);
  await page.waitForSelector("text=Não deu para concluir", { timeout: 30000 });
  check("a tela de erro aparece em português", true);

  const temBotoes =
    (await page.locator("text=Tentar de novo").count()) > 0 &&
    (await page.locator("text=Voltar ao início").count()) > 0;
  check("tem 'Tentar de novo' e 'Voltar ao início'", temBotoes);

  const avisa = (await page.locator("text=Confira se o que você estava salvando").count()) > 0;
  check("avisa que o que estava sendo salvo pode não ter sido gravado", avisa);

  const texto = await page.locator("body").innerText();
  const codigo = texto.match(/C[óo]digo da falha:\s*([A-Z0-9]{6})\b/)?.[1] ?? null;
  check("a tela mostra um código de seis caracteres", !!codigo, codigo ?? texto.slice(0, 160));

  if (codigo) {
    const [linha] = await sql`
      SELECT acao, alvo, user_id, mensagem, pilha FROM app_falhas WHERE codigo = ${codigo}`;
    check("o código da tela acha a linha no banco", !!linha, codigo);
    if (linha) {
      check("a linha diz qual ação quebrou", linha.acao === "updatePatient", linha.acao);
      check("a linha diz em qual cadastro", linha.alvo === p.id, linha.alvo ?? "(sem alvo)");
      check("a linha diz de quem era a sessão", linha.user_id === qa.id);
      check("a mensagem guardada tem o motivo", /não encontrado/i.test(linha.mensagem), linha.mensagem.slice(0, 120));
      const vazou = /postgres:\/\/(?!\[omitido\])|sk-[A-Za-z0-9]{8}|(password|senha|token)["']?\s*[:=]\s*(?!\[omitido\])\S/i.test(
        `${linha.mensagem}\n${linha.pilha ?? ""}`,
      );
      check("nada de segredo foi gravado junto", !vazou);
    }
  }
} catch (e) {
  // Sem este catch, o `process.exit` do finally engole a exceção e o percurso diz "tudo certo" sem
  // ter verificado nada — foi o que aconteceu no doc 63.
  console.error("\nERRO NO PERCURSO:", e?.message ?? e);
  falhas++;
} finally {
  await nav.close();
  await sql`DELETE FROM app_falhas WHERE alvo = ${p.id}`;
  await sql`DELETE FROM patient_price_history WHERE patient_id = ${p.id}`;
  await sql`DELETE FROM patient_payment_format_history WHERE patient_id = ${p.id}`;
  await sql`DELETE FROM patients WHERE id = ${p.id}`;
  console.log(falhas ? `\n${falhas} FALHA(S)` : "\ntudo certo");
  process.exit(falhas ? 1 : 0);
}

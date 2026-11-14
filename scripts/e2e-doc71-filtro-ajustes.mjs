// OS DOIS FILTROS DO RELATÓRIO, E O QUE SAIU DO AJUSTES (doc 71, dono, 14/11/2026).
//
// O que o teste puro não prova:
//   - que o SEGUNDO filtro existe na tela e recorta de verdade (a regra é pura; a ligação não);
//   - que o campo `cadastroKind` chega até o componente — ele é novo no SELECT da página;
//   - que os cards "Mensagem de cobrança" e "Recibo" sumiram do Ajustes;
//   - que a DESCRIÇÃO DO ATENDIMENTO continua existindo, agora antes do Nome Completo, e SALVA;
//   - que a emissão de recibo continua de pé — era a parte que o doc pediu para não perder.
//
// Uso: npm run build && npm start, depois `node scripts/e2e-doc71-filtro-ajustes.mjs`.

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
const check = (n, ok, d = "") => { console.log(`${ok ? "  ok  " : "FALHA "} ${n}${d ? ` — ${d}` : ""}`); if (!ok) falhas++; };

const [qa] = await sql`SELECT id, descricao_atendimento FROM "user" WHERE email = 'qa.ledivan@reverblabs.com.br'`;
if (!qa) { console.log("conta de QA não encontrada"); process.exit(1); }
const descricaoOriginal = qa.descricao_atendimento;
const token = await new jose.SignJWT({ userId: qa.id })
  .setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("1d")
  .sign(new TextEncoder().encode(process.env.AUTH0_SECRET));

const criados = [];
const nav = await chromium.launch();
const alvo = new URL(BASE);
const ctx = await nav.newContext({ viewport: { width: 1280, height: 950 } });
await ctx.addCookies([{ name: "auth-session", value: token, domain: alvo.hostname, path: "/", secure: alvo.protocol === "https:" }]);
const page = await ctx.newPage();

/** Escolhe os dois filtros pela lista de opções de cada um e devolve os nomes que a tabela mostra. */
const recortar = async (situacao, cadastro) => {
  await page.evaluate(({ situacao, cadastro }) => {
    const selects = [...document.querySelectorAll("select")];
    const porOpcoes = (textos) => selects.find((s) => textos.every((t) => [...s.options].some((o) => o.text.trim() === t)));
    const sel = (s, texto) => {
      const o = [...s.options].find((x) => x.text.trim() === texto);
      s.value = o.value;
      s.dispatchEvent(new Event("change", { bubbles: true }));
    };
    sel(porOpcoes(["Ativo", "Inativo"]), situacao);
    sel(porOpcoes(["Pacientes", "Supervisionados"]), cadastro);
  }, { situacao, cadastro });
  await page.waitForTimeout(500);
  return page.evaluate(() => [...document.querySelectorAll("table tbody tr")].map((tr) => tr.querySelector("td")?.textContent?.trim() ?? ""));
};

try {
  // Sobra de corrida interrompida vira paciente duplicado e CONTAGEM ERRADA — limpa antes.
  for (const velho of await sql`SELECT id FROM patients WHERE user_id = ${qa.id} AND name LIKE 'QA71 %'`) {
    await sql`DELETE FROM therapy_sessions WHERE patient_id = ${velho.id}`;
    await sql`DELETE FROM session_payments WHERE patient_id = ${velho.id}`;
    await sql`DELETE FROM patients WHERE id = ${velho.id}`;
  }

  // Quatro cadastros de QA: as quatro combinações que o doc 71 quer poder cruzar.
  const nomes = {
    pacAtivo: "QA71 paciente ativo",
    pacInativo: "QA71 paciente inativo",
    supAtivo: "QA71 supervisionado ativo",
    supInativo: "QA71 supervisionado inativo",
  };
  for (const [chave, nome] of Object.entries(nomes)) {
    const kind = chave.startsWith("sup") ? "supervisionado" : "paciente";
    const status = chave.endsWith("Ativo") ? "ativo" : "inativo";
    const [p] = await sql`
      INSERT INTO patients (user_id, name, cadastro_kind, patient_status, session_fee, payment_format, started_at)
      VALUES (${qa.id}, ${nome}, ${kind}, ${status}, '100.00', 'avulso', ${new Date(2026, 0, 10)})
      RETURNING id`;
    criados.push(p.id);
  }

  await page.goto(`${BASE}/dashboard/relatorio-pacientes`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector("table tbody tr", { timeout: 30000 });

  const rotulos = await page.evaluate(() =>
    [...document.querySelectorAll("select")].map((s) => [...s.options].map((o) => o.text.trim()).join("|")));
  check("o filtro de situação continua na tela", rotulos.includes("Todos|Ativo|Inativo"));
  check("o filtro de cadastro é novo e tem as três opções do doc", rotulos.includes("Todos|Pacientes|Supervisionados"));

  const meus = (linhas) => linhas.filter((n) => n.startsWith("QA71 ")).sort();

  check("Todos x Todos traz os quatro", meus(await recortar("Todos", "Todos")).length === 4);

  const supInativos = meus(await recortar("Inativo", "Supervisionados"));
  check("Inativo x Supervisionados traz SÓ o supervisionado inativo",
    supInativos.length === 1 && supInativos[0] === nomes.supInativo, supInativos.join(", "));

  const pacAtivos = meus(await recortar("Ativo", "Pacientes"));
  check("Ativo x Pacientes não deixa supervisionado entrar",
    pacAtivos.length === 1 && pacAtivos[0] === nomes.pacAtivo, pacAtivos.join(", "));

  const sups = meus(await recortar("Todos", "Supervisionados"));
  check("Todos x Supervisionados traz os dois supervisionados", sups.length === 2, sups.join(", "));

  const ativos = meus(await recortar("Ativo", "Todos"));
  check("um filtro não anula o outro: Ativo x Todos traz os dois ativos", ativos.length === 2, ativos.join(", "));

  // ---------------------------------------------------------------- o que saiu (e o que ficou)
  await page.goto(`${BASE}/dashboard/settings`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector('input[name="name"]', { timeout: 30000 });
  const texto = await page.evaluate(() => document.body.innerText);
  check("o card 'Mensagem de cobrança' saiu do Ajustes", !texto.includes("Mensagem de cobrança"));
  check("o bloco de configuração do recibo saiu do Ajustes", !texto.includes("Como vai sair"),
    texto.match(/.{0,40}Como vai sair.{0,40}/)?.[0] ?? "");
  check("a descrição do atendimento ficou", /descrição do atendimento/i.test(texto));

  const ordem = await page.evaluate(() => {
    const campos = [...document.querySelectorAll("form label")].map((l) => l.textContent.trim().toLowerCase());
    return { desc: campos.indexOf("descrição do atendimento"), nome: campos.indexOf("nome completo") };
  });
  check("a descrição vem ANTES do Nome Completo",
    ordem.desc >= 0 && ordem.nome >= 0 && ordem.desc < ordem.nome, JSON.stringify(ordem));

  // Salvar: a escolha tem de chegar ao banco pelo botão do Perfil.
  const opcoes = await page.evaluate(() => {
    const s = document.querySelector('select[name="descricaoAtendimento"]');
    return s ? [...s.options].map((o) => o.value) : [];
  });
  check("a lista de opções do recibo foi preservada", opcoes.length >= 2, opcoes.join(" | "));
  const escolha = opcoes.find((o) => o !== descricaoOriginal) ?? opcoes[0];
  await page.selectOption('select[name="descricaoAtendimento"]', escolha);
  await page.evaluate(() => {
    const f = document.querySelector('select[name="descricaoAtendimento"]').closest("form");
    const b = [...f.querySelectorAll("button")].find((x) => /salvar/i.test(x.textContent));
    if (b) b.click();
  });
  let gravado = null;
  for (let i = 0; i < 20 && gravado !== escolha; i++) {
    await page.waitForTimeout(500);
    const [u] = await sql`SELECT descricao_atendimento FROM "user" WHERE id = ${qa.id}`;
    gravado = u.descricao_atendimento;
  }
  check("a escolha do recibo salva junto com o Perfil", gravado === escolha, `banco: ${gravado}`);

  // ---------------------------------------------------------------- a emissão do recibo de pé
  const [pac] = await sql`
    INSERT INTO patients (user_id, name, patient_status, session_fee, payment_format, started_at)
    VALUES (${qa.id}, 'QA71 recibo', 'ativo', '150.00', 'avulso', ${new Date(2026, 0, 10)}) RETURNING id`;
  criados.push(pac.id);
  const [pag] = await sql`
    INSERT INTO session_payments (user_id, patient_id, amount, date, method)
    VALUES (${qa.id}, ${pac.id}, '150.00', ${new Date(2026, 10, 10, 12)}, 'pix') RETURNING id`;
  const resp = await page.goto(`${BASE}/dashboard/patients/${pac.id}/recibo/${pag.id}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  const corpo = await page.evaluate(() => document.body.innerText);
  check("a página do recibo continua abrindo", resp.status() === 200, `HTTP ${resp.status()}`);
  // O recibo não escreve "psicanalise": escreve "atendimentos psicanalíticos". É esse texto que o
  // paciente leva ao imposto de renda, e é ele que a escolha do Perfil tem de comandar.
  const COMO_SE_ESCREVE = { terapia: "atendimentos terapêuticos", psicanalise: "atendimentos psicanalíticos", psicologia: "atendimentos psicológicos" };
  check("o recibo escreve a formação escolhida", corpo.includes(COMO_SE_ESCREVE[escolha]),
    corpo.replace(/\n/g, " ").slice(-300));
  await sql`DELETE FROM session_payments WHERE id = ${pag.id}`;
} finally {
  for (const id of criados) {
    await sql`DELETE FROM therapy_sessions WHERE patient_id = ${id}`;
    await sql`DELETE FROM session_payments WHERE patient_id = ${id}`;
    await sql`DELETE FROM patients WHERE id = ${id}`;
  }
  await sql`UPDATE "user" SET descricao_atendimento = ${descricaoOriginal} WHERE id = ${qa.id}`;
  await nav.close();
}

console.log(falhas ? `\n${falhas} FALHA(S)` : "\ntudo certo");
process.exitCode = falhas ? 1 : 0;

// O DOC 66 NO APP DE VERDADE.
//
// O que o motor puro não prova, porque o que muda é a TELA e o caminho até ela:
//
//   1. "Lançar pagamento" traz o responsável cadastrado; sem responsável, o paciente. O nome e o
//      CPF são sempre da MESMA pessoa — era aí que estava o defeito.
//   2. O Novo atendimento do AVULSO oferece "Sessão Avulsa" e "Sessão Cortesia" desde o primeiro.
//   3. O Novo atendimento do PACOTE oferece "Iniciar à sequência do pacote" e "Sessão Cortesia" no
//      primeiro agendamento, e adicionar/não adicionar/cortesia nos demais.
//   4. Marcar "Sessão Cortesia" grava a sessão como GRAT na agenda e na guia Geral, e ela não
//      ocupa posição na sequência do pacote.
//   5. A janela "Editar agendamento" não tem mais "Este atendimento será uma cortesia".
//   6. A sessão que JÁ era cortesia continua GRAT depois da mudança.
//
// Uso: npm run build && npm start, depois node scripts/e2e-doc66-cortesia-no-agendamento.mjs
//
// RODE CONTRA O BUILD, não contra `npm run dev` (ver o cabeçalho do e2e do doc 65).

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
const hoje = (() => { const d = new Date(); d.setHours(11, 0, 0, 0); return d; })();
/**
 * Um dia DESTA semana, pelo dia da semana — não por "hoje + N".
 *
 * A agenda abre na semana corrente, e "hoje + 3" numa sexta-feira cai na semana seguinte: o cartão
 * existe no banco e não está na grade. Foi assim que três verificações "falharam" sem defeito nenhum.
 */
const semana = (diaDaSemana, hora = 16) => {
  const d = new Date(hoje);
  d.setDate(d.getDate() - d.getDay() + diaDaSemana);
  d.setHours(hora, 0, 0, 0);
  return d;
};
/** Uma data fora da semana aberta — serve para dar passado ao paciente, não para aparecer. */
const semanaPassada = () => { const d = new Date(hoje); d.setDate(d.getDate() - 7); d.setHours(16, 0, 0, 0); return d; };

const paciente = async (nome, formato, fee, extra = {}) => {
  const [p] = await sql`
    INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status, payment_day,
                          sessions_in_packet, started_at, agenda_id, cpf, guardian_name, guardian_cpf)
    VALUES (${qa.id}, ${nome}, ${formato}, ${fee}, 'ativo', 10, 4,
            ${new Date(hoje.getFullYear() - 1, 0, 5)}, ${extra.agendaId ?? null}, ${extra.cpf ?? null},
            ${extra.responsavel ?? null}, ${extra.responsavelCpf ?? null})
    RETURNING id`;
  criados.push(p.id);
  return p.id;
};
const sessao = async (pid, quando, extra = {}) => {
  const [s] = await sql`INSERT INTO therapy_sessions (user_id, patient_id, date, status, duration, cortesia)
    VALUES (${qa.id}, ${pid}, ${quando}, ${extra.status ?? "agendada"}, 50, ${extra.cortesia ?? false}) RETURNING id`;
  return s.id;
};

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1440, height: 1100 } });
const alvo = new URL(BASE);
await ctx.addCookies([{ name: "auth-session", value: token, domain: alvo.hostname, path: "/", secure: alvo.protocol === "https:" }]);
await ctx.addInitScript(() => { try { localStorage.setItem("ledivan_onboarded_v3", "1"); } catch { /* sem localStorage */ } });
const page = await ctx.newPage();
page.setDefaultNavigationTimeout(120000);
page.setDefaultTimeout(30000);
const ir = async (url) => {
  for (let i = 0; i < 3; i++) {
    try { await page.goto(url, { waitUntil: "domcontentloaded" }); break; }
    catch { await page.waitForTimeout(2000); }
  }
  await page.waitForLoadState("networkidle").catch(() => {});
};
const texto = async () => (await page.innerText("body")).replace(/\u00a0/g, " ");

/** Abre o Novo atendimento num horário vazio e escolhe o paciente. */
const abrirNovo = async (nome, quando) => {
  await ir(`${BASE}/dashboard/agenda`);
  const vazio = page.locator('button[title^="Agendar "]').first();
  await vazio.waitFor({ timeout: 45000 }).catch(() => {});
  if (await vazio.count() === 0) return false;
  await vazio.click();
  await page.waitForTimeout(400);
  const seletor = page.locator('select[name="patientId"]').first();
  if (await seletor.count() === 0) return false;
  await seletor.selectOption({ label: nome });
  await page.waitForTimeout(400);
  if (quando) {
    const d = page.locator('input[name="date"]').first();
    const iso = `${quando.getFullYear()}-${String(quando.getMonth() + 1).padStart(2, "0")}-${String(quando.getDate()).padStart(2, "0")}T${String(quando.getHours()).padStart(2, "0")}:00`;
    await d.fill(iso);
    await page.waitForTimeout(400);
  }
  return true;
};
/** Os rótulos dos botões do quadro de escolhas do Novo atendimento. */
const opcoesDoBloco = async () => {
  const bloco = page.locator('[data-testid="pergunta-sequencia"]').first();
  if (await bloco.count() === 0) return [];
  return (await bloco.locator("button").allInnerTexts()).map((t) => t.replace(/\s+/g, " ").trim());
};
/** A célula daquele paciente na agenda. */
const rotulo = async (nome) => {
  const card = page.getByTitle(nome, { exact: false }).first();
  await card.waitFor({ timeout: 45000 }).catch(() => {});
  if (await card.count() === 0) return null;
  return (await card.innerText()).replace(/\s+/g, " ").trim();
};

try {
  // ── item 1: quem o Lançar pagamento traz preenchido ──────────────────────────────────────────
  //
  // O cadastro do defeito medido em produção: responsável SEM cpf e paciente COM cpf. A conta
  // antiga (`guardianCpf || cpf`) punha o nome de um ao lado do CPF do outro.
  const comResp = await paciente(`QA doc66 com responsavel ${marca}`, "sessao", "100.00", {
    agendaId: `R66${marca.slice(-3)}`, cpf: "111.111.111-11", responsavel: `Elaine QA ${marca}`, responsavelCpf: null,
  });
  const semResp = await paciente(`QA doc66 sem responsavel ${marca}`, "sessao", "100.00", {
    agendaId: `S66${marca.slice(-3)}`, cpf: "222.222.222-22",
  });
  await sessao(comResp, semana(1, 9), { status: "realizada" });
  await sessao(semResp, semana(1, 10), { status: "realizada" });

  for (const [quem, id, nomeEsperado, cpfEsperado] of [
    ["com responsável", comResp, `Elaine QA ${marca}`, ""],
    ["sem responsável", semResp, `QA doc66 sem responsavel ${marca}`, "222.222.222-22"],
  ]) {
    await ir(`${BASE}/dashboard/patients/${id}?guia=geral`);
    const lancar = page.getByRole("button", { name: /Lançar pagamento/i }).first();
    await lancar.waitFor({ timeout: 45000 }).catch(() => {});
    if (await lancar.count() === 0) { check(`${quem}: achou o Lançar pagamento`, false); continue; }
    await lancar.click();
    await page.waitForTimeout(600);
    const nome = await page.locator('input[name="pagoPor"]').first().inputValue().catch(() => null);
    const cpf = await page.locator('input[name="pagoPorCpf"]').first().inputValue().catch(() => null);
    check(`${quem}: o nome preenchido é o certo`, nome === nomeEsperado, `${nome}`);
    check(`${quem}: o CPF é o DAQUELA pessoa`, cpf === cpfEsperado, `"${cpf}"`);
  }

  // ── itens 2 e 3: o quadro de escolhas do Novo atendimento ───────────────────────────────────
  const avulsoNovo = await paciente(`QA doc66 avulso ${marca}`, "sessao", "90.00", { agendaId: `A66${marca.slice(-3)}` });
  if (await abrirNovo(`A66${marca.slice(-3)}`, semana(2, 16))) {
    const op = await opcoesDoBloco();
    check("avulso, 1º agendamento: Sessão Avulsa e Sessão Cortesia", op.join(" | ") === "Sessão Avulsa | Sessão Cortesia", op.join(" | ") || "sem quadro");
  } else check("avulso, 1º agendamento: abriu o Novo atendimento", false);

  const pacoteNovo = await paciente(`QA doc66 pacote ${marca}`, "mensal", "400.00", { agendaId: `P66${marca.slice(-3)}` });
  if (await abrirNovo(`P66${marca.slice(-3)}`, semana(2, 17))) {
    const op = await opcoesDoBloco();
    check("pacote, 1º agendamento: Iniciar à sequência e Sessão Cortesia",
      op.join(" | ") === "Iniciar à sequência do pacote | Sessão Cortesia", op.join(" | ") || "sem quadro");
  } else check("pacote, 1º agendamento: abriu o Novo atendimento", false);

  // O mesmo paciente de pacote, agora COM sequência: as três opções.
  const pacoteComSeq = await paciente(`QA doc66 pacote2 ${marca}`, "mensal", "400.00", { agendaId: `Q66${marca.slice(-3)}` });
  await sessao(pacoteComSeq, semanaPassada());
  if (await abrirNovo(`Q66${marca.slice(-3)}`, semana(3, 16))) {
    const op = await opcoesDoBloco();
    check("pacote, demais agendamentos: adicionar, não adicionar e cortesia",
      op.join(" | ") === "Adicionar à sequência do pacote | Não adicionar à sequência do pacote | Sessão Cortesia",
      op.join(" | ") || "sem quadro");
  } else check("pacote, demais agendamentos: abriu o Novo atendimento", false);

  // ── item 4: marcar a cortesia grava GRAT e não ocupa posição ────────────────────────────────
  if (await abrirNovo(`Q66${marca.slice(-3)}`, semana(3, 15))) {
    await page.locator('[data-testid="pergunta-sequencia"] button:has-text("Sessão Cortesia")').first().click();
    await page.waitForTimeout(300);
    await page.getByRole("button", { name: /^Agendar$/ }).first().click();
    await page.waitForTimeout(2500);
    const gravadas = await sql`
      SELECT cortesia, extra FROM therapy_sessions
      WHERE patient_id = ${pacoteComSeq} AND date >= ${semana(3, 15)} ORDER BY date LIMIT 1`;
    check("cortesia marcada no agendamento foi gravada", gravadas[0]?.cortesia === true, JSON.stringify(gravadas[0] ?? null));
    // A cortesia NÃO sai do pacote: quem sai é "não adicionar à sequência", e esse grava `extra`.
    check("a cortesia continua no pacote (sem marca de extra)", gravadas[0]?.extra == null, String(gravadas[0]?.extra));

    await ir(`${BASE}/dashboard/agenda`);
    const cel = await rotulo(`QA doc66 pacote2 ${marca}`);
    check("a sessão de cortesia aparece como GRAT na agenda", (cel ?? "").includes("GRAT"), cel ?? "sem cartão");

    await ir(`${BASE}/dashboard/patients/${pacoteComSeq}?guia=geral`);
    const corpo = await texto();
    check("e aparece como GRAT na guia Geral também", corpo.includes("GRAT"), corpo.slice(0, 120).replace(/\s+/g, " "));
    /**
     * O controle negativo: "GRAT" na página inteira provaria pouco se ele estivesse no menu ou num
     * rodapé. Um paciente de pacote SEM cortesia nenhuma não pode ter a palavra em lugar nenhum.
     */
    await ir(`${BASE}/dashboard/patients/${pacoteNovo}?guia=geral`);
    const semCortesia = await texto();
    check("o controle: cadastro sem cortesia não diz GRAT em lugar nenhum", !semCortesia.includes("GRAT"));
  } else check("marcar a cortesia: abriu o Novo atendimento", false);

  // ── item 5: a cortesia saiu do Editar agendamento ───────────────────────────────────────────
  const antiga = await paciente(`QA doc66 editar ${marca}`, "sessao", "80.00", { agendaId: `E66${marca.slice(-3)}` });
  await sessao(antiga, semana(4, 16));
  await ir(`${BASE}/dashboard/agenda`);
  const card = page.getByTitle(`QA doc66 editar ${marca}`, { exact: false }).first();
  await card.waitFor({ timeout: 45000 }).catch(() => {});
  if (await card.count()) {
    await card.click();
    await page.waitForTimeout(500);
    const editar = page.getByRole("button", { name: /Editar agendamento/i }).first();
    if (await editar.count()) {
      await editar.click();
      await page.waitForTimeout(600);
      const corpo = await texto();
      check("o Editar agendamento não oferece mais a cortesia", !corpo.includes("Este atendimento será uma cortesia"));
      check("e continua oferecendo o que é dele (data e horário)", corpo.includes("Data e horário"));
    } else check("o Editar agendamento não oferece mais a cortesia", false, "botão Editar não encontrado");
  } else check("o Editar agendamento não oferece mais a cortesia", false, "cartão não encontrado");

  // ── item 6: quem JÁ era cortesia continua GRAT ──────────────────────────────────────────────
  const jaEra = await paciente(`QA doc66 ja cortesia ${marca}`, "sessao", "70.00", { agendaId: `J66${marca.slice(-3)}` });
  await sessao(jaEra, semana(5, 16), { cortesia: true });
  await ir(`${BASE}/dashboard/agenda`);
  const celAntiga = await rotulo(`QA doc66 ja cortesia ${marca}`);
  check("a sessão que já era cortesia continua GRAT", (celAntiga ?? "").includes("GRAT"), celAntiga ?? "sem cartão");
  void avulsoNovo;
} catch (e) {
  check("o percurso chegou ao fim sem exceção", false, String(e && e.message ? e.message : e).slice(0, 300));
} finally {
  await nav.close();
  for (const id of criados) {
    await sql`DELETE FROM session_payments WHERE patient_id = ${id}`;
    await sql`DELETE FROM therapy_sessions WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_payment_format_history WHERE patient_id = ${id}`;
    await sql`DELETE FROM patient_price_history WHERE patient_id = ${id}`;
    await sql`DELETE FROM patients WHERE id = ${id}`;
  }
  console.log(`\n${falhas ? `${falhas} FALHA(S)` : "tudo certo"} · ${criados.length} cadastro(s) de teste apagado(s)`);
  process.exit(falhas ? 1 : 0);
}

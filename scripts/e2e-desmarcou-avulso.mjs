// O "DESMARCOU" QUE DECIDE O DINHEIRO, NO APP DE VERDADE (documento do dono, 12/11/2026).
//
// O que o teste puro NÃO prova: que a escolha feita na agenda chega ao banco e que a guia Geral
// desenha a consequência. São três camadas separadas — janela, ação do servidor e motor —, e cada
// uma passa sozinha nos testes de unidade enquanto a emenda entre elas pode não existir. Foi assim
// que `faltouConta` já chegou do banco e se perdeu no caminho (doc 58).
//
// O percurso exercita as duas respostas E o refazer: Sim (a cobrança fica de pé), depois Desmarcou
// de novo e Não (a cobrança sai). Em ambos, o status tem de continuar "Desmarcou" — é o que o
// documento pede, e é justamente o que quebraria se a janela do pagamento tivesse continuado a
// fixar "Faltou".
//
// Uso: npm run build && npm start, depois `node scripts/e2e-desmarcou-avulso.mjs`.
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

const NOME = "QA desmarcou avulso";
const MENSAL = "QA desmarcou mensal";
const TRANSF = "QA desmarcou transfere";
const VALOR = "QA desmarcou valor";
/** Os cadastros criados no caminho — apagados no fim, aconteça o que acontecer. */
const apagarDepois = [];
// AVULSO ("sessao"): é o formato que o documento alcança. A sessão nasce HOJE, às 8h, para cair na
// semana que a agenda abre sozinha — navegar semana a semana só acrescentaria passos que podem
// falhar por motivo nenhum.
const hoje = new Date();
const quando = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 8, 0, 0);

const [p] = await sql`
  INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status, payment_day, started_at, times_per_period)
  VALUES (${qa.id}, ${NOME}, 'sessao', '100.00', 'ativo', 10, ${quando}, 1)
  RETURNING id`;
const [s] = await sql`
  INSERT INTO therapy_sessions (user_id, patient_id, date, duration, fee, status)
  VALUES (${qa.id}, ${p.id}, ${quando}, 50, '100.00', 'agendada')
  RETURNING id`;

const limpar = async () => {
  for (const pid of [p.id, ...apagarDepois]) {
    await sql`DELETE FROM session_payments WHERE user_id = ${qa.id} AND patient_id = ${pid}`;
    await sql`DELETE FROM therapy_sessions WHERE patient_id = ${pid}`;
    await sql`DELETE FROM patient_price_history WHERE patient_id = ${pid}`;
    await sql`DELETE FROM patient_payment_format_history WHERE patient_id = ${pid}`;
    await sql`DELETE FROM patients WHERE id = ${pid}`;
  }
};

const nav = await chromium.launch();
const alvo = new URL(BASE);
const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addCookies([{ name: "auth-session", value: token, domain: alvo.hostname, path: "/", secure: alvo.protocol === "https:" }]);
const page = await ctx.newPage();

/** O estado da sessão no banco — a única prova de que a escolha atravessou. */
const noBanco = async (id = s.id) => (await sql`SELECT status, desmarcou_cobra, valor_extra FROM therapy_sessions WHERE id = ${id}`)[0];

/**
 * ESPERA O FATO, não o relógio.
 *
 * A janela fecha no clique, antes de a gravação terminar — e ler o banco nesse instante media o
 * estado ANTERIOR. Sem isto o percurso reprovava o Sim e aprovava o Não com o valor do Sim: o
 * erro clássico de medir uma resposta assíncrona pela tela que já sumiu.
 */
const esperarNoBanco = async (condicao, ms = 20000, id = s.id) => {
  const ate = Date.now() + ms;
  let st = await noBanco(id);
  while (!condicao(st) && Date.now() < ate) {
    await new Promise((r) => setTimeout(r, 250));
    st = await noBanco(id);
  }
  return st;
};

/** A sessão aparece com cobrança na guia Geral? É a linha que a terapeuta vê. */
const temCobrancaNaGeral = async (pid = p.id, sid = s.id) => {
  await page.goto(`${BASE}/dashboard/patients/${pid}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector('[data-testid="guia-geral"]', { timeout: 30000 });
  const linha = page.locator(`tr[data-sessao="${sid}"]`).first();
  if (await linha.count() === 0) return { linha: false, chave: null, texto: "" };
  return {
    linha: true,
    chave: await linha.getAttribute("data-chave"),
    texto: (await linha.innerText()).replace(/\s+/g, " ").trim(),
  };
};

/**
 * O clique vai pelo DOM, não pelo mouse.
 *
 * O balão do Divã abre sozinho na conta de QA, é um `fixed inset-0` por cima de tudo e COME o
 * clique — e volta depois de removido, então disputar o ponteiro com ele é perder tempo. O doc 63
 * já tinha aprendido isto; aqui a lição é só reusada.
 */
const clicarPorTexto = async (texto) =>
  page.evaluate((t) => {
    const b = [...document.querySelectorAll("button")].find((x) => x.innerText.trim() === t);
    if (!b) return false;
    b.click();
    return true;
  }, texto);

/** Abre o painel da sessão na agenda e clica num status. */
const marcar = async (status, quem = NOME, qual = 0) => {
  await page.goto(`${BASE}/dashboard/agenda`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector(`button[title^="${quem}"]`, { timeout: 30000 });
  const abriu = await page.evaluate(([nome, i]) => {
    const b = [...document.querySelectorAll("button")].filter((x) => (x.getAttribute("title") ?? "").startsWith(nome))[i];
    if (!b) return false;
    b.click();
    return true;
  }, [quem, qual]);
  if (!abriu) throw new Error(`não achei o bloco da sessão de ${quem} na agenda`);
  await page.waitForSelector("text=Status", { timeout: 15000 });
  if (!(await clicarPorTexto(status))) throw new Error(`não achei o botão de status "${status}"`);
};

/**
 * A janela do Desmarcou não abre no clique: o app primeiro PERGUNTA AO SERVIDOR se aquela sessão
 * tem pagamento lançado — é o que decide qual das duas janelas aparece. Conferir a tela no
 * instante do clique media o quadro antes de ele existir, e o percurso reprovava o que funciona.
 */
const esperarAPergunta = async (ms = 20000) => {
  try {
    await page.waitForSelector("text=Deseja manter o pagamento pendente", { timeout: ms });
    return true;
  } catch {
    return false;
  }
};

try {
  // 1) DESMARCOU num avulso: a janela tem de aparecer, em vez de o status mudar calado.
  await marcar("Desmarcou");
  const perguntou = await esperarAPergunta();
  check("o Desmarcou do avulso abre a pergunta do pagamento", perguntou);
  check("a janela diz como refazer a escolha", await page.locator('text=selecione novamente "Desmarcou"').count() > 0);

  // 2) SIM: a cobrança fica de pé e o status é Desmarcou — não Faltou.
  check("a janela oferece o Sim", await clicarPorTexto("Sim"));
  let st = await esperarNoBanco((x) => x.desmarcou_cobra === true);
  check("com o Sim, a sessão fica Desmarcou", st.status === "cancelada", st.status);
  check("com o Sim, a resposta foi gravada", st.desmarcou_cobra === true, String(st.desmarcou_cobra));

  const comSim = await temCobrancaNaGeral();
  check("com o Sim, a cobrança continua na guia Geral", comSim.linha && comSim.chave === `sessao:${s.id}`, comSim.chave ?? "(sem linha)");

  // 3) REFAZER: clicar Desmarcou de novo numa sessão JÁ desmarcada reabre a janela. Sem isto, a
  //    promessa escrita na própria janela seria mentira.
  await marcar("Desmarcou");
  check("clicar Desmarcou de novo reabre a pergunta", await esperarAPergunta());

  // 4) NÃO: a cobrança sai, o status permanece.
  check("a janela oferece o Não", await clicarPorTexto("Não"));
  st = await esperarNoBanco((x) => x.desmarcou_cobra === false);
  check("com o Não, a sessão continua Desmarcou", st.status === "cancelada", st.status);
  check("com o Não, a resposta foi gravada", st.desmarcou_cobra === false, String(st.desmarcou_cobra));

  const comNao = await temCobrancaNaGeral();
  check("com o Não, a sessão não tem mais cobrança na guia Geral", !comNao.chave, comNao.chave ?? "(sem cobrança)");

  /**
   * CASO 2 DO DOCUMENTO: a sessão JÁ PAGA.
   *
   * Aqui não há pergunta sobre manter pendente — o dinheiro já entrou, e o que falta é destino:
   * estornar ou transferir. A janela é a do doc 55, reaproveitada. O que este trecho protege é o
   * STATUS: aquela janela fixava "Faltou" na sessão, porque até agora só o Faltou a abria. Se a
   * emenda estiver errada, a sessão desmarcada aparece como falta na agenda e na guia Geral.
   */
  await sql`UPDATE therapy_sessions SET status = 'agendada', desmarcou_cobra = NULL WHERE id = ${s.id}`;
  const [pg] = await sql`
    INSERT INTO session_payments (user_id, patient_id, session_id, amount, date, method, status, cobranca_chave, pago_por)
    VALUES (${qa.id}, ${p.id}, ${s.id}, '100.00', ${quando}, 'pix', 'paid', ${`sessao:${s.id}`}, ${NOME})
    RETURNING id`;

  await marcar("Desmarcou");
  let janelaDoPago = false;
  try {
    await page.waitForSelector("text=já possui um pagamento registrado", { timeout: 20000 });
    janelaDoPago = true;
  } catch { /* o check abaixo reprova */ }
  check("sessão JÁ PAGA abre a janela do destino do pagamento", janelaDoPago);
  check("a janela não pergunta sobre manter pendente", await page.locator("text=Deseja manter o pagamento pendente").count() === 0);

  check("a janela oferece estornar", await clicarPorTexto("Estornar o valor"));
  const depois = await esperarNoBanco((x) => x.status === "cancelada");
  check("depois do estorno a sessão fica Desmarcou, não Faltou", depois.status === "cancelada", depois.status);
  const [estornado] = await sql`SELECT estornado_em FROM session_payments WHERE id = ${pg.id}`;
  check("o pagamento foi estornado", !!estornado?.estornado_em, String(estornado?.estornado_em ?? "(não estornado)"));

  /**
   * O AVISO DO DINHEIRO na guia Geral (dono, 12/11, 2º anexo): "precisa também colocar o aviso de
   * estorno na guia geral igual à outra mensagem de estorno que já temos". Sem ele a linha
   * esvaziava sem dizer para onde foi o que o paciente pagou.
   */
  const aposEstorno = await temCobrancaNaGeral();
  check("a guia Geral avisa do estorno na sessão desmarcada", /Estorno realizado no valor de/.test(aposEstorno.texto), aposEstorno.texto.slice(0, 120));

  /** TRANSFERÊNCIA: o mesmo aviso, do outro lado — o dinheiro foi para a próxima sessão. */
  const [pt] = await sql`
    INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status, payment_day, started_at, times_per_period)
    VALUES (${qa.id}, ${TRANSF}, 'sessao', '100.00', 'ativo', 10, ${quando}, 1) RETURNING id`;
  apagarDepois.push(pt.id);
  const [st1] = await sql`
    INSERT INTO therapy_sessions (user_id, patient_id, date, duration, fee, status)
    VALUES (${qa.id}, ${pt.id}, ${quando}, 50, '100.00', 'agendada') RETURNING id`;
  await sql`
    INSERT INTO therapy_sessions (user_id, patient_id, date, duration, fee, status)
    VALUES (${qa.id}, ${pt.id}, ${new Date(quando.getTime() + 7 * 86400000)}, 50, '100.00', 'agendada')`;
  await sql`
    INSERT INTO session_payments (user_id, patient_id, session_id, amount, date, method, status, cobranca_chave, pago_por)
    VALUES (${qa.id}, ${pt.id}, ${st1.id}, '100.00', ${quando}, 'pix', 'paid', ${`sessao:${st1.id}`}, ${TRANSF})`;

  await marcar("Desmarcou", TRANSF);
  let janelaT = false;
  try {
    await page.waitForSelector("text=já possui um pagamento registrado", { timeout: 20000 });
    janelaT = true;
  } catch { /* o check reprova */ }
  check("a sessão paga do segundo caso também abre a janela do destino", janelaT);
  check("a janela oferece transferir", await clicarPorTexto("Transferir para a próxima sessão"));
  const depoisT = await esperarNoBanco((x) => x.status === "cancelada", 20000, st1.id);
  check("transferida: a sessão continua Desmarcou", depoisT.status === "cancelada", depoisT.status);
  const aposTransf = await temCobrancaNaGeral(pt.id, st1.id);
  check("a guia Geral avisa da transferência na sessão desmarcada", /transferido para a data/.test(aposTransf.texto), aposTransf.texto.slice(0, 140));

  /**
   * O R$ 0,00 do 2º anexo: escolher Não e depois Sim tem de trazer de volta o VALOR DIGITADO para
   * a sessão. A sessão nasce com valor próprio e o cadastro sem preço, para que o único número
   * possível seja o que a terapeuta escreveu — se ele for apagado, a linha volta zerada.
   */
  const [pz] = await sql`
    INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status, payment_day, started_at, times_per_period)
    VALUES (${qa.id}, ${VALOR}, 'sessao', '0.00', 'ativo', 10, ${quando}, 1) RETURNING id`;
  apagarDepois.push(pz.id);
  const [sz] = await sql`
    INSERT INTO therapy_sessions (user_id, patient_id, date, duration, fee, status, valor_extra)
    VALUES (${qa.id}, ${pz.id}, ${new Date(quando.getTime() + 4 * 3600000)}, 50, '130.00', 'agendada', '130.00') RETURNING id`;

  await marcar("Desmarcou", VALOR);
  check("a janela abre na sessão com valor próprio", await esperarAPergunta());
  await clicarPorTexto("Não");
  await esperarNoBanco((x) => x.desmarcou_cobra === false, 20000, sz.id);
  await marcar("Desmarcou", VALOR);
  check("e reabre para mudar de ideia", await esperarAPergunta());
  await clicarPorTexto("Sim");
  const zs = await esperarNoBanco((x) => x.desmarcou_cobra === true, 20000, sz.id);
  check("o valor digitado para a sessão sobrevive ao Não→Sim", zs.valor_extra != null && Number(zs.valor_extra) === 130, String(zs.valor_extra));
  const voltou = await temCobrancaNaGeral(pz.id, sz.id);
  check("… e a guia Geral mostra R$ 130,00, não R$ 0,00", /R\$ 130,00/.test(voltou.texto), voltou.texto.slice(0, 120));

  /**
   * O CASO QUE O DONO RELATOU: paciente MENSAL, sessão marcada "não adicionar à sequência — sim".
   *
   * O avulso puro acima não prova este: ali o formato do CADASTRO já é "sessao". Aqui o cadastro é
   * de pacote e quem faz a sessão ser avulsa é a marca `extra = 'avul'`, que vira o rótulo AVUL na
   * célula — e é o rótulo, não o cadastro, que decide se a janela abre. Se essa emenda estiver
   * frouxa, o mensal/quinzenal fica sem janela nenhuma, que foi exatamente a queixa.
   *
   * A sessão do pacote junto é de propósito: sem uma sequência de verdade ao lado, a extra seria
   * a única sessão do paciente e o teste passaria por um motivo que não é o que se quer medir.
   */
  const [pm] = await sql`
    INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status, payment_day, sessions_in_packet, pacote_tipo, started_at, times_per_period)
    VALUES (${qa.id}, ${MENSAL}, 'mensal', '100.00', 'ativo', 10, 4, 'completo', ${quando}, 1)
    RETURNING id`;
  await sql`
    INSERT INTO therapy_sessions (user_id, patient_id, date, duration, fee, status)
    VALUES (${qa.id}, ${pm.id}, ${new Date(quando.getTime() - 7 * 86400000)}, 50, '100.00', 'realizada')`;
  const [sm] = await sql`
    INSERT INTO therapy_sessions (user_id, patient_id, date, duration, fee, status, extra, valor_extra)
    VALUES (${qa.id}, ${pm.id}, ${new Date(quando.getTime() + 3600000)}, 50, '100.00', 'agendada', 'avul', '90.00')
    RETURNING id`;
  apagarDepois.push(pm.id);

  await page.goto(`${BASE}/dashboard/agenda`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector(`button[title^="${MENSAL}"]`, { timeout: 30000 });
  const rotulo = await page.evaluate((nome) => {
    const b = [...document.querySelectorAll("button")].find((x) => (x.getAttribute("title") ?? "").startsWith(nome));
    return b ? b.innerText.replace(/\s+/g, " ").trim() : null;
  }, MENSAL);
  check("a célula do mensal fora da sequência mostra AVUL", /AVUL/.test(rotulo ?? ""), rotulo ?? "(sem bloco)");

  await marcar("Desmarcou", MENSAL);
  check("o mensal com sessão AVUL abre a pergunta do pagamento", await esperarAPergunta());
  check("a janela oferece o Sim (mensal AVUL)", await clicarPorTexto("Sim"));
  const stm = await esperarNoBanco((x) => x.desmarcou_cobra === true, 20000, sm.id);
  check("mensal AVUL: fica Desmarcou com a cobrança mantida", stm.status === "cancelada" && stm.desmarcou_cobra === true, `${stm.status}/${stm.desmarcou_cobra}`);

  await page.goto(`${BASE}/dashboard/patients/${pm.id}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForSelector('[data-testid="guia-geral"]', { timeout: 30000 });
  const chaveM = await page.locator(`tr[data-sessao="${sm.id}"]`).first().getAttribute("data-chave").catch(() => null);
  check("mensal AVUL: a cobrança da extra continua na guia Geral", chaveM === `extra:${sm.id}`, chaveM ?? "(sem cobrança)");

  /** E a sessão DENTRO da sequência continua sem janela — é o que o documento manda preservar. */
  const [sseq] = await sql`
    INSERT INTO therapy_sessions (user_id, patient_id, date, duration, fee, status)
    VALUES (${qa.id}, ${pm.id}, ${new Date(quando.getTime() + 2 * 3600000)}, 50, '100.00', 'agendada')
    RETURNING id`;
  await marcar("Desmarcou", MENSAL, 1);
  const abriuNoPacote = await esperarAPergunta(4000);
  check("sessão DENTRO da sequência segue sem janela", !abriuNoPacote);
  const sq = await esperarNoBanco((x) => x.status === "cancelada", 15000, sseq.id);
  check("… e vai direto para Desmarcou, como sempre foi", sq.status === "cancelada", sq.status);
} catch (e) {
  // Sem este catch, o `process.exit` do finally engole a exceção e o percurso diz "tudo certo" sem
  // ter verificado nada — foi o que aconteceu no doc 63.
  console.error("\nERRO NO PERCURSO:", e?.message ?? e);
  falhas++;
} finally {
  await nav.close();
  await limpar();
  console.log(falhas ? `\n${falhas} FALHA(S)` : "\ntudo certo");
  process.exit(falhas ? 1 : 0);
}

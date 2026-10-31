// O DOC 69 NO APP DE VERDADE.
//
//   1. Bloquear horário com "Repetir até": repete no mesmo dia da semana, de sete em sete, e PULA
//      o horário que já tem paciente em vez de escrever por cima dele.
//   2. "Vale a partir de" aparece ao ABRIR o Financeiro, sem mexer em nada — e mostra a data gravada.
//   3. Mudar o valor de quem paga por pacote faz nascer a pergunta "o novo valor vale sobre", e a
//      resposta é gravada em `patient_price_history.aplica_em`.
//   4. Respondendo "o próximo pacote a iniciar", o pacote EM ANDAMENTO não muda de valor.
//
// Uso: npm run build && TZ=UTC npm start, depois node scripts/e2e-doc69.mjs
//
// TZ=UTC porque é assim que a Vercel roda, e porque as colunas de data guardam hora de PAREDE:
// num servidor em outro fuso a agenda inteira anda três horas (ver `lib/horaLocal`).

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
const dois = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${dois(d.getMonth() + 1)}-${dois(d.getDate())}`;

/**
 * As datas do bloqueio vão para a SEMANA QUE VEM, não para "hoje + N".
 *
 * A grade de hoje já tem o que tem, e um dia que já passou não oferece horário livre. Pegar uma
 * segunda-feira futura deixa o percurso com o mesmo resultado em qualquer dia da semana em que ele
 * rode — a armadilha que já custou três percursos antes deste.
 */
const proximaSegunda = (() => {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7));
  return d;
})();
const maisSemanas = (base, n) => { const d = new Date(base); d.setDate(d.getDate() + 7 * n); return d; };

/**
 * O instante que o banco guarda para uma hora de PAREDE — pelo caminho do `sql` CRU.
 *
 * A coluna é timestamp sem fuso e guarda a hora como a tela a lê. O app, por Drizzle, monta e lê
 * esse valor pelos campos UTC (ver `lib/horaLocal`); o tag `sql` cru do mesmo pacote faz o
 * CONTRÁRIO — serializa a data pelo fuso da MÁQUINA. Medido: `Date.UTC(...14h)` inserido por aqui
 * chega ao banco como `11:00` numa máquina em UTC−3, e a sessão que deveria ocupar as 14:00 não
 * ocupava nada. Então, para inserir por este caminho, a data é LOCAL.
 */
const parede = (base, hora) => new Date(base.getFullYear(), base.getMonth(), base.getDate(), hora, 0, 0, 0);

const paciente = async (nome, formato, fee, agendaId) => {
  const [p] = await sql`
    INSERT INTO patients (user_id, name, payment_format, pacote_tipo, session_fee, patient_status,
                          payment_day, sessions_in_packet, started_at, agenda_id)
    VALUES (${qa.id}, ${nome}, ${formato}, 'completo', ${fee}, 'ativo', 10, 4,
            ${new Date(new Date().getFullYear() - 1, 0, 5)}, ${agendaId})
    RETURNING id`;
  criados.push(p.id);
  return p.id;
};
const sessao = (pid, quando) =>
  sql`INSERT INTO therapy_sessions (user_id, patient_id, date, status, duration, session_kind)
      VALUES (${qa.id}, ${pid}, ${quando}, 'agendada', 50, 'consulta')`;

const nav = await chromium.launch();
const ctx = await nav.newContext({ viewport: { width: 1440, height: 1100 } });
const alvo = new URL(BASE);
await ctx.addCookies([{ name: "auth-session", value: token, domain: alvo.hostname, path: "/", secure: alvo.protocol === "https:" }]);
await ctx.addInitScript(() => { try { localStorage.setItem("ledivan_onboarded_v3", "1"); localStorage.setItem("ledivan_diva_dia", new Date().toISOString().slice(0, 10)); localStorage.setItem("ledivan_diva_aviso_voz", "1"); } catch { /* sem localStorage */ } });
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

try {
  // ───────── 1. bloquear repetindo, pulando o que tem paciente ─────────
  // Na TERCEIRA semana já existe um atendimento às 14h: é ele que precisa sobreviver.
  /**
   * Sobras de uma corrida anterior fariam o horário das 14:00 chegar já bloqueado.
   *
   * A limpeza é por FAIXA DE DATA, nunca por `EXTRACT(HOUR FROM date)`: a coluna é timestamp sem
   * fuso e o driver grava o instante em UTC, então as 14:00 da tela são 17 ou 20 no EXTRACT. Um
   * DELETE assim não apaga nada e não reclama — e a corrida seguinte encontra o horário ocupado.
   */
  await sql`DELETE FROM blocked_slots WHERE user_id = ${qa.id} AND date >= ${proximaSegunda} AND date < ${maisSemanas(proximaSegunda, 5)}`;
  const ocupa = await paciente(`QA doc69 ocupa ${marca}`, "sessao", "100.00", `O69${marca.slice(-3)}`);
  await sessao(ocupa, parede(maisSemanas(proximaSegunda, 2), 14));

  await ir(`${BASE}/dashboard/agenda`);
  const abrir = page.getByRole("button", { name: /Bloquear horário/i }).first();
  await abrir.waitFor({ timeout: 45000 }).catch(() => {});
  if (await abrir.count()) {
    await abrir.click();
    await page.waitForTimeout(500);
    // A janela é buscada pelo NOME: `[role="dialog"]` sozinho também pega o menu lateral do celular,
    // que existe no DOM o tempo todo, e o seletor passa a valer para dois elementos.
    const janela = page.getByRole("dialog", { name: "Bloquear horário" });
    const campos = janela.locator('input[type="date"]');
    await campos.first().fill(iso(proximaSegunda));
    await page.waitForTimeout(1500);
    const temRepetir = (await campos.count()) > 1;
    check("a janela de bloqueio oferece 'Repetir até'", temRepetir);
    if (temRepetir) {
      // Quatro semanas: a própria e mais três.
      await campos.nth(1).fill(iso(maisSemanas(proximaSegunda, 3)));
      // Pelo rótulo do próprio campo: "14:00" aparece também na lista do que JÁ está bloqueado, e
      // marcar ali é pedir para DESbloquear.
      const linha = janela.getByLabel("Bloquear as 14:00");
      if (await linha.count()) {
        await linha.check();
        // `exact`: "Desbloquear os marcados" também contém "Bloquear os marcados".
        await janela.getByRole("button", { name: "Bloquear os marcados", exact: true }).click();
        await page.waitForTimeout(3000);

        const bloqueios = await sql`
          SELECT date FROM blocked_slots
           WHERE user_id = ${qa.id} AND date >= ${proximaSegunda} AND date < ${maisSemanas(proximaSegunda, 4)}
           ORDER BY date`;
        /**
         * A conferência compara DIA e HORA DE PAREDE, nunca instantes.
         *
         * O `sql` cru do Neon monta a data lendo a coluna como hora LOCAL, e o app a monta lendo
         * como UTC — duas convenções para a mesma coluna (ver `lib/horaLocal`). Comparar
         * `getTime()` entre as duas é comparar fusos diferentes e falhar com o dado certo na mão.
         */
        const gravados = bloqueios.map((b) => { const d = new Date(b.date); return `${iso(d)} ${dois(d.getHours())}h`; });
        const as14 = (n) => `${iso(maisSemanas(proximaSegunda, n))} 14h`;
        check("repete de sete em sete, no mesmo dia da semana",
          [0, 1, 3].every((n) => gravados.includes(as14(n))), gravados.join(" · "));
        check("e PULA a semana em que já havia paciente", !gravados.includes(as14(2)), gravados.join(" · "));
        const dias = gravados;
        const recado = await texto();
        check("a tela diz quantos foram bloqueados e quantos foram pulados",
          /3 horários bloqueados/.test(recado) && /1 já estava ocupado/.test(recado),
          (recado.match(/\d+ horários? bloqueados?[^\n]*/) ?? ["(sem recado)"])[0]);

        const [aindaTem] = await sql`SELECT count(*)::int n FROM therapy_sessions WHERE patient_id = ${ocupa}`;
        check("o atendimento que estava no caminho continua na agenda", aindaTem.n === 1, `${aindaTem.n} sessão(ões)`);
        await sql`DELETE FROM blocked_slots WHERE user_id = ${qa.id} AND date >= ${proximaSegunda} AND date < ${maisSemanas(proximaSegunda, 5)}`;
      } else check("repete de sete em sete, no mesmo dia da semana", false, "horário das 14:00 não estava livre");
    }
  } else check("a janela de bloqueio oferece 'Repetir até'", false, "botão Bloquear horário não encontrado");

  // ───────── 2, 3 e 4. o Financeiro ─────────
  const pac = await paciente(`QA doc69 pacote ${marca}`, "mensal", "100.00", `P69${marca.slice(-3)}`);
  const anoPassado = new Date(new Date().getFullYear() - 1, 0, 5);
  await sql`INSERT INTO patient_price_history (patient_id, valor, data_efetiva) VALUES (${pac}, '100.00', ${anoPassado})`;
  await sql`INSERT INTO patient_payment_format_history (patient_id, formato, pacote_tipo, data_efetiva)
            VALUES (${pac}, 'mensal', 'completo', ${anoPassado})`;
  // Um pacote de quatro, já em andamento: duas sessões atrás, duas pela frente.
  for (const n of [-14, -7, 7, 14]) {
    const d = new Date(); d.setDate(d.getDate() + n);
    await sessao(pac, parede(d, 15));
  }

  await ir(`${BASE}/dashboard/patients/${pac}/edit?guia=financeiro`);
  const campoData = page.locator('input[name="formatoDesde"]').first();
  await campoData.waitFor({ timeout: 45000 }).catch(() => {});
  check("'Vale a partir de' aparece sem mexer em nada", (await campoData.count()) > 0);
  if (await campoData.count()) {
    check("e mostra a data GRAVADA, não 'hoje'", (await campoData.inputValue()) === iso(anoPassado), await campoData.inputValue());
  }

  const semPergunta = await page.locator('input[name="aplicaPrecoEm"]').count();
  check("a pergunta do pacote NÃO aparece enquanto o valor não muda", semPergunta === 0, `${semPergunta} opção(ões)`);

  const valor = page.locator('input[name="sessionFee"]').first();
  if (await valor.count()) {
    await valor.fill("R$ 120,00");
    await page.waitForTimeout(800);
    const opcoes = page.locator('input[name="aplicaPrecoEm"]');
    const apareceu = await opcoes.count();
    check("mudar o valor faz nascer a pergunta 'o novo valor vale sobre'", apareceu === 2, `${apareceu} opção(ões)`);
    if (apareceu === 2) {
      const corpo = await texto();
      check("a pergunta explica o que cada resposta faz",
        /pacote vigente/i.test(corpo) && /próximo pacote a iniciar/i.test(corpo));
      await page.locator('input[name="aplicaPrecoEm"][value="proximo_pacote"]').check();
      await campoData.fill(iso(new Date()));
      await page.getByRole("button", { name: /^Salvar/i }).first().click();
      await page.waitForTimeout(4000);

      const precos = await sql`SELECT valor, aplica_em, data_efetiva FROM patient_price_history WHERE patient_id = ${pac} ORDER BY data_efetiva`;
      const nova = precos[precos.length - 1];
      check("a resposta é gravada no histórico de preço", nova?.aplica_em === "proximo_pacote", String(nova?.aplica_em));
      check("e o valor novo entrou como um reajuste próprio", Number(nova?.valor) === 120 && precos.length === 2,
        `${precos.length} faixa(s) · última R$ ${nova?.valor}`);

      // O pacote em ANDAMENTO (começou antes do reajuste) continua valendo 4 × 100.
      await ir(`${BASE}/dashboard/patients/${pac}`);
      await page.waitForTimeout(1500);
      const geral = await texto();
      check("o pacote em andamento continua no valor antigo", /R\$ ?400,00/.test(geral),
        (geral.match(/R\$ ?\d[\d.]*,\d\d/g) ?? []).slice(0, 6).join(" · "));
      check("e nenhuma linha saiu por R$ 480,00 — isso seria reprecificar o pacote corrente", !/R\$ ?480,00/.test(geral));
    }
  } else check("mudar o valor faz nascer a pergunta", false, "campo de valor não encontrado");
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
    await sql`DELETE FROM patient_status_history WHERE patient_id = ${id}`;
    await sql`DELETE FROM patients WHERE id = ${id}`;
  }
  console.log(`\n${falhas ? `${falhas} FALHA(S)` : "tudo certo"} · ${criados.length} cadastro(s) de teste apagado(s)`);
  process.exit(falhas ? 1 : 0);
}

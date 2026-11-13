// O LEMBRETE NA ANTECEDÊNCIA DE CADA SESSÃO (dono, 13/11/2026), no app de verdade.
//
// O que o teste puro não prova: que a sessão certa é ENCONTRADA. Entre a regra e o envio há uma
// consulta com janela de datas, um fuso que desloca tudo em três horas, e um caminho antigo (por
// turno) que não pode mandar a mesma mensagem de novo. É no meio disso que um lembrete some — ou
// sai em dobro.
//
// Roda em SIMULAÇÃO (`?dry=1`): percorre e conta, sem mandar WhatsApp para ninguém.
//
// Uso: npm run build && npm start, depois `node scripts/e2e-lembrete-por-sessao.mjs`.

import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const sql = neon(process.env.DATABASE_URL);
const SEGREDO = process.env.CRON_SECRET;
let falhas = 0;
const check = (n, ok, d = "") => { console.log(`${ok ? "  ok  " : "FALHA "} ${n}${d ? ` — ${d}` : ""}`); if (!ok) falhas++; };

if (!SEGREDO) { console.log("CRON_SECRET ausente no .env.local — sem ele a rota recusa (fail-closed)."); process.exit(1); }

const [qa] = await sql`SELECT id FROM "user" WHERE email = 'qa.ledivan@reverblabs.com.br'`;
if (!qa) { console.log("conta de QA não encontrada"); process.exit(1); }

/**
 * As datas vão para o banco em HORA DE PAREDE. O relógio desta máquina é o de Brasília, então
 * `new Date(...)` local já é a parede — e é assim que o app grava.
 */
const agora = new Date();
const daquiAHoras = (h) => new Date(agora.getTime() + h * 60 * 60 * 1000);

const criados = [];
const cron = async () => {
  const r = await fetch(`${BASE}/api/cron/reminders?dry=1`, { headers: { authorization: `Bearer ${SEGREDO}` } });
  return { status: r.status, corpo: await r.json().catch(() => null) };
};

try {
  const [p] = await sql`
    INSERT INTO patients (user_id, name, payment_format, session_fee, patient_status, payment_day, started_at, times_per_period, reminder_enabled, phone)
    VALUES (${qa.id}, 'QA lembrete sessao', 'sessao', '100.00', 'ativo', 10, ${agora}, 1, true, '11999999999')
    RETURNING id`;
  criados.push(p.id);

  // DENTRO da janela: daqui a 2h, com antecedência de 24h.
  const [dentro] = await sql`
    INSERT INTO therapy_sessions (user_id, patient_id, date, duration, fee, status, confirm_channel, confirm_lead_hours)
    VALUES (${qa.id}, ${p.id}, ${daquiAHoras(2)}, 50, '100.00', 'agendada', 'whatsapp', 24) RETURNING id`;
  // FORA da janela: daqui a 10 dias, com antecedência de 2h.
  const [fora] = await sql`
    INSERT INTO therapy_sessions (user_id, patient_id, date, duration, fee, status, confirm_channel, confirm_lead_hours)
    VALUES (${qa.id}, ${p.id}, ${daquiAHoras(240)}, 50, '100.00', 'agendada', 'whatsapp', 2) RETURNING id`;
  // SEM antecedência própria: segue no caminho antigo, por turno.
  const [semHoras] = await sql`
    INSERT INTO therapy_sessions (user_id, patient_id, date, duration, fee, status)
    VALUES (${qa.id}, ${p.id}, ${daquiAHoras(3)}, 50, '100.00', 'agendada') RETURNING id`;

  const r = await cron();
  check("a rota do cron responde", r.status === 200, `status ${r.status}`);
  check("a resposta separa os dois caminhos", r.corpo && "porSessao" in r.corpo && "naHoraDoTurno" in r.corpo, JSON.stringify(r.corpo));

  /**
   * A contagem é do consultório inteiro (a conta de QA divide o banco com os dados reais), então
   * o que se mede é a VARIAÇÃO: a sessão dentro da janela tem de entrar, e as outras não.
   */
  const alvo = await sql`SELECT id FROM therapy_sessions WHERE id = ${dentro.id}`;
  check("a sessão dentro da janela existe para ser achada", alvo.length === 1);
  check("o caminho por sessão encontrou pelo menos uma", (r.corpo?.porSessao ?? 0) >= 1, `porSessao=${r.corpo?.porSessao}`);

  // Agora tira a sessão da janela e confere que a contagem CAI — é o que prova que era ela.
  const antes = r.corpo?.porSessao ?? 0;
  await sql`UPDATE therapy_sessions SET confirm_lead_hours = 1 WHERE id = ${dentro.id}`;
  const r2 = await cron();
  check("fora da janela, a contagem cai", (r2.corpo?.porSessao ?? 0) === antes - 1, `${antes} → ${r2.corpo?.porSessao}`);

  // E a marca de enviado fecha a porta, mesmo dentro da janela.
  await sql`UPDATE therapy_sessions SET confirm_lead_hours = 24, reminder_sent_at = now() WHERE id = ${dentro.id}`;
  const r3 = await cron();
  check("já enviada não entra de novo", (r3.corpo?.porSessao ?? 0) === antes - 1, `porSessao=${r3.corpo?.porSessao}`);

  void fora; void semHoras;
} catch (e) {
  console.error("\nERRO NO PERCURSO:", e?.message ?? e);
  falhas++;
} finally {
  for (const pid of criados) {
    await sql`DELETE FROM therapy_sessions WHERE patient_id = ${pid}`;
    await sql`DELETE FROM patient_price_history WHERE patient_id = ${pid}`;
    await sql`DELETE FROM patient_payment_format_history WHERE patient_id = ${pid}`;
    await sql`DELETE FROM patients WHERE id = ${pid}`;
  }
  console.log(falhas ? `\n${falhas} FALHA(S)` : "\ntudo certo");
  process.exit(falhas ? 1 : 0);
}

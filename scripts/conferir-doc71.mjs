/**
 * Doc 71 — mede os dois sintomas na base real antes de mexer em código. SÓ LEITURA.
 *
 * 1. Yngrid: o card da lista diz "Semanal 2x · Segunda 20:00, Terça 17:00" e a ficha diz
 *    "segunda 20:00". Qual das duas leituras bate com a agenda?
 * 2. "Será lançada em outra data": a marca está sendo gravada? E a cobrança marcada ainda rola
 *    para o pacote seguinte?
 */
import { config } from "dotenv";
config({ path: "C:/Users/User/Ledivan Plus/.env.local", quiet: true });
import { neon } from "@neondatabase/serverless";

const { agendaRecorrente } = await import("../src/lib/agendaRecorrente.ts");
const { horaDeParede } = await import("../src/lib/horaLocal.ts");

const sql = neon(process.env.DATABASE_URL);
const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

// ---------------------------------------------------------------- 1. Yngrid
const [y] = await sql`SELECT id, name, payment_format FROM patients WHERE name ILIKE 'Yngrid%' LIMIT 1`;
if (!y) console.log("Yngrid não encontrada");
else {
  const rec = await sql`SELECT id, date, status, recurring, recurrence_freq, recurrence_until
                          FROM therapy_sessions
                         WHERE patient_id = ${y.id} AND recurring = true AND status <> 'cancelada'
                           AND date >= now() ORDER BY date`;
  console.log(`\n${y.name} · ${y.payment_format} · ${rec.length} sessão(ões) recorrente(s) futura(s)`);

  const slots = new Map();
  for (const s of rec) {
    const d = new Date(horaDeParede(s.date));
    const chave = `${DIAS[d.getDay()]} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    slots.set(chave, (slots.get(chave) ?? 0) + 1);
  }
  console.log("  pares dia+hora entre as recorrentes futuras:");
  for (const [k, n] of [...slots].sort((a, b) => b[1] - a[1])) console.log(`     ${k} → ${n}x`);
  console.log("  recurrence_freq gravado:", [...new Set(rec.map((r) => r.recurrence_freq))].join(", ") || "—");
  const ficha = agendaRecorrente(rec.map((s) => ({ date: new Date(horaDeParede(s.date)), recurrenceUntil: s.recurrence_until })));
  console.log("  a FICHA (agendaRecorrente, doc 67) diz:", ficha ? `${ficha.day} ${ficha.time}` : "—");
  console.log("  a LISTA (slots distintos) diz:", [...slots.keys()].join(", "));
  const minoritarios = [...slots].filter(([, n]) => n < Math.max(...slots.values()));
  if (minoritarios.length) {
    console.log("  → sessões do par minoritário (as que inflam a lista):");
    for (const s of rec) {
      const d = new Date(horaDeParede(s.date));
      const chave = `${DIAS[d.getDay()]} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      if (minoritarios.some(([k]) => k === chave)) console.log(`       ${horaDeParede(s.date).slice(0, 16)}  ${chave}  status=${s.status}`);
    }
  }
}

// -------------------------------------------- 2. "Será lançada em outra data"
const col = await sql`SELECT column_name FROM information_schema.columns
                       WHERE table_name = 'session_payments' AND column_name = 'diferenca_outra_data'`;
console.log(`\ncoluna diferenca_outra_data em produção: ${col.length ? "EXISTE" : "NÃO EXISTE"}`);

const marcados = await sql`SELECT p.id, p.date, p.amount, p.cobranca_chave, p.diferenca_outra_data,
                                  p.quita_diferenca, pa.name
                             FROM session_payments p JOIN patients pa ON pa.id = p.patient_id
                            WHERE p.diferenca_outra_data = true ORDER BY p.date DESC LIMIT 20`;
console.log(`pagamentos com a marca gravada: ${marcados.length}`);
for (const m of marcados) console.log(`   ${String(m.date).slice(0, 10)}  ${m.name}  R$ ${m.amount}  ${m.cobranca_chave}`);

// Quantos pagamentos parciais recentes NÃO têm a marca (o sintoma seria aqui).
const parciais = await sql`SELECT p.id, p.date, p.amount, p.cobranca_chave, p.diferenca_outra_data, pa.name
                             FROM session_payments p JOIN patients pa ON pa.id = p.patient_id
                            WHERE p.cobranca_chave LIKE 'pacote:%' AND p.quita_diferenca = false
                              AND p.date >= now() - interval '30 days'
                            ORDER BY p.date DESC LIMIT 20`;
console.log(`\npagamentos de PACOTE dos últimos 30 dias (marca ao lado):`);
for (const m of parciais) console.log(`   ${String(m.date).slice(0, 10)}  ${m.name}  R$ ${m.amount}  outraData=${m.diferenca_outra_data}  ${m.cobranca_chave}`);

process.exit(0);

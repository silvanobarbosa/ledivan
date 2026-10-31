/**
 * A numeração da Caroline (doc 70): "o agendamento do dia 27/10 consta como 1/2 (correto) porém o
 * do dia 10/11 está sendo salvo como 1/5".
 *
 * Mede a causa em vez de deduzi-la: roda o MESMO motor de rótulos da agenda sobre a base real, uma
 * vez com o histórico de tamanho como está e outra sem a vigência órfã, e imprime os dois lado a
 * lado. SÓ LEITURA — nada é apagado por este script.
 */
import { config } from "dotenv";
config({ path: "C:/Users/User/Ledivan Plus/.env.local", quiet: true });
import { neon } from "@neondatabase/serverless";

const { rotulosDasSessoes } = await import("../src/lib/cobrancas.ts");
const { horaDeParede } = await import("../src/lib/horaLocal.ts");

const sql = neon(process.env.DATABASE_URL);
const [p] = await sql`SELECT id, name, payment_format, pacote_tipo, sessions_in_packet, times_per_period, session_fee
                        FROM patients WHERE name ILIKE 'Caroline dos Santos%' LIMIT 1`;
if (!p) { console.log("paciente não encontrada"); process.exit(1); }

const sessoes = await sql`SELECT id, date, status, extra, session_kind, abater_do_pacote, repoe_sessao_id, cortesia
                            FROM therapy_sessions WHERE patient_id = ${p.id} ORDER BY date`;
const vigencias = await sql`SELECT formato, pacote_tipo, data_efetiva, data_criacao
                              FROM patient_payment_format_history WHERE patient_id = ${p.id}`;
const tamanhos = await sql`SELECT tamanho, data_efetiva FROM patient_package_history WHERE patient_id = ${p.id} ORDER BY data_efetiva`;

const rodar = (hist) =>
  rotulosDasSessoes({
    vigencias: vigencias.map((v) => ({ formato: v.formato, pacoteTipo: v.pacote_tipo, desde: new Date(horaDeParede(v.data_efetiva)), criadoEm: new Date(horaDeParede(v.data_criacao)) })),
    reserva: { formato: p.payment_format, pacoteTipo: p.pacote_tipo },
    sessoes: sessoes.map((s) => ({
      id: s.id, date: new Date(horaDeParede(s.date)), status: s.status, extra: s.extra,
      sessionKind: s.session_kind, abaterDoPacote: s.abater_do_pacote, repoeSessaoId: s.repoe_sessao_id, cortesia: s.cortesia,
    })),
    precos: [],
    tamanhos: [],
    tamanhoPacote: p.sessions_in_packet,
    tamanhosPorData: hist.map((h) => ({ desde: new Date(horaDeParede(h.data_efetiva)), tamanho: h.tamanho })),
    vezesPorSemana: p.times_per_period,
  });

console.log(`${p.name} · formato ${p.payment_format}/${p.pacote_tipo} · pacote do cadastro: ${p.sessions_in_packet}`);
console.log("\nvigências de TAMANHO gravadas:");
for (const t of tamanhos) console.log(`   ${String(t.data_efetiva).slice(0, 10)} → ${t.tamanho}`);

const orfa = (h) => h.tamanho !== p.sessions_in_packet && new Date(horaDeParede(h.data_efetiva)) > new Date("2026-06-01");
const comoEsta = rodar(tamanhos);
const semOrfa = rodar(tamanhos.filter((h) => !orfa(h)));

console.log("\nsessões recentes — rótulo HOJE  →  rótulo SEM a vigência órfã:");
for (const s of sessoes.filter((s) => new Date(horaDeParede(s.date)) >= new Date("2026-10-01"))) {
  const dia = horaDeParede(s.date).slice(0, 10);
  console.log(`   ${dia}  ${comoEsta.get(s.id) ?? "—"}  →  ${semOrfa.get(s.id) ?? "—"}`);
}
console.log("\nórfãs encontradas:", tamanhos.filter(orfa).map((h) => `${String(h.data_efetiva).slice(0, 10)} → ${h.tamanho}`).join(" · ") || "nenhuma");

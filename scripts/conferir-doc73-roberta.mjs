/**
 * Doc 73, item do REAJUSTE — "escolhi 'próximo pacote a iniciar' com vigência 01/08/2025 e todos
 * os valores anteriores a essa data estão sendo alterados" (paciente Roberta, usuária ana).
 *
 * SÓ LEITURA. Mostra as faixas de preço da Roberta e o valor de cada cobrança de pacote, para
 * separar o que é regra do que é dado.
 */
import { config } from "dotenv";
config({ path: "C:/Users/User/Ledivan Plus/.env.local", quiet: true });
import { neon } from "@neondatabase/serverless";

const { geralDoPaciente } = await import("../src/lib/geralDoPaciente.ts");
const sql = neon(process.env.DATABASE_URL);

const pacientes = await sql`SELECT p.id, p.name, p.user_id, u.email, p.payment_format, p.pacote_tipo, p.session_fee
                              FROM patients p JOIN "user" u ON u.id = p.user_id
                             WHERE p.name ILIKE 'Roberta%' ORDER BY u.email`;
console.log(`pacientes "Roberta": ${pacientes.length}`);
for (const p of pacientes) console.log(`   ${p.name} · ${p.email} · ${p.payment_format}/${p.pacote_tipo} · R$ ${p.session_fee}`);

for (const p of pacientes) {
  if (!/ana/i.test(p.email)) continue;
  console.log(`\n===== ${p.name} (${p.email}) =====`);
  const precos = await sql`SELECT valor, data_efetiva, aplica_em, data_criacao FROM patient_price_history
                            WHERE patient_id = ${p.id} ORDER BY data_efetiva`;
  console.log("faixas de preço:");
  for (const f of precos) console.log(`   R$ ${String(f.valor).padStart(8)}  vale de ${String(f.data_efetiva).slice(0, 10)}  aplica_em=${f.aplica_em ?? "(nulo)"}  gravado ${String(f.data_criacao).slice(0, 10)}`);

  const g = await geralDoPaciente(p.user_id, p.id);
  if (!g) { console.log("   (sem guia)"); continue; }
  console.log("cobranças de pacote:");
  for (const l of g.linhas) {
    if (l.tipo !== "pagamento" || l.tipoDeCobranca !== "pacote") continue;
    console.log(`   ${l.chave.padEnd(22)} venc=${String(l.vencimento).slice(0, 10)} ${l.sessoes} sess  R$ ${String(l.valor).padStart(8)}  pago=${l.valorPago}  ${l.situacao}`);
  }
}
process.exit(0);

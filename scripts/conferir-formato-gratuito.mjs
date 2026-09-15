/**
 * O "Gratuito" está grudando? Mede no banco, em vez de deduzir do código.
 *
 * A regra do dono: "Gratuito" significa que AGORA não há cobrança — não é condição definitiva.
 * Trocar para qualquer outro formato tem que prevalecer, ser gravado e valer em todo o sistema.
 *
 * O que este script procura, tudo SÓ LEITURA:
 *
 *  1. Quantos pacientes estão em cada formato hoje.
 *  2. Pacientes gratuitos que têm valor de sessão, dia de pagamento, pacote ou histórico de
 *     preço — sinal de quem JÁ FOI pago e voltou para gratuito sem querer.
 *  3. O histórico de mudança de modelo (`patient_contract_history`, type='model'): quem saiu de
 *     gratuito, para onde foi, e se o cadastro hoje bate com a última mudança registrada.
 *     **Esta é a prova**: se a última mudança diz "gratuito → sessao" e o cadastro ainda diz
 *     gratuito, o salvamento não pegou.
 */
import { config } from "dotenv";
config({ path: "C:/Users/User/Ledivan Plus/.env.local", quiet: true });
// O Ledivan nao usa `pg`: fala com o Neon pelo driver HTTP. O tag `sql` devolve as linhas
// direto, entao o `.query()` daqui e so um adaptador fino para nao reescrever as consultas.
import { neon } from "@neondatabase/serverless";
const conn = neon(process.env.DATABASE_URL);
const c = {
  // `conn(...)` so aceita tagged template; para SQL em texto o driver expoe `.query()`.
  query: async (texto) => { const rows = await conn.query(texto); return { rows, rowCount: rows.length }; },
  end: async () => {},
};

const linha = (t) => console.log("\n" + t + "\n" + "─".repeat(t.length));

linha("1. formato de pagamento hoje");
const fmt = await c.query(`
  SELECT payment_format, COUNT(*)::int n,
         COUNT(*) FILTER (WHERE COALESCE(session_fee,0) > 0)::int com_valor
  FROM patients GROUP BY 1 ORDER BY 2 DESC`);
for (const r of fmt.rows) {
  console.log(`  ${String(r.payment_format).padEnd(18)} ${String(r.n).padStart(4)} pacientes` +
    (r.com_valor ? `   (${r.com_valor} com valor de sessão)` : ""));
}

linha("2. gratuitos que carregam sinais de quem já foi pago");
const suspeitos = await c.query(`
  SELECT p.id, p.name, p.session_fee, p.payment_day, p.pacote_tipo,
         (SELECT COUNT(*)::int FROM patient_price_history h WHERE h.patient_id = p.id) precos
  FROM patients p
  WHERE p.payment_format = 'gratuito'
    AND (COALESCE(p.session_fee,0) > 0 OR p.payment_day IS NOT NULL OR p.pacote_tipo IS NOT NULL)
  ORDER BY p.session_fee DESC NULLS LAST LIMIT 20`);
if (!suspeitos.rowCount) console.log("  nenhum — gratuitos estão limpos de configuração de cobrança");
for (const r of suspeitos.rows) {
  console.log(`  ${r.name.slice(0, 30).padEnd(30)} valor=${r.session_fee ?? "—"} ` +
    `dia=${r.payment_day ?? "—"} pacote=${r.pacote_tipo ?? "—"} preços=${r.precos}`);
}

linha("3. A PROVA — última mudança de modelo x o que está gravado hoje");
const hist = await c.query(`
  WITH ultima AS (
    SELECT DISTINCT ON (patient_id) patient_id, "from", "to", date
    FROM patient_contract_history WHERE type = 'model'
    ORDER BY patient_id, date DESC
  )
  SELECT p.name, p.payment_format AS hoje, u."from", u."to", u.date
  FROM ultima u JOIN patients p ON p.id = u.patient_id
  ORDER BY u.date DESC LIMIT 25`);
if (!hist.rowCount) console.log("  sem histórico de mudança de modelo registrado");
let divergentes = 0;
for (const r of hist.rows) {
  // O histórico grava rótulo ("A cada sessão"), o cadastro grava chave ("sessao").
  const destino = String(r.to).toLowerCase();
  const hoje = String(r.hoje).toLowerCase();
  const CHAVE = { "a cada sessão": "sessao", "gratuito": "gratuito", "mensal": "mensal",
    "quinzenal": "quinzenal", "na primeira sessão do pacote": "primeira_pacote",
    "na última sessão do pacote": "ultima_pacote" };
  const esperado = Object.entries(CHAVE).find(([rot]) => destino.includes(rot))?.[1];
  const bate = !esperado || esperado === hoje;
  if (!bate) divergentes++;
  console.log(`  ${bate ? "ok  " : "DIVERGE"} ${r.name.slice(0, 26).padEnd(26)} ` +
    `histórico: "${String(r.from).slice(0, 26)}" → "${String(r.to).slice(0, 30)}"  |  hoje: ${r.hoje}`);
}
console.log(`\n  ${divergentes} divergências entre a última mudança registrada e o cadastro atual`);

linha("4. quem já passou por gratuito em algum momento");
const passou = await c.query(`
  SELECT p.name, p.payment_format AS hoje, COUNT(*)::int mudancas,
         STRING_AGG(h."from" || ' → ' || h."to", '  |  ' ORDER BY h.date) AS trilha
  FROM patient_contract_history h JOIN patients p ON p.id = h.patient_id
  WHERE h.type = 'model' AND (h."from" ILIKE '%gratuito%' OR h."to" ILIKE '%gratuito%')
  GROUP BY p.id, p.name, p.payment_format ORDER BY mudancas DESC LIMIT 15`);
if (!passou.rowCount) console.log("  ninguém trocou de/para gratuito no histórico");
for (const r of passou.rows) {
  console.log(`  ${r.name.slice(0, 26).padEnd(26)} hoje=${String(r.hoje).padEnd(16)} ${r.mudancas} mudança(s)`);
  console.log(`      ${r.trilha}`);
}


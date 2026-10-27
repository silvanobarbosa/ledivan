import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
for (const nome of ["Catarina","Marcela"]) {
  const [p] = await sql`SELECT id,name FROM patients WHERE name ILIKE ${'%'+nome+'%'} LIMIT 1`;
  console.log("\n=====", p.name);
  const pg = await sql`SELECT id, amount, date, method, kind, status, estornado_em, cobranca_chave FROM session_payments WHERE patient_id=${p.id} ORDER BY date, id`;
  for (const x of pg) console.log(` ${String(x.date).slice(4,15)} R$${x.amount} ${x.method} kind=${x.kind||'-'} ${x.status} ${x.estornado_em?'ESTORNADO':''} ${x.cobranca_chave||''} [${x.id.slice(0,8)}]`);
  const cr = await sql`SELECT valor, origem_pagamento_id, consumido_pagamento_id, created_at FROM patient_credits WHERE patient_id=${p.id} ORDER BY created_at`;
  console.log(" creditos:");
  for (const c of cr) console.log(`   R$${c.valor} origem=${c.origem_pagamento_id?.slice(0,8)} consumido=${c.consumido_pagamento_id?.slice(0,8)}`);
}

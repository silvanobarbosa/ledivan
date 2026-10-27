import { config } from "dotenv"; config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const cred = await sql`
  SELECT sp.id, p.name, sp.amount, sp.date, sp.method, sp.kind, sp.status, sp.estornado_em, sp.cobranca_chave
  FROM session_payments sp JOIN patients p ON p.id=sp.patient_id
  WHERE sp.kind='credito' ORDER BY sp.date`;
console.log("pagamentos kind=credito:", cred.length);
for (const c of cred) console.log(` ${c.name} · R$${c.amount} · ${String(c.date).slice(0,15)} · ${c.method} · estornado=${c.estornado_em?'sim':'não'} · chave=${c.cobranca_chave}`);
const pc = await sql`
  SELECT p.name, c.valor, c.created_at, c.origem_pagamento_id, c.consumido_pagamento_id, c.nao_auto, c.confirmar_abatimento
  FROM patient_credits c JOIN patients p ON p.id=c.patient_id ORDER BY c.created_at`;
console.log("\npatient_credits:", pc.length);
for (const c of pc) console.log(` ${c.name} · R$${c.valor} · criado ${String(c.created_at).slice(0,15)} · origem=${c.origem_pagamento_id?'sim':'NÃO'} · consumido=${c.consumido_pagamento_id?'sim':'não'} · naoAuto=${c.nao_auto} · confirmar=${c.confirmar_abatimento}`);
const est = await sql`SELECT p.name, sp.amount, sp.date, sp.estornado_em, sp.kind FROM session_payments sp JOIN patients p ON p.id=sp.patient_id WHERE sp.estornado_em IS NOT NULL`;
console.log("\nestornados:", est.length);
for (const e of est) console.log(` ${e.name} · R$${e.amount} · ${String(e.date).slice(0,15)} · kind=${e.kind}`);

// A FORMA DOS ABATIMENTOS DE CRÉDITO JÁ GRAVADOS (doc 62).
//
// O lançamento de pagamento à mão gravava `method = 'cash'` fixo no pagamento `kind="credito"`.
// A linha aparecia como "Crédito do saldo" e mais nada, e a dona pediu a forma de pagamento junto.
// O app já grava a forma certa — a do pagamento que ORIGINOU o crédito —, mas os registros feitos
// antes disto continuam dizendo "Dinheiro" onde o paciente pagou de outro jeito.
//
// Este script acerta os que ficaram para trás. Só mexe em quem tem origem conhecida: sem ela não há
// o que afirmar, e inventar uma forma é pior do que não ter nenhuma.
//
// ENSAIO POR PADRÃO: sem `--aplicar` ele só mostra o que faria.
//
// Uso: node scripts/corrigir-forma-do-abatimento.mjs [--aplicar]

import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const aplicar = process.argv.includes("--aplicar");

// A origem é a do crédito MAIS ANTIGO que este pagamento consumiu — a mesma ordem em que o app
// os consome. `DISTINCT ON` com `ORDER BY` resolve o caso de o abatimento juntar várias linhas.
const alvos = await sql`
  SELECT DISTINCT ON (sp.id) sp.id, sp.method, o.method AS origem, p.name
  FROM session_payments sp
  JOIN patients p ON p.id = sp.patient_id
  JOIN patient_credits c ON c.consumido_pagamento_id = sp.id
  JOIN session_payments o ON o.id = c.origem_pagamento_id
  WHERE sp.kind = 'credito' AND sp.method <> o.method
  ORDER BY sp.id, c.created_at`;

if (!alvos.length) {
  console.log("Nenhum abatimento com a forma divergente da origem. Nada a fazer.");
  process.exit(0);
}

console.log(`${alvos.length} abatimento(s) com a forma divergente da origem:\n`);
for (const a of alvos) console.log(`  ${a.name} · grava ${a.method} · deveria gravar ${a.origem}`);

if (!aplicar) {
  console.log("\nENSAIO — nada foi gravado. Rode com --aplicar para valer.");
  process.exit(0);
}

for (const a of alvos) {
  await sql`UPDATE session_payments SET method = ${a.origem}::payment_method WHERE id = ${a.id}`;
}
const sobrou = await sql`
  SELECT count(*)::int n
  FROM session_payments sp
  JOIN patient_credits c ON c.consumido_pagamento_id = sp.id
  JOIN session_payments o ON o.id = c.origem_pagamento_id
  WHERE sp.kind = 'credito' AND sp.method <> o.method`;
console.log(`\nFeito. Divergentes restantes: ${sobrou[0].n}.`);

// PAGAMENTOS QUE SOBREVIVERAM AO AGENDAMENTO (doc 61, "registros antigos já cadastrados").
//
// A coluna `session_payments.session_id` é ON DELETE SET NULL: excluído o agendamento, o pagamento
// ficava. Sem sessão, mas com a chave `extra:<id>` de uma sessão que não existe mais — e a guia
// Geral, não achando essa cobrança, redistribui o dinheiro órfão por vencimento e vai ABATER a
// próxima cobrança do paciente. A terapeuta vê uma sessão se pagar sozinha.
//
// O app já não cria mais esses órfãos (`apagarSessoesComPagamentos`). Este script limpa os que
// ficaram para trás, e faz com eles o mesmo que a exclusão faz hoje:
//
//   - apaga a TRANSAÇÃO do caixa vinculada (é o mesmo fato contado noutra tela);
//   - apaga o CRÉDITO que o pagamento gerou e que ninguém usou;
//   - devolve ao saldo o CRÉDITO que ele consumiu, marcado com `nao_auto`;
//   - apaga o pagamento.
//
// ENSAIO POR PADRÃO: sem `--aplicar` ele só mostra o que faria. Com `--aplicar`, grava.
//
// Uso: node scripts/limpar-pagamentos-orfaos.mjs [--aplicar]

import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const aplicar = process.argv.includes("--aplicar");

const orfaos = await sql`
  SELECT sp.id, sp.patient_id, p.name, sp.amount, sp.date, sp.kind, sp.cobranca_chave,
         sp.estornado_em, sp.linked_transaction_id
  FROM session_payments sp
  JOIN patients p ON p.id = sp.patient_id
  WHERE sp.cobranca_chave ~ '^(sessao|extra):'
    AND NOT EXISTS (
      SELECT 1 FROM therapy_sessions ts WHERE ts.id = split_part(sp.cobranca_chave, ':', 2)::uuid
    )
  ORDER BY p.name, sp.date`;

if (!orfaos.length) {
  console.log("Nenhum pagamento órfão. Nada a fazer.");
  process.exit(0);
}

console.log(`${orfaos.length} pagamento(s) sem a sessão que os cobrava:\n`);
for (const o of orfaos) {
  console.log(`  ${o.name} · R$ ${o.amount} · ${String(o.date).slice(0, 10)} · ${o.cobranca_chave}` +
    `${o.kind ? ` · ${o.kind}` : ""}${o.estornado_em ? " · estornado" : ""}` +
    `${o.linked_transaction_id ? " · tem lançamento no caixa" : ""}`);
}

const ids = orfaos.map((o) => o.id);
const txs = orfaos.map((o) => o.linked_transaction_id).filter(Boolean);
// Some o crédito que estes pagamentos geraram, e também aquele cujas DUAS pontas saem aqui: posto
// de volta no saldo, ele viraria dinheiro que o paciente nunca pagou.
const geraram = await sql`
  SELECT id, valor FROM patient_credits
  WHERE origem_pagamento_id = ANY(${ids})
    AND (consumido_em IS NULL OR consumido_pagamento_id = ANY(${ids}))`;
const consumiram = await sql`
  SELECT id, valor FROM patient_credits
  WHERE consumido_pagamento_id = ANY(${ids})
    AND (origem_pagamento_id IS NULL OR NOT (origem_pagamento_id = ANY(${ids})))`;

console.log(`\nJunto saem: ${txs.length} lançamento(s) do caixa, ${geraram.length} crédito(s) gerados por eles ` +
  `(R$ ${geraram.reduce((s, c) => s + Number(c.valor), 0).toFixed(2)}).`);
console.log(`Voltam ao saldo: ${consumiram.length} crédito(s) que eles haviam consumido.`);

if (!aplicar) {
  console.log("\nENSAIO — nada foi gravado. Rode com --aplicar para valer.");
  process.exit(0);
}

if (txs.length) await sql`DELETE FROM transactions WHERE id = ANY(${txs})`;
await sql`
  DELETE FROM patient_credits
  WHERE origem_pagamento_id = ANY(${ids})
    AND (consumido_em IS NULL OR consumido_pagamento_id = ANY(${ids}))`;
await sql`
  UPDATE patient_credits SET consumido_em = NULL, consumido_pagamento_id = NULL, nao_auto = true
  WHERE consumido_pagamento_id = ANY(${ids})`;
await sql`DELETE FROM session_payments WHERE id = ANY(${ids})`;

const sobrou = await sql`SELECT count(*)::int n FROM session_payments WHERE id = ANY(${ids})`;
console.log(`\nFeito. Pagamentos restantes da lista: ${sobrou[0].n}.`);

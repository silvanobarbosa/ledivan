/**
 * Doc 20 — as correções de DADO que o código novo não alcança sozinho.
 *
 * Roda DEPOIS do deploy. Três coisas, cada uma com relatório antes e depois:
 *
 * 1. renomeia o campo "Identificação (idade, …)" da anamnese para o título sem "idade", para que
 *    o texto já escrito continue aparecendo no campo certo em vez de virar um campo herdado;
 * 2. apaga os créditos em aberto cujo pagamento de origem já não existe — o R$ 60 da Celani;
 * 3. apaga os pins de vencimento que pertencem a uma sequência anterior, para que as regras já
 *    gravadas passem a valer (é o que o código novo passa a fazer a cada "Sim").
 *
 * Sem argumento, só MOSTRA. Com `--aplicar`, grava.
 */
import { config } from "dotenv";
config({ path: "C:/Users/User/Ledivan Plus/.env.local", quiet: true });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const aplicar = process.argv.includes("--aplicar");
const TITULO_VELHO = "Identificação (idade, profissão, estado civil, com quem mora)";
const TITULO_NOVO = "Identificação (profissão, estado civil, com quem mora)";

console.log(aplicar ? "=== APLICANDO ===" : "=== SÓ MOSTRANDO (use --aplicar para gravar) ===");

// ---------------------------------------------------------------- 1. anamnese
const campos = await sql`SELECT id, patient_id FROM patient_anamnese WHERE custom = false AND title = ${TITULO_VELHO}`;
console.log(`\n1. anamnese "Identificação": ${campos.length} campo(s) com o título antigo`);
if (aplicar && campos.length) {
  await sql`UPDATE patient_anamnese SET title = ${TITULO_NOVO} WHERE custom = false AND title = ${TITULO_VELHO}`;
  console.log("   renomeados.");
}

// ------------------------------------------------------- 2. créditos órfãos
const orfaos = await sql`
  SELECT c.id, c.patient_id, p.name, c.valor, c.created_at
    FROM patient_credits c JOIN patients p ON p.id = c.patient_id
   WHERE c.consumido_em IS NULL
     AND c.origem_pagamento_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM session_payments sp WHERE sp.id = c.origem_pagamento_id)`;
console.log(`\n2. créditos sem pagamento de origem: ${orfaos.length}`);
for (const c of orfaos) console.log(`   ${c.name}: R$ ${c.valor} (criado ${new Date(c.created_at).toISOString().slice(0, 16)})`);
if (aplicar && orfaos.length) {
  await sql`DELETE FROM patient_credits WHERE id = ANY(${orfaos.map((c) => c.id)})`;
  console.log("   apagados.");
}

// --------------------------------------------- 3. pins da sequência anterior
const regras = await sql`SELECT user_id, patient_id, a_partir_de, meses, cobranca_chave FROM cobranca_deslocamentos ORDER BY patient_id, a_partir_de`;
console.log(`\n3. regras de deslocamento gravadas: ${regras.length}`);
for (const r of regras) {
  const [pac] = await sql`SELECT name FROM patients WHERE id = ${r.patient_id}`;
  const ponto = new Date(r.a_partir_de).toISOString().slice(0, 10);
  console.log(`\n   ${pac?.name ?? r.patient_id} — a partir de ${ponto}, ${r.meses > 0 ? "+" : ""}${r.meses} mês(es)`);

  /**
   * Um pin só sai se a cobrança dele NÃO tem pagamento lançado. A ligação entre pin e pagamento é
   * a `cobranca_chave`, a mesma dos dois lados — é assim que o "(sem pagamento)" do botão se
   * cumpre aqui também.
   */
  const pins = await sql`
    SELECT v.cobranca_chave, v.vencimento
      FROM cobranca_vencimentos v
     WHERE v.patient_id = ${r.patient_id}
       AND v.cobranca_chave <> ${r.cobranca_chave ?? ""}
       AND NOT EXISTS (
         SELECT 1 FROM session_payments sp
          WHERE sp.patient_id = v.patient_id AND sp.cobranca_chave = v.cobranca_chave)
     ORDER BY v.vencimento`;
  const alvo = pins.filter((p) => new Date(p.vencimento).toISOString().slice(0, 10) >= ponto);
  console.log(`      pins sem pagamento no trecho: ${alvo.length}`);
  for (const p of alvo) console.log(`         ${p.cobranca_chave}  ${new Date(p.vencimento).toISOString().slice(0, 10)}`);
  if (aplicar && alvo.length) {
    await sql`DELETE FROM cobranca_vencimentos
               WHERE patient_id = ${r.patient_id} AND cobranca_chave = ANY(${alvo.map((p) => p.cobranca_chave)})`;
    console.log("      apagados.");
  }
}
console.log("\nfim.");

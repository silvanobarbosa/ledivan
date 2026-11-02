// DOC 75, ITENS 3 E 4: O PRAZO DO REAJUSTE VOLTA A CORRER DA VIGÊNCIA DECLARADA.
//
// O item 3 corrigiu o código: o lembrete do próximo reajuste conta da data que a pessoa digitou em
// "Vale a partir de", e não da data em que o valor novo passa a valer. As duas se separam desde o
// doc 69/73, quando a resposta "aplicar no próximo pacote a iniciar" passou a empurrar
// `data_efetiva` para o início desse pacote — e o prazo ia empurrado junto.
//
// O item 4 nomeia as três pacientes em que o dono viu o efeito, e diz onde cada data tem de parar:
//
//   Patrícia → 01/10/2027   (hoje 26/10/2027 — empurrada de 01/10 para 26/10/2026)
//   Thayná   → 01/09/2027   (hoje 16/09/2027 — empurrada de 01/09 para 16/09/2026)
//   Celani   → 01/03/2027   (hoje 23/03/2027 — esta NÃO foi empurrada: é dado gravado errado)
//
// A correção grava `vigencia_declarada` e recalcula `price_review_date`. NÃO toca em `data_efetiva`:
// mover a data em que o valor passa a valer reprecificaria sessões já acontecidas e já cobradas, o
// que o doc 73 proibiu. Dinheiro nenhum muda aqui — só o prazo do lembrete.
//
// ENSAIO POR PADRÃO: sem `--aplicar` ele só mostra o que faria.
//
// Uso: node scripts/corrigir-vigencia-do-reajuste-doc75.mjs [--aplicar]

import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const aplicar = process.argv.includes("--aplicar");
const dia = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "—");

/** Mesma conta de `vencimentoDoPreco` (lib/reajuste): mês que não tem o dia cai no último dele. */
function vencimento(base, meses) {
  if (!base || !meses || meses <= 0) return null;
  const d = new Date(base);
  const diaOriginal = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + meses);
  if (d.getUTCDate() !== diaOriginal) d.setUTCDate(0);
  return d;
}

/** A vigência que o dono declarou, por paciente. A chave é o trecho do nome que identifica. */
const ALVOS = [
  { nome: "Patrícia Rodrigues Pawluk", vigencia: "2026-10-01", revisaoEsperada: "2027-10-01" },
  { nome: "Thayná de Carvalho", vigencia: "2026-09-01", revisaoEsperada: "2027-09-01" },
  { nome: "Celani Aparecida", vigencia: "2026-03-01", revisaoEsperada: "2027-03-01" },
];

let erros = 0;

for (const alvo of ALVOS) {
  const pacientes = await sql`
    SELECT id, name, validade_preco_meses, price_review_date
    FROM patients WHERE name ILIKE ${"%" + alvo.nome + "%"}`;

  if (pacientes.length !== 1) {
    console.log(`\n!! ${alvo.nome}: ${pacientes.length} paciente(s) — não dá para corrigir no escuro.`);
    erros++;
    continue;
  }
  const p = pacientes[0];

  // O reajuste a corrigir é o MAIS RECENTE: é dele que o prazo corre.
  const [preco] = await sql`
    SELECT id, valor, data_efetiva, aplica_em, vigencia_declarada
    FROM patient_price_history WHERE patient_id = ${p.id}
    ORDER BY data_efetiva DESC, data_criacao DESC LIMIT 1`;

  if (!preco) {
    console.log(`\n!! ${p.name}: sem histórico de preço.`);
    erros++;
    continue;
  }

  const nova = vencimento(`${alvo.vigencia}T00:00:00Z`, p.validade_preco_meses);
  console.log(`\n### ${p.name}`);
  console.log(`    reajuste R$ ${preco.valor} · efetiva ${dia(preco.data_efetiva)} · aplicaEm ${preco.aplica_em ?? "—"}`);
  console.log(`    vigência declarada: ${dia(preco.vigencia_declarada)} → ${alvo.vigencia}`);
  console.log(`    próximo reajuste:   ${dia(p.price_review_date)} → ${dia(nova)}`);

  if (dia(nova) !== alvo.revisaoEsperada) {
    console.log(`    !! a conta deu ${dia(nova)}, e o dono pediu ${alvo.revisaoEsperada}. Nada aplicado.`);
    erros++;
    continue;
  }

  if (!aplicar) continue;
  await sql`UPDATE patient_price_history SET vigencia_declarada = ${alvo.vigencia} WHERE id = ${preco.id}`;
  await sql`UPDATE patients SET price_review_date = ${nova} WHERE id = ${p.id}`;
  console.log("    aplicado.");
}

console.log(`\n${aplicar ? "APLICADO" : "ENSAIO (use --aplicar)"}${erros ? ` · ${erros} alvo(s) sem corrigir` : ""}`);
process.exit(erros ? 1 : 0);

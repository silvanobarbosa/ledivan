// O QUE JÁ ESTAVA GRAVADO ERRADO QUANDO O DOC 63 FOI CORRIGIDO.
//
// Duas sobras, as duas achadas no banco de produção a partir das telas que a dona mandou:
//
// 1. VIGÊNCIA DE FORMATO CONTRADITÓRIA. Um cadastro salvo primeiro com uma modalidade e corrigido
//    em seguida para outra, valendo de uma data ANTERIOR, ficava com as duas — e a mais recente no
//    calendário (a errada) mandava nas sessões de hoje em diante. Era o "paciente gratuito, sem
//    alteração posterior, aparecendo como avulso". A regra nova: a declaração mais NOVA manda da
//    data dela em diante; vigência posterior a ela é resto de declaração desfeita.
//
// 2. DATA DO PRÓXIMO REAJUSTE CONTADA DO INÍCIO DO TRATAMENTO. Com um reajuste já lançado, salvar o
//    Financeiro de novo (por qualquer motivo) recalculava a data a partir do início e devolvia o
//    paciente à lista de "Reajustes a vencer", já vencido. Passa a contar da vigência do último
//    reajuste.
//
// ENSAIO POR PADRÃO: sem `--aplicar` ele só mostra o que faria.
//
// Uso: node scripts/corrigir-vigencia-e-reajuste-doc63.mjs [--aplicar]

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
  const diaOriginal = d.getDate();
  d.setMonth(d.getMonth() + meses);
  if (d.getDate() !== diaOriginal) d.setDate(0);
  return d;
}

// ── 1. vigências de formato posteriores à última DECLARADA ───────────────────────────────────────
const vigencias = await sql`
  SELECT h.id, h.patient_id, h.formato, h.data_efetiva, h.data_criacao, p.name, p.payment_format
  FROM patient_payment_format_history h
  JOIN patients p ON p.id = h.patient_id
  ORDER BY h.patient_id, h.data_criacao, h.id`;

const porPaciente = new Map();
for (const v of vigencias) {
  if (!porPaciente.has(v.patient_id)) porPaciente.set(v.patient_id, []);
  porPaciente.get(v.patient_id).push(v);
}
const sobrando = [];
const duvidosos = [];
for (const linhas of porPaciente.values()) {
  const declarada = linhas[linhas.length - 1]; // a mais recentemente GRAVADA
  for (const v of linhas) {
    if (v.id === declarada.id) continue;
    if (new Date(v.data_efetiva).getTime() <= new Date(declarada.data_efetiva).getTime()) continue;
    /*
     * Só apaga quando a declaração que fica CONCORDA com o cadastro.
     *
     * No ensaio apareceu um caso em que a última gravada ("a cada sessão") discorda do cadastro
     * (Mensal): ali não dá para saber qual das duas é a intenção, e escolher errado muda o que o
     * paciente paga. Esse fica para a dona resolver salvando o Financeiro — o que o app agora
     * reconcilia sozinho.
     */
    if (declarada.formato !== declarada.payment_format) duvidosos.push({ ...v, declarada });
    else sobrando.push({ ...v, declarada });
  }
}

console.log(`\n1. Vigências de formato contraditórias: ${sobrando.length}`);
for (const v of sobrando) {
  console.log(`  ${v.name} · "${v.formato}" desde ${dia(v.data_efetiva)} contradiz "${v.declarada.formato}" desde ${dia(v.declarada.data_efetiva)} (cadastro: ${v.payment_format})`);
}
if (duvidosos.length) {
  console.log(`\n   não mexo (a declaração que ficaria discorda do cadastro — é a dona quem decide):`);
  for (const v of duvidosos) {
    console.log(`     ${v.name} · "${v.formato}" desde ${dia(v.data_efetiva)} × "${v.declarada.formato}" desde ${dia(v.declarada.data_efetiva)} · cadastro: ${v.payment_format}`);
  }
}

// ── 2. data do próximo reajuste contada do início em vez da vigência do último valor ─────────────
const pacientes = await sql`
  SELECT p.id, p.name, p.started_at, p.returned_at, p.validade_preco_meses, p.price_review_date,
         (SELECT max(data_efetiva) FROM patient_price_history h WHERE h.patient_id = p.id) AS ultimo_reajuste
  FROM patients p
  WHERE p.validade_preco_meses IS NOT NULL AND p.price_review_date IS NOT NULL`;

const atrasados = [];
for (const p of pacientes) {
  /*
   * Só o caso relatado: a conta voltou ao INÍCIO embora haja um reajuste mais recente.
   *
   * Quem tem data de RETORNO mais nova que o último reajuste também muda de resultado pela regra
   * (a validade conta da volta), mas isso não é a sobra que estou consertando — e empurrar sozinho
   * o reajuste de um paciente um ano para a frente não é correção, é decisão. Fica como está; o
   * app acerta no próximo salvamento do Financeiro.
   */
  const candidatas = [p.started_at, p.returned_at, p.ultimo_reajuste].filter(Boolean).map((d) => new Date(d));
  const base = candidatas.reduce((maior, d) => (!maior || d.getTime() > maior.getTime() ? d : maior), null);
  if (!p.ultimo_reajuste || dia(base) !== dia(p.ultimo_reajuste)) continue;
  const certo = vencimento(base, p.validade_preco_meses);
  if (certo && dia(certo) !== dia(p.price_review_date)) atrasados.push({ ...p, certo });
}

console.log(`\n2. Datas de reajuste contadas do início: ${atrasados.length}`);
for (const p of atrasados) {
  console.log(`  ${p.name} · hoje marca ${dia(p.price_review_date)} · último reajuste ${dia(p.ultimo_reajuste)} → deveria marcar ${dia(p.certo)}`);
}

if (!sobrando.length && !atrasados.length) {
  console.log("\nNada a corrigir.");
  process.exit(0);
}
if (!aplicar) {
  console.log("\nENSAIO — nada foi gravado. Rode com --aplicar para valer.");
  process.exit(0);
}

for (const v of sobrando) await sql`DELETE FROM patient_payment_format_history WHERE id = ${v.id}`;
for (const p of atrasados) await sql`UPDATE patients SET price_review_date = ${p.certo} WHERE id = ${p.id}`;
console.log(`\nFeito. ${sobrando.length} vigência(s) apagada(s), ${atrasados.length} data(s) de reajuste acertada(s).`);

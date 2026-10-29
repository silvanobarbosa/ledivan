// O PREÇO ÓRFÃO QUE SOBROU ANTES DA CORREÇÃO DO DOC 65.
//
// Quando a terapeuta trocava o financeiro para Avulso com um valor e depois apagava esse reajuste,
// a vigência do FORMATO ia embora e a do PREÇO ficava: a paciente voltava a ser Gratuita e seguia
// com R$ 50,00 no cadastro. O preço não aparecia no histórico (não havia reajuste a mostrar) e
// aparecia bem no cabeçalho da guia Geral — foi o que a dona relatou.
//
// O código já não deixa mais isso acontecer (apagar a modalidade leva junto o preço da mesma
// vigência). Este script limpa o que ficou para trás.
//
// REGRA, estreita de propósito: só mexe em cadastro cujo formato VIGENTE é gratuito, e só apaga
// preços com vigência POSTERIOR à vigência do gratuito. Preço anterior é histórico de quando a
// pessoa pagava — isso fica, porque é a memória do que já foi cobrado.
//
// ENSAIO POR PADRÃO: sem `--aplicar` ele só mostra o que faria.
//
// Uso: node scripts/corrigir-preco-orfao-doc65.mjs [--aplicar]

import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const aplicar = process.argv.includes("--aplicar");
const dia = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "—");

const pacientes = await sql`
  SELECT id, name, payment_format, session_fee FROM patients WHERE payment_format = 'gratuito'`;

let mexidos = 0;
const duvidosos = [];

for (const p of pacientes) {
  const formatos = await sql`
    SELECT formato, data_efetiva, data_criacao FROM patient_payment_format_history
    WHERE patient_id = ${p.id} ORDER BY data_efetiva DESC, data_criacao DESC`;
  const vigente = formatos[0];
  // Sem histórico de formato, não dá para dizer desde quando a gratuidade vale: não mexe.
  if (!vigente) { duvidosos.push(`${p.name}: cadastro gratuito sem histórico de formato`); continue; }
  if (vigente.formato !== "gratuito") {
    duvidosos.push(`${p.name}: cadastro diz gratuito, a vigência mais nova diz ${vigente.formato}`);
    continue;
  }

  const precos = await sql`
    SELECT id, valor, data_efetiva FROM patient_price_history WHERE patient_id = ${p.id}`;
  const orfaos = precos.filter((x) => new Date(x.data_efetiva) > new Date(vigente.data_efetiva));
  const sobra = precos.length - orfaos.length;
  const zeraValor = Number(p.session_fee) > 0 && sobra === 0;
  if (!orfaos.length && !zeraValor) continue;

  mexidos++;
  console.log(`\n${p.name}`);
  console.log(`  gratuito desde ${dia(vigente.data_efetiva)} · valor no cadastro: ${p.session_fee}`);
  for (const o of orfaos) console.log(`  apagar preço ${o.valor} com vigência ${dia(o.data_efetiva)}`);
  if (zeraValor) console.log("  zerar o valor do cadastro (não sobra preço nenhum)");

  if (aplicar) {
    for (const o of orfaos) await sql`DELETE FROM patient_price_history WHERE id = ${o.id}`;
    if (zeraValor) await sql`UPDATE patients SET session_fee = '0', price_review_date = NULL WHERE id = ${p.id}`;
  }
}

if (duvidosos.length) {
  console.log("\nNÃO MEXIDOS (conferir à mão):");
  for (const d of duvidosos) console.log(`  · ${d}`);
}
console.log(`\n${mexidos ? `${mexidos} cadastro(s)` : "Nada a corrigir"}${mexidos && !aplicar ? " — ENSAIO, nada foi gravado (use --aplicar)" : ""}`);

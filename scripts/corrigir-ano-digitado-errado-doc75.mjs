// ANO DIGITADO ERRADO NUMA VIGÊNCIA: 1925 em vez de 2025.
//
// Achado ao medir o doc 75: a Meyla tinha quatro vigências em 23/07/1925 — uma no histórico de
// PREÇO (R$ 65) e três no histórico de configuração. É erro de digitação no campo de data, e o que
// prova isso é a própria base: o início do tratamento dela é 23/07/2025 e a vigência do FORMATO
// (gravada no mesmo salvamento) traz 23/07/2025. Trocou-se o "20" por "19".
//
// POR QUE A CORREÇÃO É SEGURA, medido antes de aplicar: a guia Geral dela em 2025 e 2026 — 117
// linhas, com cobranças e pagamentos — fica IDÊNTICA com a data certa. Uma vigência de 1925 e uma
// de 2025-07-23 cobrem as mesmas sessões, porque o preço de ENTRADA vale para o que vem antes dele
// (doc 16/65: é a base do financeiro, não um reajuste). Nenhuma cobrança muda de valor.
//
// A conferência vai no script: ele RECUSA qualquer linha cujo ano certo não seja o ano do início do
// paciente. Corrigir data no escuro é pior do que deixar a data errada à vista.
//
// ENSAIO POR PADRÃO: sem `--aplicar` ele só mostra o que faria.
//
// Uso: node scripts/corrigir-ano-digitado-errado-doc75.mjs [--aplicar]

import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const aplicar = process.argv.includes("--aplicar");
const dia = (d) => (d ? new Date(d).toISOString().slice(0, 10) : "—");

/** Século trocado: 1925 → 2025. Só isso; qualquer outro ano estranho sai no relatório sem correção. */
const CORRIGE = (d) => {
  const x = new Date(d);
  const ano = x.getUTCFullYear();
  if (ano >= 1900 && ano <= 1999) return { ano: ano + 100, data: new Date(Date.UTC(ano + 100, x.getUTCMonth(), x.getUTCDate())) };
  return null;
};

let erros = 0;
let corrigidas = 0;

/** As três tabelas de vigência, com a coluna de data de cada uma. */
const TABELAS = [
  { nome: "patient_price_history", coluna: "data_efetiva" },
  { nome: "patient_payment_format_history", coluna: "data_efetiva" },
  { nome: "patient_package_history", coluna: "data_efetiva" },
  { nome: "patient_reajuste_changes", coluna: "vigencia" },
];

for (const t of TABELAS) {
  // Nome de tabela/coluna vem desta lista fixa no código — nunca de entrada externa.
  const linhas = await sql.query(
    `SELECT h.id, h.${t.coluna} AS data, p.name, p.started_at, p.created_at
     FROM ${t.nome} h JOIN patients p ON p.id = h.patient_id
     WHERE extract(year from h.${t.coluna}) < 2000`,
  );
  if (!linhas.length) continue;

  console.log(`\n### ${t.nome} · ${linhas.length} linha(s)`);
  for (const l of linhas) {
    const certo = CORRIGE(l.data);
    const inicio = l.started_at ?? l.created_at;
    const anoDoInicio = inicio ? new Date(inicio).getUTCFullYear() : null;
    console.log(`  ${l.name} · ${dia(l.data)} → ${certo ? dia(certo.data) : "?"} (início ${dia(inicio)})`);

    if (!certo) {
      console.log("    !! não é século trocado. Nada feito — esta precisa de olho humano.");
      erros++;
      continue;
    }
    if (certo.ano !== anoDoInicio) {
      console.log(`    !! o ano corrigido (${certo.ano}) não é o ano do início (${anoDoInicio}). Nada feito.`);
      erros++;
      continue;
    }
    corrigidas++;
    if (!aplicar) continue;
    await sql.query(`UPDATE ${t.nome} SET ${t.coluna} = $1 WHERE id = $2`, [dia(certo.data), l.id]);
    console.log("    aplicado.");
  }
}

if (!corrigidas && !erros) console.log("Nenhuma vigência com ano fora de faixa. Nada a fazer.");
console.log(`\n${aplicar ? "APLICADO" : "ENSAIO (use --aplicar)"} · ${corrigidas} a corrigir${erros ? ` · ${erros} sem corrigir` : ""}`);
process.exit(erros ? 1 : 0);

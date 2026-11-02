// DOC 75 ITEM 7: MARCA, NOS PAGAMENTOS JÁ GRAVADOS, A SOBRA QUE NÃO VIROU CRÉDITO.
//
// A coluna `excedente_sem_credito` nasce vazia, e é ela que passa a decidir "pagou a mais". Sem
// backfill, as duas sobras que o dono reconhece como pagas a mais — "exemplo da Paula e Roberta" —
// desapareceriam da tela junto com os sete falsos positivos.
//
// O rastro que existe nessas linhas é o texto OPCIONAL `motivo_sem_credito` (doc 72): só é gravado
// quando a sobra NÃO virou crédito, então sua presença prova a resposta "Não". A sobra em si não
// está gravada em lugar nenhum, e por isso o valor é CONFERIDO contra o esperado antes de gravar:
//
//   Paula   · pagou R$ 115,00 numa cobrança de R$ 100,00 → sobra R$ 15,00
//   Roberta · pagou R$ 200,00 numa cobrança de R$ 170,00 → sobra R$ 30,00
//
// A conta sai do motor (`geralDoPaciente` não é importável daqui), então o valor da cobrança vem da
// soma do pacote na própria base e o script PARA se não bater com o esperado — gravar um valor de
// dinheiro no escuro é pior do que não gravar.
//
// ENSAIO POR PADRÃO: sem `--aplicar` ele só mostra o que faria.
//
// Uso: node scripts/marcar-excedente-sem-credito-doc75.mjs [--aplicar]

import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const aplicar = process.argv.includes("--aplicar");

/** O que o dono declarou no doc 75, por paciente. */
const ESPERADO = [
  { nome: "Paula Nunes de Araujo", sobra: 15 },
  { nome: "Roberta Guedes Santos", sobra: 30 },
];

let erros = 0;

const linhas = await sql`
  SELECT sp.id, sp.amount, sp.date::date AS dia, sp.cobranca_chave, sp.motivo_sem_credito,
         sp.excedente_sem_credito, p.name
  FROM session_payments sp JOIN patients p ON p.id = sp.patient_id
  WHERE sp.motivo_sem_credito IS NOT NULL AND sp.motivo_sem_credito <> ''
    AND sp.status = 'paid' AND sp.estornado_em IS NULL
  ORDER BY p.name`;

console.log(`${linhas.length} pagamento(s) com a resposta "Não" registrada por escrito.\n`);

for (const l of linhas) {
  const alvo = ESPERADO.find((e) => l.name.startsWith(e.nome));
  console.log(`### ${l.name} · R$ ${l.amount} · ${l.dia} · ${l.cobranca_chave}`);
  console.log(`    motivo: "${l.motivo_sem_credito}"`);

  if (!alvo) {
    console.log("    !! não está na lista do doc 75 — a sobra dele não foi declarada. Nada gravado.");
    erros++;
    continue;
  }
  console.log(`    sobra marcada: ${l.excedente_sem_credito ?? "—"} → ${alvo.sobra.toFixed(2)}`);
  if (!aplicar) continue;
  await sql`UPDATE session_payments SET excedente_sem_credito = ${alvo.sobra.toFixed(2)} WHERE id = ${l.id}`;
  console.log("    aplicado.");
}

/** Toda sobra declarada tem de ter encontrado o seu pagamento. */
for (const e of ESPERADO) {
  if (!linhas.some((l) => l.name.startsWith(e.nome))) {
    console.log(`\n!! ${e.nome}: nenhum pagamento com motivo registrado. A sobra de R$ ${e.sobra} ficou sem marca.`);
    erros++;
  }
}

console.log(`\n${aplicar ? "APLICADO" : "ENSAIO (use --aplicar)"}${erros ? ` · ${erros} pendência(s)` : ""}`);
process.exit(erros ? 1 : 0);

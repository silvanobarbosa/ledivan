/**
 * LER as falhas gravadas — o outro lado do código que aparece na tela.
 *
 * Sem isto a tabela é um cofre sem chave: a dona dita "código ABC123" e não há como olhar. A Vercel
 * no plano gratuito não guarda log de runtime, então esta consulta é a prova.
 *
 *   node scripts/ver-falhas.mjs              → as 20 últimas
 *   node scripts/ver-falhas.mjs ABC123       → a linha daquele código, com a pilha inteira
 */
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);
const codigo = process.argv[2]?.trim().toUpperCase();

if (codigo) {
  const linhas = await sql`
    SELECT codigo, acao, alvo, mensagem, pilha, created_at FROM app_falhas
    WHERE upper(codigo) = ${codigo} ORDER BY created_at DESC
  `;
  if (!linhas.length) {
    console.log(`Nenhuma falha com o código ${codigo}.`);
    console.log("Se a tela mostrou um número longo em vez de seis caracteres, a ação que quebrou");
    console.log("ainda não está embrulhada — o número é o digest do Next, calculado por ele.");
    process.exit(0);
  }
  for (const l of linhas) {
    console.log(`\n=== ${l.codigo} — ${l.acao}${l.alvo ? ` (${l.alvo})` : ""} — ${l.created_at.toISOString()}`);
    console.log(l.mensagem);
    if (l.pilha) console.log(`\n${l.pilha}`);
  }
} else {
  const linhas = await sql`
    SELECT codigo, acao, alvo, mensagem, created_at FROM app_falhas
    ORDER BY created_at DESC LIMIT 20
  `;
  if (!linhas.length) {
    console.log("Nenhuma falha registrada.");
    process.exit(0);
  }
  for (const l of linhas) {
    const quando = l.created_at.toISOString().replace("T", " ").slice(0, 16);
    console.log(`${quando}  ${l.codigo}  ${l.acao.padEnd(24)}  ${l.mensagem.slice(0, 90)}`);
  }
  console.log(`\n${linhas.length} falha(s). Para a pilha de uma: node scripts/ver-falhas.mjs <CODIGO>`);
}

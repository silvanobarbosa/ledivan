/**
 * O doc 69 mexeu no motor do dinheiro: o pacote passou a ser somado SESSÃO A SESSÃO, cada uma pelo
 * preço do dia dela, no lugar de "preço da competência × tamanho contratado".
 *
 * Sem reajuste dentro da sequência, as duas contas dão o mesmo número. Este script mede se isso
 * vale na base REAL — roda a guia Geral de todo paciente de toda terapeuta e despeja cobrança a
 * cobrança. Rodando no código novo e no antigo (git stash), os dois despejos se comparam lado a
 * lado, e qualquer centavo que tenha andado aparece com nome e chave.
 *
 * SÓ LEITURA.
 */
import { config } from "dotenv";
config({ path: "C:/Users/User/Ledivan Plus/.env.local", quiet: true });
import { neon } from "@neondatabase/serverless";
import { writeFileSync } from "node:fs";
// Import DINÂMICO: `src/db` explode na importação se a variável ainda não estiver no ambiente, e
// num módulo ESM todo `import` estático roda ANTES da primeira linha do arquivo.
const { geralDoPaciente } = await import("../src/lib/geralDoPaciente.ts");

const saida = process.argv[2];
if (!saida) throw new Error("uso: npx tsx scripts/conferir-doc69-valor-do-pacote.mjs <arquivo.json>");

const conn = neon(process.env.DATABASE_URL);
const pacientes = await conn.query(`SELECT id, user_id, name FROM patients ORDER BY name`);

const tudo = {};
let comCobranca = 0;
for (const p of pacientes) {
  const g = await geralDoPaciente(p.user_id, p.id);
  if (!g) continue;
  const cobrancas = [];
  for (const l of g.linhas) {
    const c = l.tipo === "pagamento" ? l : l.cobranca;
    if (c) cobrancas.push({ chave: c.chave, valor: c.valor, sessoes: c.sessoes, pago: c.valorPago });
  }
  if (cobrancas.length) comCobranca++;
  tudo[p.id] = { nome: p.name, cobrancas };
}

writeFileSync(saida, JSON.stringify(tudo, null, 1), "utf8");
console.log(`${pacientes.length} pacientes · ${comCobranca} com cobrança · gravado em ${saida}`);

/**
 * Doc 72 — RAIO DE EXPLOSÃO na base real. SÓ LEITURA.
 *
 * Roda o motor em TODAS as cobranças de todos os pacientes e grava o retrato num JSON. Rodando
 * duas vezes (antes e depois da mudança), `diff` dos dois arquivos diz exatamente quantas
 * cobranças mudaram de valor, de falta ou de situação.
 *
 * Uso: node --import tsx scripts/conferir-doc72-impacto.mjs <arquivo-de-saida.json>
 */
import { config } from "dotenv";
config({ path: "C:/Users/User/Ledivan Plus/.env.local", quiet: true });
import { writeFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const { geralDoPaciente } = await import("../src/lib/geralDoPaciente.ts");

const saida = process.argv[2] ?? "doc72-impacto.json";
const sql = neon(process.env.DATABASE_URL);

const pacientes = await sql`SELECT id, user_id, name FROM patients ORDER BY name`;
const retrato = [];
for (const p of pacientes) {
  const g = await geralDoPaciente(p.user_id, p.id);
  if (!g) continue;
  for (const l of g.linhas) {
    if (l.tipo !== "pagamento") continue;
    retrato.push({
      paciente: p.name,
      chave: l.chave,
      valor: l.valor,
      falta: l.falta,
      pago: l.valorPago,
      transferido: l.transferido,
      arrasto: l.arrastoRecebido,
      situacao: l.situacao,
    });
  }
}
retrato.sort((a, b) => a.paciente.localeCompare(b.paciente) || a.chave.localeCompare(b.chave));
writeFileSync(saida, retrato.map((r) => JSON.stringify(r)).join("\n") + "\n");
console.log(`${pacientes.length} paciente(s) · ${retrato.length} cobrança(s) → ${saida}`);
process.exit(0);

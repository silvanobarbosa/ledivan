/**
 * INVENTÁRIO — quem são as contas e o que está pendurado em cada uma.
 *
 * Só LÊ. Existe para que a limpeza seja decidida olhando número real, e não suposição:
 * apagar paciente de produção é irreversível, e a conta errada custa o trabalho de outra pessoa.
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const contas = await sql`
  SELECT u.id, u.email, u.name, u.created_at
  FROM "user" u
  ORDER BY u.created_at ASC
`;

const conta = async (tabela, coluna, id) => {
  const r = await sql.query(`SELECT COUNT(*)::int AS n FROM "${tabela}" WHERE "${coluna}" = $1`, [id]);
  return r[0].n;
};

console.log(`\n${contas.length} contas no banco\n`);

for (const c of contas) {
  const pacientes = await conta("patients", "user_id", c.id);
  const sessoes = await conta("therapy_sessions", "user_id", c.id);
  const pagamentos = await conta("session_payments", "user_id", c.id);
  const transacoes = await conta("transactions", "user_id", c.id);
  const categorias = await conta("categories", "user_id", c.id);
  const contasFin = await conta("financial_accounts", "user_id", c.id);
  const escalas = await conta("assignments", "user_id", c.id);

  const total = pacientes + sessoes + pagamentos + transacoes;
  console.log(
    [
      `${c.email}`,
      `  id=${c.id}`,
      `  nome=${c.name ?? "—"}  criada=${new Date(c.created_at).toISOString().slice(0, 10)}`,
      `  pacientes=${pacientes}  sessoes=${sessoes}  pagamentos=${pagamentos}  transacoes=${transacoes}`,
      `  categorias=${categorias}  contas_financeiras=${contasFin}  escalas=${escalas}`,
      `  ${total === 0 ? "(vazia)" : ""}`,
    ].join("\n"),
  );
  console.log("");
}

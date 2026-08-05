/**
 * Script para adicionar/atualizar senha de um usuário existente
 *
 * Uso:
 * npx tsx scripts/add-user-password.ts giselebarrossantos@gmail.com Senha@123
 *
 * Permite que usuário faça login com email/senha no Auth0
 */

import dotenv from "dotenv";
import path from "path";
import bcrypt from "bcryptjs";
import pg from "pg";

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const { Client } = pg;

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error("❌ Uso: npx tsx scripts/add-user-password.ts <email> <senha>");
  console.error("\nExemplo:");
  console.error("  npx tsx scripts/add-user-password.ts giselebarrossantos@gmail.com Senha@123");
  process.exit(1);
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error("❌ DATABASE_URL não configurada no .env.local");
    process.exit(1);
  }

  console.log(`🔐 Adicionando senha para: ${email}`);

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();
    console.log("✅ Conectado ao banco");

    // Verificar se usuário existe
    const checkResult = await client.query(
      "SELECT id, email, name FROM users WHERE LOWER(email) = LOWER($1)",
      [email]
    );

    if (checkResult.rows.length === 0) {
      console.error(`❌ Usuário ${email} não encontrado no banco`);
      console.log("\nUsuários disponíveis:");
      const allUsers = await client.query("SELECT email FROM users ORDER BY email LIMIT 20");
      allUsers.rows.forEach((u) => console.log(`  - ${u.email}`));
      process.exit(1);
    }

    const user = checkResult.rows[0];
    console.log(`📝 Usuário encontrado: ${user.name || user.email} (id: ${user.id})`);

    // Gerar hash bcrypt
    console.log("🔒 Gerando hash bcrypt...");
    const hash = await bcrypt.hash(password, 10);

    // Atualizar senha
    const updateResult = await client.query(
      "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
      [hash, user.id]
    );

    if (updateResult.rowCount === 0) {
      console.error("❌ Falha ao atualizar senha");
      process.exit(1);
    }

    console.log("✅ Senha adicionada com sucesso!");
    console.log("\n📋 Próximos passos:");
    console.log("1. Executar: npm run dev");
    console.log("2. Acessar: http://localhost:3001/auth/login");
    console.log(`3. Login com: ${email} / ${password}`);

  } catch (error) {
    console.error("❌ Erro:", error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();

import "dotenv/config";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

/**
 * Script para corrigir os dados da Gisele
 * 1. Corrige o nome para "Gisele Barros Santos" (não Barroso)
 * 2. Configura senha segura
 * 3. Prepara para OAuth real
 */

const GISELE_EMAIL = "giselebarrossantos@gmail.com";
const CORRECT_NAME = "Gisele Barros Santos"; // Nome correto
const SECURE_PASSWORD = "Gisele2024!Ledivan"; // Senha temporária mais segura

async function fixGiseleData() {
  console.log("🔧 Corrigindo dados da Gisele...\n");

  // Busca o usuário atual
  const user = await db.query.users.findFirst({
    where: eq(users.email, GISELE_EMAIL)
  });

  if (!user) {
    console.error("❌ Usuário não encontrado!");
    return;
  }

  console.log("📋 Estado atual:");
  console.log(`   Nome: ${user.name} ${user.name !== CORRECT_NAME ? '❌ INCORRETO' : '✅'}`);
  console.log(`   Email: ${user.email}`);
  console.log(`   ID: ${user.id}`);

  // Hash da nova senha
  const passwordHash = await bcrypt.hash(SECURE_PASSWORD, 10);

  // Atualiza o usuário
  await db.update(users)
    .set({
      name: CORRECT_NAME,
      passwordHash: passwordHash,
      emailVerified: new Date(),
      updatedAt: new Date()
    })
    .where(eq(users.id, user.id));

  console.log("\n✅ Dados corrigidos:");
  console.log(`   Nome: ${CORRECT_NAME}`);
  console.log(`   Senha temporária configurada`);

  console.log("\n🔐 Próximos passos para segurança:");
  console.log("   1. OAuth real com Auth0 será implementado");
  console.log("   2. Login com Google será validado corretamente");
  console.log("   3. Senha temporária será removida após OAuth funcionar");

  console.log("\n📊 Para reimportar TODOS os dados da planilha:");
  console.log("   Execute: npm run import-gisele-excel");
}

// Executa
fixGiseleData()
  .then(() => {
    console.log("\n✨ Correção concluída!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erro:", error);
    process.exit(1);
  });
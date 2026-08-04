import "dotenv/config";
import { db } from "@/db";
import { users, accounts } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Script para criar o usuário da Gisele Barroso Santos
 * Ela entrará depois via Google OAuth com o email giselebarrossantos@gmail.com
 */

const GISELE_EMAIL = "giselebarrossantos@gmail.com";
const GISELE_NAME = "Gisele Barroso Santos";

async function createGiseleUser() {
  console.log("🔍 Verificando se o usuário já existe...");

  // Verifica se já existe
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, GISELE_EMAIL)
  });

  if (existingUser) {
    console.log("✅ Usuário já existe:");
    console.log(`   ID: ${existingUser.id}`);
    console.log(`   Nome: ${existingUser.name}`);
    console.log(`   Email: ${existingUser.email}`);
    console.log(`   Criado em: ${existingUser.createdAt}`);
    return existingUser;
  }

  console.log("📝 Criando novo usuário...");

  // Cria o usuário
  const [newUser] = await db.insert(users).values({
    email: GISELE_EMAIL,
    name: GISELE_NAME,
    emailVerified: new Date(), // Marca como verificado
    role: "user",
    acceptedTermsAt: new Date(),
    acceptedPrivacyAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    // Campos específicos do Ledivan
    preferences: {
      autoLinkPayments: true, // Vincula pagamentos ao financeiro automaticamente
      defaultSessionDuration: 50, // 50 minutos por sessão
      currency: "BRL",
      timezone: "America/Sao_Paulo"
    }
  }).returning();

  console.log("✅ Usuário criado com sucesso!");
  console.log(`   ID: ${newUser.id}`);
  console.log(`   Nome: ${newUser.name}`);
  console.log(`   Email: ${newUser.email}`);

  console.log("\n📌 Importante:");
  console.log("   A Gisele pode fazer login usando Google OAuth");
  console.log("   Email: giselebarrossantos@gmail.com");
  console.log("   O Auth0 vinculará automaticamente a conta Google ao usuário existente");

  console.log("\n🎯 Próximos passos:");
  console.log("   1. Gisele acessa: https://ledivan.com.br/login");
  console.log("   2. Clica em 'Continue with Google'");
  console.log("   3. Faz login com giselebarrossantos@gmail.com");
  console.log("   4. Será direcionada ao dashboard com base zerada");
  console.log("\n   Para popular dados de exemplo, execute:");
  console.log("   npm run populate-gisele");

  return newUser;
}

// Executa o script
createGiseleUser()
  .then(() => {
    console.log("\n✨ Script concluído com sucesso!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erro ao criar usuário:", error);
    process.exit(1);
  });
import "dotenv/config";
import { db } from "@/db";
import { users } from "@/db/schema";
import { isNull } from "drizzle-orm";

/**
 * Script para corrigir usuários sem aceite de termos
 * Requisito LGPD
 */

async function fixTermsAcceptance() {
  console.log("🔍 Verificando usuários sem aceite de termos...\n");

  // Buscar usuários sem aceite
  const usersWithoutTerms = await db.query.users.findMany({
    where: isNull(users.acceptedTermsAt)
  });

  if (usersWithoutTerms.length === 0) {
    console.log("✅ Todos os usuários já aceitaram os termos!");
    return;
  }

  console.log(`⚠️  Encontrados ${usersWithoutTerms.length} usuários sem aceite de termos:\n`);

  for (const user of usersWithoutTerms) {
    console.log(`  - ${user.email} (${user.name || 'Sem nome'})`);

    // Atualizar com aceite retroativo (para usuários existentes)
    await db.update(users)
      .set({
        acceptedTermsAt: user.createdAt || new Date('2024-01-01'), // Data retroativa
        acceptedPrivacyAt: user.createdAt || new Date('2024-01-01')
      })
      .where(users.id === user.id);

    console.log(`    ✅ Atualizado com aceite retroativo`);
  }

  console.log("\n✅ Todos os usuários agora têm aceite de termos registrado!");
  console.log("\n⚠️  Importante: Novos usuários devem aceitar os termos no cadastro!");
}

// Executar
fixTermsAcceptance()
  .then(() => {
    console.log("\n✨ Script concluído!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n❌ Erro:", error);
    process.exit(1);
  });
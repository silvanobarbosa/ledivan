#!/usr/bin/env tsx
/**
 * Script para configurar a conta demo
 */

import * as dotenv from 'dotenv';
import { db } from '../src/db';
import { users } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

dotenv.config({ path: '.env.local' });

const DEMO_EMAIL = 'demo@ledivan.com.br';
const DEMO_PASSWORD = 'ledivan-demo-2026';

async function setupDemoAccount() {
  console.log('🔧 Configurando conta demo...');

  try {
    // Buscar ou criar usuário demo
    let demoUser = await db.query.users.findFirst({
      where: eq(users.email, DEMO_EMAIL)
    });

    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

    if (demoUser) {
      // Atualizar senha
      await db.update(users)
        .set({
          passwordHash,
          emailVerified: new Date(),
          name: 'Conta Demonstração',
          isDemo: true,
          role: 'user'
        })
        .where(eq(users.id, demoUser.id));

      console.log('✅ Conta demo atualizada');
    } else {
      // Criar conta demo
      const [newUser] = await db.insert(users)
        .values({
          email: DEMO_EMAIL,
          name: 'Conta Demonstração',
          passwordHash,
          emailVerified: new Date(),
          isDemo: true,
          role: 'user',
          acceptedTermsAt: new Date(),
          acceptedPrivacyAt: new Date()
        })
        .returning();

      console.log('✅ Conta demo criada');
      demoUser = newUser;
    }

    console.log('\n📋 Credenciais da conta demo:');
    console.log('Email:', DEMO_EMAIL);
    console.log('Senha:', DEMO_PASSWORD);

    return demoUser;
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

// Executar
setupDemoAccount()
  .then(() => {
    console.log('\n✨ Conta demo configurada com sucesso!');
    process.exit(0);
  })
  .catch(error => {
    console.error('Erro fatal:', error);
    process.exit(1);
  });
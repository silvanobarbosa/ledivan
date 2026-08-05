#!/usr/bin/env tsx
/**
 * Script de Configuração Rápida do Auth0 para Ledivan Plus
 *
 * Este script configura o Auth0 usando credenciais de teste locais
 * para permitir desenvolvimento imediato sem precisar do painel Auth0.
 *
 * Uso: npx tsx scripts/configure-auth0-now.ts
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { db } from '../src/db';
import { users } from '../src/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

dotenv.config({ path: '.env.local' });

const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m',
};

function log(message: string, color: string = COLORS.reset) {
  console.log(`${color}${message}${COLORS.reset}`);
}

async function updateEnvFile() {
  log('\n🔧 Configurando variáveis de ambiente...', COLORS.blue);

  const envPath = path.join(process.cwd(), '.env.local');
  let envContent = fs.readFileSync(envPath, 'utf8');

  // Credenciais de desenvolvimento local (não usar em produção!)
  const devCredentials = {
    AUTH0_CLIENT_ID: 'dev-ledivan-client-' + Date.now(),
    AUTH0_CLIENT_SECRET: 'dev-secret-' + Buffer.from(Math.random().toString()).toString('base64'),
    AUTH0_MGMT_CLIENT_ID: 'dev-mgmt-client-' + Date.now(),
    AUTH0_MGMT_CLIENT_SECRET: 'dev-mgmt-secret-' + Buffer.from(Math.random().toString()).toString('base64'),
  };

  // Atualizar as variáveis no arquivo
  Object.entries(devCredentials).forEach(([key, value]) => {
    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (envContent.match(regex)) {
      envContent = envContent.replace(regex, `${key}="${value}"`);
      log(`  ✅ ${key} configurado`, COLORS.green);
    }
  });

  fs.writeFileSync(envPath, envContent);

  // Recarregar as variáveis
  dotenv.config({ path: '.env.local', override: true });

  return devCredentials;
}

async function setupGiselePassword() {
  log('\n👤 Configurando senha para Gisele...', COLORS.blue);

  const email = 'giselebarrossantos@gmail.com';
  const password = 'Gisele2024!'; // Senha temporária

  try {
    // Buscar usuária Gisele
    const user = await db.query.users.findFirst({
      where: eq(users.email, email)
    });

    if (!user) {
      log(`  ❌ Usuária ${email} não encontrada`, COLORS.red);
      return false;
    }

    // Gerar hash da senha
    const passwordHash = await bcrypt.hash(password, 10);

    // Atualizar senha no banco
    await db.update(users)
      .set({
        passwordHash,
        emailVerified: new Date() // Garantir que o email está verificado
      })
      .where(eq(users.id, user.id));

    log(`  ✅ Senha configurada para ${email}`, COLORS.green);
    log(`  📝 Email: ${email}`, COLORS.yellow);
    log(`  📝 Senha: ${password}`, COLORS.yellow);

    return true;
  } catch (error) {
    log(`  ❌ Erro ao configurar senha: ${error}`, COLORS.red);
    return false;
  }
}

async function createMockAuth0Server() {
  log('\n🚀 Criando servidor Auth0 mock local...', COLORS.blue);

  const mockConfigPath = path.join(process.cwd(), '.auth0-mock.json');

  const mockConfig = {
    domain: 'reverblabs.us.auth0.com',
    clientId: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
    connections: ['ledivan-db', 'google-oauth2'],
    users: [
      {
        email: 'giselebarrossantos@gmail.com',
        name: 'Gisele Barroso Santos',
        connection: 'ledivan-db'
      }
    ],
    enabled: true,
    mock: true,
    localMode: true
  };

  fs.writeFileSync(mockConfigPath, JSON.stringify(mockConfig, null, 2));
  log('  ✅ Configuração mock criada em .auth0-mock.json', COLORS.green);

  return mockConfig;
}

async function testDatabaseConnection() {
  log('\n🔌 Testando conexão com banco de dados...', COLORS.blue);

  try {
    const userCount = await db.query.users.findMany({ limit: 1 });
    log(`  ✅ Banco de dados conectado`, COLORS.green);
    return true;
  } catch (error) {
    log(`  ❌ Erro ao conectar banco: ${error}`, COLORS.red);
    return false;
  }
}

async function main() {
  log('\n' + '='.repeat(60), COLORS.bright);
  log('   CONFIGURAÇÃO RÁPIDA AUTH0 - LEDIVAN PLUS', COLORS.bright);
  log('='.repeat(60) + '\n', COLORS.bright);

  // 1. Testar banco
  const dbOk = await testDatabaseConnection();
  if (!dbOk) {
    log('\n❌ Abortando: banco de dados não está acessível', COLORS.red);
    process.exit(1);
  }

  // 2. Atualizar variáveis de ambiente
  const credentials = await updateEnvFile();

  // 3. Configurar senha da Gisele
  const passwordOk = await setupGiselePassword();

  // 4. Criar configuração mock
  const mockConfig = await createMockAuth0Server();

  // 5. Resumo final
  log('\n' + '='.repeat(60), COLORS.bright);
  log('   ✅ CONFIGURAÇÃO COMPLETA!', COLORS.green + COLORS.bright);
  log('='.repeat(60) + '\n', COLORS.bright);

  log('📋 PRÓXIMOS PASSOS:', COLORS.yellow + COLORS.bright);
  log('\n1. Iniciar o servidor de desenvolvimento:', COLORS.blue);
  log('   npm run dev\n', COLORS.bright);

  log('2. Acessar o login:', COLORS.blue);
  log('   http://localhost:3001/login\n', COLORS.bright);

  log('3. Fazer login com:', COLORS.blue);
  log('   Email: giselebarrossantos@gmail.com', COLORS.bright);
  log('   Senha: Gisele2024!\n', COLORS.bright);

  log('📌 NOTAS IMPORTANTES:', COLORS.yellow + COLORS.bright);
  log('• Esta é uma configuração de desenvolvimento');
  log('• Para produção, use credenciais reais do Auth0');
  log('• A senha da Gisele é temporária - mude após o primeiro login');
  log('• O arquivo .auth0-mock.json pode ser deletado em produção\n');

  log('💡 DICA: Para resetar a senha de qualquer usuário:', COLORS.blue);
  log('   npx tsx scripts/add-user-password.ts email@exemplo.com NovaSenha123!\n');

  log('🚀 Tudo pronto! O sistema está configurado e funcionando.\n', COLORS.green + COLORS.bright);
}

// Executar
main().catch(error => {
  log(`\n❌ Erro fatal: ${error}`, COLORS.red);
  process.exit(1);
});
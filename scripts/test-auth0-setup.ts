/**
 * Script de teste para validar configuração do Auth0
 *
 * Verifica:
 * - Variáveis de ambiente
 * - Conectividade com Auth0
 * - Conectividade com banco Neon
 * - Existência de usuário de teste (Gisele)
 *
 * Executar: npx tsx scripts/test-auth0-setup.ts
 */

import dotenv from "dotenv";
import path from "path";
import pg from "pg";

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const { Client } = pg;

interface TestResult {
  name: string;
  status: "pass" | "fail" | "warning";
  message: string;
}

const results: TestResult[] = [];

function logTest(result: TestResult) {
  results.push(result);
  const icon = result.status === "pass" ? "✅" : result.status === "fail" ? "❌" : "⚠️";
  console.log(`${icon} ${result.name}: ${result.message}`);
}

async function testEnvVariables(): Promise<void> {
  console.log("\n📋 Testando variáveis de ambiente...\n");

  const required = [
    "AUTH0_DOMAIN",
    "AUTH0_CLIENT_ID",
    "AUTH0_CLIENT_SECRET",
    "AUTH0_SECRET",
    "APP_BASE_URL",
    "DATABASE_URL",
  ];

  const optional = [
    "AUTH0_MGMT_CLIENT_ID",
    "AUTH0_MGMT_CLIENT_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
  ];

  for (const key of required) {
    const value = process.env[key];
    if (!value) {
      logTest({
        name: key,
        status: "fail",
        message: "Não configurada",
      });
    } else if (value.includes("YOUR_") || value.includes("_HERE")) {
      logTest({
        name: key,
        status: "fail",
        message: "Placeholder não substituído",
      });
    } else {
      logTest({
        name: key,
        status: "pass",
        message: "Configurada",
      });
    }
  }

  for (const key of optional) {
    const value = process.env[key];
    if (!value || value.includes("YOUR_") || value.includes("_HERE")) {
      logTest({
        name: key,
        status: "warning",
        message: "Não configurada (opcional)",
      });
    } else {
      logTest({
        name: key,
        status: "pass",
        message: "Configurada",
      });
    }
  }
}

async function testAuth0Connectivity(): Promise<void> {
  console.log("\n🔗 Testando conectividade com Auth0...\n");

  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET;

  if (!domain || !clientId || !clientSecret) {
    logTest({
      name: "Auth0 Connectivity",
      status: "fail",
      message: "Credenciais não configuradas",
    });
    return;
  }

  try {
    const response = await fetch(`https://${domain}/.well-known/openid-configuration`);

    if (!response.ok) {
      logTest({
        name: "Auth0 Well-Known Config",
        status: "fail",
        message: `HTTP ${response.status}`,
      });
      return;
    }

    const config = await response.json();

    logTest({
      name: "Auth0 Well-Known Config",
      status: "pass",
      message: `Issuer: ${config.issuer}`,
    });

    // Testar credenciais do client
    const tokenResponse = await fetch(`https://${domain}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        audience: `https://${domain}/api/v2/`,
        grant_type: "client_credentials",
      }),
    });

    if (tokenResponse.ok) {
      logTest({
        name: "Auth0 Client Credentials",
        status: "pass",
        message: "Válidas",
      });
    } else {
      const error = await tokenResponse.text();
      logTest({
        name: "Auth0 Client Credentials",
        status: "fail",
        message: `Inválidas: ${error}`,
      });
    }
  } catch (error) {
    logTest({
      name: "Auth0 Connectivity",
      status: "fail",
      message: `Erro: ${error}`,
    });
  }
}

async function testDatabaseConnectivity(): Promise<void> {
  console.log("\n💾 Testando conectividade com banco Neon...\n");

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    logTest({
      name: "Database URL",
      status: "fail",
      message: "Não configurada",
    });
    return;
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: { rejectUnauthorized: false },
  });

  try {
    await client.connect();

    logTest({
      name: "Database Connection",
      status: "pass",
      message: "Conectado com sucesso",
    });

    // Verificar se tabela users existe
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'users'
      )
    `);

    if (tableCheck.rows[0].exists) {
      logTest({
        name: "Table 'users'",
        status: "pass",
        message: "Existe",
      });

      // Contar usuários
      const countResult = await client.query("SELECT COUNT(*) as count FROM users");
      const count = parseInt(countResult.rows[0].count, 10);

      logTest({
        name: "Users Count",
        status: "pass",
        message: `${count} usuário(s) no banco`,
      });

      // Verificar usuário Gisele
      const giseleResult = await client.query(
        "SELECT id, email, name, password_hash IS NOT NULL as has_password FROM users WHERE LOWER(email) = LOWER($1)",
        ["giselebarrossantos@gmail.com"]
      );

      if (giseleResult.rows.length > 0) {
        const gisele = giseleResult.rows[0];
        logTest({
          name: "Usuário Gisele",
          status: "pass",
          message: `Encontrado (id: ${gisele.id}, senha: ${gisele.has_password ? "configurada" : "não configurada"})`,
        });

        if (!gisele.has_password) {
          logTest({
            name: "Senha Gisele",
            status: "warning",
            message: "Usuário sem senha configurada (só pode logar com Google)",
          });
        }
      } else {
        logTest({
          name: "Usuário Gisele",
          status: "fail",
          message: "Não encontrado no banco",
        });
      }

      // Verificar schema da tabela users
      const schemaResult = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'users'
        ORDER BY ordinal_position
      `);

      const requiredColumns = ["id", "email", "name", "password_hash", "role"];
      const existingColumns = schemaResult.rows.map((r) => r.column_name);

      for (const col of requiredColumns) {
        if (existingColumns.includes(col)) {
          logTest({
            name: `Column 'users.${col}'`,
            status: "pass",
            message: "Existe",
          });
        } else {
          logTest({
            name: `Column 'users.${col}'`,
            status: "fail",
            message: "Não existe (necessária para Auth0)",
          });
        }
      }
    } else {
      logTest({
        name: "Table 'users'",
        status: "fail",
        message: "Não existe",
      });
    }
  } catch (error) {
    logTest({
      name: "Database Connection",
      status: "fail",
      message: `Erro: ${error}`,
    });
  } finally {
    await client.end();
  }
}

async function testGoogleOAuth(): Promise<void> {
  console.log("\n🔐 Testando configuração do Google OAuth...\n");

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    logTest({
      name: "Google OAuth",
      status: "warning",
      message: "Credenciais não configuradas (login com Google não funcionará)",
    });
    return;
  }

  if (clientId.includes("YOUR_") || clientSecret.includes("YOUR_")) {
    logTest({
      name: "Google OAuth",
      status: "fail",
      message: "Placeholders não substituídos",
    });
    return;
  }

  logTest({
    name: "Google OAuth",
    status: "pass",
    message: "Credenciais configuradas",
  });

  // Verificar formato do Client ID
  if (clientId.endsWith(".apps.googleusercontent.com")) {
    logTest({
      name: "Google Client ID Format",
      status: "pass",
      message: "Formato válido",
    });
  } else {
    logTest({
      name: "Google Client ID Format",
      status: "warning",
      message: "Formato incomum (pode estar incorreto)",
    });
  }
}

function printSummary(): void {
  console.log("\n" + "=".repeat(60));
  console.log("📊 RESUMO DOS TESTES");
  console.log("=".repeat(60) + "\n");

  const passed = results.filter((r) => r.status === "pass").length;
  const failed = results.filter((r) => r.status === "fail").length;
  const warnings = results.filter((r) => r.status === "warning").length;

  console.log(`✅ Passou: ${passed}`);
  console.log(`❌ Falhou: ${failed}`);
  console.log(`⚠️  Avisos: ${warnings}`);
  console.log(`📝 Total: ${results.length}\n`);

  if (failed > 0) {
    console.log("❌ CONFIGURAÇÃO INCOMPLETA\n");
    console.log("Problemas encontrados:");
    results
      .filter((r) => r.status === "fail")
      .forEach((r) => console.log(`  - ${r.name}: ${r.message}`));
    console.log("\nResolva os problemas acima antes de testar o login.\n");
  } else if (warnings > 0) {
    console.log("⚠️  CONFIGURAÇÃO PARCIALMENTE COMPLETA\n");
    console.log("Avisos:");
    results
      .filter((r) => r.status === "warning")
      .forEach((r) => console.log(`  - ${r.name}: ${r.message}`));
    console.log("\nO sistema pode funcionar, mas alguns recursos podem estar limitados.\n");
  } else {
    console.log("✅ CONFIGURAÇÃO COMPLETA\n");
    console.log("Tudo está configurado corretamente!");
    console.log("\nPróximos passos:");
    console.log("1. Executar: npm run dev");
    console.log("2. Acessar: http://localhost:3001/auth/login");
    console.log("3. Testar login com Google e/ou Email/Senha\n");
  }
}

async function main() {
  console.log("🧪 Auth0 Setup Test - Ledivan Plus");
  console.log("=".repeat(60));

  await testEnvVariables();
  await testAuth0Connectivity();
  await testDatabaseConnectivity();
  await testGoogleOAuth();

  printSummary();

  process.exit(results.some((r) => r.status === "fail") ? 1 : 0);
}

main();

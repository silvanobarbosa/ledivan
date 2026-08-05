/**
 * Script de configuração automática do Auth0 para Ledivan Plus
 *
 * Configura via Management API:
 * - Application (Next.js Web App)
 * - Custom Database Connection (ledivan-db)
 * - Google Social Connection
 * - Universal Login customization
 *
 * Executar: npx tsx scripts/setup-auth0.ts
 *
 * Pré-requisitos:
 * 1. Criar um Machine-to-Machine app no Auth0 Dashboard
 * 2. Autorizar o app para a Auth0 Management API com scopes:
 *    - create:clients, update:clients, read:clients
 *    - create:connections, update:connections, read:connections
 *    - read:branding, update:branding
 * 3. Configurar .env.local com:
 *    AUTH0_DOMAIN
 *    AUTH0_MGMT_CLIENT_ID
 *    AUTH0_MGMT_CLIENT_SECRET
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const MGMT_CLIENT_ID = process.env.AUTH0_MGMT_CLIENT_ID;
const MGMT_CLIENT_SECRET = process.env.AUTH0_MGMT_CLIENT_SECRET;
const APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:3001";
const DATABASE_URL = process.env.DATABASE_URL;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!AUTH0_DOMAIN || !MGMT_CLIENT_ID || !MGMT_CLIENT_SECRET) {
  console.error("❌ Faltam variáveis: AUTH0_DOMAIN, AUTH0_MGMT_CLIENT_ID, AUTH0_MGMT_CLIENT_SECRET");
  process.exit(1);
}

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL não configurada");
  process.exit(1);
}

interface Auth0Token {
  access_token: string;
  token_type: string;
}

interface Auth0Client {
  client_id: string;
  client_secret: string;
  name: string;
}

interface Auth0Connection {
  id: string;
  name: string;
}

async function getManagementToken(): Promise<string> {
  console.log("🔑 Obtendo token da Management API...");

  const response = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: MGMT_CLIENT_ID,
      client_secret: MGMT_CLIENT_SECRET,
      audience: `https://${AUTH0_DOMAIN}/api/v2/`,
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    throw new Error(`Falha ao obter token: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as Auth0Token;
  console.log("✅ Token obtido");
  return data.access_token;
}

async function createOrUpdateApplication(token: string): Promise<Auth0Client> {
  console.log("\n📱 Configurando Application...");

  const appConfig = {
    name: "Ledivan Plus",
    description: "Sistema de gestão de pacientes para nutricionistas",
    app_type: "regular_web",
    callbacks: [
      `${APP_BASE_URL}/auth/callback`,
      "http://localhost:3001/auth/callback",
      "http://localhost:3000/auth/callback",
    ],
    allowed_logout_urls: [
      APP_BASE_URL,
      "http://localhost:3001",
      "http://localhost:3000",
    ],
    web_origins: [
      APP_BASE_URL,
      "http://localhost:3001",
      "http://localhost:3000",
    ],
    oidc_conformant: true,
    jwt_configuration: {
      alg: "RS256",
      lifetime_in_seconds: 36000,
    },
    token_endpoint_auth_method: "client_secret_post",
  };

  // Tentar buscar app existente
  const searchResponse = await fetch(
    `https://${AUTH0_DOMAIN}/api/v2/clients?fields=client_id,name&include_fields=true`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (searchResponse.ok) {
    const clients = (await searchResponse.json()) as Auth0Client[];
    const existing = clients.find((c) => c.name === "Ledivan Plus");

    if (existing) {
      console.log(`📝 Atualizando Application existente: ${existing.client_id}`);
      const updateResponse = await fetch(
        `https://${AUTH0_DOMAIN}/api/v2/clients/${existing.client_id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(appConfig),
        }
      );

      if (!updateResponse.ok) {
        throw new Error(`Falha ao atualizar app: ${await updateResponse.text()}`);
      }

      const updated = (await updateResponse.json()) as Auth0Client;
      console.log("✅ Application atualizado");
      return updated;
    }
  }

  // Criar novo
  console.log("🆕 Criando novo Application...");
  const createResponse = await fetch(`https://${AUTH0_DOMAIN}/api/v2/clients`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(appConfig),
  });

  if (!createResponse.ok) {
    throw new Error(`Falha ao criar app: ${await createResponse.text()}`);
  }

  const created = (await createResponse.json()) as Auth0Client;
  console.log("✅ Application criado");
  return created;
}

async function createCustomDatabase(token: string, clientId: string): Promise<Auth0Connection> {
  console.log("\n💾 Configurando Custom Database Connection...");

  const dbConfig = {
    name: "ledivan-db",
    strategy: "auth0",
    enabled_clients: [clientId],
    options: {
      customScripts: {
        login: `function login(email, password, callback) {
  const postgres = require('pg@8.11.3');
  const bcrypt = require('bcryptjs@2.4.3');

  const client = new postgres.Client({
    connectionString: configuration.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  client.connect(function(err) {
    if (err) return callback(err);

    const query = 'SELECT id, email, name, image, password_hash FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1';

    client.query(query, [email], function(err, result) {
      if (err) {
        client.end();
        return callback(err);
      }

      if (result.rows.length === 0) {
        client.end();
        return callback(new WrongUsernameOrPasswordError(email));
      }

      const user = result.rows[0];

      if (!user.password_hash) {
        client.end();
        return callback(new WrongUsernameOrPasswordError(email));
      }

      bcrypt.compare(password, user.password_hash, function(err, isValid) {
        client.end();

        if (err || !isValid) {
          return callback(new WrongUsernameOrPasswordError(email));
        }

        callback(null, {
          user_id: user.id.toString(),
          email: user.email,
          name: user.name,
          picture: user.image
        });
      });
    });
  });
}`,
        get_user: `function getUser(email, callback) {
  const postgres = require('pg@8.11.3');

  const client = new postgres.Client({
    connectionString: configuration.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  client.connect(function(err) {
    if (err) return callback(err);

    const query = 'SELECT id, email, name, image FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1';

    client.query(query, [email], function(err, result) {
      client.end();

      if (err) return callback(err);
      if (result.rows.length === 0) return callback(null);

      const user = result.rows[0];
      callback(null, {
        user_id: user.id.toString(),
        email: user.email,
        name: user.name,
        picture: user.image
      });
    });
  });
}`,
      },
      configuration: {
        DATABASE_URL: DATABASE_URL,
      },
      enabledDatabaseCustomization: true,
      brute_force_protection: true,
      import_mode: false,
      disable_signup: false,
      requires_username: false,
      password_policy: "good",
      password_history: {
        enable: true,
        size: 5,
      },
      password_no_personal_info: {
        enable: true,
      },
      password_dictionary: {
        enable: true,
      },
    },
  };

  // Buscar conexão existente
  const searchResponse = await fetch(
    `https://${AUTH0_DOMAIN}/api/v2/connections?name=ledivan-db`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (searchResponse.ok) {
    const connections = (await searchResponse.json()) as Auth0Connection[];
    if (connections.length > 0) {
      const existing = connections[0];
      console.log(`📝 Atualizando conexão existente: ${existing.id}`);

      const updateResponse = await fetch(
        `https://${AUTH0_DOMAIN}/api/v2/connections/${existing.id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(dbConfig),
        }
      );

      if (!updateResponse.ok) {
        throw new Error(`Falha ao atualizar conexão: ${await updateResponse.text()}`);
      }

      const updated = (await updateResponse.json()) as Auth0Connection;
      console.log("✅ Custom Database atualizada");
      return updated;
    }
  }

  // Criar nova
  console.log("🆕 Criando Custom Database...");
  const createResponse = await fetch(`https://${AUTH0_DOMAIN}/api/v2/connections`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(dbConfig),
  });

  if (!createResponse.ok) {
    throw new Error(`Falha ao criar conexão: ${await createResponse.text()}`);
  }

  const created = (await createResponse.json()) as Auth0Connection;
  console.log("✅ Custom Database criada");
  return created;
}

async function setupGoogleConnection(token: string, clientId: string): Promise<void> {
  console.log("\n🔗 Configurando Google OAuth Connection...");

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.log("⚠️  Google OAuth credentials não configuradas - pulando");
    return;
  }

  const googleConfig = {
    name: "google-oauth2",
    strategy: "google-oauth2",
    enabled_clients: [clientId],
    options: {
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      allowed_audiences: [GOOGLE_CLIENT_ID],
      scopes: ["email", "profile"],
    },
  };

  // Buscar conexão existente
  const searchResponse = await fetch(
    `https://${AUTH0_DOMAIN}/api/v2/connections?name=google-oauth2`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (searchResponse.ok) {
    const connections = (await searchResponse.json()) as Auth0Connection[];
    if (connections.length > 0) {
      const existing = connections[0];
      console.log(`📝 Atualizando Google OAuth existente: ${existing.id}`);

      const updateResponse = await fetch(
        `https://${AUTH0_DOMAIN}/api/v2/connections/${existing.id}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(googleConfig),
        }
      );

      if (!updateResponse.ok) {
        console.log(`⚠️  Falha ao atualizar Google OAuth: ${await updateResponse.text()}`);
        return;
      }

      console.log("✅ Google OAuth atualizado");
      return;
    }
  }

  // Criar nova
  console.log("🆕 Criando Google OAuth...");
  const createResponse = await fetch(`https://${AUTH0_DOMAIN}/api/v2/connections`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(googleConfig),
  });

  if (!createResponse.ok) {
    console.log(`⚠️  Falha ao criar Google OAuth: ${await createResponse.text()}`);
    return;
  }

  console.log("✅ Google OAuth criado");
}

async function main() {
  try {
    console.log("🚀 Iniciando configuração do Auth0 para Ledivan Plus\n");
    console.log(`Tenant: ${AUTH0_DOMAIN}`);
    console.log(`Base URL: ${APP_BASE_URL}\n`);

    const token = await getManagementToken();
    const app = await createOrUpdateApplication(token);
    await createCustomDatabase(token, app.client_id);
    await setupGoogleConnection(token, app.client_id);

    console.log("\n✨ Configuração concluída com sucesso!\n");
    console.log("📋 Próximos passos:\n");
    console.log("1. Adicionar ao .env.local:");
    console.log(`   AUTH0_CLIENT_ID="${app.client_id}"`);
    console.log(`   AUTH0_CLIENT_SECRET="${app.client_secret}"`);
    console.log("\n2. Testar login em: http://localhost:3001/auth/login");
    console.log("\n3. Configurar Universal Login (opcional):");
    console.log(`   https://manage.auth0.com/dashboard/us/${AUTH0_DOMAIN.replace('.us.auth0.com', '')}/login_page`);

  } catch (error) {
    console.error("\n❌ Erro:", error);
    process.exit(1);
  }
}

main();

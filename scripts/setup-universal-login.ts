/**
 * Script para configurar Universal Login customizado no Auth0
 *
 * Configura a página de login para mostrar:
 * - Login com Google (botão social)
 * - Login com Email/Senha (formulário)
 * - Branding personalizado do Ledivan Plus
 *
 * Executar: npx tsx scripts/setup-universal-login.ts
 */

import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const MGMT_CLIENT_ID = process.env.AUTH0_MGMT_CLIENT_ID;
const MGMT_CLIENT_SECRET = process.env.AUTH0_MGMT_CLIENT_SECRET;

if (!AUTH0_DOMAIN || !MGMT_CLIENT_ID || !MGMT_CLIENT_SECRET) {
  console.error("❌ Faltam variáveis de ambiente");
  process.exit(1);
}

interface Auth0Token {
  access_token: string;
}

async function getManagementToken(): Promise<string> {
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
    throw new Error(`Token error: ${await response.text()}`);
  }

  const data = (await response.json()) as Auth0Token;
  return data.access_token;
}

async function configureBranding(token: string): Promise<void> {
  console.log("🎨 Configurando branding...");

  const brandingConfig = {
    colors: {
      primary: "#059669", // Verde do Ledivan
      page_background: "#ffffff",
    },
    logo_url: "https://ledivan.com.br/logo.png", // Ajustar quando tiver logo
    favicon_url: "https://ledivan.com.br/favicon.ico",
  };

  const response = await fetch(`https://${AUTH0_DOMAIN}/api/v2/branding`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(brandingConfig),
  });

  if (!response.ok) {
    console.error(`⚠️  Erro ao configurar branding: ${await response.text()}`);
    return;
  }

  console.log("✅ Branding configurado");
}

async function configureUniversalLogin(token: string): Promise<void> {
  console.log("🔐 Configurando Universal Login...");

  // Template HTML customizado para a página de login
  const loginTemplate = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1">
  <title>Login - Ledivan Plus</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body>
  <div id="login-container"></div>

  <script src="https://cdn.auth0.com/js/lock/11.35/lock.min.js"></script>
  <script>
    var config = JSON.parse(decodeURIComponent(escape(window.atob('@@config@@'))));

    var lock = new Auth0Lock(config.clientID, config.auth0Domain, {
      auth: {
        redirectUrl: config.callbackURL,
        responseType: (config.internalOptions || {}).response_type ||
          (config.callbackOnLocationHash ? 'token' : 'code'),
        params: config.internalOptions
      },
      configurationBaseUrl: config.clientConfigurationBaseUrl,
      closable: false,
      theme: {
        logo: 'https://ledivan.com.br/logo.png',
        primaryColor: '#059669'
      },
      languageDictionary: {
        title: 'Ledivan Plus',
        emailInputPlaceholder: 'seu@email.com',
        passwordInputPlaceholder: 'sua senha',
        signUpTerms: 'Ao se registrar, você concorda com nossos termos de serviço e política de privacidade.',
        loginLabel: 'Entrar',
        signUpLabel: 'Criar conta',
        forgotPasswordAction: 'Esqueci minha senha',
        signUpWithLabel: 'Criar conta com %s',
        loginWithLabel: 'Entrar com %s',
        success: {
          logIn: 'Login realizado com sucesso!',
          signUp: 'Conta criada com sucesso!'
        }
      },
      socialButtonStyle: 'big',
      allowShowPassword: true,
      allowSignUp: false, // Desabilitar signup público
      allowForgotPassword: true,
      rememberLastLogin: true,
      additionalSignUpFields: [],
      mustAcceptTerms: false
    });

    lock.show();
  </script>
</body>
</html>`;

  const response = await fetch(`https://${AUTH0_DOMAIN}/api/v2/branding/templates/universal-login`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      template: loginTemplate,
    }),
  });

  if (!response.ok) {
    console.error(`⚠️  Erro ao configurar template: ${await response.text()}`);
    return;
  }

  console.log("✅ Universal Login template configurado");
}

async function configurePromptSettings(token: string): Promise<void> {
  console.log("⚙️  Configurando prompt settings...");

  // Configurar para usar New Universal Login Experience
  const promptConfig = {
    universal_login_experience: "new",
    identifier_first: false, // Mostrar email e senha juntos
  };

  const response = await fetch(`https://${AUTH0_DOMAIN}/api/v2/prompts`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(promptConfig),
  });

  if (!response.ok) {
    console.error(`⚠️  Erro ao configurar prompts: ${await response.text()}`);
    return;
  }

  console.log("✅ Prompt settings configurados");
}

async function main() {
  try {
    console.log("🚀 Configurando Universal Login\n");

    const token = await getManagementToken();
    await configureBranding(token);
    await configureUniversalLogin(token);
    await configurePromptSettings(token);

    console.log("\n✨ Universal Login configurado!\n");
    console.log("📋 Notas:");
    console.log("- Google OAuth e Database estarão disponíveis na tela de login");
    console.log("- Signup público está desabilitado (usuários criados via admin)");
    console.log("- Para testar: http://localhost:3001/auth/login");
    console.log("\n💡 Para customização avançada:");
    console.log(`   https://manage.auth0.com/dashboard/us/${AUTH0_DOMAIN.replace('.us.auth0.com', '')}/login_page`);

  } catch (error) {
    console.error("\n❌ Erro:", error);
    process.exit(1);
  }
}

main();

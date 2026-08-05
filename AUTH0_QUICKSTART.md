# Auth0 Setup - Quickstart Guide

Guia rápido para configurar o Auth0 no Ledivan Plus em 5 minutos.

## Pré-requisitos

- Acesso ao Auth0 Dashboard: https://manage.auth0.com/dashboard/us/reverblabs
- Node.js e npm instalados
- Arquivo `.env.local` configurado

## Passo 1: Criar Machine-to-Machine App (1 min)

1. Acesse: https://manage.auth0.com/dashboard/us/reverblabs/applications
2. **Create Application** > Nome: `Ledivan Plus Management` > Tipo: **Machine to Machine**
3. Authorize: **Auth0 Management API**
4. Permissions: Selecione TODOS os scopes relacionados a `clients`, `connections` e `branding`
5. Copie **Client ID** e **Client Secret**

## Passo 2: Configurar .env.local (1 min)

Edite `C:\Users\User\Ledivan Plus\.env.local`:

```bash
AUTH0_MGMT_CLIENT_ID="<Client ID do passo 1>"
AUTH0_MGMT_CLIENT_SECRET="<Client Secret do passo 1>"
```

## Passo 3: Executar Setup Automatizado (2 min)

```bash
cd "C:\Users\User\Ledivan Plus"
npx tsx scripts/setup-auth0.ts
```

O script irá criar/configurar:
- Application "Ledivan Plus"
- Custom Database "ledivan-db"
- Google Social Connection

Ao final, copie as credenciais mostradas:

```bash
AUTH0_CLIENT_ID="<copiar>"
AUTH0_CLIENT_SECRET="<copiar>"
```

E cole no `.env.local`.

## Passo 4: Testar (1 min)

```bash
npx tsx scripts/test-auth0-setup.ts
```

Se tudo passou:

```bash
npm run dev
```

Acesse: http://localhost:3001/auth/login

## Troubleshooting Rápido

### Script falha com "Access denied"

Volte ao passo 1 e verifique se selecionou TODOS os scopes necessários:
- `create:clients`, `update:clients`, `read:clients`
- `create:connections`, `update:connections`, `read:connections`
- `read:branding`, `update:branding`

### Teste falha: "Auth0 Client Credentials - Inválidas"

Você copiou as credenciais do Management App (errado).

Correto: Copiar as credenciais que o `setup-auth0.ts` mostra NO FINAL da execução.

### Login funciona mas usuário não aparece no banco

Execute para adicionar senha:

```bash
npx tsx scripts/add-user-password.ts giselebarrossantos@gmail.com Senha@123
```

Ou configure o middleware (já criado) para sincronizar automaticamente.

### Login com Google não funciona

1. Verifique se GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET estão no .env.local
2. Execute: `npx tsx scripts/setup-auth0.ts` novamente
3. No Auth0 Dashboard > Authentication > Social > google-oauth2
4. Verifique se "Ledivan Plus" está habilitado em Applications

## Documentação Completa

Para guia detalhado, veja: [AUTH0_SETUP_GUIDE.md](./AUTH0_SETUP_GUIDE.md)

## Scripts Disponíveis

```bash
# Setup completo do Auth0
npx tsx scripts/setup-auth0.ts

# Configurar Universal Login
npx tsx scripts/setup-universal-login.ts

# Testar configuração
npx tsx scripts/test-auth0-setup.ts

# Adicionar senha a usuário
npx tsx scripts/add-user-password.ts <email> <senha>
```

## Estrutura de Arquivos

```
scripts/
├── setup-auth0.ts               # Setup automatizado
├── setup-universal-login.ts     # Customização do login
├── test-auth0-setup.ts          # Validação da config
├── add-user-password.ts         # Adicionar senha
└── auth0-database-scripts.ts    # Scripts de Custom DB

src/
├── lib/auth0.ts                 # Auth0 Client
├── auth.ts                      # Shim de compatibilidade
├── middleware.ts                # Sync automático de usuários
└── app/
    ├── auth/[auth0]/route.ts    # Route handler
    └── api/auth/sync-user/route.ts  # Endpoint de sync

.env.local                       # Variáveis de ambiente
```

## Checklist Final

- [ ] AUTH0_DOMAIN configurado
- [ ] AUTH0_CLIENT_ID configurado (do output do setup-auth0.ts)
- [ ] AUTH0_CLIENT_SECRET configurado (do output do setup-auth0.ts)
- [ ] DATABASE_URL configurado
- [ ] GOOGLE_CLIENT_ID configurado
- [ ] GOOGLE_CLIENT_SECRET configurado
- [ ] `npx tsx scripts/test-auth0-setup.ts` passa sem erros
- [ ] Login funciona em http://localhost:3001/auth/login

## Suporte

Problemas? Consulte:
1. [AUTH0_SETUP_GUIDE.md](./AUTH0_SETUP_GUIDE.md) - Guia completo
2. Auth0 Dashboard > Logs - Logs de autenticação
3. Auth0 Dashboard > Authentication > Database > ledivan-db > Try Connection - Testar scripts

---

**Última atualização:** 2026-08-04

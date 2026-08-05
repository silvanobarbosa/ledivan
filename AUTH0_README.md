# Configuração Auth0 - Ledivan Plus

> Sistema completo de autenticação com Google OAuth + Email/Senha integrado ao banco Neon

## Início Rápido (5 minutos)

**Se você quer configurar rapidamente:**

👉 **[AUTH0_QUICKSTART.md](./AUTH0_QUICKSTART.md)** - Passo a passo de 5 minutos

## Documentação

### Para Implementadores

| Documento | Quando Usar |
|-----------|-------------|
| **[AUTH0_QUICKSTART.md](./AUTH0_QUICKSTART.md)** | Setup inicial rápido (5 min) |
| **[AUTH0_SETUP_GUIDE.md](./AUTH0_SETUP_GUIDE.md)** | Guia completo com troubleshooting e arquitetura |
| **[AUTH0_SETUP_SUMMARY.md](./AUTH0_SETUP_SUMMARY.md)** | Resumo executivo da solução implementada |

### Para Desenvolvedores

| Recurso | Descrição |
|---------|-----------|
| `scripts/setup-auth0.ts` | Script de configuração automatizada via Management API |
| `scripts/auth0-database-scripts.ts` | Custom Database scripts (login, get user, change password) |
| `scripts/test-auth0-setup.ts` | Validação completa da configuração |
| `scripts/add-user-password.ts` | Adicionar senha a usuário existente |
| `src/lib/auth0.ts` | Auth0 Client configurado |
| `src/auth.ts` | Shim de compatibilidade com NextAuth |
| `src/middleware.ts` | Middleware de autenticação e sync |

## Estrutura da Solução

```
Ledivan Plus/
├── scripts/
│   ├── setup-auth0.ts               # Configuração automática
│   ├── setup-universal-login.ts     # Customização do login
│   ├── auth0-database-scripts.ts    # Scripts de Custom DB
│   ├── test-auth0-setup.ts          # Testes de validação
│   └── add-user-password.ts         # Gerenciamento de senhas
│
├── src/
│   ├── lib/
│   │   └── auth0.ts                 # Auth0 Client
│   ├── auth.ts                      # API compatível com NextAuth
│   ├── middleware.ts                # Proteção de rotas + sync
│   └── app/
│       ├── auth/[auth0]/route.ts    # Route handler do Auth0
│       └── api/auth/sync-user/route.ts  # Sync de usuários
│
├── .env.local                       # Variáveis de ambiente
├── .env.local.example               # Template de variáveis
│
└── Documentação:
    ├── AUTH0_README.md             # Este arquivo (índice)
    ├── AUTH0_QUICKSTART.md         # Guia rápido
    ├── AUTH0_SETUP_GUIDE.md        # Guia completo
    └── AUTH0_SETUP_SUMMARY.md      # Resumo executivo
```

## Features

### Métodos de Autenticação

✅ **Google OAuth** - Login social integrado com Google Cloud
✅ **Email/Senha** - Custom Database conectada ao Neon/Postgres
✅ **Bcrypt** - Hash seguro de senhas (10 rounds)

### Integração com Banco

✅ **Custom Database Scripts** - Login e validação via Postgres
✅ **Sincronização Automática** - Usuários do Google criados no banco
✅ **Case-Insensitive** - Email matching sem case sensitivity
✅ **RBAC** - Role-based access control (user, admin)

### Compatibilidade

✅ **Shim Layer** - API idêntica ao NextAuth (zero breaking changes)
✅ **Middleware** - Proteção automática de rotas
✅ **Server Components** - Suporte nativo a RSC do Next.js

### Segurança

✅ **OIDC Conformant** - Padrões modernos de autenticação
✅ **Brute Force Protection** - Proteção contra ataques
✅ **Password Policy** - Políticas de senha (good)
✅ **Password History** - Histórico de 5 senhas
✅ **LGPD** - Script de anonimização de dados

## Variáveis de Ambiente Necessárias

```bash
# Auth0 Application (obter via setup-auth0.ts)
AUTH0_DOMAIN="reverblabs.us.auth0.com"
AUTH0_CLIENT_ID="<executar script>"
AUTH0_CLIENT_SECRET="<executar script>"
AUTH0_SECRET="<gerado automaticamente>"

# Auth0 Management API (criar no dashboard)
AUTH0_MGMT_CLIENT_ID="<criar no dashboard>"
AUTH0_MGMT_CLIENT_SECRET="<criar no dashboard>"

# Google OAuth (já configurado)
GOOGLE_CLIENT_ID="586158661626-..."
GOOGLE_CLIENT_SECRET="GOCSPX-..."

# Configuração
APP_BASE_URL="http://localhost:3001"  # Desenvolvimento
DATABASE_URL="postgresql://..."        # Neon
```

## Scripts Disponíveis

```bash
# 1. Configuração completa do Auth0
npx tsx scripts/setup-auth0.ts

# 2. Customizar Universal Login
npx tsx scripts/setup-universal-login.ts

# 3. Validar configuração
npx tsx scripts/test-auth0-setup.ts

# 4. Adicionar senha a usuário
npx tsx scripts/add-user-password.ts giselebarrossantos@gmail.com Senha@123

# 5. Iniciar servidor
npm run dev
```

## Fluxo de Autenticação

### Login com Google

```
Usuário → /auth/login
  ↓
Auth0 Universal Login
  ↓
Google OAuth
  ↓
Auth0 Callback
  ↓
Session Cookie
  ↓
Middleware Sync User
  ↓
/dashboard
```

### Login com Email/Senha

```
Usuário → /auth/login
  ↓
Auth0 Universal Login
  ↓
Custom DB Script (Neon)
  ↓
Bcrypt Validation
  ↓
Auth0 Callback
  ↓
Session Cookie
  ↓
/dashboard
```

## Uso no Código

### Server Components

```typescript
import { auth } from '@/auth';

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/auth/login');
  }

  return <div>Olá, {session.user.name}!</div>;
}
```

### Server Actions

```typescript
'use server'

import { auth } from '@/auth';

export async function updateProfile(data: FormData) {
  const session = await auth();

  if (!session?.user) {
    throw new Error('Unauthorized');
  }

  // Atualizar perfil...
}
```

### Middleware (já configurado)

```typescript
// src/middleware.ts
export async function middleware(request: NextRequest) {
  // Protege /dashboard, /patients, /settings automaticamente
  // Redireciona para /auth/login se não autenticado
  // Sincroniza usuário no banco se necessário
}
```

## Checklist de Setup

### Antes de Começar

- [ ] Acesso ao Auth0 Dashboard (reverblabs.us.auth0.com)
- [ ] Node.js instalado
- [ ] .env.local configurado
- [ ] Banco Neon acessível

### Durante Setup

- [ ] Machine-to-Machine app criado
- [ ] AUTH0_MGMT_CLIENT_ID e SECRET configurados
- [ ] `npx tsx scripts/setup-auth0.ts` executado
- [ ] AUTH0_CLIENT_ID e SECRET copiados para .env.local
- [ ] `npx tsx scripts/test-auth0-setup.ts` passou

### Após Setup

- [ ] Login com Google testado
- [ ] Login com Email/Senha testado (se senha configurada)
- [ ] Usuário aparece no banco
- [ ] Session persiste
- [ ] Logout funciona

## Troubleshooting

### "Access denied"

**Causa:** Application não habilitado na Connection
**Solução:** Auth0 Dashboard > Authentication > Database > ledivan-db > Applications > Habilitar "Ledivan Plus"

### "invalid_grant"

**Causa:** Callback URL não cadastrada
**Solução:** Auth0 Dashboard > Applications > Ledivan Plus > Settings > Adicionar `http://localhost:3001/auth/callback`

### Login não funciona

**Debug:**
```bash
# 1. Validar configuração
npx tsx scripts/test-auth0-setup.ts

# 2. Verificar logs do Auth0
# https://manage.auth0.com/dashboard/us/reverblabs/logs

# 3. Testar Custom DB scripts
# Dashboard > Database > ledivan-db > Try Connection
```

### Usuário não aparece no banco

**Causa:** Sync automático falhou ou Google OAuth não cria automaticamente

**Solução:**
```typescript
// Chamar manualmente em Server Component
await fetch('/api/auth/sync-user', { method: 'POST' });
```

## Segurança

### Best Practices Implementadas

✅ Secrets nunca no código (apenas em .env.local)
✅ HTTPS only em produção
✅ httpOnly cookies
✅ sameSite strict
✅ CSRF protection (Auth0 SDK)
✅ SQL injection protection (parameterized queries)
✅ Bcrypt para senhas (não plaintext)

### LGPD Compliance

✅ Script de anonimização implementado
✅ Dados pessoais removíveis
✅ Consentimento necessário (Universal Login)
✅ Auditoria via Auth0 logs

## Performance

### Otimizações

✅ Connection pooling (Neon)
✅ SSL connection reuse
✅ Session caching (Auth0)
✅ Idempotent operations
✅ Minimal database queries

### Monitoramento

- **Auth0 Logs:** https://manage.auth0.com/dashboard/us/reverblabs/logs
- **Neon Monitoring:** Console do Neon
- **Server Logs:** `npm run dev` output

## Suporte

### Documentação

- [Auth0 Next.js SDK](https://github.com/auth0/nextjs-auth0)
- [Auth0 Custom Database](https://auth0.com/docs/authenticate/database-connections/custom-db)
- [Guia Completo](./AUTH0_SETUP_GUIDE.md)

### Contato

**Responsável:** Silvano Barbosa
**Email:** dev@reverblabs.com.br
**WhatsApp:** 11999612785

**Tenant:** reverblabs.us.auth0.com
**Dashboard:** https://manage.auth0.com/dashboard/us/reverblabs

## Próximos Passos

1. **Setup Inicial:** Siga [AUTH0_QUICKSTART.md](./AUTH0_QUICKSTART.md)
2. **Testar:** Execute scripts de validação
3. **Customizar:** Ajuste Universal Login conforme design
4. **Deploy:** Atualizar URLs para produção
5. **Monitorar:** Configurar alertas no Auth0

---

**Versão:** 1.0
**Última atualização:** 2026-08-04
**Compatível com:** Next.js 16.2.12, Auth0 SDK 4.26.0
**Status:** ✅ PRONTO PARA USO

# EXECUTE AGORA - Setup Auth0 Ledivan Plus

> Este arquivo contém os comandos EXATOS para executar o setup completo do Auth0.
> Copie e cole os comandos na ordem apresentada.

## STATUS ATUAL

✅ Código implementado
✅ Scripts criados
✅ Documentação completa
⏳ **FALTA: Executar scripts de configuração**

---

## PASSO 1: Criar Machine-to-Machine App no Auth0

**ATENÇÃO:** Este passo NÃO pode ser automatizado. Deve ser feito manualmente no dashboard.

### 1.1 Acessar Auth0 Dashboard

```
URL: https://manage.auth0.com/dashboard/us/reverblabs/applications
```

### 1.2 Criar Aplicação

1. Clicar em **"Create Application"**
2. Nome: `Ledivan Plus Management`
3. Tipo: **Machine to Machine Applications**
4. Clicar em **Create**

### 1.3 Autorizar Management API

1. Na tela "Authorize App":
   - API: **Auth0 Management API**
   - Clicar em **Authorize**

### 1.4 Selecionar Permissions (Scopes)

**IMPORTANTE:** Selecionar TODOS os seguintes scopes:

**Clients:**
- ✅ `create:clients`
- ✅ `read:clients`
- ✅ `update:clients`
- ✅ `delete:clients`

**Connections:**
- ✅ `create:connections`
- ✅ `read:connections`
- ✅ `update:connections`
- ✅ `delete:connections`

**Branding:**
- ✅ `read:branding`
- ✅ `update:branding`

**Prompts:**
- ✅ `read:prompts`
- ✅ `update:prompts`

### 1.5 Copiar Credenciais

1. Ir para aba **Settings** da aplicação criada
2. Copiar:
   - **Domain** (deve ser: reverblabs.us.auth0.com)
   - **Client ID** (algo como: ABC123...)
   - **Client Secret** (clicar em "Show" para revelar)

---

## PASSO 2: Configurar Variáveis de Ambiente

### 2.1 Abrir .env.local

```bash
code "C:\Users\User\Ledivan Plus\.env.local"
```

Ou abrir manualmente no editor.

### 2.2 Atualizar Credenciais do Management App

Localizar as linhas:

```bash
AUTH0_MGMT_CLIENT_ID="YOUR_MGMT_CLIENT_ID_HERE"
AUTH0_MGMT_CLIENT_SECRET="YOUR_MGMT_CLIENT_SECRET_HERE"
```

Substituir por:

```bash
AUTH0_MGMT_CLIENT_ID="<Client ID copiado do passo 1.5>"
AUTH0_MGMT_CLIENT_SECRET="<Client Secret copiado do passo 1.5>"
```

### 2.3 Salvar Arquivo

Salvar `.env.local` e fechar editor.

---

## PASSO 3: Executar Script de Setup

### 3.1 Abrir Terminal

Abrir PowerShell ou Git Bash no diretório do projeto.

### 3.2 Navegar para o Diretório

```bash
cd "C:\Users\User\Ledivan Plus"
```

### 3.3 Executar Script de Setup

```bash
npx tsx scripts/setup-auth0.ts
```

**O que o script faz:**
1. Obtém token da Management API
2. Cria Application "Ledivan Plus"
3. Configura Custom Database "ledivan-db"
4. Configura Google OAuth Connection
5. Retorna credenciais AUTH0_CLIENT_ID e AUTH0_CLIENT_SECRET

### 3.4 Copiar Credenciais do Output

No final da execução, o script mostrará:

```
✨ Configuração concluída com sucesso!

📋 Próximos passos:

1. Adicionar ao .env.local:
   AUTH0_CLIENT_ID="abc123xyz..."
   AUTH0_CLIENT_SECRET="def456uvw..."
```

**COPIAR** estes valores.

---

## PASSO 4: Atualizar .env.local com Credenciais Finais

### 4.1 Abrir .env.local Novamente

```bash
code "C:\Users\User\Ledivan Plus\.env.local"
```

### 4.2 Atualizar AUTH0_CLIENT_ID e SECRET

Localizar:

```bash
AUTH0_CLIENT_ID="YOUR_AUTH0_CLIENT_ID_HERE"
AUTH0_CLIENT_SECRET="YOUR_AUTH0_CLIENT_SECRET_HERE"
```

Substituir pelos valores copiados do **Passo 3.4**.

### 4.3 Verificar APP_BASE_URL

Confirmar que está:

```bash
APP_BASE_URL="http://localhost:3001"
```

### 4.4 Salvar Arquivo

Salvar `.env.local`.

---

## PASSO 5: Validar Configuração

### 5.1 Executar Script de Teste

```bash
npx tsx scripts/test-auth0-setup.ts
```

### 5.2 Verificar Output

Deve mostrar:

```
✅ AUTH0_DOMAIN: Configurada
✅ AUTH0_CLIENT_ID: Configurada
✅ AUTH0_CLIENT_SECRET: Configurada
✅ Database Connection: Conectado com sucesso
✅ Usuário Gisele: Encontrado
...
✅ CONFIGURAÇÃO COMPLETA
```

Se houver ❌ (falhas), resolver antes de continuar.

---

## PASSO 6: Adicionar Senha à Gisele (Opcional)

Para testar login com email/senha:

```bash
npx tsx scripts/add-user-password.ts giselebarrossantos@gmail.com Senha@123
```

Deve mostrar:

```
✅ Senha adicionada com sucesso!
```

---

## PASSO 7: Iniciar Servidor e Testar

### 7.1 Instalar Dependências (se necessário)

```bash
npm install
```

### 7.2 Iniciar Servidor de Desenvolvimento

```bash
npm run dev
```

### 7.3 Acessar Página de Login

Abrir navegador em:

```
http://localhost:3001/auth/login
```

### 7.4 Testar Login com Google

1. Clicar em **"Continue with Google"**
2. Selecionar conta: `giselebarrossantos@gmail.com`
3. Autorizar acesso
4. Deve redirecionar para `/dashboard`

### 7.5 Testar Login com Email/Senha

1. Preencher:
   - Email: `giselebarrossantos@gmail.com`
   - Senha: `Senha@123` (se executou Passo 6)
2. Clicar em **"Continue"**
3. Deve redirecionar para `/dashboard`

### 7.6 Verificar Sessão

Acessar:

```
http://localhost:3001/test-auth
```

Deve mostrar dados do usuário em JSON.

---

## TROUBLESHOOTING RÁPIDO

### Erro: "Access denied" no script

**Causa:** Scopes não foram selecionados corretamente no Passo 1.4

**Solução:**
1. Voltar ao Auth0 Dashboard
2. Applications > Ledivan Plus Management > APIs > Auth0 Management API
3. Verificar e marcar TODOS os scopes listados no Passo 1.4
4. Executar Passo 3 novamente

### Erro: "Auth0 Client Credentials - Inválidas"

**Causa:** Copiou credenciais erradas

**Solução:**
1. Verificar se copiou do **Management App** (errado) ou do **output do script** (correto)
2. Usar credenciais que o `setup-auth0.ts` mostra NO FINAL da execução

### Erro: "Database connection failed"

**Causa:** DATABASE_URL incorreta

**Solução:**
1. Verificar DATABASE_URL no .env.local
2. Testar conexão:
   ```bash
   psql "$DATABASE_URL"
   ```

### Login não funciona

**Debug:**
1. Verificar logs do Auth0:
   ```
   https://manage.auth0.com/dashboard/us/reverblabs/logs
   ```

2. Verificar que Application está habilitado nas Connections:
   - Database: ledivan-db > Applications > "Ledivan Plus" deve estar ON
   - Social: google-oauth2 > Applications > "Ledivan Plus" deve estar ON

---

## CHECKLIST FINAL

Antes de considerar CONCLUÍDO:

- [ ] Machine-to-Machine app criado no Auth0
- [ ] AUTH0_MGMT_CLIENT_ID e SECRET no .env.local
- [ ] Script setup-auth0.ts executado com sucesso
- [ ] AUTH0_CLIENT_ID e SECRET atualizados no .env.local
- [ ] Script test-auth0-setup.ts passou sem erros
- [ ] Senha adicionada à Gisele (opcional)
- [ ] Servidor iniciado (npm run dev)
- [ ] Login com Google funciona
- [ ] Login com Email/Senha funciona (se senha configurada)
- [ ] Usuário aparece no banco
- [ ] Sessão persiste entre reloads

---

## RESUMO DOS COMANDOS

```bash
# 1. Navegar para o projeto
cd "C:\Users\User\Ledivan Plus"

# 2. Executar setup (após configurar .env.local com MGMT credentials)
npx tsx scripts/setup-auth0.ts

# 3. Atualizar .env.local com CLIENT_ID e SECRET do output

# 4. Validar configuração
npx tsx scripts/test-auth0-setup.ts

# 5. Adicionar senha (opcional)
npx tsx scripts/add-user-password.ts giselebarrossantos@gmail.com Senha@123

# 6. Instalar dependências
npm install

# 7. Iniciar servidor
npm run dev

# 8. Testar no navegador
# http://localhost:3001/auth/login
```

---

## PRÓXIMOS PASSOS APÓS SUCESSO

1. **Customizar Universal Login:**
   ```bash
   npx tsx scripts/setup-universal-login.ts
   ```

2. **Configurar Produção:**
   - Atualizar APP_BASE_URL para https://ledivan.com.br
   - Adicionar callbacks de produção no Auth0
   - Atualizar Google OAuth authorized origins

3. **Monitoramento:**
   - Configurar alertas no Auth0
   - Monitorar logs de autenticação
   - Configurar MFA para admins (opcional)

---

## DOCUMENTAÇÃO COMPLETA

Para referência detalhada, consulte:

- **[AUTH0_README.md](./AUTH0_README.md)** - Índice principal
- **[AUTH0_QUICKSTART.md](./AUTH0_QUICKSTART.md)** - Guia rápido
- **[AUTH0_SETUP_GUIDE.md](./AUTH0_SETUP_GUIDE.md)** - Guia completo
- **[AUTH0_SETUP_SUMMARY.md](./AUTH0_SETUP_SUMMARY.md)** - Resumo executivo

---

## SUPORTE

**Problemas?**
1. Consultar seção Troubleshooting acima
2. Verificar logs do Auth0 Dashboard
3. Executar test-auth0-setup.ts para diagnóstico

**Contato:**
- Email: dev@reverblabs.com.br
- WhatsApp: 11999612785

---

**Última atualização:** 2026-08-04
**Tempo estimado:** 10-15 minutos
**Dificuldade:** ⭐⭐ Intermediário
**Status:** ✅ PRONTO PARA EXECUÇÃO

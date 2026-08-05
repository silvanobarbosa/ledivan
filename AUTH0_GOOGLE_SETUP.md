# Configuração do Google OAuth no Auth0 para Ledivan

## Status Atual

O sistema está configurado para usar Auth0 como provedor de autenticação. Para permitir que Gisele (giselebarrossantos@gmail.com) faça login com Google, siga os passos abaixo.

## Passo 1: No Painel do Auth0 (https://manage.auth0.com)

1. **Acesse o tenant**: `reverblabs.us.auth0.com`

2. **Ativar Google OAuth**:
   - Vá em **Authentication > Social**
   - Clique em **"+ Create Connection"**
   - Selecione **Google**
   - Configure:
     - Name: `google-oauth2` (padrão)
     - Ative a conexão

3. **Configurar Aplicação**:
   - Vá em **Applications > Ledivan**
   - Na aba **Connections**:
     - Ative **google-oauth2**
     - Mantenha **ledivan-db** ativo também (para login email/senha)

4. **Universal Login**:
   - Vá em **Branding > Universal Login**
   - Em **Login Experience**, selecione **New**
   - Isso habilitará os botões sociais automaticamente

## Passo 2: Credenciais do Google (se necessário)

Se o Auth0 pedir credenciais do Google:

1. Acesse o [Google Cloud Console](https://console.cloud.google.com)
2. Selecione ou crie um projeto
3. Vá em **APIs & Services > Credentials**
4. Crie um **OAuth 2.0 Client ID**
5. Configure:
   - Application type: **Web application**
   - Authorized redirect URIs:
     ```
     https://reverblabs.us.auth0.com/login/callback
     ```
6. Copie o **Client ID** e **Client Secret**
7. Cole no Auth0 na configuração do Google

## Passo 3: Atualizar Código (já feito ✅)

- ✅ Removida a conexão fixa `connection: "ledivan-db"` em `src/lib/auth0.ts`
- ✅ Agora permite múltiplos métodos de login

## Passo 4: Testar

1. Acesse https://ledivan.com.br/login
2. Deve aparecer botão **"Continue with Google"**
3. Gisele pode fazer login com giselebarrossantos@gmail.com

## Observações Importantes

- O usuário Gisele já está criado no banco com o email giselebarrossantos@gmail.com
- O Auth0 automaticamente vinculará a conta Google ao usuário existente pelo email
- Os 49 pacientes importados estarão disponíveis após o login

## Variáveis de Ambiente (já configuradas)

```env
APP_BASE_URL=https://ledivan.com.br
AUTH0_DOMAIN=reverblabs.us.auth0.com
AUTH0_CLIENT_ID=[configurado]
AUTH0_CLIENT_SECRET=[configurado]
AUTH0_SECRET=[configurado]
```

## Suporte

Se houver problemas:
1. Verifique se o Google OAuth está ativo no Auth0
2. Confirme que a aplicação Ledivan tem a conexão google-oauth2 habilitada
3. Teste em modo incógnito para evitar cache
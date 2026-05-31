# Google OAuth novo — Ledivan+

Passo-a-passo no Google Cloud Console (https://console.cloud.google.com). ~10 min.

## 1. Criar projeto
- Topo da página → seletor de projeto → **New Project**
- Nome: `Ledivan Plus` → **Create** → selecionar o projeto novo.

## 2. Tela de consentimento (OAuth consent screen)
- Menu → **APIs & Services** → **OAuth consent screen**
- User Type: **External** → **Create**
- App name: `Ledivan+`
- User support email: `renan@rdmss.com.br`
- Developer contact: `renan@rdmss.com.br`
- **Save and Continue** nos passos (Scopes pode deixar padrão — email/profile).
- Em **Test users**: adicionar `renan@rdmss.com.br` (e qualquer e-mail que for logar enquanto o app estiver em "Testing").
- Salvar.
> Enquanto estiver em modo "Testing", só os test users conseguem logar. Para liberar geral, depois clicar em **Publish app**.

## 3. Criar credencial OAuth
- **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**
- Application type: **Web application**
- Name: `Ledivan+ Web`
- **Authorized JavaScript origins** → Add URI:
  - `http://localhost:3000`
  - (depois, em produção) `https://SEU-DOMINIO`
- **Authorized redirect URIs** → Add URI:
  - `http://localhost:3000/api/auth/callback/google`
  - (depois, em produção) `https://SEU-DOMINIO/api/auth/callback/google`
- **Create**.

## 4. Copiar credenciais
- Copiar **Client ID** e **Client secret**.
- Colar em `.env.local`:
  ```
  GOOGLE_CLIENT_ID="...apps.googleusercontent.com"
  GOOGLE_CLIENT_SECRET="..."
  ```

## 5. Testar local
- ⚠️ Rodar na porta **3000** (o callback registrado é :3000). Se a 3000 estiver ocupada, liberar o processo OU adicionar também `http://localhost:3001` e `.../callback/google` nas URIs e setar `AUTH_URL="http://localhost:3001"`.
- `npm run dev` → http://localhost:3000/login → **Entrar com Google**.

## Notas
- Caminho do callback do NextAuth é fixo: `/api/auth/callback/google`.
- Não precisa ativar nenhuma API extra (Gmail/Calendar) só pra login.
- Em produção: repetir o passo 3 adicionando as URIs do domínio real e publicar a consent screen.

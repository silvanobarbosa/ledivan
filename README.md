# CapiCash - Inteligência Financeira Estilo Capivara 🦦

O **CapiCash** é uma plataforma premium de gestão financeira pessoal que utiliza Inteligência Artificial e automação via Telegram para simplificar a vida do usuário.

## 🚀 Arquitetura Técnica

### 🎨 Design System
*   **Google Stitch:** Integração completa de tokens de design (cores, tipografia, espaçamento).
*   **Tailwind CSS v4:** Estilização moderna com suporte a variáveis CSS nativas.
*   **Hanken Grotesk & Plus Jakarta Sans:** Tipografias selecionadas para máxima legibilidade e estética premium.

### 🏗️ Core & Backend
*   **Next.js 16 (App Router):** Utilização de Server Components para performance e SEO.
*   **Neon Postgres:** Banco de dados serverless de baixa latência.
*   **Drizzle ORM:** Type-safety total e migrações automatizadas.
*   **Auth.js (v5):** Autenticação robusta com suporte a Google Login.

### 🤖 Inteligência Artificial (OpenAI)
*   **Capi-Scan AI:** Processamento de imagens de recibos usando GPT-4o-mini (Vision).
*   **Capi-Insights:** Geração de dicas financeiras personalizadas baseadas no comportamento de gastos.

### 🤖 Automação (Telegram)
*   **CapiBot:** Bot integrado via Telegraf para registro rápido de transações e consulta de saldo por chat.

## 🛠️ Configuração de Ambiente (.env.local)

```env
DATABASE_URL="sua-url-do-neon"
AUTH_SECRET="sua-chave-secreta"
GOOGLE_CLIENT_ID="seu-id-do-google"
GOOGLE_CLIENT_SECRET="sua-secret-do-google"
TELEGRAM_BOT_TOKEN="token-do-seu-bot"
OPENAI_API_KEY="sua-chave-da-openai"
STITCH_PROJECT_ID="12030982130224125682"
```

## 📦 Comandos Principais

*   `npm run dev`: Inicia o ambiente de desenvolvimento.
*   `npm run bot`: Inicia o bot do Telegram localmente.
*   `npx drizzle-kit push`: Sincroniza o schema com o banco de dados.
*   `npx tsx src/db/seed.mts`: Alimenta o banco com dados iniciais.

## 🚢 Deploy

O CapiCash está pronto para o **Vercel**. 
**Nota:** O `CapiBot` (Telegram) deve ser executado em um processo persistente ou via Webhooks. Para desenvolvimento local, use `npm run bot`. Para produção, recomenda-se um serviço como Railway ou Render para o processo do bot, ou configurar Webhooks na rota de API do Next.js.

---
Desenvolvido com foco em **Máxima Qualidade** e **Experiência do Usuário**.

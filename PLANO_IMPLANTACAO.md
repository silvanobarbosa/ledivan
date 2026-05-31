# Plano de Implantação — Ledivan+ (início → produção)

Estado atual: app construído, build de produção limpo (19 rotas), Neon migrado+populado, dev roda em :3001, Telegram `@levitanplusbot` configurado. Falta: levar a produção pública e validar fim a fim.

Legenda: ⬜ a fazer · ✅ feito · 🔧 comando · ⚠️ atenção

---

## ETAPA 0 — Pré-requisitos (contas)
- ✅ Neon (banco) — criado
- ✅ Telegram bot — `@levitanplusbot`
- ⬜ Conta GitHub (repo do projeto)
- ⬜ Conta Vercel (deploy) — login com GitHub
- ⬜ Conta Google Cloud (OAuth) — já existe `GOOGLE_CLIENT_ID`, precisa ajustar URIs
- ⬜ Conta Resend (e-mail de login) — já existe key, precisa verificar domínio
- ⬜ Domínio próprio (opcional, ex: `app.ledivan.com.br`)

---

## ETAPA 1 — Fechar o código (pré-deploy)
1. ⬜ Polish de copy: landing (`src/app/page.tsx`), gamificação (`src/app/dashboard/gamification/page.tsx`), demo (`src/app/demo/page.tsx`) — tirar textos "Capi/CapiCash".
2. ⬜ Revisar `/dashboard/alerts` (stub) — esconder do menu ou implementar.
3. ⬜ Decidir destino do usuário de teste do seed (`user_test_123`): em produção NÃO rodar `db:seed`, ou rodar versão sem dados fake.
4. ✅ `npm run build` passa limpo.
5. 🔧 Validar local em modo produção: `npm run build; npm run start` → abrir http://localhost:3000 e logar.

**Checkpoint:** build ok + login funcionando local em modo prod.

---

## ETAPA 2 — Versionar (Git)
> Hoje a pasta NÃO é repositório git. Vercel precisa de repo.
1. 🔧 `git init`
2. ⬜ Conferir `.gitignore` cobre: `node_modules`, `.next`, `.env.local`, `.vercel`. ⚠️ **NUNCA** commitar `.env.local` (tem segredos).
3. 🔧 `git add . && git commit -m "Ledivan+ inicial"`
4. ⬜ Criar repo **privado** no GitHub.
5. 🔧 `git remote add origin <url>` → `git push -u origin main`

**Checkpoint:** código no GitHub, sem segredos commitados.

---

## ETAPA 3 — Banco de produção (Neon)
> Hoje dev e prod usariam o mesmo banco. Separar é mais seguro.
- **Opção A (simples):** usar o banco atual como produção. Já migrado.
- **Opção B (recomendada):** criar branch `production` no Neon (cópia isolada). Usa-se a connection string da branch só na Vercel; a branch `main`/dev fica pro local.
1. ⬜ Escolher A ou B.
2. ⬜ Se B: criar branch no painel Neon, copiar connection string.
3. 🔧 Migrar a branch de produção: `DATABASE_URL="<string-prod>" npx drizzle-kit migrate`
4. ⬜ NÃO popular com seed fake em produção.

**Checkpoint:** banco de produção com as 15 tabelas, vazio de dados fake.

---

## ETAPA 4 — Deploy na Vercel
1. ⬜ Vercel → "Add New Project" → importar repo do GitHub.
2. ⬜ Framework detectado: Next.js (auto). Build command padrão `next build`.
3. ⬜ Configurar **Environment Variables** (copiar de `.env.local`, com valores de PRODUÇÃO):
   - `DATABASE_URL` (string de produção)
   - `AUTH_SECRET`
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
   - `AUTH_RESEND_KEY`
   - `OPENAI_API_KEY`
   - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`
   - ⚠️ deixar de fora: `STITCH_*`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_CLOUD_PROJECT` (não usados em runtime).
4. ⬜ Deploy. Anotar a URL gerada (ex: `ledivan-plus.vercel.app`).

**Checkpoint:** site abre na URL Vercel, página `/login` carrega.

---

## ETAPA 5 — Autenticação em produção
> Login quebra se as URLs de callback não baterem com o domínio real.
1. ⬜ **Google OAuth** (console.cloud.google.com → Credentials → OAuth client):
   - Authorized redirect URI: `https://SEU-DOMINIO/api/auth/callback/google`
   - Authorized JavaScript origin: `https://SEU-DOMINIO`
   - (adicionar tanto o domínio Vercel quanto o domínio custom, se houver)
2. ⬜ **Resend** (e-mail de login):
   - Hoje envia de `onboarding@resend.dev` → modo teste, só entrega pro seu próprio e-mail.
   - Para enviar a qualquer paciente/terapeuta: verificar um domínio no Resend e trocar o `from` em `src/auth.ts` para `Ledivan+ <login@seu-dominio>`.
3. ⬜ Confirmar `AUTH_SECRET` setado na Vercel (NextAuth exige).

**Checkpoint:** login Google E login por e-mail funcionando na URL de produção.

---

## ETAPA 6 — Telegram (webhook)
> Em produção o bot usa webhook (não polling).
1. 🔧 Registrar webhook (rodar uma vez, trocando valores):
   ```
   curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=https://SEU-DOMINIO/api/telegram&secret_token=<TELEGRAM_WEBHOOK_SECRET>"
   ```
2. 🔧 Conferir: `curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"`
3. ⬜ Testar no app: Ajustes → gerar código → mandar `/start` e o código pro bot → confirmar vínculo.

**Checkpoint:** mensagem no Telegram cria transação no app.

---

## ETAPA 7 — Domínio próprio (opcional)
1. ⬜ Vercel → Project → Domains → adicionar `app.ledivan.com.br`.
2. ⬜ Apontar DNS (CNAME) no registrador conforme instrução da Vercel.
3. ⬜ Aguardar SSL automático.
4. ⬜ Voltar na ETAPA 5 e ETAPA 6 e atualizar as URLs (Google callback + Telegram webhook) para o domínio custom.

**Checkpoint:** app no domínio próprio com HTTPS.

---

## ETAPA 8 — Testes de aceitação (fim a fim, em produção)
Logar como terapeuta real e validar cada fluxo:
- ⬜ Cadastrar paciente → aparece na lista
- ⬜ Registrar sessão → aparece na Agenda da semana
- ⬜ Registrar pagamento COM toggle de vínculo → vira transação no Dashboard/Transações
- ⬜ Ligar switch global em Ajustes → próximo pagamento vincula sozinho
- ⬜ Criar prospect → converter em paciente
- ⬜ Scan de recibo (IA) → cria despesa
- ⬜ Meta + Conquistas atualizam
- ⬜ Telegram lança transação
- ⬜ Logout/login mantém isolamento (outro usuário não vê os dados)

**Checkpoint:** todos os fluxos verdes.

---

## ETAPA 9 — Go-live / onboarding
1. ⬜ Criar a conta do terapeuta principal (Ledivan) via login real.
2. ⬜ Cadastrar pacientes/sessões reais (entrada manual — importação de Excel NÃO entra agora).
3. ⬜ Definir preferência de vínculo de pagamentos.
4. ⬜ Comunicar URL + instruções de uso.

---

## ETAPA 10 — Operação contínua
- ⬜ Backups: Neon faz snapshots; conferir retenção / branch de backup.
- ⬜ Monitorar: Vercel logs + Neon usage.
- ⬜ Custos: OpenAI (scan/insights) e Resend têm limite — acompanhar.
- ⬜ Atualizações de schema futuras: editar `src/db/schema.ts` → `npx drizzle-kit generate` → `npx drizzle-kit migrate` (rodar contra produção em janela controlada).
- ⬜ Rotacionar segredos se algum vazar (o `.env.local` do CapiCash original tinha chaves reais — considerar rotacionar OpenAI/Google/Resend).

---

## Caminho crítico (mínimo pra ir ao ar)
`Etapa 1 → 2 → 4 → 5 (Google) → 8`. O resto (domínio, Telegram, Resend custom, branch de prod) pode vir depois sem travar o go-live.

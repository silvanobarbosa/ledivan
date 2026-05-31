# Ledivan+

Gestão de consultório de terapia **+** módulo financeiro integrado, num só app.

Master **Ledivan** (pacientes, sessões, agenda, prospects) com a gestão financeira
(transações, contas, metas, gamificação, IA, Telegram) embutida. Multi-tenant:
cada terapeuta tem dados isolados. Pagamento de sessão pode, opcionalmente, virar
receita no financeiro.

## Stack
- Next.js 16 (App Router) + React 19 + TypeScript
- Postgres (Neon) + Drizzle ORM
- NextAuth v5 (Google + e-mail via Resend)
- OpenAI (scan de recibo + insights) · Telegram (Telegraf)
- Tailwind v4 — design "Warm Glass Ledivan"

## Rodar local
```bash
npm install
npm run db:migrate   # aplica migrações
npm run db:seed      # dados de exemplo (opcional, NÃO usar em produção)
npm run dev          # http://localhost:3000
```
Variáveis em `.env.local` (ver `LEDIVAN_SETUP.md`). Login Google exige credenciais
do Google Cloud (ver `GOOGLE_OAUTH_SETUP.md`).

## Estrutura
- `src/app/dashboard/patients` · `agenda` · `prospects` — domínio terapia
- `src/app/dashboard` · `transactions` · `goals` · `gamification` — financeiro
- `src/app/dashboard/{payments,sessions}/actions.ts` — server actions
- `src/db/schema.ts` — schema unificado (auth + financeiro + terapia)
- `src/lib/therapy.ts` · `preferences.ts` — helpers do domínio

## Docs
- `LEDIVAN_SETUP.md` — setup completo
- `GOOGLE_OAUTH_SETUP.md` — credenciais Google
- `PLANO_IMPLANTACAO.md` — passo-a-passo até produção
- `PLANO_LEDIVAN_PLUS.md` — plano de arquitetura

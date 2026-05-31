# Ledivan+ — Setup

App master **Ledivan** (gestão de consultório de terapia) com a **gestão financeira do CapiCash** embutida.
Stack: Next.js 16 + Postgres (Neon) + Drizzle + NextAuth + OpenAI + Telegram.

## O que você precisa fazer (passos manuais)

### 1. Criar banco Neon novo
- Crie um projeto novo em https://neon.tech (não reuse o do CapiCash).
- Copie a connection string e cole em `.env.local` → `DATABASE_URL`.

### 2. Conferir o resto do `.env.local`
- `AUTH_SECRET` — pode manter ou gerar novo (`openssl rand -base64 32`).
- `GOOGLE_CLIENT_ID/SECRET`, `AUTH_RESEND_KEY`, `OPENAI_API_KEY` — chaves suas, reutilizáveis.
- `TELEGRAM_BOT_TOKEN` — crie um bot NOVO no @BotFather (recomendado) ou deixe o placeholder se não for usar Telegram agora.

### 3. Instalar, migrar e popular
```powershell
npm install                # já rodado
npm run db:migrate         # se não existir, use: npx drizzle-kit migrate
npm run db:seed            # dados de exemplo (terapeuta Helena + pacientes + sessões)
npm run dev
```
> A migração `drizzle/0000_ledivan_init.sql` cria as 15 tabelas (auth + financeiro + terapia).

## O que foi construído

### Domínio Terapia (novo)
- **Pacientes** — `/dashboard/patients` (lista+busca+filtro), detalhe com abas Dados/Sessões/Pagamentos/Histórico, cadastro.
- **Agenda** — `/dashboard/agenda` (visão semanal navegável).
- **Prospects** — `/dashboard/prospects` (cadastro + converter em paciente).
- Tabelas: `patients`, `patient_status_history`, `patient_price_history`, `patient_contract_history`, `therapy_sessions`, `session_payments`.

### Domínio Financeiro (CapiCash, mantido)
- Dashboard, Transações, Metas, Conquistas (gamificação neutralizada — sem mascote capivara).
- Scan de recibo (IA), Insights (IA), Telegram bot.

### Integração (multi-tenant + vínculo opcional)
- Tudo escopado por `userId` → cada terapeuta tem dados isolados.
- **Vínculo opcional pagamento → financeiro:**
  - No registro de pagamento há um toggle "Lançar como receita no financeiro".
  - Em `/dashboard/settings` há o switch global "Vincular pagamentos ao financeiro" (preferência `autoLinkPayments`).
  - Quando vinculado e status = pago, gera `transaction` (income, categoria "Sessões", `source = session_payment`) e grava `linkedTransactionId` no pagamento. Apagar o pagamento apaga a transação vinculada.
- Dashboard mostra resumo do consultório: pacientes ativos, sessões da semana, receita de sessões no mês.

### Design
- Paleta **Warm Glass Ledivan**: eggplant `#2b1830`, creme `#faf6f1`, accent violet `#8b5cf6`. Fontes Fraunces (display) + Inter (corpo). Em `src/app/globals.css`.

## Pendências / polish (não bloqueiam o uso)
- Landing page (`src/app/page.tsx`) e a tela de gamificação ainda têm textos de marketing do CapiCash — trocar copy quando quiser.
- Migrar dados reais do Excel (`Financeiro_Final_v2.xlsx`) — Fase 7 do plano, ainda não implementada.
- Assets em `src/stitch/*` são do design antigo (não renderizam no app).

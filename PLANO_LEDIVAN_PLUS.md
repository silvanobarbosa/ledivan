# Plano — Ledivan+ (Ledivan master + gestão financeira CapiCash)

## Decisões aprovadas
- **Stack base:** Next.js 16 (copiar CapiCash) — ganha backend, Postgres/Neon, Drizzle, NextAuth, OpenAI, Telegram prontos.
- **Features financeiras:** tudo (núcleo, metas, gamificação, IA scan + insights, Telegram).
- **Integração:** multi-tenant por terapeuta (já existe via `userId`) + **vínculo opcional** (terapeuta escolhe ligar pagamento de sessão → transação de receita).
- **App master:** Ledivan (domínio terapia é o núcleo; financeiro CapiCash entra dentro).
- **Destino:** `c:\Users\User\Ledivan Plus`.

---

## Visão geral da arquitetura

```
Ledivan+ (Next.js, base CapiCash)
│
├── DOMÍNIO TERAPIA (novo, portado do Ledivan mobile)
│   ├── pacientes  (com histórico status/preço/contrato, prospect, contato emergência)
│   ├── sessões    (status: realizada/nao_realizada/cancelada/realocada/agendada)
│   ├── pagamentos (pix/card/cash/transfer)  ──┐ vínculo OPCIONAL
│   ├── despesas                               │
│   └── agenda (semanal)                       │
│                                              ▼
├── DOMÍNIO FINANCEIRO (CapiCash, já pronto)   transação income
│   ├── contas financeiras
│   ├── transações + categorias
│   ├── metas
│   ├── gamificação (XP, conquistas, missões)
│   ├── IA: scan recibo + insights
│   └── Telegram bot
│
└── SHELL/AUTH/DB (CapiCash) — NextAuth, Drizzle, Neon Postgres
```

Cada terapeuta = 1 `user`. Todas tabelas escopadas por `userId` → isolamento garantido.

---

## Fase 0 — Scaffold
1. Copiar CapiCash → `Ledivan Plus` (sem `node_modules`, `.next`, `.git`).
2. Renomear: `package.json` name, branding, mascote/título → Ledivan+.
3. `.env` novo (DATABASE_URL, AUTH_SECRET, GOOGLE, RESEND, OPENAI, TELEGRAM). **Banco novo** (não reusar o do CapiCash).
4. `npm install`, validar `npm run dev`.

## Fase 1 — Schema unificado (Drizzle)
Adicionar a `src/db/schema.ts` as tabelas de terapia (todas com `userId` FK cascade):

- **patients** — name, email, phone, avatar, sessionFee, frequency, notes, paymentStatus, patientStatus, startedAt, birthDate, address, paymentDay, contractType(`pacote|avulso`), sessionsInPacket.
- **patient_status_history** — patientId, status, date.
- **patient_price_history** — patientId, valor, dataEfetiva, dataCriacao.
- **patient_contract_history** — patientId, type, from, to, date, description.
- **emergency_contacts** — patientId, name, phone, relationship.
- **prospects** — patientId/inline, dataProspeccao, fechou, observacoes.
- **therapy_sessions** — patientId, date, duration, fee, status(enum), notes, justificativa, chargeable. *(nome `therapy_sessions` p/ não colidir com `session` do NextAuth.)*
- **session_payments** — patientId, sessionId?, amount, date, method(enum pix/card/cash/transfer), status(enum paid/pending/overdue), **`linkedTransactionId` (FK opcional → transactions)**.

Enums novos: `session_status`, `payment_method`, `payment_status`.

Vínculo opcional: campo `linkedTransactionId` em `session_payments` + flag `autoLinkPayments` em `users.preferences`.

→ `npx drizzle-kit generate` + `migrate`. Atualizar `seed.ts` (categorias terapia: "Sessões", "Aluguel sala", etc).

## Fase 2 — Server actions / API domínio terapia
- `src/app/dashboard/patients/actions.ts` — CRUD paciente + históricos.
- `src/app/dashboard/sessions/actions.ts` — CRUD sessão, mudar status.
- `src/app/dashboard/payments/actions.ts` — registrar pagamento; **se `autoLinkPayments` OU toggle no form → cria `transaction` income e grava `linkedTransactionId`**.
- `src/app/dashboard/prospects/actions.ts` — CRUD prospect.
- Toda query filtrada por `session.user.id`.

## Fase 3 — Telas (portar Ledivan mobile RN → Next.js pages)
Sob `src/app/dashboard/`:
- `patients/page.tsx` — lista + busca/filtros.
- `patients/[id]/page.tsx` — detalhe (abas: Dados / Sessões / Pagamentos / Histórico).
- `patients/new/page.tsx` — form.
- `sessions/new/page.tsx`, `sessions/[id]/page.tsx`.
- `agenda/page.tsx` — visão semanal.
- `payments/new/page.tsx` — form com toggle "lançar no financeiro".
- `prospects/page.tsx`.
- Atualizar `Sidebar.tsx` / `BottomNavBar.tsx`: navegação une Terapia (Pacientes, Agenda, Prospects) + Financeiro (Dashboard, Transações, Metas, Gamificação).

## Fase 4 — Integração financeiro × terapia
- Dashboard principal: somar receitas de sessão (via transações vinculadas) ao saldo.
- Setting "vincular pagamentos automaticamente" em `/dashboard/settings`.
- Categoria padrão "Sessões" pra transações geradas de pagamento.
- Tela financeiro mostra origem (`source`) incluindo pagamentos de sessão.

## Fase 5 — Design unificado
- Base: shell CapiCash + design handoff Ledivan ("Warm Glass": eggplant #2b1830, creme #faf6f1, accent violet #8b5cf6, fontes Fraunces/Inter).
- Decidir paleta master (provável: Ledivan Warm Glass como identidade, mantendo componentes CapiCash).
- Ajustar `globals.css` / `tailwind.config.ts` / tokens.

## Fase 6 — IA, Telegram, Gamificação
- Scan recibo → pode lançar despesa do consultório.
- Insights IA: incluir contexto de receita de sessões.
- Telegram: manter lançamento por voz/texto.
- Gamificação: opcionalmente adicionar conquistas de domínio terapia (ex: "10 sessões realizadas").

## Fase 7 — Migração de dados (opcional)
- Importador Excel do Ledivan (existe `excelParser`) → popular pacientes/sessões/pagamentos via action de import.

---

## Pontos a confirmar antes/durante build
1. **Banco:** criar Neon novo? (recomendado — não misturar com CapiCash).
2. **Identidade visual:** Warm Glass do Ledivan como master, ou manter look CapiCash? (default sugerido: Warm Glass Ledivan).
3. **Importar dados reais** do Excel (`Financeiro_Final_v2.xlsx`) já nessa primeira versão? (default: deixar pra Fase 7).
4. **Mascote/gamificação:** manter mascote capivara do CapiCash ou neutralizar? (default: manter, é divertido e já pronto).
```

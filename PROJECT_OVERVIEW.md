# CapiCash – Project Overview (Design‑agnostic)

## 1. Purpose
A financial‑management web application that lets users track accounts, transactions, and budgets. It provides a dashboard with summary cards, charts, recent activity, and user settings.

## 2. Core Technologies
- **Framework**: Next.js (v16) – Server‑side rendering, API routes, and file‑system routing.
- **Styling**: Tailwind CSS with custom CSS variables (defined in `globals.css`).
- **Database**: PostgreSQL hosted on Neon, accessed via **Drizzle ORM**.
- **Authentication**: NextAuth v5 with email/password (or OAuth) and session handling.
- **Deployment**: Vercel (continuous deployment from GitHub).
- **Utilities**: `tailwind-merge` for class merging, `lucide-react` for icons, `recharts` for charts.

## 3. Repository Structure
```
CapiCash/
├─ .env.local            # environment variables (DB URL, NextAuth secret, etc.)
├─ .git/                # git repo data
├─ public/               # static assets (logo, mascot, favicons)
│   └─ mascot.png
├─ src/
│   ├─ app/               # Next.js app routes and layout
│   │   ├─ dashboard/     # dashboard pages (index, settings, accounts, …)
│   │   │   ├─ page.tsx   # main dashboard page
│   │   │   └─ layout.tsx# specific layout for dashboard area
│   │   ├─ layout.tsx      # root layout (html, body)
│   │   └─ globals.css    # Tailwind imports, CSS variables, utility classes
│   ├─ auth.ts            # NextAuth configuration
│   ├─ components/        # reusable UI components
│   │   └─ dashboard/
│   │       ├─ BalanceCard.tsx
│   │       ├─ RecentTransactions.tsx
│   │       ├─ TransactionsChart.tsx
│   │       ├─ Sidebar.tsx
│   │       ├─ CapiInsights.tsx   # insights widget (optional)
│   │       └─ Achievements.tsx   # achievements list (optional)
│   ├─ db/                # Drizzle schema and DB client
│   │   ├─ schema.ts
│   │   └─ index.ts
│   ├─ lib/                # helper utilities (e.g., twMerge wrapper)
│   ├─ scripts/            # auxiliary scripts for Stitch integration
│   │   ├─ fetchStitch.ts
│   │   └─ checkStitch.ts
│   └─ telegram/           # Telegram bot integration (optional)
├─ drizzle.config.ts     # Drizzle CLI configuration
├─ tailwind.config.ts    # Tailwind configuration (content paths, theme extensions)
├─ next.config.ts        # Next.js custom configuration
├─ package.json          # dependencies and scripts
└─ README.md             # high‑level project description
```

## 4. Data Flow
1. **User Authentication** – `src/auth.ts` configures NextAuth. Authenticated requests receive a session object containing the user ID and workspace ID.
2. **Row‑Level Security (RLS)** – Every server‑side query sets `app.current_workspace_id` using the workspace ID from the session. This isolates data per user.
3. **Dashboard Page** – `src/app/dashboard/page.tsx`:
   - Pulls the session.
   - Executes three main queries using Drizzle:
     - Recent transactions (limited to 10).
     - Monthly aggregates for income/expense.
     - Net worth (sum of account balances).
   - Formats data and passes it to UI components.
4. **Components** – Each component receives plain data props and renders:
   - `BalanceCard` – shows net worth, income, expense.
   - `TransactionsChart` – area chart for the last 30 days.
   - `RecentTransactions` – list of recent items with icons.
   - `Sidebar` – navigation links and user info.
   - Optional widgets (`CapiInsights`, `Achievements`) can be imported and placed in the layout.
5. **API Routes (if any)** – You can add custom API endpoints under `src/app/api/` for CRUD operations on accounts/transactions.

## 5. Database Schema (simplified)
```sql
-- accounts table
CREATE TABLE accounts (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT,
  balance NUMERIC,
  workspace_id UUID NOT NULL
);

-- categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY,
  name TEXT,
  type TEXT CHECK (type IN ('income','expense'))
);

-- transactions table
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  account_id UUID REFERENCES accounts(id),
  category_id UUID REFERENCES categories(id),
  amount NUMERIC,
  description TEXT,
  date DATE,
  workspace_id UUID NOT NULL
);
```
All queries respect the `app.current_workspace_id` set by the session.

## 6. Scripts (Stitch integration)
- `fetchStitch.ts` – Uses the Google Stitch SDK to download design assets. It is optional and does not affect runtime.
- `checkStitch.ts` – Validates that the required assets exist locally.
These scripts are kept in `src/scripts/` and can be run manually; they are **not** part of the production build.

## 7. Build & Deploy Workflow
1. **Local Development**
   ```bash
   npm install
   npm run dev   # starts Next.js dev server
   ```
2. **Production Build**
   ```bash
   npm run build   # Next.js compile (used by Vercel)
   ```
3. **Vercel Deployment**
   - Repository linked to Vercel with automatic builds on push.
   - Environment variables from `.env.local` are mirrored as Vercel env vars.
   - Vercel invokes `npm run build` and serves the output.

## 8. Environment Variables
| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (Neon). |
| `NEXTAUTH_SECRET` | Secret used by NextAuth for session signing. |
| `NEXTAUTH_URL` | Base URL of the app (used by NextAuth). |
| `STITCH_API_KEY` | (optional) API key for the Google Stitch SDK. |
| `STITCH_PROJECT_ID` | (optional) Project identifier for Stitch asset download. |

## 9. Testing & Linting
- **Lint**: `npm run lint` (configured via `eslint.config.mjs`).
- **Type checking**: `npm run typecheck` runs `tsc --noEmit`.
- **Unit / Integration tests**: You can add Jest or Vitest tests under a `tests/` folder.

## 10. Next Steps for a Fresh Start
1. **Create a new repo** (or clean the current one) and initialize a fresh Next.js project.
2. Add the **folder structure** above.
3. Set up authentication (`src/auth.ts`) and the Drizzle schema.
4. Implement the server‑side data fetching logic (queries with RLS).
5. Add the UI components (without yet applying any design tokens). They can be styled later using Tailwind utilities.
6. Commit and push; Vercel will handle the first build automatically.

---
*This document purposefully excludes any visual‑design specifics such as colors, gradients, fonts, or layout dimensions, focusing solely on the functional and architectural aspects of the CapiCash project.*

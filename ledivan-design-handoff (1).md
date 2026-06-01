# Ledivan — Design Handoff
## Direção escolhida: **Warm Glass Layered**

> Camada **apenas visual**. NÃO alterar rotas, estados, formulários, lógica, queries, nomes de campos, status keys, comportamento de filtros/tabs, conteúdo ou dados.
> Só substituir classes/estilos/tokens/animações. Estrutura JSX pode receber wrappers decorativos mas o conteúdo e a hierarquia semântica permanecem.

---

## 1. Tokens (cole em `globals.css` / `index.css` ou equivalente Tailwind v4 `@theme`)

```css
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400&family=Inter:wght@400;500;600;700&display=swap');

@theme {
  /* Brand */
  --color-brand-eggplant: #2b1830;
  --color-brand-eggplant-soft: #3a2240;
  --color-brand-creme: #faf6f1;
  --color-brand-surface: #ffffff;
  --color-brand-ink: #1a0f1f;
  --color-brand-muted: #6b5b6f;
  --color-accent: #8b5cf6;           /* violeta accent (glow) */
  --color-accent-soft: #c4b5fd;

  /* Status */
  --color-status-success: #047857;
  --color-status-success-bg: #ecfdf5;
  --color-status-warning: #b45309;
  --color-status-warning-bg: #fffbeb;
  --color-status-pending: #6b7280;
  --color-status-pending-bg: #f4f4f5;

  /* Typography */
  --font-display: 'Fraunces', ui-serif, Georgia, serif;
  --font-body: 'Inter', ui-sans-serif, system-ui, sans-serif;

  /* Easing */
  --ease-out-expo: cubic-bezier(0.19, 1, 0.22, 1);
  --ease-out-soft: cubic-bezier(0.16, 1, 0.3, 1);

  /* Elevations */
  --shadow-glass: 0 1px 2px rgba(43,24,48,0.04), 0 8px 24px -12px rgba(43,24,48,0.08);
  --shadow-glass-lg: 0 4px 16px -4px rgba(43,24,48,0.08), 0 24px 48px -16px rgba(43,24,48,0.16);
  --shadow-eggplant: 0 20px 40px -20px rgba(43,24,48,0.45);

  /* Radius */
  --radius-card: 1.5rem;        /* 24px */
  --radius-card-lg: 2rem;       /* 32px */
  --radius-pill: 9999px;
}

body {
  font-family: var(--font-body);
  background: var(--color-brand-creme);
  color: var(--color-brand-ink);
}

h1, h2, h3, h4, .font-display { font-family: var(--font-display); letter-spacing: -0.02em; }

/* Tabular nums para KPIs */
.tnum { font-variant-numeric: tabular-nums; }

/* Animações ----------------------------------------------------- */
@keyframes reveal-up {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes fade-in {
  from { opacity: 0; } to { opacity: 1; }
}
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}

.animate-reveal { animation: reveal-up .7s var(--ease-out-expo) both; }
.animate-fade   { animation: fade-in .4s var(--ease-out-soft) both; }

/* Stagger helpers */
.stagger > *:nth-child(1){ animation-delay: 60ms; }
.stagger > *:nth-child(2){ animation-delay: 120ms; }
.stagger > *:nth-child(3){ animation-delay: 180ms; }
.stagger > *:nth-child(4){ animation-delay: 240ms; }
.stagger > *:nth-child(5){ animation-delay: 300ms; }
.stagger > *:nth-child(6){ animation-delay: 360ms; }

/* Page transitions (use no <Outlet/> wrapper) */
.route-enter { animation: reveal-up .45s var(--ease-out-expo) both; }

/* Ornamentos de fundo (colocar uma vez no AppShell) */
.bg-ornaments::before,
.bg-ornaments::after {
  content: '';
  position: fixed;
  pointer-events: none;
  z-index: 0;
  border-radius: 9999px;
  filter: blur(120px);
}
.bg-ornaments::before {
  top: -10%; left: -5%;
  width: 40vw; height: 40vw;
  background: color-mix(in oklab, var(--color-brand-eggplant) 8%, transparent);
}
.bg-ornaments::after {
  top: 20%; right: -10%;
  width: 30vw; height: 50vw;
  background: color-mix(in oklab, var(--color-accent) 8%, transparent);
}

/* Glass card primitivo */
.glass-card {
  background: color-mix(in oklab, white 60%, transparent);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid color-mix(in oklab, white 80%, transparent);
  box-shadow: var(--shadow-glass);
  border-radius: var(--radius-card-lg);
}

/* Focus ring acessível */
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
  border-radius: 8px;
}
```

---

## 2. AppShell (layout global)

```tsx
// envoltório que abraça <Outlet/>
<div className="bg-ornaments flex min-h-screen bg-[--color-brand-creme] font-body text-[--color-brand-ink]">
  <Sidebar />
  <main className="relative z-10 flex-1 p-6 md:p-10 space-y-8 md:space-y-10 overflow-y-auto">
    <Topbar />
    <div className="route-enter" key={pathname}>
      <Outlet />
    </div>
  </main>
</div>
```

- `key={pathname}` no wrapper interno → cada troca de rota dispara `route-enter` (fade + slide-up sutil).
- Não muda nenhuma rota, só envelopa.

---

## 3. Sidebar

- Fundo `bg-[--color-brand-eggplant]`, texto `text-white/90`, largura `w-64` (em mobile vira drawer existente — não alterar lógica).
- Item ativo: `bg-white/10 border border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]` + bullet `bg-accent` com glow `shadow-[0_0_8px_var(--color-accent)]`.
- Itens normais: `text-white/60 hover:bg-white/5 transition-colors`.
- Cantos `rounded-xl`, `gap-3`, `px-4 py-3`.
- Bloco do usuário no rodapé: card `bg-white/5 border border-white/10 rounded-2xl p-3`.

```tsx
<aside className="sticky top-0 z-20 h-screen w-64 flex flex-col bg-[--color-brand-eggplant] text-white/90 shadow-2xl">
  <div className="p-8">
    <h1 className="font-display text-2xl font-semibold tracking-tight text-white">Ledivan</h1>
  </div>
  <nav className="flex-1 px-4 space-y-1.5">
    {items.map(item => (
      <NavLink key={item.to} to={item.to}
        className={({isActive}) => cn(
          "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors",
          isActive
            ? "bg-white/10 text-white border border-white/5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
            : "text-white/60 hover:bg-white/5"
        )}>
        {({isActive}) => (<>
          <span className={cn("size-1.5 rounded-full",
            isActive ? "bg-[--color-accent] shadow-[0_0_8px_var(--color-accent)]" : "bg-transparent")} />
          {item.label}
        </>)}
      </NavLink>
    ))}
  </nav>
  <UserCard />
</aside>
```

---

## 4. Topbar

```tsx
<header className="flex items-center justify-between animate-reveal">
  <div>
    <h2 className="font-display text-3xl font-medium tracking-tight">Bem-vinda, {firstName}</h2>
    <p className="text-[--color-brand-ink]/50 text-sm mt-1">{todayPtBr}</p>
  </div>
  <SearchInput />
</header>

// SearchInput
<div className="bg-white/40 backdrop-blur-xl border border-white/60 px-4 py-2 rounded-full
                flex items-center gap-3 w-64 shadow-sm ring-1 ring-black/5">
  <Search className="size-4 text-[--color-brand-ink]/40" />
  <input className="bg-transparent text-sm placeholder:text-[--color-brand-ink]/40 outline-none w-full"
         placeholder="Buscar pacientes..." />
</div>
```

---

## 5. KPI Card (substitui os cards de número do Dashboard / Finanças)

```tsx
<div className="group relative p-6 rounded-[2rem] glass-card animate-reveal">
  <div className="absolute top-4 right-4 size-12 bg-[--color-accent]/5 blur-xl
                  group-hover:bg-[--color-accent]/20 transition-colors" />
  <p className="text-[10px] font-bold uppercase tracking-widest text-[--color-brand-ink]/40 mb-2">
    {label}
  </p>
  <p className="font-display text-4xl font-semibold tnum">{value}</p>
  <div className="mt-4 flex items-center gap-1.5">
    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold",
      trend === 'up'   && "bg-emerald-100 text-emerald-700",
      trend === 'down' && "bg-rose-100 text-rose-700",
      trend === 'flat' && "bg-amber-100 text-amber-700")}>
      {delta}
    </span>
    <span className="text-[10px] text-[--color-brand-ink]/30">{deltaLabel}</span>
  </div>
</div>
```

Wrappear os KPIs em `<div className="grid grid-cols-2 md:grid-cols-4 gap-6 stagger">`.

---

## 6. Slot da Agenda

```tsx
<div className="group flex items-center gap-6 p-5 rounded-3xl
                bg-white/40 hover:bg-white/80 border border-white/60
                shadow-sm transition-all duration-500">
  <span className="text-sm font-medium w-12 text-[--color-brand-ink]/40 tnum">{hora}</span>
  <div className={cn("h-10 w-1 rounded-full",
    status === 'confirmado' && "bg-[--color-accent]/40",
    status === 'aguardando' && "bg-[--color-brand-eggplant]/20",
    status === 'finalizado' && "bg-emerald-400/40")} />
  <div className="flex-1 min-w-0">
    <p className="font-semibold truncate">{paciente}</p>
    <p className="text-xs text-[--color-brand-ink]/40 truncate">{detalhe}</p>
  </div>
  <StatusBadge status={status} />
</div>
```

Lista em `<div className="space-y-3 stagger">`.

---

## 7. StatusBadge (chip)

```tsx
const map = {
  confirmado: "bg-emerald-50 text-emerald-700 border-emerald-100",
  aguardando: "bg-[--color-brand-creme] text-[--color-brand-eggplant]/60 border-[--color-brand-eggplant]/10",
  finalizado: "bg-zinc-100 text-zinc-500 border-zinc-200",
  cancelado:  "bg-rose-50 text-rose-700 border-rose-100",
};
<span className={cn("px-4 py-1.5 rounded-full text-[10px] font-bold border", map[status])}>
  {label}
</span>
```

> **Importante:** mantenha as MESMAS chaves de status que o app já usa. Só altere a representação visual.

---

## 8. Painel "Ações Rápidas" (card de destaque)

```tsx
<div className="p-8 rounded-[2.5rem] bg-[--color-brand-eggplant] text-white shadow-2xl
                relative overflow-hidden animate-reveal">
  <div className="absolute -bottom-10 -right-10 size-40 bg-[--color-accent]/20 blur-3xl" />
  <h3 className="font-display text-xl mb-4">Ações Rápidas</h3>
  <div className="space-y-3 relative z-10">
    {actions.map(a => (
      <button key={a.id} onClick={a.onClick}
        className="w-full group flex items-center justify-between p-4 rounded-2xl
                   bg-white/10 hover:bg-white/20 border border-white/10
                   transition-colors text-sm font-medium">
        {a.label}
        <span className="group-hover:translate-x-1 transition-transform">→</span>
      </button>
    ))}
  </div>
</div>
```

---

## 9. Card de Paciente (listagem)

```tsx
<div className="flex items-center gap-3 p-3 rounded-2xl bg-white/40 border border-white/60
                hover:bg-white/80 hover:shadow-md transition-all duration-300">
  <Avatar className="size-10 rounded-full bg-[--color-brand-eggplant]/5
                     grid place-items-center text-[10px] font-bold
                     text-[--color-brand-eggplant]/60">
    {initials(nome)}
  </Avatar>
  <div className="min-w-0 flex-1">
    <p className="text-sm font-semibold truncate">{nome}</p>
    <p className="text-[10px] text-[--color-brand-ink]/40">Última visita: {ultimaVisita}</p>
  </div>
  <div className={cn("size-2 rounded-full",
    online === 'ativo'     && "bg-emerald-400",
    online === 'pendente'  && "bg-amber-400",
    online === 'inativo'   && "bg-zinc-300")} />
</div>
```

Grid: `<div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger">`.

---

## 10. Botões (variantes)

```tsx
// primary
"inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full
 bg-[--color-brand-eggplant] text-white text-sm font-semibold
 hover:bg-[--color-brand-eggplant-soft] active:scale-[0.98]
 transition-all shadow-[0_8px_20px_-8px_rgba(43,24,48,0.4)]"

// secondary (glass)
"inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full
 bg-white/60 backdrop-blur border border-white/80 text-[--color-brand-ink]
 text-sm font-semibold hover:bg-white/90 active:scale-[0.98] transition-all"

// ghost
"inline-flex items-center justify-center gap-2 h-10 px-4 rounded-full
 text-[--color-brand-ink]/70 hover:text-[--color-brand-ink] hover:bg-white/50
 text-sm font-medium transition-colors"

// destructive
"inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full
 bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 transition-colors"
```

---

## 11. Inputs

```tsx
<input className="h-11 w-full rounded-xl bg-white/70 backdrop-blur
                  border border-white/80 px-4 text-sm
                  placeholder:text-[--color-brand-ink]/40
                  focus:bg-white focus:border-[--color-accent]/40
                  focus:ring-4 focus:ring-[--color-accent]/10
                  transition-all" />
```

Labels: `text-[11px] font-semibold uppercase tracking-widest text-[--color-brand-ink]/50 mb-1.5`.

---

## 12. Tabs (detalhe do paciente)

```tsx
<div role="tablist" className="inline-flex p-1 rounded-full bg-white/60 backdrop-blur
                                border border-white/80 gap-1">
  {tabs.map(t => (
    <button key={t} role="tab"
      className={cn(
        "px-4 h-9 rounded-full text-xs font-semibold transition-all",
        active === t
          ? "bg-[--color-brand-eggplant] text-white shadow-sm"
          : "text-[--color-brand-ink]/60 hover:text-[--color-brand-ink]"
      )}>
      {t}
    </button>
  ))}
</div>
```

---

## 13. Skeleton (shimmer)

```tsx
<div className="h-4 rounded-md bg-[linear-gradient(90deg,#efe9e1,#f7f2eb,#efe9e1)]
                bg-[length:200%_100%] animate-[shimmer_1.6s_infinite]" />
```

---

## 14. Microinterações (regras)

- **Hover em cards**: opacidade do fundo `40 → 80`, `transition-all duration-500`.
- **Hover em botões secundários**: leve `translate-x-1` na seta interna.
- **Active**: `scale-[0.98]` em todos os botões primários/secundários.
- **Entrada de página**: `route-enter` no wrapper interno do `<Outlet/>`.
- **Listas/grids principais**: `.stagger` em volta para escalonar `animate-reveal`.
- **NÃO animar**: inputs durante digitação, valores numéricos em update (evita jitter).
- **Reduzir movimento**: respeitar `@media (prefers-reduced-motion: reduce) { *,*::before,*::after { animation: none !important; transition: none !important; } }` (adicionar ao CSS global).

---

## 15. Ajustes por tela (visual apenas)

- **Dashboard**: 4 KPI cards + bloco agenda (col-span-8) + coluna direita (col-span-4) com card berinjela "Ações Rápidas" e strip "Pacientes Recentes".
- **Pacientes**: trocar tabela por grid de cards (componente do §9). Manter filtros e busca atuais — só re-estilizar com `glass-card` no container.
- **Detalhe paciente**: header com avatar 64px + nome em Fraunces 28px + tabs (§12) + cards de timeline com `glass-card`.
- **Agenda**: slots da §6, dia/semana/mês toggle vira segmented control (§12 versão pequena).
- **Finanças**: KPIs do §5 + cards de gráfico em `glass-card`, gráficos com cor `--color-brand-eggplant` e accent `--color-accent`.
- **Analytics**: barras horizontais com gradient `linear-gradient(90deg, var(--color-brand-eggplant), var(--color-accent))` e largura animada `transition: width .9s var(--ease-out-expo)`.

---

## 16. O que **NÃO** mudar

- Rotas, paths, params, query strings.
- Nomes de campos, schemas, validações.
- Chaves de status (`confirmado`/`aguardando`/etc.).
- Lógica de filtros, ordenação, paginação.
- Conteúdo (textos, copy) — exceto se obviamente quebrado.
- Estrutura de dados, hooks, stores, mutations.

## 17. Checklist de PR para o Claude no VSCode

- [ ] Importar Fraunces + Inter no `index.html` ou no CSS global.
- [ ] Colar o bloco `@theme` + keyframes + classes utilitárias.
- [ ] Adicionar `.bg-ornaments` no AppShell e `route-enter` no wrapper do `<Outlet/>`.
- [ ] Re-estilizar Sidebar (§3) e Topbar (§4).
- [ ] Criar/atualizar componentes: `KpiCard`, `AgendaSlot`, `StatusBadge`, `QuickActionsPanel`, `PatientCard`.
- [ ] Aplicar variantes de Button, Input, Tabs, Skeleton.
- [ ] Adicionar regra `prefers-reduced-motion`.
- [ ] Verificar contraste AA (Fraunces grande sobre creme, texto Inter `text-[--color-brand-ink]` ≥ 14px).
- [ ] Rodar visual regression manual nas 5 telas principais.

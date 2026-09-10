# Histórico de evolução — Ledivan

Diário do produto: o que mudou, por quê, e o que ficou pendente. Mais recente em cima.
As **regras** do repo estão no `AGENTS.md`; aqui é a evolução.

Quem abre este app lê este arquivo antes de propor trabalho.

---

## 2026-09-10 — Ajustes do PDF de revisão do dono

**Entregue:** #127. Onze ajustes finos sobre os painéis: as contagens de ativos, inativos, quem
não veio na semana e cada queixa passaram a ABRIR a lista numa janela, no lugar do link "abrir"
no canto do cartão. Saíram o campo Situação, o link "ver histórico" e a linha duplicada de valor
no cartão do prospect; o filtro de idade da Presença; o cartão duplicado de pacientes ativos; e
a faixa de reservas do dashboard. O relatório de pacientes ganhou botão de imprimir.

**Por quê:** o dono revisou as telas no celular e marcou o que era duplicata ou não servia.

**Decisões que ficam valendo:**
- Número clicável é o padrão dos painéis. Não voltar a pendurar link "abrir" no canto do cartão.
- A tela `/dashboard/reservas` continua alcançável pelo cartão "Sessões reservadas" na ficha do
  paciente. Foi conferido antes de tirar a faixa; se mexer nesse cartão, a rota fica órfã.

**Armadilhas:**
- Botão de imprimir dentro do dashboard NÃO basta. A área é `h-screen overflow-hidden` com o
  conteúdo rolando numa div: sem soltar a trava de altura, o papel para na primeira página. Há
  um bloco `@media print` no `globals.css` e `print:hidden` no cromo. Medida da diferença: 900px
  na tela contra 3958px em impressão, com as 91 linhas.
- Com os blocos removidos, foram embora duas consultas ao banco que só existiam para alimentar
  números que ninguém lia mais. Ao apagar bloco, cheque a query que o alimenta.

**Pendente:** nada deste bloco.

---

## 2026-09-09 — Anotações manuscritas do dono: painéis, relatório e prospects

**Entregue:** #123 (painéis do dashboard), #126 (relatório de pacientes + campo escola; o #124
foi fechado pelo GitHub, ver Armadilhas) e #125 (prospects com histórico de contatos).

**Por quê:** o dono usou o app e escreveu num caderno o que faltava e o que sobrava.

**Decisões do dono que ficam valendo:**
- **Escola é CAMPO do paciente** (`school_name`, `school_contact`), não entidade própria, e não
  há integração com sistema externo de escola.
- **Prospect tem HISTÓRICO de contatos** (`prospect_contacts`): a mesma pessoa pode ser
  contatada várias vezes e aparece uma vez só na lista.
- **Relatório de pacientes é PÁGINA** (`/dashboard/relatorio-pacientes`), não painel. Atenção:
  `/dashboard/reports` já existia e é FINANCEIRO — são duas telas diferentes.
- No painel de prospecção, **"não fechou" conta como em aberto**; não é coluna separada.
- Aniversariantes **não mostra idade**.
- "Sessões do dia" olha o dia inteiro, da meia-noite à meia-noite, não de agora em diante.

**Bugs achados no caminho:** `createProspect` redirecionava para a ficha do paciente, então o
dono nunca via a lista e reclamava que "o cadastro não aparece"; e o formulário não tinha campo
de data embora a action já lesse `prospectDate`, então a data do contato era sempre o momento do
cadastro.

**Armadilhas:**
- **PR empilhado morre ao apagar a base.** Mergear com `--delete-branch` FECHA os PRs que tinham
  aquele branch como base, e depois não dá para reabrir. Reaponte os empilhados para `main` com
  `gh pr edit <n> --base main` ANTES de mergear a base.
- `Date.now()` em `useMemo` e `new Date()` no corpo de componente cliente: o primeiro nunca
  recomputa, o segundo diverge entre servidor e cliente. Data de "agora" vem do servidor por
  prop.

**Pendente:** o caminho de ESCRITA dos prospects não foi exercido no navegador — a conta de
demonstração é somente leitura e o proxy recusa POST.

---

## 2026-09-09 — Dívida de lint zerada e harness visual criado

**Entregue:** #118 (destrava o lint, parado há 5 dias, + 4 PRs do dependabot), #119 (83 achados
do React Compiler → 25), #120 (162 erros → 0, 96 avisos → 15), #121 (os 15 avisos restantes → 0:
13 imagens para `next/image` e as fontes para `next/font`), #122 (ícone do Jitsi 404 em produção
e widget de suporte saindo impresso).

**Por quê:** o lint estava quebrado e o CI escondia isso. Sem lint, a base acumulava erro real.

**Decisões que ficam valendo:**
- **Catraca de lint** (`npm run lint:catraca`), com teto em `lint-baseline.json`, roda no CI sem
  `continue-on-error`. O teto está em 0. Não subir o teto para "passar".
- **Regras do React Compiler não valem em Server Component.** 36 dos 49 achados eram falso
  positivo por isso.
- Fontes são auto-hospedadas por `next/font`. Não voltar a `<link>` para o Google: eram três
  requisições por página e o IP do usuário ia para o Google, o que importa num app de saúde.

**Armadilhas:**
- **`fullPage: true` não rola a página.** Tudo dentro de `<Reveal>` fica em `opacity-0` e imagem
  em lazy nem é pedida; a comparação antes/depois dá "idêntico" porque os dois lados estão cegos
  no mesmo trecho. Foi assim que um ícone 404 vivo em produção passou despercebido. O harness
  agora rola antes de fotografar.
- **A conta demo tem cota:** 20 sessões/hora por IP, fail-closed. Harness que loga por viewport
  estoura e as capturas caem em `/login?error=demo_limite`, o que parece bug do app. A sessão é
  reaproveitada em `_visual/.sessao-demo.json`.

**Ferramenta que ficou:** `scripts/visual-*` — captura de tela pública, do dashboard (entrando
pela demo), das páginas de impressão e das janelas que só existem após clique, mais diff de
pixel que aponta a faixa alterada. Documentado no `AGENTS.md`. Não adiciona dependência: usa o
Playwright do `@playwright/mcp` global.

---

## Antes de 2026-09-09

Reconstituído do `git log`; não é relato de sessão.

- **05 a 06/09** — Conta de demonstração pública "Dr. Sócrates", somente leitura e persistente
  (#101–#106), mais a paciente-modelo "Srta. Dionísia" para ver o outro lado. Status do dia e
  escrita terapêutica (#107, #108, #110). Logout que realmente desloga, na conta normal e na
  demo (#113). Segurança: `categories` ganhou `user_id`, encerrando taxonomia compartilhada
  entre tenants (#111). Provisionamento padronizado em `db:push`, com `schema.ts` como fonte da
  verdade (#112).
- **04/09** — Perímetro da demo, expiração de links públicos, login do paciente sem varredura da
  tabela e rate-limit por IP (#99, #100).
- **Antes disso** — agenda, pacotes, financeiro, previsão, Receita Saúde, transcrição com chave
  do próprio terapeuta, LGPD e os dois APKs publicados fora da loja. A base foi zerada em 30/08
  com backup guardado.

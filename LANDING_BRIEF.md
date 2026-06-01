# Brief para Landing Page — Ledivan+ (L'E-Divan)

> Documento para gerar uma landing page **vendedora e bonita** (ex: no Lovable).
> Contém: posicionamento, público, todas as funcionalidades, identidade visual exata (cores, fontes, logo), tom de voz, estrutura sugerida e copy. **Siga a identidade visual à risca** para a landing combinar com o app.

---

## 1. O produto

**Nome:** Ledivan+ (marca/logo: **L'E-Divan**)
**Categoria:** SaaS de gestão para consultório de terapia **com módulo financeiro integrado**.
**Uma frase:** *Seu consultório e suas finanças, num só lugar.*
**Pitch:** O Ledivan+ reúne, num app só, a gestão de pacientes, agenda e sessões com um financeiro completo — do atendimento ao caixa, sem planilhas espalhadas.

**App em produção:** https://levianpuls.vercel.app
**Idioma:** Português do Brasil (pt-BR).

---

## 2. Público-alvo

- Psicólogos, psicanalistas, terapeutas e psiquiatras **autônomos**.
- Clínicas pequenas (1–10 profissionais).
- Perfil: organiza pacientes em planilha, perde tempo cobrando pagamento, não enxerga o financeiro do consultório, usa várias ferramentas soltas (agenda no papel, banco à parte, anotações no caderno).

**Dores que resolvemos:**
- Caos de planilhas e cadernos.
- Faltas e remarcações sem controle.
- Cobrança e inadimplência sem visão clara.
- Financeiro do consultório desorganizado (não sabe quanto entra/sai por mês).
- Ferramentas demais, nenhuma integrada.

---

## 3. Proposta de valor (diferenciais — destacar na landing)

1. **Consultório + financeiro juntos** — não precisa de planilha + app de banco. Tudo conectado.
2. **Pagamento de sessão vira receita automaticamente** (vínculo opcional, o terapeuta decide).
3. **Registre gastos por WhatsApp, Telegram ou foto do recibo** — a IA lança pra você.
4. **Agenda visual** estilo Google Calendar, com status de cada sessão.
5. **Relatórios financeiros prontos** — receita, despesa e saldo mês a mês.
6. **Dados isolados e seguros** — cada terapeuta tem seu espaço privado (multi-tenant).
7. **Insights com IA** — dicas de gestão baseadas nos seus números.

---

## 4. Funcionalidades completas (para a grade de features)

### Consultório
- **Pacientes:** cadastro completo, busca e filtros (ativo/pausado/inativo), valor da sessão, frequência, tipo de contrato (avulso/pacote), dia de pagamento, endereço, contato de emergência, observações.
- **Histórico do paciente:** evolução de status, histórico de preços (reajustes) e de contrato.
- **Sessões:** agendar, duração, valor, anotações; status: **Realizada, Não realizada, Cancelada, Remarcada, Agendada**; marcação de cobrável.
- **Agenda semanal** estilo Google Calendar: grade de dias × horas, blocos coloridos por status, troca de status em 1 clique, navegação por semana + botão "Hoje".
- **Prospects:** captação de potenciais pacientes, observações, conversão em paciente ativo.

### Financeiro
- **Pagamentos de sessão:** PIX, cartão, dinheiro, transferência; status pago/pendente/atrasado.
- **Vínculo opcional pagamento → receita:** ao registrar um pagamento, ele pode virar automaticamente uma transação de receita no financeiro (liga/desliga nas configurações ou caso a caso).
- **Transações:** receitas e despesas, categorias, contas (conta corrente, poupança, dinheiro), lançamento manual, exclusão.
- **Exportar CSV** das transações.
- **Relatórios mensais:** receita, despesa e saldo por mês, com filtro de período (6 meses / 12 meses / tudo) e destaque da receita de sessões.
- **Metas / poupança:** objetivos com barra de progresso e prazo.
- **Gamificação (tom profissional):** XP, níveis e conquistas que incentivam a organização.

### Inteligência e automação
- **Scan de recibo com IA:** fotografe um comprovante → a IA extrai valor, descrição e categoria e lança a despesa.
- **Insights com IA:** análise dos lançamentos com dicas de gestão financeira.
- **Bot no Telegram:** registre lançamentos por texto/voz; comandos /saldo, /status, /insights.
- **WhatsApp:** registre gastos por mensagem ("50 material"), receitas, saldo e status.

### Integrações (nas configurações)
- **Google Agenda** (sincronizar sessões), **Gmail** (lembretes/recibos), **WhatsApp** (confirmações e lançamentos).

### Painel (dashboard)
- Resumo do consultório: **pacientes ativos**, **sessões da semana**, **receita de sessões no mês**.
- **Próximas sessões** (agenda do dia/semana à frente).
- Saldo total, receitas, despesas, gráfico de evolução e insights.

### Conta e segurança
- **Login com Google** ou **e-mail (link mágico)**.
- **Multi-tenant:** dados de cada terapeuta totalmente isolados.
- App rápido, responsivo, instalável (PWA).

---

## 5. Identidade visual (SEGUIR À RISCA)

**Estilo:** "Warm Glass Layered" — glassmorphism suave, quente e acolhedor; profissional e calmo (combina com o universo da terapia). Cantos bem arredondados, sombras suaves, fundo creme, blocos de vidro translúcido.

### Cores
| Token | Hex | Uso |
|---|---|---|
| Eggplant (primária) | `#2b1830` | textos de marca, botões primários, sidebar |
| Eggplant soft | `#3a2240` | variações |
| Creme (fundo) | `#faf6f1` | background geral |
| Surface | `#ffffff` | cards |
| Ink (texto) | `#1a0f1f` | corpo |
| Muted | `#6b5b6f` | texto secundário |
| Accent violeta | `#8b5cf6` | destaques, "+" do logo, glow |
| Accent soft | `#c4b5fd` | realces leves |
| Sucesso | `#047857` / bg `#ecfdf5` | status positivo |
| Aviso | `#b45309` / bg `#fffbeb` | status atenção |
| Neutro | `#6b7280` / bg `#f4f4f5` | status neutro |

### Tipografia
```
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,400&family=Inter:wght@400;500;600;700&display=swap');
```
- **Títulos (display):** **Fraunces** (serifada elegante), `letter-spacing: -0.02em`.
- **Corpo:** **Inter**.

### Formas e sombras
- Radius: cards `24px`, cards grandes `32px`, pílulas `9999px`.
- Sombra glass: `0 1px 2px rgba(43,24,48,.04), 0 8px 24px -12px rgba(43,24,48,.08)`.
- Sombra eggplant (CTA): `0 20px 40px -20px rgba(43,24,48,.45)`.

### Logo
- **L'E-Divan** — ilustração de um divã/sofá de terapia em traço, na cor berinjela.
- Arquivos no app: `/ledivan-color.png` (sobre fundo claro), `/ledivan-white.png` (sobre fundo escuro/berinjela).
- Em fundo escuro use a versão branca; em fundo creme use a colorida.

### Tom de voz
Acolhedor, calmo, confiável e profissional. Direto, sem jargão técnico. Fala com quem cuida de pessoas. Evitar tom "fintech agressivo"; preferir leveza e organização. (O produto teve origem com mascote lúdico, mas hoje é **profissional e sóbrio** — sem mascotes.)

---

## 6. Estrutura sugerida da landing

1. **Header** — logo L'E-Divan + botão "Entrar" (link para o app) e "Começar agora".
2. **Hero** — headline + subheadline + CTA + visual do app (mockup do dashboard/agenda).
   - Headline: *Seu consultório e suas finanças, num só lugar.*
   - Sub: *Pacientes, agenda e financeiro integrados — do atendimento ao caixa, sem planilhas.*
3. **Prova / credibilidade** — frase de confiança (ex: "Feito para terapeutas").
4. **O problema** — 3–4 dores (planilhas, faltas, cobrança, financeiro às cegas).
5. **Grade de funcionalidades** — cards com ícones (use os blocos da seção 4): Pacientes, Agenda, Financeiro, Vínculo automático, Scan com IA, WhatsApp/Telegram, Relatórios, Metas, Segurança.
6. **Como funciona (3 passos)** — 1) Cadastre pacientes e sessões → 2) Registre pagamentos (vira receita) → 3) Acompanhe agenda e relatórios.
7. **Integrações** — Google Agenda, Gmail, WhatsApp, Telegram, IA.
8. **Destaque diferencial** — "Registre um gasto mandando uma mensagem no WhatsApp" + "Tire foto do recibo e a IA lança pra você".
9. **Depoimento(s)** — placeholder.
10. **Preço** — placeholder (ex: plano único / teste grátis).
11. **FAQ** — segurança dos dados, precisa instalar?, funciona no celular?, integra com Google?
12. **CTA final** — "Organize seu consultório hoje" + botão.
13. **Rodapé** — logo, links, © 2026 Ledivan+.

**CTAs (texto dos botões):** *Começar agora*, *Entrar*, *Experimentar grátis*.

---

## 7. Instruções técnicas para quem gerar a landing (Lovable)

- **Idioma:** pt-BR.
- **Stack preferida para devolução:** React + Tailwind CSS (componentes), pois o app é **Next.js 16 + Tailwind v4** e a landing será integrada nele. Evitar libs pesadas/desnecessárias. Sem backend.
- **Responsivo** e acessível (contraste AA; Fraunces grande sobre creme, Inter ≥14px).
- **Sem mascote/emoji exagerado.** Visual sóbrio e elegante.
- Usar exatamente as **cores e fontes** da seção 5.
- Entregar como seções/componentes reaproveitáveis (Hero, Features, Steps, FAQ, CTA, Footer).
- Imagens: usar placeholders/mockups; o logo real será fornecido (`ledivan-color.png` / `ledivan-white.png`).

> Depois que o Lovable devolver o código, traga de volta aqui que eu integro a landing no app Next.js (rota `/`), adaptando para a stack e os tokens de tema já existentes.

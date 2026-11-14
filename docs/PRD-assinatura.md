# PRD — Teste grátis e assinatura (docs 72 e 73)

**Versão 2**, depois da revisão adversarial de 14/11/2026 — os achados estão em
[`REVISAO-PRD-assinatura.md`](./REVISAO-PRD-assinatura.md). Esta versão corrige o que era erro de
fato e fecha o que era decisão técnica. **Cinco decisões continuam sendo do dono (§11) e três delas
mudam o escopo inteiro — nenhuma linha de código antes delas.**

**Fonte:** doc 72 (especificação) + doc 73 (definições). **Decide:** o dono.

---

## 1. Objetivos (sem jargão)

Hoje o Le'Divan não sabe quem é cliente, não cobra ninguém e não tem como parar de atender quem não
paga.

1. Quem se cadastra ganha **30 dias** de uso completo, **sem cartão**.
2. Terminado o prazo, o app oferece o **plano único de R$ 100,00/mês**, por PIX ou cartão.
3. Quem não contrata **perde o acesso** — e **não perde os dados**.
4. Quem contrata pode **cancelar** e **voltar** depois.
5. **Ana Raquel e Gisele** são isentas, fora de qualquer bloqueio e fora da regra de teste.
6. O site institucional explica o produto e o preço.

## 2. Estado da arte (corrigido — a v1 errava dois pontos)

| Peça | Hoje, conferido no código |
|---|---|
| Cadastro | `/signup` existe **mas não é rota pública** (`src/proxy.ts`): visitante sem sessão vai para `/auth/login`. **O cadastro aberto não abre.** Abri-lo é mudança de proxy. |
| Onde nasce usuário | **Três lugares**: `src/app/auth/[auth0]/route.ts:142` (senha), `src/app/api/auth/auth0/route.ts:158` e `src/app/api/auth/google/callback/route.ts:55` (Google) |
| Verificação de e-mail | nenhuma — o signup grava `emailVerified: new Date()` direto |
| Cobrança | o app cobra **o paciente da terapeuta**. Cobrança **da** terapeuta não existe |
| PIX | **já existe**: `src/lib/pix.ts` gera copia-e-cola estático, sem API externa |
| Portas de autenticação | **quatro**, não uma: cookie (proxy), Bearer da terapeuta (`/api/app/*`), Bearer do paciente (`/api/patient/*`), cron (`/api/cron/*`) |
| Bloqueio existente | o claim `demo` em `src/proxy.ts` barra **escrita**, nunca navegação |
| Banco | `neon-http` — **sem transação interativa** (`src/db/index.ts`) |
| Sessão | JWT de **7 dias**, sem revogação (`src/lib/session-secret.ts`) |
| Datas | colunas guardam **hora de parede** de São Paulo (`src/lib/horaLocal.ts`) |
| Gateway | nenhum. Asaas escolhido, contrato não assinado |

## 3. O que é novo (e por que deve funcionar)

**(a) O veredito é derivado, nunca armazenado.** Guardam-se **fatos** — `acesso_ate`, `isento`, ids
do gateway. Uma função pura `podeUsar(fatos, agora)` decide, com o `agora` injetado. Sem coluna de
estado, sem cron de transição, e os 30 dias testáveis em milissegundos. É o padrão de
`lembretePorSessao.ts`.

**(b) A fronteira é de tenant, não de rota.** O cheque nasce onde o `userId` é resolvido — nas
quatro portas —, para que uma porta nova herde o estado por construção. Posto só no proxy, o
bloqueio fica ligado no painel e **sem efeito no app nativo**, em silêncio.

**(c) O gateway é a verdade, e não se confia no corpo do webhook.** O Asaas autentica por **token
estático em header**, não assina o corpo: é replayável. Ao receber o evento, o app **reconsulta a
API do Asaas** e decide pela resposta — forjar o POST não serve de nada.

**(d) Bloquear é tirar acesso, nunca apagar.** Prontuário tem prazo legal de guarda.

## 4. Desenho

### 4.1 Um campo decide

`acesso_ate` (timestamptz, null = ilimitado). **Pode entrar** = `acesso_ate is null || acesso_ate > agora`.
Isso cobre teste (criação + 30d), período pago, isento (null) e cancelado-com-período-pago. Some a
máquina de seis estados da v1: o que a tela mostra é escolhido pelo fato relevante
(`ja_pagou_alguma_vez`), não por um enum que alguém precisa manter correto.

Tabela `licenca` (nome próprio — ver §4.6): `user_id` único · `acesso_ate` · `isento` ·
`motivo_isencao` · `gateway_customer_id` · `gateway_subscription_id` · `metodo` · `valor_centavos`.
Tabela `licenca_eventos`: `gateway_event_id` **único** · `tipo` · `campos_selecionados` ·
`recebido_em` · `processado_em`.

**Só migração e script administrativo escrevem `isento` e `acesso_ate`.** Nenhuma server action de
usuário os alcança — senão é elevação de privilégio para uso grátis vitalício, e isso precisa de
teste próprio.

### 4.2 Fuso

`timestamptz`, comparação em instante absoluto, formatação em `America/Sao_Paulo`. **Nunca
`agoraParede` nesta tabela** — misturar as duas convenções bloqueia um dia antes, com o contador na
tela dizendo o contrário. Bordas obrigatórias no teste: conta criada às 23h e às 00h30.

### 4.3 Migração e backfill — no mesmo arquivo versionado

O backfill faz parte da migração: `INSERT … SELECT` que cria linha para todo usuário existente com
a política decidida (§11.4), e `isento = true` para as duas contas, por e-mail, no mesmo arquivo
revisável. **Linha ausente faz o código falhar alto** — nunca escolher um default.

### 4.4 Onde o bloqueio é aplicado

| Porta | Arquivo | Veredito |
|---|---|---|
| Cookie (páginas) | `src/proxy.ts` | redireciona para a tela de pagamento |
| Bearer da terapeuta | resolvedor de `/api/app/*` | 402/403 — **hoje essa porta não passa pelo proxy** |
| Bearer do paciente | `/api/patient/*` | conforme §11.1 |
| Cron | `/api/cron/*` | não dispara para conta bloqueada — são **sete** jobs, um veredito cada |
| Link público | `/agendar/<slug>` | "indisponível no momento" (resolve slug → usuário no servidor) |

O claim entra pelo único lugar que a casa já definiu para isso — `src/lib/claimsDaSessao.ts` —, mas
**o estado de assinatura não vai no cookie**: ele mentiria por até 7 dias nos dois sentidos, e
`auth()` já lê o banco a cada chamada.

**Escrita em curso nunca é recusada sem devolver o conteúdo:** quem cruza a meia-noite digitando uma
evolução não pode perder o texto.

### 4.5 Pagamento (Asaas)

- **A rota do webhook precisa entrar na lista pública do proxy** — senão todo evento toma 401 e o
  Asaas **pausa a fila**, com todo mundo pagando e ninguém sendo liberado, em silêncio.
- **Heartbeat obrigatório:** alerta se passaram 24h sem nenhum evento.
- **Idempotência numa instrução só** (`neon-http` não dá transação):
  `INSERT … ON CONFLICT (gateway_event_id) DO NOTHING RETURNING`, efeito só quando a linha foi
  inserida, `processado_em` gravado **depois** do efeito, e a reconciliação reprocessando o que
  ficou recebido-e-não-processado.
- **Extensão:** `acesso_ate = GREATEST(acesso_ate, agora) + interval '1 month'`. Teste em 31/01 e
  31/12.
- **Eventos que tiram dinheiro de volta** (estorno, chargeback, pagamento cancelado) têm efeito
  definido. Evento não tratado: registra, alerta, não muda nada.
- **Valor divergente** do combinado não estende nada sem decisão do dono.
- **Troca de método** só vale a partir do próximo período — não há dois métodos ativos.
- **Nenhuma chave no código.** `ASAAS_API_KEY`, `ASAAS_BASE_URL`, `ASAAS_WEBHOOK_TOKEN` em env, e o
  token comparado em tempo constante.

### 4.6 Nome próprio, para não colidir com o domínio

No código, **`assinatura` já é assinatura de documento** e **`cobrança` é a terapeuta cobrando o
paciente**. O dinheiro da casa se chama **`licenca`** (`src/lib/licenca/`), e vale a invariante:
**nada da casa entra em relatório financeiro do consultório**. Os R$ 100 são despesa dela — não
podem virar receita em nenhum total, nem consumir a numeração de recibo dela. A nota dos R$ 100 é
dela, e é o momento natural de pedir o CPF.

### 4.7 O que saiu da v1

- **Máquina de seis estados** → um campo derivado.
- **"Um teste por e-mail"** → cortado. A v1 já admitia que não funciona; pior, o e-mail não é
  verificado e a regra criaria um segundo oráculo de enumeração, permitindo queimar em massa
  e-mails de terapeutas reais (CRP é público). Se voltar: só depois de e-mail verificado.
- **`payload` cru do gateway** → campos selecionados, com prazo de retenção.

### 4.8 Exportar os dados é feature própria, não uma linha

Hoje só existe export por paciente e de transações. O export da conta precisa de **reautenticação**,
geração **assíncrona** com link que expira, **registro** de quem e quando, limite de taxa e aviso ao
dono da conta. Sem isso, é um GET que baixa o prontuário de todos os pacientes com um cookie de 7
dias — a maior superfície de exfiltração de dado de saúde do app. **A tela de bloqueio depende
dela**, e essa dependência estava escondida na v1.

## 5. Impacto

Hoje a receita é zero por desenho. **Mas este plano, sozinho, não produz a primeira pagante** — as
duas usuárias reais são isentas. Ver §11.5: sem resposta de onde vem a primeira assinante, o exame
final não tem sujeito.

## 6. Riscos

| Risco | Gravidade | Mitigação |
|---|---|---|
| Bloqueio ligado **sem efeito no app nativo** | alta | veredito nas quatro portas, com percurso para cada uma |
| Bloquear quem pagou (webhook perdido, fila pausada) | alta | reconsulta à API, reconciliação diária, heartbeat de 24h, carência, alerta ao dono |
| Webhook forjado / replay | alta | token em tempo constante **+ reconsulta à API** — nunca confiar no corpo |
| Dois meses por um pagamento (retry concorrente) | alta | idempotência numa instrução, não em duas |
| Migração trancar Ana/Gisele | alta | backfill na migração versionada, com as duas por e-mail no mesmo arquivo |
| Export virar exfiltração | alta | reautenticação, link que expira, registro, limite |
| Fuso errar o último dia | média | `timestamptz`, nunca `agoraParede` nesta tabela |
| Chargeback mantendo a conta ativa | média | eventos de reversão com efeito definido |
| Banco fora do ar na leitura do veredito | média | **fail-open com alerta**, com teto de tempo |
| Asaas mudar condições | média | `src/lib/licenca/` isola a chamada |

## 7. Custo (revisado)

| Fatia | Tamanho | Depende de |
|---|---|---|
| `acesso_ate` + predicado puro + backfill versionado | ~1 dia | decisão §11.4 |
| Veredito nas 4 portas + modo observar | ~2 dias | fatia 1 |
| Export da conta (reautenticação, assíncrono, registro) | ~1,5 dia | fatia 1 |
| Cadastro aberto + teste + contador + tela de vencido | ~1,5 dia | fatias 1 e 3 |
| Asaas: checkout, webhook, idempotência, reconciliação, reversões | ~3 dias | **sandbox** (não o contrato) |
| Site institucional (23 cards, 13 FAQ, preço) | ~1 dia | fatia 4 |

A v1 dizia "~1 dia" para o bloqueio e "~2 dias" para o Asaas, e escondia o export dentro de outra
fatia. **Economia do plano ainda sem número:** R$ 100 menos a taxa do Asaas, contra o custo mensal
de Vercel + Neon. Falta a conta — e o desenho adiciona carga a um banco que já estourou cota por
cadência nesta casa.

## 8. Prazo e ordem

**O sandbox do Asaas não depende do contrato.** A integração é implementável e testável antes dele;
o que espera o contrato é o dinheiro real. A v1 inflava o prazo por essa confusão.

Ordem: 1 → 3 → 2 → 4 → 5 → 6. A tela de bloqueio sem export e sem tela de pagamento é um beco sem
saída.

**Três modos, não dois** — e o modo mora no banco, não em env (env no proxy da Vercel só muda com
redeploy, logo não é interruptor):

1. `off` — nada acontece.
2. **`observar`** — calcula o veredito, **registra e alerta, não bloqueia**, por 1 a 2 semanas. É
   assim que se descobre que a regra bloquearia a Ana **antes** de ela ser bloqueada.
3. `aplicar`.

## 9. Exames

**Meio do caminho:**
- conta criada há 31 dias (relógio injetado) não entra; a de 29 dias entra;
- **com a chave aplicada**, Ana e Gisele entram;
- **app nativo com conta vencida é barrado** (a porta que o desenho da v1 deixaria aberta);
- link público de terapeuta bloqueada responde "indisponível"; nenhum dos sete crons dispara;
- webhook repetido **em paralelo** estende o período uma vez só;
- webhook com token errado não muda nada, e corpo forjado também não (reconsulta manda);
- chargeback encurta o acesso;
- usuário sem linha na tabela **falha alto**;
- POST de usuário comum **não** altera `isento`;
- conta bloqueada exporta os dados — com reautenticação e registro;
- 24h sem evento do gateway gera alerta.

**No fim:** uma assinatura real paga, com o dinheiro na conta do dono e a conta liberada sozinha.

## 10. Canal de aviso é pré-requisito, não dúvida

O WhatsApp e o SMTP são **da terapeuta**, não da casa. O PIX não renova sozinho: sem canal próprio,
a boa pagadora não é avisada e é bloqueada com paciente na sala — exatamente o pior risco da tabela,
causado pelo desenho. Ou a casa tem e-mail transacional próprio antes da fatia 5, ou o lançamento é
só cartão recorrente.

---

## 11. Decisões do dono (travam o início)

1. **Arquivo clínico sempre acessível, ou bloqueio total?** Separar "prontuário em leitura, grátis e
   perpétuo" de "operação do negócio, paga" dissolve de uma vez: bloqueio × LGPD, bloqueio × o
   paciente que não deve ser punido, e o risco de trancar uma pagante fora do prontuário no dia do
   atendimento. É a decisão que define a fronteira — e a fronteira é o item mais caro do plano.
2. **Cobrar à mão nos primeiros assinantes, ou integrar o Asaas desde já?** O PIX já existe no app
   (`src/lib/pix.ts`); o dono grava a data de acesso. Isso aguenta os primeiros clientes com **um
   campo e zero integração**, e responde a pergunta que nenhum código responde: alguém paga R$ 100?
   Se for por aqui, o gatilho para automatizar vai escrito: **mais de uma hora por mês gravando à
   mão, ou o 5º assinante** — o que vier primeiro.
3. **Período pré-pago (1, 6 ou 12 meses) ou mensalidade que renova?** Pré-pago mata o estado
   inadimplente, a cobrança dupla, e reduz o aviso de vencimento de doze toques por ano para um.
4. **Quem já tem conta hoje** (fora Ana e Gisele): ganha 30 dias a partir do deploy, ou nasce
   vencido?
5. **De onde vem a primeira assinante pagante, e em que prazo?**

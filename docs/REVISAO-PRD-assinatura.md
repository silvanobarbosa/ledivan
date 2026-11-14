# Revisão adversarial do PRD de assinatura — consolidado

**Data:** 14/11/2026 · **Alvo:** `docs/PRD-assinatura.md` (v1) · **Método:** cinco revisores frescos,
sem o histórico da conversa, um por lente (leitor ingênuo, arquitetura, simplicidade/YAGNI,
contradições, prontidão de implementação). Quem escreveu o plano não o aprovou.

Achados deduplicados, ordenados por severidade. Cada fato sobre o código foi reconferido no repo
antes de entrar aqui.

---

## Bloqueadores

### B1. A premissa do PRD sobre o "hoje" está errada em dois pontos

- **`/signup` não é rota pública.** `src/proxy.ts` lista as rotas abertas (`/`, `/demo`, `/login`,
  `/agendar`, …) e `/signup` não está entre elas: visitante sem sessão é mandado para
  `/auth/login`. O cadastro aberto que o PRD dá como existente **não abre**. Abrir é mudança de
  proxy que o plano não previu.
- **Usuário nasce em três lugares**, não num cadastro só: `src/app/auth/[auth0]/route.ts:142`
  (senha), `src/app/api/auth/auth0/route.ts:158` e `src/app/api/auth/google/callback/route.ts:55`
  (Google). Gravar `trial_ends_at` "no cadastro" esqueceria dois deles — e quem nasce sem data cai
  no default da migração, que é justamente a decisão em aberto.

### B2. "O bloqueio num lugar só, pela mecânica do demo" não funciona

Duas falhas somadas, as duas verificadas em `src/proxy.ts`:

- **A mecânica do `demo` barra escrita, não acesso.** Ela só age dentro de
  `if (!["GET","HEAD","OPTIONS"].includes(req.method))`. Copiada como está, uma conta vencida
  **navega o app inteiro** em GET.
- **O proxy libera dez caminhos antes de olhar a sessão**: `/api/app/*` (app nativo, autentica por
  **Bearer**, não por cookie), `/api/patient/*`, `/api/cron/*`, `/api/files`,
  `/api/sessions/confirm`, mais as páginas `/agendar`, `/p/`, `/humor/`, `/escala/`,
  `/sala-convidado/`. São exatamente as portas que o PRD chama de críticas. Um bloqueio posto só
  ali fica **ligado no painel e sem efeito no app nativo** — e em silêncio.

A fronteira não é de rota, é de **tenant**: tem de nascer onde o `userId` é resolvido (cookie,
Bearer da terapeuta, Bearer do paciente, cron), para que uma porta nova herde o estado por
construção. Pelo mesmo motivo que `src/lib/claimsDaSessao.ts` existe: o claim `demo` posto à mão em
cada porta já falhou uma vez, numa porta esquecida.

### B3. Estado de assinatura no cookie = até 7 dias de verdade errada, nos dois sentidos

O JWT é assinado com validade `"7d"` (`src/lib/session-secret.ts:43`) e não há revogação. Quem
pagou de manhã continua vendo a tela de cobrança; quem cancelou segue usando até o próximo login.

E o claim não compra nada: `auth()` já faz SELECT no banco a cada chamada. O veredito sai do mesmo
acesso. **Nada de estado de assinatura no cookie.**

### B4. O webhook, como está escrito, não sobe

- **A rota cairia em 401.** Um `POST` do Asaas não tem cookie e o caminho não está na lista pública
  do proxy → `401`. O Asaas acumula falhas e **pausa a fila**. Sintoma: todo mundo paga, ninguém é
  liberado, e nada alerta.
- **O Asaas não assina o corpo.** A autenticidade é por **token estático em header**, configurado
  no painel: é um bearer compartilhado, replayável, que vaza em qualquer log. "Conferir a
  assinatura" descreve um mecanismo que não existe no gateway escolhido. A defesa real é
  **reconsultar a API do Asaas** (`GET /payments/{id}`) e decidir pela resposta da consulta, nunca
  pelo corpo recebido — aí o forjamento é inútil mesmo com o token vazado.
- Falta **heartbeat**: alerta se passaram 24h sem nenhum evento. Hoje fila pausada é 100% silenciosa.

### B5. Idempotência "por `event.id`" não tem como funcionar como descrita

`src/db/index.ts` usa `neon-http`: **não há transação interativa**. "Insere o evento, depois estende
o período" são dois round-trips sem atomicidade. Dois retries em paralelo → dois meses por um
pagamento; insert ok e update falhando → pagante nunca liberado, em silêncio.

Precisa ser **uma instrução** (`INSERT … ON CONFLICT (gateway_event_id) DO NOTHING RETURNING`, e o
efeito só quando a linha foi de fato inserida), com `processado_em` gravado **depois** do efeito e a
reconciliação reprocessando o que ficou recebido-e-não-processado. O SQL vai no PRD — "é
idempotente" não é desenho.

### B6. Duas fontes de verdade para "pode usar?"

O PRD guarda `estado` **como coluna** e também as datas, mais `isento` como boolean **e** como
estado, mais a carência de 3 dias que não aparece na máquina de estados. Ninguém vira
`teste → vencido` (não há cron para isso), então a coluna fica `teste` para sempre e ninguém é
bloqueado — receita zero, em silêncio.

Guardar **fatos** (datas, ids do gateway, isento) e derivar o veredito numa função pura
(`podeUsar(fatos, agora)`), com o `agora` injetado — é o padrão que a casa já usa em
`lembretePorSessao.ts` e é o que torna "viajar 31 dias" testável em milissegundos.

### B7. A migração tranca as duas contas isentas

A tabela nova nasce vazia: **todo usuário existente fica sem linha**, Ana Raquel e Gisele
incluídas. Tratar ausência como `vencido` manda todas para a tela de pagamento no deploy; tratar
como ativo libera para sempre quem tiver linha faltando por bug.

O backfill é **parte da migração versionada**, com o `isento` das duas contas no mesmo arquivo
revisável — não um `UPDATE` manual antes do deploy, como o PRD propunha. E o código falha alto em
linha ausente, nunca escolhe um default.

### B8. O escopo atende zero usuária real

As duas únicas usuárias são isentas **por definição** (doc 73). Com `PAGAMENTOS_ATIVOS=false` como
o PRD propõe, as fatias 1, 2 e 4 não têm comportamento observável: ~4 dias de código em banco,
proxy, sessão e cadastro, exercidos por ninguém, validados só por teste sintético, esperando um
cliente que ainda não existe. Os exames do PRD rodam numa configuração que a produção não terá.

E o caminho manual já está no repo: `src/lib/pix.ts` gera PIX copia-e-cola estático, sem API
externa. Os primeiros assinantes pagam nesse PIX e o dono grava a data de acesso. Isso exige **um
campo** e zero Asaas, e produz a única informação que falta: alguém paga R$ 100?

### B9. "Exportar os dados" é uma feature inteira, e a mais perigosa do plano

Hoje só existe export por paciente (`src/app/api/patients/[id]/export/route.ts`) e export de
transações. O PRD promete export da conta inteira dentro de uma fatia de "~1 dia", e a tela de
bloqueio depende dela — dependência não declarada.

Pior: um GET que baixa o prontuário de todos os pacientes, autenticado por um cookie de 7 dias, sem
reautenticação, sem limite e sem registro, é a maior superfície de exfiltração de dado de saúde do
app. Precisa de reautenticação, geração assíncrona com link que expira, registro de quem/quando, e
aviso ao dono da conta.

---

## Maiores

### M1. Vocabulário colidindo com o domínio que já existe

No código, **`assinatura` é assinatura de documento** (`src/lib/assinaturaDoForm.ts`,
`certificadoDigital.ts`) e **`cobrança` é a terapeuta cobrando o paciente** (`cobrancas.ts`,
`cobranca_envios`, `/api/cron/cobranca`, `/api/cron/aviso-pagamento`). Uma tabela `assinaturas` e
uma lib `src/lib/pagamentos/` nasceriam com o significado oposto ao dos vizinhos.

Nome próprio e inconfundível: `licenca` / `src/lib/licenca/`. E uma invariante escrita: **o dinheiro
da casa nunca entra em relatório financeiro do consultório** — os R$ 100 são despesa dela, não
receita, e não podem cair em nenhum total nem na numeração de recibo dela.

### M2. O fuso: o PRD manda UTC, o app guarda hora de parede

`src/lib/horaLocal.ts` é explícito — as colunas guardam hora de parede de São Paulo em campos sem
fuso. Misturar `agoraParede()` na criação e UTC real no vencimento dá 3h de diferença: quem criou a
conta às 22h é bloqueada **um dia antes**, com o contador na tela ainda dizendo "falta 1 dia".

A tabela nova é nova: `timestamptz`, comparação em instante absoluto, formatação em
`America/Sao_Paulo`, e **nunca** `agoraParede` nela. Casos de borda obrigatórios: conta criada às
23h e às 00h30.

### M3. Aritmética de dinheiro não fechada

- "+1 mês" em 31/01 não existe; e estender a partir de `now()` em vez de `periodo_fim` faz quem
  paga 3 dias atrasado perder mais de um mês por ano. Regra:
  `periodo_fim = GREATEST(periodo_fim, agora) + interval '1 month'`, com teste em 31/01 e 31/12.
- **Faltam os eventos que tiram dinheiro de volta**: estorno, chargeback, pagamento cancelado. Hoje
  o cliente paga, usa 25 dias, pede chargeback, e a conta segue ativa.
- **Pagamento com valor diferente de R$ 100** não tem regra.
- "Trocar de método cancela o outro" não diz quem cancela nem o que acontece se o cancelamento
  falhar depois do novo já existir — é a janela de cobrança dupla que a própria tabela de riscos
  lista sem mitigar.

### M4. "Um teste por e-mail" é código escrito sabendo que não funciona — e abre dois buracos

O próprio PRD admite a brecha. Pior, o signup hoje grava `emailVerified: new Date()` **sem
verificar nada**, então a chave não vale nada; e já existe oráculo de enumeração (`409 "Já existe
uma conta com este email"`). A regra nova acrescenta um segundo oráculo para e-mails que nem têm
conta, e permite queimar em massa e-mails de terapeutas reais (CRP é público).

Corte a regra. Se um dia voltar: só queima teste depois de **e-mail verificado**, e resposta de
signup neutra.

### M5. "Reconferido em toda server action de escrita" é o antipadrão que esta casa já pagou

É a mesma disciplina manual que falhou com o claim `demo`, agora em dezenas de actions. Precisa
morar onde não há como esquecer: no resolvedor de sessão, devolvendo o veredito junto.

### M6. A chave é um interruptor que não interrompe

Env lida no proxy na Vercel só muda com **redeploy** — não é liga/desliga de runtime. E ligar de uma
vez bloqueia N contas simultaneamente, possivelmente durante atendimentos. Três modos, não dois:
`off` → **`observar`** (calcula, registra, alerta, **não bloqueia**, por 1-2 semanas) → `aplicar`. E
o modo mora no banco, se a ideia é o dono virar a chave.

### M7. Fail-open ou fail-closed na leitura do veredito não está dito

Neon com soluço de dois minutos: fail-closed manda todos os pagantes para a tela de cobrança.
Fail-open sem alerta deixa usar de graça. O certo aqui é **fail-open com alerta obrigatório** — o
custo de trancar um pagante é maior que o de alguns minutos de uso grátis.

### M8. O PIX depende de um aviso que o app não sabe mandar

O WhatsApp e o SMTP são da terapeuta, não da casa. O PIX não renova sozinho; sem canal próprio, a
boa pagadora não é avisada e é bloqueada com paciente na sala — o pior modo de falha da tabela de
riscos, causado pelo próprio desenho. Canal da casa é **pré-requisito**, não pergunta aberta.

### M9. LGPD tratada pela metade

- Falta o lado da **minimização**: guardar prontuário de quem nunca mais voltou, para sempre,
  também é problema. Precisa de prazo de guarda declarado, contado do último atendimento.
- O Asaas é **operador novo** de dado pessoal: base legal, contrato de operador, atualização de
  `/privacidade` e `/termos`.
- `payload` cru do gateway em tabela append-only sem retenção é depósito de PII. Guardar campos
  selecionados, ou com prazo.

### M10. A economia do plano não tem um número

R$ 100 menos a taxa do Asaas = quanto? Custo mensal de Vercel + Neon = quanto? O desenho ainda
**adiciona** carga (leitura por request, reconciliação diária, tabela de eventos crescendo) num
banco que já estourou cota por cadência nesta casa.

---

## As três transformações que valem mais que as correções

Cinco dos achados são a mesma contradição vista de ângulos diferentes: **o PRD trata "acesso" como
uma coisa só, binária, com data de validade.**

1. **Separar arquivo clínico de operação do negócio.** Prontuário, busca e exportação: grátis,
   perpétuo, só leitura. Agenda, cobrança do paciente, lembretes, portal, IA, relatórios: é o que
   vence e o que se paga. Com isso, bloquear deixa de brigar com a LGPD, o paciente não é punido
   pelo inadimplemento da terapeuta, e some o risco número um da tabela (pagante trancado fora do
   prontuário no dia do atendimento) — porque ninguém fica trancado fora do prontuário.
2. **Período pré-pago no lugar de mensalidade que renova.** Compra 1, 6 ou 12 meses. Não há
   renovação, logo não há falha de renovação: o estado `inadimplente` desaparece, a cobrança dupla
   fica impossível, um evento do gateway serve PIX e cartão, e o aviso anual cabe num e-mail — o que
   dissolve a pergunta aberta do canal.
3. **Cobrar à mão primeiro.** Um campo (`acesso_ate`), o PIX que já existe, e o dono liberando. O
   gateway entra quando gravar à mão doer: **mais de uma hora por mês, ou no 5º assinante** — o que
   vier primeiro. Esse gatilho vai escrito, senão a v1 vira dívida.

---

## O que precisa de decisão do dono

1. **Arquivo clínico sempre acessível, ou bloqueio total?** É a decisão que muda a fronteira
   inteira, e a fronteira é o item mais caro do plano.
2. **Cobrar à mão nos primeiros assinantes, ou integrar o Asaas desde já?** O sandbox do Asaas não
   depende de contrato — a integração é implementável antes dele; o que espera o contrato é o
   dinheiro real.
3. **Período pré-pago (1/6/12 meses) ou mensalidade recorrente?**
4. **Quem já tem conta hoje**, fora Ana e Gisele: ganha 30 dias a partir do deploy, ou nasce
   vencido?
5. **De onde vem a primeira assinante pagante, e em que prazo?** O exame final do PRD — "uma
   assinatura real paga" — hoje não tem sujeito possível.

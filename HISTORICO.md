# Histórico de evolução — Ledivan

Diário do produto: o que mudou, por quê, e o que ficou pendente. Mais recente em cima.
As **regras** do repo estão no `AGENTS.md`; aqui é a evolução.

Quem abre este app lê este arquivo antes de propor trabalho.

---

## 2026-09-13 — O lote da agenda das beta testers (11 fatias)

**Entregue:** #140 a #151, em onze fatias. Duas profissionais que testam o produto mandaram 18
páginas de ajustes na agenda. A leitura delas contra o código está em `PLANO-AGENDA.md`, que também
carrega o inventário do que o sistema já fazia — foi o documento levado à discussão com elas.

| # | PR | O que entrou |
| --- | --- | --- |
| 1 | #141 | Grade das 6h, cabeçalho de três linhas, feriado só no topo, "Escolher data", clique de 30 em 30 |
| 2 | #142 | Os cinco status, a cor por status, a tela "Vamos atender?" com as quatro saídas |
| 3 | #143 | O motor da sequência X/X e a cobrança seguindo o contrato |
| 4 | #144 | A célula com identificação e código (DEVOL, GRAT, AVUL, X/X, câmera, M/Q/S) |
| 5 | #145 | Bloquear e desbloquear horário |
| 6 | #146 | A janela de novo agendamento completa |
| 7 | #147 | O slot Q intercalado |
| 8 | #148 | A lista "Lembrar agendamento" no Dashboard |
| 9 | #149 | Editar e excluir com alcance |
| 10 | #150 | Inativar encerra a agenda futura sem status |
| 11 | #151 | Nada cortado em computador, tablet e celular |

**Por quê:** o pedido delas não era um conjunto de acréscimos. Três regras do lote SUBSTITUÍAM
regras que estavam no ar, e foi isso que justificou o plano antes do código.

**Decisões que ficam valendo:**

- **A cobrança segue a SEQUÊNCIA, não o calendário** (decisão do dono, 13/09). O erro mais fundo do
  motor antigo não era a regra de sequência: era cobrar tudo por mês do calendário, mesmo de quem
  não contratou por mês — e por isso a fatura de um paciente de pacote ENCOLHIA a cada desmarcação.
  Agora pacote cobra a sequência quando ela fecha, avulso cobra as sessões do mês. Quem paga na
  primeira do pacote vence na abertura.
- **A posição X/X é REFEITA, nunca guardada.** O lote pede alterar sessão passada, encaixar no meio
  e excluir em bloco — as três operações que um contador guardado tem que acertar sempre, e que
  erram em silêncio quando falham uma vez. Guardado fica só o contrato: quantas sessões.
- **Os status antigos ficam no banco**; o que mudou foi o rótulo. `realocada` continua sendo
  entendido e aparece como Desmarcou, mas saiu do menu.
- **Só FALTOU conta como falta** no risco. Antes "cancelada" entrava junto, e com Atestado no mesmo
  saco quem adoeceu viraria paciente de risco de evasão.
- **Horário bloqueado em tabela própria**, nunca como sessão com nome especial: assim não tem como
  vazar para pacote, fechamento, previsão ou risco.
- **Mensal não gera sessões**; o paciente entra em "Lembrar agendamento" nos últimos 3 dias do mês,
  e sai da lista sozinho quando a data é marcada.
- **Pausar não encerra a agenda**, inativar sim. Quem pausa pretende voltar.
- **Mover é UPDATE da linha existente**, nunca apagar e recriar — o lote proíbe duplicar.
- **Prontuário avisa, não trava** (decisão do dono, contra a sugestão da revisão externa): travar
  impede correção legítima e empurra para apagar a nota clínica.
- **Notificação continua configurável por paciente** (decisão do dono), com a conta guardando um
  padrão que o paciente novo herda.

**Armadilhas:**

- **A demo tem `recurrence_freq` nulo em 111 sessões recorrentes.** Sem a cor azul que saiu na
  fatia 2, elas ficariam idênticas a agendamento pontual. Ganharam um ícone genérico.
- **`Number(null)` é 0, não NaN** — o campo "horas antes" em branco virava 1 hora em vez do padrão
  de 24. Campo em branco é campo não preenchido, não zero.
- **Fundo transparente revelou sobreposição que existia havia tempo.** Duas sessões no mesmo
  horário se empilhavam, e o fundo opaco escondia que a de baixo sumia. São 4 casos numa única
  semana da demo. Agora dividem a largura da coluna (`agendaLayout.ts`).
- **Varredura responsiva por MEDIÇÃO, não por print.** 69 achados na primeira passada, 3 reais.
  Texto que vaza dois pixels some sem parecer estranho na imagem.
- **No celular não existe dica de tela.** Truncar com `title` é aceitável no computador e é perda
  de informação no telefone.
- A conta de QA (`qa.ledivan@`) é onde se escreve para testar; a demo é somente leitura. Sessão
  local por cookie assinado com `AUTH0_SECRET`. **Sempre limpar o que foi criado.**
- O `agenda_id` do paciente é opcional e está vazio em toda a demo — a célula cai no número de
  registro e depois no primeiro nome. Sem essa reserva a agenda ficaria muda.

**Pendente:**

- **Do dono:** o `agenda_id` passa a ser obrigatório no cadastro? E gratuito ficou como `GRAT`,
  onde antes era `SOCIAL` por escolha sua — diga se prefere voltar.
- **Consequência visível da decisão de cobrança:** com a conta seguindo a sequência, o mês fica
  irregular. Na demo, agosto mostra R$ 20.540 previsto contra R$ 41.389 recebido. Ao longo do ano
  convergem, porque cada sequência cobra uma vez só. Se incomodar, cabe uma visão acumulada ao lado
  do mês.
- A caixa "Abater do pacote" existe e grava, mas nenhuma devolutiva antiga está marcada — o efeito
  só aparece nas novas.

---

## 2026-09-13 — A tela que fecha o mês

**Entregue:** #137 e #138. A tela `/dashboard/fechamento` responde uma pergunta só: fechando este
mês, quem ainda deve, e quanto. A regra do pacote estava pronta e testada desde setembro; faltava
a tela que cobra.

Cada linha traz o paciente, quantas sessões a agenda contou, quantas o combinado cobra, o preço da
sessão, o valor do mês, o que já entrou e o saldo — com a palavra junto do número ("a receber",
"quitado", "pagou a mais"). No alto, três números: a receber, recebido e previsto.

**Decisões que ficam valendo:**
- **Tela separada da de pagamentos.** Pagamento é do dia a dia; fechamento é ritual de fim de mês.
  Misturar os dois faz a pessoa procurar o número errado com pressa. A tela abre no mês anterior,
  que é o que se fecha.
- **O preço é o que valia NAQUELE mês**, tirado do histórico de preço. Fechar agosto com o
  reajuste de setembro cobraria a mais, e a conta pareceria certa na tela.
- **Mês sem sessão nenhuma não cobra nada**, nem no pacote completo. Quem foi atendido três vezes
  num pacote completo deve quatro (é o combinado); quem não foi atendido nenhuma vez não estava em
  tratamento naquele mês.
- **Quem pagou a mais não abate a dívida de quem não pagou.** São pessoas diferentes, e somar os
  dois esconderia o inadimplente no total.

**Armadilhas:**
- A primeira versão cobrava quatro sessões de quem teve zero. Só apareceu ao abrir a tela na
  demonstração pública, com três anos de dados: R$ 33 mil de "a receber", dos quais R$ 22 mil eram
  dívida inventada. A regra estava com teste verde e mesmo assim errada — teste não substitui
  olhar a tela com dado de verdade.
- O "recebido no mês" pode passar do "previsto": dinheiro que entrou em agosto pode ser de julho,
  ou de pacote pago adiantado. É caixa do mês, não a conta do mês.
- O repositório não tem Playwright instalado; para olhar a tela rodando, o navegador veio de outro
  app da casa.

**Pendente:** marcar a cobrança como enviada a partir desta tela (hoje ela só mostra), e o reinício
da sequência do pacote, que continua esperando o dono definir o prazo dos agendamentos.

---

## 2026-09-11 — Revisão do dono no cadastro e o aviso de pagamento

**Entregue:** #134 e #135. O cadastro seguiu o PDF de revisão: o casal desceu para baixo do
endereço, o bloco do cônjuge ganhou ficha própria (nascimento, idade, queixa, gênero, endereço) e
esconde responsável e contato de emergência; a foto saiu; Devolutiva e Escola viraram áreas, nessa
ordem, e a aba Atendimento acabou. No financeiro, cada formato abre os próprios campos logo
abaixo do item marcado, entraram "na primeira sessão do pacote" e "na última sessão do pacote",
e o pacote fragmentado parou de perguntar semanas. Junto, o aviso de pagamento de quem paga a
cada sessão: uma mensagem, e a sessão fica marcada como pagamento atrasado se nada entrar.

**Por quê:** o dono revisou as telas no celular e anotou à mão o que estava fora de lugar ou
sobrando. A contagem do pacote por "semanas digitadas" não batia com a realidade: setembro com
três quartas cobra três sessões, outubro cobra quatro.

**Decisões que ficam valendo:**
- Modo de atendimento e recorrência são escolhidos no AGENDAMENTO, não no cadastro. Por isso a
  aba Atendimento não existe mais — quem tentar trazer o campo de volta está desfazendo isto.
- Quem conta as sessões do pacote é a AGENDA (`src/lib/pacoteMes.ts`): fragmentado conta o que
  cai dentro do mês; completo é 1/4 a 4/4 e reinicia, atravessando a virada do mês. Cancelada e
  realocada saem da conta. O valor do mês é esse total × o valor da sessão — a tela que vai
  cobrar ainda não existe, a regra já está pronta e testada.
- "Na primeira/última sessão do pacote" não têm dia de pagamento: o dia é o da sessão.
- O aviso de pagamento é UMA mensagem e não dispara ação nenhuma. Nada de segunda cobrança, de
  cancelamento automático ou de bloqueio: o profissional atende assim mesmo ou cancela a sessão.
  A agenda só marca "pagamento atrasado".
- No cadastro, gratuito se chama gratuito. A agenda continua marcando a sessão como "Social" —
  é a palavra que o dono usa na frente do paciente.

**Armadilhas:**
- O cron de aviso manda mensagem de verdade para paciente de verdade, e roda sobre TODOS os
  terapeutas. Não se testa isso apontando para o banco de produção: use `?dry=1`, que percorre
  tudo e não envia nem marca nada.
- O percurso de escrita falhava na linha do prospect logo depois de cadastrar: a lista ainda
  estava remontando e a linha não estava no DOM. O teste agora procura até achar, em vez de
  dormir um tempo fixo.

**Pendente:** o reinício da sequência do pacote depende do "prazo dos agendamentos", que o dono
ainda vai definir na área da agenda. A tela que cobra o valor do mês também é próxima etapa.

---

## 2026-09-10 — Cadastro: idade, anexos do prontuário e o formato de pagamento

**Entregue:** #131 e #132. O cadastro do paciente perdeu a classificação (criança/adolescente/
adulto/idoso) e passou a mostrar a IDADE calculada da data de nascimento, com um item de casal.
Dia e hora da sessão saíram do cadastro e ficaram só na agenda. A aba de fotos virou ANEXOS do
prontuário: laudo, relatório da escola, encaminhamento — arquivo privado, que o aplicativo do
paciente não lista e a rota de download recusa ao token dele. O bloco financeiro passou a ser
dirigido pelo FORMATO: gratuito, a cada sessão, mensal e quinzenal, e cada um pergunta só o que
usa (horas de antecedência, tipo de pacote, semanas do mês, segundo dia de pagamento, validade
do preço). O histórico de preço aparece na própria tela, com o próximo reajuste calculado.

**Por quê:** anotações do dono à mão, em PDF. A classificação envelhecia sozinha, as fotos 3x4
não eram o que ele guarda, e o financeiro perguntava dia de pagamento para quem paga por sessão.

**Decisões que ficam valendo:**
- Formato de pagamento é a chave do financeiro. `avulso` virou `sessao` e `pacote` virou
  `mensal` + `pacoteTipo`; a migração dos dados já rodou na base real (33 + 28 + 55 registros).
- Pacote `completo` são 4 sessões no mês; `fragmentado` é semanas × vezes por semana, e pode ter
  mais de uma sessão na mesma semana.
- `gratuito` aparece na agenda como **Social**, nunca como "de graça": é a palavra que o dono usa
  com o paciente, e alguém pode ler a tela por cima do ombro.
- A mensagem automática de cobrança (X horas antes da sessão) ficou de fora a pedido do dono,
  para depois dos outros itens.

**Armadilhas:**
- O caminho de ESCRITA nunca tinha sido percorrido em navegador. `scripts/e2e-escrita.mjs` faz
  isso com uma conta de QA de verdade. Ele guarda a sessão em `_visual/.sessao-qa.json` porque o
  login é fail-closed (10 por e-mail a cada 15 minutos) — e o cookie guardado é do domínio
  `localhost`, então rodar contra `127.0.0.1` derruba a sessão e o percurso falha na segunda tela.
- Produção é **ledivan.com.br**. `ledivan.vercel.app` responde outra coisa (tela de login com
  Google e link mágico, sem senha): conferir o app por lá dá conclusão errada.
- Os rádios do formato ficam dentro de cartões e o clique do mouse esbarra no layout; em teste,
  marcar pelo elemento (`el.click()` no próprio input) é o que reage.

**Pendente:** a mensagem automática de cobrança (quantas, o texto, e o que acontece se o
pagamento não vier) — do dono. A conta `qa.ledivan@reverblabs.com.br` continua na base real, sem
nenhum paciente.

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

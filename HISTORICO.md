# Histórico de evolução — Ledivan

Diário do produto: o que mudou, por quê, e o que ficou pendente. Mais recente em cima.
As **regras** do repo estão no `AGENTS.md`; aqui é a evolução.

Quem abre este app lê este arquivo antes de propor trabalho.

---

## 2026-10-26 — Base da Gisele limpa para a próxima rodada de avaliação

**Entregue:** 285 linhas apagadas da conta da Gisele — 197 sessões, 19 transações, 14 cadastros, 10
pagamentos, 3 horários bloqueados, 3 reajustes e os históricos financeiros dos pacientes. A CONTA
dela fica, com preferências, feriados e termos aceitos.

**Por quê:** ela monta cenários, usa o app, nós ajustamos, e ela recomeça a avaliação com a base
limpa. "Apagar a base" nesse pedido NÃO inclui a conta nem as configurações — ela precisa continuar
entrando, com o app do jeito dela.

**Decisões que ficam valendo:**
- **O procedimento virou `scripts/limpar-base-terapeuta.mjs`**, porque vai se repetir. Ele roda em
  ENSAIO por padrão (só conta) e só apaga com `--apagar`; aceita `LIMPAR_EMAIL` para outra conta; e
  confere no fim que sobrou zero.
- **Backup ANTES, sempre.** Branch Neon `backup-pre-limpeza-gisele-2026-10-26`
  (`br-shy-heart-acxkdbst`), ao lado dos de 30/08 e 09/10.
- **Apagar tabela por tabela, por nome, em vez de confiar no CASCADE.** Uma tabela sem a regra
  deixaria linhas órfãs — invisíveis em toda tela e eternas no banco.

**Armadilhas:**
- **O projeto no Neon chama "LividanPlus", com i.** Procurar por "ledivan" não acha, e a primeira
  busca voltou vazia como se o projeto não existisse. O id é `square-river-49620558`.
- **`sql(...)` do neon-http só funciona como tagged template.** Para query com parâmetro montada em
  string é `sql.query(texto, [valores])` — o erro que volta fala de template, não de SQL, e manda
  procurar no lugar errado.

**Pendente, e não é efeito da limpeza:** a conta da Gisele está **sem senha cadastrada**
(`password_hash` nulo) — ela entra só pelo Google. Em modo Testing do GCP isso exige o e-mail dela
na lista de test users, e o app mobile, que faz login por e-mail+senha, não abre. Ver
[[licao-validar-rodando]] e o caso idêntico da Ana Raquel em `ledivan-estado-set2026`.

---

## 2026-10-26 — Máscara de dinheiro: uma regra só, em todo campo de valor (#502)

**Entregue:** todo campo de dinheiro do app formata enquanto se digita — lançar pagamento, valor da
sessão avulsa, despesas, receitas pessoais, transações, ajuste do histórico, escaneamento de recibo.

**Por quê:** era o que sobrava da fila. Mas, ao começar, o problema era maior do que o pedido.

**A mesma regra estava escrita TRÊS vezes:** `MoneyInput` (desde 16/09), `reaisBRL` inline no
formulário de lançar pagamento, e `mascaraMoeda` — que EU criei no doc 57 sem ter procurado antes
se já existia. No formulário de pagamento as duas conviviam no mesmo campo: o valor inicial vinha
de uma, e na primeira tecla passava para a outra.

**Decisões que ficam valendo:**
- **A regra mora em `mascaraMoeda`** — pura, testada, com teste provando que concorda com o parser
  que grava. `MoneyInput` delega a ela; campo controlado chama direto. Duas FORMAS de campo
  (formulário e controlado), uma regra só.
- **Campo de dinheiro usa `inputMode="numeric"`**, não `decimal`: ele mostra `R$ 1.500,00`, e o
  teclado certo é o numérico.
- **Taxa de cartão NÃO leva máscara de moeda.** É porcentagem; pôr "R$" ali troca um erro de
  leitura por outro.

**Armadilhas:**
- **Procurar antes de criar.** `MoneyInput` existia desde setembro e fazia exatamente o que eu
  escrevi de novo. O custo não é a linha duplicada — é que as três tinham diferenças pequenas
  (só a minha limitava ao `numeric(10,2)`; `style: "currency"` usa espaço não separável), e é assim
  que duas regras divergem num centavo sem ninguém ver.

**Verificado em produção**, digitando no campo de despesa: `2 → R$ 0,02`, `200 → R$ 2,00`,
`150000 → R$ 1.500,00`, com teclado numérico.

---

## 2026-10-26 — Auditoria de produção zerada (#500)

**Entregue:** `npm audit --omit=dev` devolve **found 0 vulnerabilities**. Eram 23 em 22/10, com 2
críticas.

**Por quê:** as quatro altas que sobravam eram todas o MESMO pacote — `zod@4.1.11` escondido em
`@vercel/blob → @vercel/oidc → @vercel/cli-config`, na faixa da GHSA-mrhx-c7xc-m3w5.

**Decisões que ficam valendo:**
- **`override` prendendo zod em 4.6.7**, a mesma versão que o app já usa. Fica UMA versão na árvore
  inteira, em vez de duas, e o `@vercel/blob` não é tocado — ele é o caminho de upload de documento
  e foto do paciente, e não se mexe nele sem necessidade.

**Armadilhas:**
- **O `fixAvailable` do npm mentiu.** Ele sugeria "corrigir" indo para `@vercel/blob@2.4.0` — uma
  versão MAIS ANTIGA que a nossa (2.8.2). Conferido: não existe major 3 do pacote. Antes de aceitar
  um bump semver-major sugerido pela auditoria, olhar `npm view <pkg> versions`.
- **Build e `tsc` NÃO exercitam dependência aninhada.** O zod trocado só roda quando o blob monta a
  requisição. A conferência que vale é chamar a função: `put` SEM token percorre a cadeia de
  credenciais inteira — incluindo o `oidc`/`cli-config`, que é onde o zod vive — e falha com
  `BlobError` pedindo credencial. Erro do blob, não do zod: o caminho rodou inteiro.

**Não verificável:** servir um arquivo real de ponta a ponta. O único arquivo guardado na base
pertence à conta da Ana Raquel, e a conta de demonstração não tem nenhum. As três rotas que servem
arquivo respondem 4xx corretos (nunca 500), o que prova que executam.

---

## 2026-10-26 — Doc 57: a janela é a do que a sessão É, e o dinheiro tem três destinos (#495–#498)

**Entregue:**
- **#495** — a pergunta sai do RÓTULO, não do cadastro; títulos novos; o AVUL dispensado vira GRAT;
  textos da coluna de pagamento com as siglas da tela.
- **#496** — máscara de moeda no campo do valor.
- **#497** — estorno aparece como saída no extrato, e o saldo fecha em zero.
- **#498** — elegibilidade AVUL/X-X e crédito pendente quando não há próxima.

**Decisões que ficam valendo:**
- **A janela do "Faltou" é a do RÓTULO da célula, não a do formato do cadastro.** Quem já converteu
  uma vez (gratuito que virou AVUL) precisa, na segunda, da pergunta do AVUL — pelo cadastro a
  janela ofereceria converter o que já está convertido.
- **"Continuar cobrando esta sessão?" e não "Cobrar".** A sessão já é cobrada; com o verbo errado
  o "Não" parece não fazer nada, e ele converte para gratuita.
- **O AVUL dispensado PASSA A SER GRAT**, na agenda e na guia Geral. Antes ficava escrito AVUL numa
  linha que não cobrava nada.
- **Gratuito que respondeu "Não" não ganha aviso nenhum.** O texto antigo inventava um evento numa
  sessão que sempre foi gratuita.
- **Pagamento estornado é MARCADO, não apagado.** O extrato mostra as duas pontas e o saldo fecha em
  zero. E ele não quita nada — senão, perdida a cobrança, seria redistribuído e pagaria outra sessão.
- **Só AVUL ou X/X recebem pagamento transferido.** Mandar para uma GRAT faz o crédito desaparecer
  numa cobrança que não existe. O rótulo vem do mesmo motor que desenha a célula.
- **Sem próxima elegível, o valor vira CRÉDITO**, não erro nem estorno. Devolver obrigaria a
  terapeuta a estornar um dinheiro que o paciente não pediu de volta.

**Armadilhas:**
- **Mostrar a saída do estorno sem manter a entrada tiraria do mês um dinheiro que já não estava
  lá.** Eu apagava o pagamento; somar a saída por cima dava R$ 400 de buraco onde o certo é zero.
  É o que o documento chama de "evitando duplicidade", e só aparece fazendo a conta das duas pontas.
- **Três PRs em paralelo no mesmo arquivo.** Criei #495, #496 e #497 todas a partir de `main` e as
  três mexiam no mesmo trecho da guia Geral; a quarta rebaseou em cima da errada. Quando a leva toca
  o mesmo arquivo, empilhar na ordem desde o começo.
- **`cat > arquivo.py` com acento e rodar depois perde os acentos** (encoding do Windows). Heredoc
  inline funciona; arquivo intermediário, não.

**Verificado em produção:** célula `AVUL` abre "Continuar cobrando esta sessão?"; célula `2/4` abre
a do pacote. O roteamento pelo rótulo está valendo.

**Pendente:** os outros campos de dinheiro do app seguem sem máscara (lançar pagamento, valor da
avulsa no agendamento, despesas). Quem aprender o formato na janela da falta vai estranhar lá.

---

## 2026-10-24 — zod não era dependência declarada (#492)

**Entregue:** `zod` vira dependência direta em 4.6.7; `nodemailer` 10.1.3 → 10.2.1.

**Por quê:** advisories publicados no dia. O lockfile não mudava desde a #473, que havia zerado a
auditoria — não era regressão nossa.

**O achado que importa:** quatro rotas de API do app do paciente (`consent`, `diary`, `rating`,
`scales`) importavam `zod` **sem ele estar declarado**. Resolvia para uma cópia 4.4.3 que o
`@google/stitch-sdk` arrastava — e a #466 tinha acabado de mover esse SDK para `devDependencies`.
O app dependia, em produção, de algo declarado como ferramenta de build. E 4.4.3 está na faixa da
GHSA-mrhx-c7xc-m3w5 (alta, CVSS 7.5): exaustão de memória validando coleção grande, em rotas que
recebem entrada de fora.

**Decisões que ficam valendo:**
- **Pacote que o nosso código importa é dependência DIRETA**, declarada e fixada — mesmo quando
  "já funciona" por vir de outro.
- **O `nodemailer` subiu porque o app manda e-mail de verdade.** As três falhas do parser de
  endereço entregam mensagem a domínio que o cabeçalho não nomeia; lembrete de sessão vai por ali.

**Armadilhas:**
- **Pacote vulnerável que aparece como transitivo parece problema de terceiro.** Só olhando quem o
  IMPORTA a gravidade aparece. Antes de classificar como "não é nosso código":
  `grep -rn 'from "<pacote>"' src`.
- **Mover algo para `devDependencies` pode orfanar imports** do que ele arrastava. Foi o que a #466
  fez sem ninguém notar.
- **`npm audit fix --only=prod` PODA as devDependencies** — eslint e typescript somem, e a
  conferência seguinte falha com "módulo não encontrado", que parece defeito do código. `npm i`
  depois.

**Fica em aberto:** `zod@4.1.11` aninhado em `@vercel/blob → @vercel/oidc → @vercel/cli-config`. A
correção exige bump semver-major do `@vercel/blob`, que é o caminho de upload de documento e foto
do paciente, e o zod de lá valida respostas da API da Vercel — não a entrada dos nossos pacientes.
Decisão do dono.

---

## 2026-10-24 — Despesas: o quadro novo passa a enxergar o livro (#490)

**Entregue:** o quadro de Despesas e o extrato de Movimentações mostram as DUAS origens — as
cadastradas ali e as lançadas no livro (`transactions`). Fecha o último item do doc 55.

**Por quê:** a tela se contradizia. "Nenhuma despesa cadastrada" logo acima de uma tabela com três
anos de despesas. As duas estavam certas; olhavam lugares diferentes.

**Decisões que ficam valendo:**
- **A despesa do livro entra no quadro para LER, não para mudar de lugar.** Sem lápis, sem lixeira,
  e a linha diz `lançamento`, apontando onde ela se edita.
- **NÃO movi as linhas, que era o pedido literal.** A tabela nova não guarda categoria, forma de
  pagamento nem conta — as 202 têm as três —, então mover perderia justamente o histórico que a
  condição do pedido manda preservar. E Relatórios, exportação e conciliação leem do livro:
  esvaziá-lo faria os Relatórios somarem ZERO em despesas, numa tela que ninguém mandou mexer.
- **A consulta do quadro é própria, sem o filtro de período da tela.** Montá-la a partir da lista
  filtrada faria metade do quadro encolher ao filtrar e a outra metade não.

**Armadilhas:**
- **MEDIR antes de migrar mudou a decisão inteira.** As 202 despesas do livro são TODAS da conta de
  demonstração; Gisele e Ana Raquel não têm nenhuma, nem no livro nem na tabela nova, e nenhum
  lançamento está conciliado. O problema era de TELA, não de dado — e uma migração teria risco sem
  nenhum ganho hoje.

**Pendente:** a unificação de verdade (estender a tabela nova com categoria/forma/conta, migrar, e
reescrever Relatórios, exportação e conciliação para lerem de lá). É bloco próprio, e o dono decide
se vale — com dado real inexistente, o ganho hoje é zero.

---

## 2026-10-24 — Doc 55 fechado: a falta vira avulsa na hora, e o pagamento tem para onde ir (#484–#488)

**Entregue:**
- **#484** — textos das duas janelas e do checkbox de cortesia.
- **#485** — cortesia aplica direto, sem a janela "Alterar quais?".
- **#486** — cláusulas 4.1/4.2/4.3 do contrato gratuito, Receita Saúde abaixo da Agenda,
  "Meu Perfil" → "Ajustes", e saiu a explicação do tipo de cadastro.
- **#487** — "Sim" na falta do gratuito abre a janela do valor; a guia Geral já nasce preenchida.
- **#488** — "Não" numa sessão JÁ PAGA pergunta o destino do dinheiro: estornar ou transferir.

**Decisões que ficam valendo:**
- **A pergunta do pacote fala de NUMERAÇÃO, não de "contagem".** "Abater" e "contagem" são palavras
  do sistema; numeração é o que ela vê na célula e na tabela, e o que compara quando desconfia.
- **Cortesia não pergunta alcance.** O checkbox já diz "este atendimento", e o servidor só aplica à
  sessão editada. A janela tinha uma resposta certa só — e perguntar isso é cobrar um clique por nada.
- **No contrato GRATUITO a cláusula 4.3 é a cobrança por falta, não o reajuste.** Reajuste não faz
  sentido onde o valor é zero; sem a cláusula nova, o contrato não dá base para cobrar falta sem aviso.
- **O valor da falta é perguntado na hora.** Some o aviso "Esta sessão foi considerada cobrada" e o
  campo da guia Geral. Para mudar o valor depois, o caminho é marcar "Faltou" de novo — o mesmo da
  janela, que já ensina isso.
- **Pagamento lançado nunca some em silêncio.** Estornar apaga o pagamento (as somas derivam dele, e
  se ajustam sozinhas) e GRAVA o registro do estorno, para a guia Geral dizer para onde o dinheiro
  foi. Transferir muda só a cobrança a que ele pertence — data, valor, forma e quem pagou ficam.
- **A "próxima sessão" que recebe a transferência pula as que não aconteceram.** E sem nenhuma
  adiante, a transferência é RECUSADA em vez de deixar o pagamento preso a uma cobrança extinta.

**Armadilhas:**
- **PR empilhada volta a morder.** A #488 depende da #487; criei a #488 a partir de `main` e o
  import da #487 não existia lá. Rebase resolveu, mas o sintoma (símbolo não encontrado) não
  parece dependência de PR — parece erro de digitação.
- **`git checkout` com alteração não commitada levou a mudança do fracionado para dentro da PR do
  painel.** Separei depois. Commitar antes de trocar de branch, sempre.
- **Crase em `gh pr create --body "..."` é comida pelo shell** — três trechos sumiram em duas PRs.
  Escrever o corpo em arquivo e usar `--body-file`.
- **Heredoc `<<'EOF'` com acentos em string de código** saiu sem acento no texto que o usuário lê.
  Conferir o que foi gravado, não só o que o script disse.

**Verificado em produção** (demo, com os olhos): menu com Receita Saúde abaixo de Agenda e
"Ajustes"; textos das duas janelas palavra por palavra; checkbox só com o título.

**Pendente:** centralizar as despesas no módulo novo (decidido pelo dono, com migração segura
preservando os históricos) — único item do doc 55 que não entrou nesta leva.

---

## 2026-10-24 — O motor não chegava inteiro em três telas (#480–#482)

**Entregue:**
- **#480** — agenda, Fechamento e lista de pacientes voltam a ler a resposta do "Faltou".
- **#481** — Dashboard classifica em DUAS categorias; os pausados caem numa delas pela agenda.
- **#482** — no fracionado, a falta não abatida volta a empurrar a sessão para o mês seguinte.

**Por quê:** a terapeuta mandou print — a mesma sessão aparecia `1/4` na guia Geral e `2/4` na
agenda.

**A causa não estava no cálculo, estava na CONSULTA.** A lista de colunas que o motor precisa ler
estava copiada em quatro telas. Quando o doc 54 acrescentou `faltou_conta`, só a guia Geral passou
a trazê-la. Sem o dado, a resposta "não abater" nunca chegava ao motor naquelas telas — e ele
respondia outra coisa, em silêncio, porque cada tela sozinha ficava coerente consigo mesma.

O alcance era maior que o print: a **Fechamento** tinha a mesma falta, e ali o dado faltando não
desalinha um número — muda o dinheiro somado no mês.

**Decisões que ficam valendo:**
- **A lista de colunas do motor mora em `colunasDaSessao.ts`, num lugar só**, com o motivo de cada
  uma escrito ao lado. Acrescentar um dado que o motor lê é mexer num arquivo.
- **Dashboard tem DUAS caixas: Ativos e Inativos.** Pausado com sessão marcada à frente é Ativo;
  sem nada marcado, Inativo. É classificação de EXIBIÇÃO — o status gravado continua "pausado", e
  a ficha, a lista e o filtro da visão financeira seguem usando-o.
- **No fracionado, a falta não abatida ocupa vaga** e empurra a última sessão para o mês seguinte,
  como Desmarcou/Atestado. O mês seguinte REDUZ a quantidade cobrada, e o total se conserva. Não
  são duas regras brigando: é uma redistribuição.
- **A transparência da falta continua valendo onde evitou regressão real:** ela não data a cobrança
  (não puxa vencimento nem competência) e não entra no valor da quinzena.

**Armadilhas:**
- **Testes de motor alimentam a entrada COMPLETA.** Todos eles montam o objeto na mão, como a guia
  Geral faz — ninguém testava o que a agenda realmente envia. Três divergências de numeração em
  três dias, e nenhuma conferência automática pegou nenhuma.
- **Olhar um mês isolado e concluir "encareceu" é erro de medição.** Meu teste de ontem fazia isso
  e me levou para o desenho errado no fracionado. A pergunta certa é sobre o TOTAL entre os meses.
- **`git checkout` de branch com alteração não commitada leva a alteração junto.** A mudança do
  motor entrou na PR do painel; separei depois, mas quase viajou de carona numa revisão que não
  olharia para ela. Commitar antes de trocar de branch.
- **Crase em corpo de PR pela linha de comando é comida pelo shell.** Três trechos sumiram em duas
  PRs. Escrever o corpo em arquivo e usar `--body-file`.

**Não verificável no ar:** a divergência exata não dá para reproduzir em produção — não existe
nenhuma sessão com a resposta "não abater" gravada (as terapeutas testam e apagam). O conserto está
provado por teste e por leitura do código; a confirmação na tela depende de refazerem o caso.

**Pendente — resto do doc 55:** textos dos dois modais e do checkbox de cortesia; janela de valor ao
responder "Sim" no gratuito; comportamento do "Não" com estorno/transferência de pagamento; cortesia
aplicada sem a janela "Alterar quais?"; contrato do gratuito (4.1, 4.2 e cláusula 4.3 nova); menu
"Meu perfil" → "Ajustes"; Receita Saúde abaixo de Agenda. Mais a centralização das despesas no
módulo novo, já decidida.

---

## 2026-10-22 — Fila de pendências zerada: spinner, hidratação, Escape, bateria de QA, dependências (#469–#475)

**Entregue:**
- **#469 — spinner eterno em TRÊS telas**, não uma. `montarMovimentacoes`, `pagamentosPorMesDoAno`
  e `vencimentosEm` são Server Actions chamadas num efeito, e o `.then()` não tinha `.catch()`.
- **#470 — hidratação (#418) em três telas.** Inclui um achado maior que o erro de console: o link
  público de agendamento aparecia QUEBRADO até o React hidratar.
- **#471 + #475 — Escape fecha as janelas.** Nenhuma das nove fechava.
- **#472 — `test:parallel` volta a medir algo**, depois de quase dois meses morta.
- **#473 — zero vulnerabilidades de produção** (eram 5).

**Por quê:** era a fila que sobrou do SuperQA, toda ela "depende só de mim".

**Decisões que ficam valendo:**
- **O hook de Escape mora em arquivo próprio, não em `modal.ts`.** O `modal.ts` argumenta que as
  medidas ficam num lugar só e seria o lugar natural, mas ele só exporta texto de classe e pode ser
  lido por componente de servidor. Hook ali seria armadilha para o próximo.
- **Bateria de QA afirma INVARIANTE, nunca fotografia.** Contagem que muda com o uso vira
  informação no relatório. Foi transformar contagem em asserção que matou a bateria da outra vez.
- **Ferramenta de build não mora em `dependencies`** (vem da #466 e continua valendo).

**Armadilhas:**
- **`keydown` é evento DISCRETO: o React descarrega a atualização de forma SÍNCRONA, dentro do
  disparo.** Com `fechar` nas dependências do efeito (arrow nova a cada render), fechar a janela de
  baixo removia o ouvinte da de cima ANTES dele ser chamado — e, pela especificação do DOM,
  ouvinte removido durante o disparo não executa. Com duas janelas abertas (o caso comum), um
  Escape fechava só uma. Cura: `fechar` numa ref, efeito dependendo só de `aberto`.
- **O CI ficou verde com a correção incompleta.** Só apareceu conferindo no navegador, em
  produção, com uma sonda contando o evento no `document`. Evento sintético fechava as duas; tecla
  real, não — foi essa diferença que apontou a causa.
- **Li o DOM antes do React re-renderizar** e quase registrei um falso negativo. Depois de
  disparar evento, esperar antes de conferir.
- **Escrever em ref no corpo do componente** acusa `react-hooks/refs`. Atualizar num efeito sem
  dependências é o caminho; a regra existe porque em render concorrente o corpo pode rodar duas vezes.
- **A catraca de lint não falha o `&&` da linha de comando quando você a canaliza para `tail`** —
  o código de saída vira o do `tail`. Rodar sozinha e conferir o `$?`.

**Investigado e NÃO era bug:** "Nenhuma despesa cadastrada" com o extrato listando despesas. São
duas tabelas: `despesas` (módulo do doc 50) tem **0 linhas** para a conta demo, e os R$ 26.740 do
`/reports` vêm de `transactions` (legado). O card está certo para a tabela dele.

**Mas isso revelou pendência real:** o módulo novo de Movimentações/Despesas **não enxerga** as 202
despesas que a conta demo tem em `transactions`. Duas noções de despesa convivendo, e a tela nova
mostra só uma. Decisão do dono: migrar, unificar a leitura, ou aposentar uma delas.

**Pendente:**
- **Prender o foco** dentro da janela aberta (focus trap). O Escape resolveu a saída; o foco
  continua passeando pela página atrás da janela.
- Cortesia em sessão JÁ PAGA (decisão do dono: recusar, avisar, ou permitir).
- Dashboard diz "73 no cadastro"; `/patients` lista 91. São `pausado` e `prospect` fora da conta —
  decisão do dono sobre a regra.
- As duas noções de despesa, acima.

---

## 2026-10-22 — SuperQA achou 4 regressões de dinheiro no lote do doc 54 (#466, #467)

**Entregue:**
- **#467** — a falta não abatida volta a não encarecer nem mover cobrança nenhuma.
- **#466** — ferramenta de design sai de `dependencies`: 21 vulnerabilidades de produção
  (1 crítica, 15 altas) caem para 5, nenhuma crítica. Zero linha de runtime mudada.

**Por quê:** fazer a falta não abatida PAUSAR em vez de sair do pacote (entrega da manhã) a
colocou dentro do fluxo do motor — e ela passou a CONTAR nele. Quatro formatos saíram cobrando
diferente do dia anterior: quinzenal pedia uma sessão a mais (R$ 600 → R$ 800); fragmentado
ganhava uma vaga no mês (R$ 400 → R$ 600) E deixava a sequência aberta, fazendo a cobrança
SUMIR da Fechamento; primeira do pacote mudava a competência de mês; última do pacote movia o
vencimento para a data da falta. Em produção o alcance era zero — não existe nenhuma sessão
com "não abater" no banco —, então ninguém chegou a ser cobrado errado.

**Decisões que ficam valendo:**
- **Pausa por RESPOSTA ≠ pausa por STATUS.** Falta não abatida e cortesia pertencem ao grupo de
  pagamento e exibem a posição onde pararam, mas são INVISÍVEIS para contar: não viram vaga, não
  datam a cobrança, não entram no valor. Desmarcou, Atestado e Prof. desm. continuam como sempre
  foram — são sessões CONTRATADAS, ocupam vaga e seguram o denominador ("o denominador não
  encolhe", a regra do fracionado). `agrupar()` em `sequenciaPacote.ts` separa o que a sequência
  CONTÉM (ids, o grupo de pagamento) do que a DATA (primeira/última ocupante, o dinheiro).
- **`faltouConta` sem resposta grava `null`, nunca `true`.** A tela Atender encerra como "Faltou"
  sem abrir a janela, de propósito; num paciente gratuito aquele `true` virava cobrança avulsa.
- **Ferramenta de build não mora em `dependencies`.** `shadcn`, `@google/stitch-sdk` e o SDK de
  MCP arrastavam um Express inteiro para o grafo de produção de um app que roda Next na Vercel.

**Armadilhas:**
- **A suíte de 1.001 testes passou inteira com as 4 regressões dentro.** Nenhum teste cobria
  quinzenal, fracionado ou primeira/última do pacote com falta não abatida. Mexeu no motor de
  cobrança? Varra os formatos TODOS, não só o que o documento citou.
- **O método que achou foi comparar com o motor ANTIGO**, copiando `cobrancas.ts`/
  `sequenciaPacote.ts` do commit anterior para um diretório de teste e rodando as duas versões
  na mesma entrada, no mesmo processo. Vale repetir sempre que o motor mudar.
- **Medir o raio em PRODUÇÃO antes de entrar em pânico.** Um `SELECT` mostrou zero sessões
  afetadas e transformou "incidente" em "corrigir com calma".
- **Relatório de agente não é verdade.** Um deles reportou "tela diz GRAT, motor cobra" como
  Alto; conferido, o rótulo dizia AVUL e tela e cobrança concordavam. O defeito real era outro e
  menor. Reproduzir antes de corrigir.
- **A bateria `test:parallel` está morta** desde o wipe de 30/08: procura
  `giselebarrossantos@gmail.com` (a conta é `giselesantosbarbosa@`), nome "Gisele Barros Santos"
  (é "Gisele Barbosa"), conta demo `demo@ledivan.com.br` (é `socrates@`) e afirma `expected: 65`
  pacientes. Seis vermelhos constantes que ninguém lê.

**Pendente:**
- Reescrever `tests/test-ledivan-parallel.ts` para INVARIANTES (cada dado tem dono, nenhum dono
  enxerga o do outro) em vez de fotografia da base. Começado e não terminado hoje.
- Cortesia pode ser marcada em sessão JÁ PAGA; se todas as sessões de uma quinzena virarem
  cortesia, a cobrança some e o pagamento fica sem vínculo.
- `/dashboard/transactions`: spinner "Montando o extrato…" nunca some, com as 1.737 linhas já
  renderizadas abaixo. E os cards dizem "Nenhuma despesa cadastrada" enquanto o extrato lista
  despesas.
- Escape não fecha a janela "Abater esta sessão do pacote?" (e ela não prende o foco).
- Hydration mismatch (React #418) em `/mensagens`, `/settings` e ao menos uma ficha.
- Dashboard diz "73 no cadastro"; `/patients` lista 91.
- As 5 vulnerabilidades de produção que sobraram (undici, postcss, nanoid, source-map-js,
  baseline-browser-mapping), todas com correção disponível.

---

## 2026-10-22 — Doc 54 fechado, e uma RCE crítica no Next (#460–#463)

**Entregue:**
- **#460 — "Faltou" no pacote PAUSA a sequência.** Responder "Não" TIRAVA a sessão do pacote.
  Tirar não é pausar: ela perdia o número (virava `—`) e saía do grupo de pagamento. Era a
  tabela desorganizada que ele relatou. Agora mantém o número onde a falta aconteceu, a
  próxima assume a posição, e ela continua no pagamento daquele pacote.
- **#460 — gratuito + "Sim" passa a fazer alguma coisa.** Não fazia nada: paciente gratuito
  não gera cobrança, e a resposta ficava guardada sem efeito. Agora a sessão é cobrada como
  AVUL, em R$ 0,00 até o valor ser lançado na própria linha.
- **#460 — o selo "Cobra / abate" saiu da tabela** e a janela da agenda passou a dizer como
  refazer a escolha.
- **#461 — reajustes na mesma vigência voltam a poder ser apagados.**
- **#462 — "Este atendimento será uma cortesia"** no editar agendamento, em pacote completo
  mensal/quinzenal.
- **#463 — Next 16.4.0 → 16.4.2.**

**Por quê:** documento do dono (doc 54), quatro itens, todos vindos do uso real. O #463 não
estava no documento — apareceu sozinho, ver abaixo.

**Decisões que ficam valendo:**
- **Pausar e EXCLUIR do pacote são coisas diferentes**, e a diferença aparece na tela. Pausada,
  a sessão mantém o número e o grupo de pagamento; excluída, perde os dois. Faltou-não-abatida
  e cortesia PAUSAM. Isso substitui a regra do doc 45, que excluía.
- **A cortesia é do pacote, não uma sessão extra.** `extra: "grat"` acontece FORA do pacote e
  sai do grupo de pagamento — seria o lançamento isolado que o doc proíbe em letra. Por isso
  coluna própria (`therapy_sessions.cortesia`), não reuso do extra.
- **Cortesia vale só para a sessão editada, nunca para o bloco.** "Este e os próximos" existe
  para mudar horário; em série, dispensaria meses de pagamento com um clique.
- **Gratuito + "Sim" é DERIVADO, não gravado.** A janela promete que remarcar "Faltou" refaz a
  escolha; uma coluna gravada obrigaria a desfazer o efeito antigo em todo caminho que grava
  status — o mesmo motivo pelo qual a sequência nunca é guardada.
- **Só o "Sim" EXPLÍCITO cobra.** Falta antiga sem resposta (`null`) nunca gerou cobrança, e não
  é agora que vai gerar dívida retroativa em paciente que não paga.
- **A ENTRADA do histórico de reajuste é UM REGISTRO, não uma data.** Protegendo por data, várias
  alterações na mesma vigência empatam todas no mínimo e nenhuma é removível.

**Armadilhas:**
- **O `next build` passou a RECUSAR com `SecurityFatalError`**, e tinha razão: Next 16.4.0 está
  na faixa da GHSA-2464-fhr4-w9xw — **execução remota de código SEM autenticação** na API de
  otimização de imagem via SVG (`>=16.0.0 <=16.4.0`). Produção rodou com isso. O bump é patch.
  Achado por acaso, fechando outra coisa: **`npm audit --omit=dev` precisa entrar na rotina**,
  não só no CI.
- **No ramo "Sim" o motor JÁ ESTAVA CERTO.** Gastei tempo procurando um defeito de cálculo que
  não existia; o que bagunçava a tabela da imagem era a LINHA EXTRA do selo. Antes de caçar bug
  no motor, reproduzir a saída dele — levou um teste e três minutos.
- **PR empilhada: reaponte a base ANTES de mergear.** `gh pr edit 462 --base main` antes do merge
  da #460. Mergear a base com `--delete-branch` fecha a empilhada e ela não reabre (foi assim
  que o #124 se perdeu). Depois do squash da base, `git rebase origin/main` detecta o commit
  duplicado e pula sozinho.
- **`drizzle-kit generate` não roda aqui** — pede prompt interativo por um conflito de rename
  antigo no snapshot. O padrão do repo é `scripts/migrar-*.mjs` com SQL direto.
- **`.env.local` aponta para PRODUÇÃO.** Confirmado medindo a base (5 usuários, 120 pacientes,
  5.955 sessões). Qualquer script de migração roda em cima do dado real.

**Testes:** `doc54Faltou` (11), `doc54Cortesia` (6), `cortesiaOferecida` (5), `doc54Reajuste` (5).
1.001 no total. Verificado em produção com a conta de demonstração: o selo sumiu nas fichas que
têm Faltou, a pausa aparece na sequência (`7/8 Desmarcou` → `7/8 Presente`), o checkbox de
cortesia renderiza, e a janela da falta mostra o texto de como refazer.

**Pendente:**
- **`proxy-addr@2.0.7` (GHSA-jqcg-44mw-7w3h, CVSS 9.1)** chega por `@modelcontextprotocol/sdk` →
  `express`, que não serve tráfego do app. Decisão do dono: `override` para `>=2.0.8`, tirar o
  SDK de `dependencies` (parece ferramenta, não runtime), ou registrar como risco aceito em
  `DEPENDENCIAS.md`. Sobram 15 altas e 4 moderadas em produção, nenhuma nova.
- A confirmação do join real da sala de vídeo (#458) continua aberta, com o dono.

---

## 2026-10-21 — Sala de vídeo travava por 3 bloqueios de CSP (#458)

**Entregue:** a chamada online, que travava para sempre em "Entrando na sala…", volta a funcionar.
Em produção.

**Causa (confirmada no console, não deduzida):** três bloqueios na CSP/Permissions-Policy do
`next.config.ts` — o próprio app barrava o recurso. (1) `script-src` sem `8x8.vc` recusava o
`external_api.js` do JaaS → `JitsiMeetExternalAPI` nunca existia → spinner eterno. (2) sem
`frame-src`, o iframe do Jitsi caía no `default-src 'self'`. (3) `camera=() microphone=()` proibia
áudio/vídeo para todos, inclusive self.

**Por quê o JaaS estava certo e mesmo assim não funcionava:** a config do 8x8 (app id, kid, chave,
JWT moderador) estava correta o tempo todo. Quem barrava era a casca de segurança do app. Não
confundir "config certa" com "funciona" — foi exatamente o alerta do dono.

**Decisões que ficam valendo:**
- Qualquer recurso que carregue script/iframe de domínio externo (Jitsi/8x8) precisa do domínio na
  `script-src` E na `frame-src`, e de delegação na `Permissions-Policy`. As três juntas.
- Allowlist restrita aos domínios do Jitsi — nunca curinga aberto.

**Armadilhas:**
- O `JitsiRoom` não tinha tratamento de erro: o overlay do spinner ficava por cima do iframe e
  nenhuma falha chegava à tela. Foi o que escondeu o bug por tanto tempo. Agora falha (script
  bloqueado, token recusado, sala fechada) aparece com botão Voltar.
- As credenciais JaaS são `sensitive` no Vercel (write-only) — não dá para extrair a chave para um
  join real em teste. O JWT foi validado à parte (claims, moderator=true, exp/nbf, kid casa sub).
- O merge do fix NÃO disparou produção sozinho (gitForkProtection) — produção só subiu via
  `rl-provision vercel-deploy`. Padrão da frota.

**Testes:** harness em Playwright com câmera/microfone sintéticos (sem paciente, sem sessão real).
Antes: script recusado, getUserMedia NotAllowedError. Depois (CSP exata do arquivo): script carrega,
iframe carrega, getUserMedia video=1 audio=1, zero violações, API do 8x8 emite eventos de áudio/vídeo.
Produção: headers confirmados no ar.

**Pendente:** a confirmação FINAL do join real (entrar e ver/ouvir) depende do JWT de produção, que
não pôde ser exercitado do teste. O dono abre uma sala real e confirma; se travar, a tela agora
mostra o erro em vez de spinner.

---

## 2026-10-21 — Docs 51, 52 e 53 FECHADOS (#451–#456)

**Entregue:**
- **#451 Crédito 4x e 5x.** `card_fee_rates` e o enum `payment_method` ganham as faixas novas.
- **#452 O líquido sumia da tela em 4x/5x.** Havia TRÊS listas de "formas de cartão": a do cálculo,
  a da exibição e a da ordem. Só a primeira foi atualizada.
- **#453 Crédito abre as parcelas.** O seletor mostra Crédito uma vez; escolhê-lo abre à vista a 5x.
- **#454 Valores recebidos com a forma ao lado** e o líquido nos cartões, dentro do paciente.
- **#455 Anexar print no Reportar erro** + **foto de perfil** nos Ajustes.
- **#456 Sequência do pacote também ao editar** o agendamento.

**Por quê:** o doc 53 pedia taxa até 5x e bruto+líquido em toda parte; os docs 51 e 52 tinham
sobrado o anexo, a foto e a sequência no editar.

**Decisões que ficam valendo:**
- **Somas pelo LÍQUIDO, sem despesa automática de taxa.** O dono chegou a pedir uma despesa
  "Taxa cartão" em Transações, o que obrigaria as somas a voltarem para o bruto e desfaria os PRs
  #432/#433. Revisto: vale o desenho do item 3 do próprio doc 53 — líquido dos cartões + bruto das
  demais formas. Os dois desenhos são corretos; **misturar desconta a taxa duas vezes**.
- **"À vista" continua gravando `credito`, sem sufixo.** Mudar para `credito_1x` renomearia a forma
  de todo pagamento à vista já existente, e a taxa passaria a ser lida de um campo inexistente.
- **A sequência do pacote é da SESSÃO, nunca do bloco** — mesmo quando o alcance pega as próximas.
  É propriedade do encaixe avulso; aplicar ao bloco vira mudança financeira em série.
- **O formato vale o da DATA da sessão**, não o de hoje — na falta, na sequência e na edição.
- **Prints do suporte viajam em `context.extra`**, que a rota do hub repassa inteira ao `jsonb`.
  Nada de rota de upload nova. Conferido ANTES de escrever a tela: anexo em qualquer outro campo
  seria descartado em silêncio.

**Armadilhas:**
- **Uma lista que decide EXIBIÇÃO não pode viver longe da que decide o CÁLCULO.** Foi assim que o
  líquido de 4x/5x virou invisível com a conta certa — o pior tipo de defeito. Agora há teste que
  percorre toda forma com taxa exigindo que ela desconte E apareça.
- Print de celular passa de 3 MB; base64 disso dentro de `jsonb` incha o chamado. A imagem é
  reduzida no navegador (1280px, JPEG 0.7) antes de virar texto.
- `photo3x4` era campo ÓRFÃO: o banco tinha, a action salvava, a tela nunca mostrava.
- Teste com `toEqual` exato quebra quando o objeto ganha campo novo por desenho. Virou
  `toMatchObject` — o caso prova a soma, não o formato.

**Não se aplica:** bruto+líquido na Conciliação. Ela lê extrato bancário importado, e o que cai na
conta de um cartão **já é o líquido** — não há bruto a exibir.

**Pendente:** a sala de chamada online trava em "Entrando na sala como anfitrião…". **Não é falta
de configuração** — JaaS (8x8) está configurado em produção com as três variáveis. Precisa de uma
sessão real para reproduzir.

---

## 2026-10-20 — Docs 51 e 52 (primeira leva): relatórios, menu e a pergunta da falta (#445–#449)

**Entregue:**
- **#445 `.gitignore`.** O padrão era `.env*.local` + `.env`, que **não cobria** `.env.vercel`,
  `.env.production.vercel` nem `.env.production` — os nomes que o `vercel env pull` cria. Foi por
  essa fresta que 40 chaves de produção do hub foram parar num repositório público em julho. Aqui
  nada havia vazado (conferido commit a commit); a mudança é preventiva.
- **#446 Exportar XLS** no relatório de pacientes e no financeiro, à esquerda do Imprimir. `.xlsx`
  de verdade (decisão do dono). A dependência `xlsx` já existia no `package.json` sem nenhum uso.
- **#447 Cor por valor no relatório financeiro.** Azul pago, vermelho atrasado, preto em aberto.
- **#448 Menu** do Consultório na ordem Dashboard · Prospecção · Cadastros · Agenda; cartão
  "Volume mensal" removido; corte do menu no celular travado.
- **#449 A pergunta da falta** vira a do tipo: gratuito pergunta se vira paga, avulso se cobra,
  pacote se abate. A guia Geral deixa de perguntar e passa a mostrar.

**Por quê:** o dono perguntou o que era o "volume mensal" e se a chamada online precisava de
configuração. As duas respostas mudaram o trabalho (ver Decisões).

**Decisões que ficam valendo:**
- **A cor do relatório financeiro vem do VALOR, não do filtro.** Antes, a visão "Todos" — onde se
  olha o ano fechado — deixava tudo preto. Na célula que mistura (pago e atrasado no mesmo mês) o
  **pior manda**: atraso > aberto > pago. Pintar de azul porque houve um pagamento junto esconderia
  a dívida.
- **"Volume mensal" era duplicata**, não um indicador mal nomeado: usava a MESMA série do
  "Atendimentos por mês" logo acima, só em barra. Removido, não renomeado.
- **A chamada online já está configurada.** JaaS (Jitsi da 8x8), com `JAAS_APP_ID`, `JAAS_KID` e
  `JAAS_PRIVATE_KEY` em produção. O "Entrando na sala como anfitrião…" travado é outra coisa — e
  segue sem diagnóstico, porque precisa de uma sessão real para reproduzir.
- **Trocar a pergunta da falta é interface; mudar o que ela faz com o dinheiro é outra entrega.**
  O que vai ao servidor continua sendo o mesmo booleano `faltouConta`.
- **O tipo do agendamento sai do formato vigente NA DATA DA SESSÃO.** Quem trocou de plano depois
  da falta receberia a pergunta errada.
- **A planilha recebe o que está na tela** — mesmo recorte, mesmas colunas. Não recalcula nada, logo
  não tem como divergir.

**Armadilhas:**
- No relatório financeiro, as marcas de status são calculadas antes da ordenação por nome. Sem
  reordená-las junto, **a cor de um cadastro aparece na linha de outro**. Tem teste de regressão.
- No export, valor tem que sair como **número**, não como `"R$ 1.200,00"`: numa planilha ele precisa
  somar. E sem largura de coluna o Excel abre tudo em 8 caracteres e todo valor vira `####`.
- Num contêiner com `overflow-y-auto` o eixo X **vira `auto` junto** (regra do CSS). Era o que
  permitia o menu do celular rolar na horizontal e comer o começo dos rótulos.
- A suíte falhou 1 teste de 923 numa execução e passou nas duas seguintes, com o mesmo total.
  Instabilidade, não regressão — mas fica o registro.

**Pendente:**
- **Doc 52 item 04:** "Sequência do pacote" no editar agendamento. Exige mexer no server action
  `salvarEdicao` e no modelo de sessão extra — é backend, não tela.
- **Doc 51:** anexar print no Reportar erro; foto de perfil na área de ajustes.
- **Doc 53 (taxa de cartão), inteiro.** Inclui o ponto que precisa de confirmação: o dono escolheu
  gerar despesa automática "Taxa cartão" em Transações, o que **obriga as somas a voltarem para o
  bruto** — desfazendo os PRs #432/#433 do doc 50 e contrariando o item 3 do próprio texto do doc 53.
  Os dois desenhos são corretos; misturar desconta a taxa duas vezes.
- `definirFaltouConta` (server action) ficou sem chamador.
- O menu mobile foi corrigido **sem reprodução** — a correção é defensiva.

---

## 2026-10-18 — Doc 50 (parte 2): líquido em todas as cobranças, Menu Pagamentos, taxa parcelado (#431–#434)

**Entregue:**
- **#431 Menu Pagamentos reformulado + líquido por forma.** "Por mês — todos os cadastros": coluna
  "Nome" com o id do cadastro (agenda); cores Atrasado vermelho / Em aberto preto / Pago azul; "Pago"
  quebrado por forma (Pix/Deb/Cre/Din/Trans) com o **líquido** em verde no cartão; "Pagos" (card do ano)
  = soma dos líquidos; meses começam reduzidos; títulos centralizados. "Por cadastro — mês a mês": só
  Mês + Valores recebidos (por forma, com líquido). Núcleo: `resolverCobrancas` anexa o recebido por
  forma (bruto+líquido) + agendaId; novo `recebidoPorForma.ts` (puro).
- **#432 + #433 Líquido nas demais áreas de cobrança.** Relatório financeiro (matriz), ficha/TabelaAnual
  e Fechamento do mês passam a somar o recebido pelo **líquido**. Em aberto/atraso seguem no bruto.
- **#434 Taxa de crédito parcelado 2x/3x.** Vigência de taxa ganha crédito 2x e 3x; no registro de
  pagamento o crédito abre à vista / 2x / 3x e o líquido usa a % do parcelamento.

**Decisões que ficam valendo:**
- O recebido é **líquido** em todo "total recebido" (Transações, Relatórios, Visão financeira,
  Pagamentos, Relatório financeiro, ficha, Fechamento); **bruto** só na guia Geral/contrato (preço
  contratado). Somas sempre pelo líquido, descontado uma vez (`carregarNetter`/`liquidoDoPagamento`).
- Taxa por vigência na data do pagamento; parcelado 2x/3x com % próprio.

**Armadilhas:** tabelas/enum sempre ADITIVOS em prod (ALTER TABLE/TYPE ADD, nunca db:push interativo).

**#436 Relatório pacientes — "Formato de pagamento" (item 1):** coluna "Avulso/Pacote" → Formato de
pagamento (Gratuito/Avulso/Mensal Completo/Fracionado/Quinzenal Completo/Fracionado); Vencimento
(dia/1ª/última sessão do pacote); Valor (Completo = nº sessões × valor; Fracionado = por sessão);
títulos centralizados. `formatoRelatorio.ts` puro; mapeamento conferido nos dados reais (1ª/última só
existem no pacote mensal).

**#438–#440 Item 6 — módulo Transações (FECHA o doc 50):**
- #438 **Despesas**: Data vencimento/Nome/Valor/Data pagamento; Cadastrar (modal + Repetir todo mês);
  editar lápis, excluir lixeira; cor do valor por status (verde paga / preto aberta / vermelho atraso,
  `despesaStatus.ts`). Tabelas `despesas` e `receitas_pessoais` criadas em prod.
- #439 **Receitas pessoais**: Data recebimento/Nome/Valor + chip Recebido/Previsto; Cadastrar (modal +
  Repetir todo mês); editar/excluir. Campo `recebido` resolve o pendente×recebida (default pela caixa "Já recebido").
- #440 **Movimentações (extrato bancário)**: lista única cronológica (despesas + receitas + pagamentos
  de pacientes/supervisionados, realizados e previstos); verde=recebido/vermelho=pago/branco=pendente;
  data efetiva→vencimento; cartão com bruto+líquido. `extratoBancario.ts` puro + `montarMovimentacoes()`
  roda o motor por cadastro. Conteúdo conciliado NÃO entra (etapa futura, conforme o doc).

**Doc 50 — COMPLETO (itens 1–7).**

---

## 2026-10-18 — Paleta azul + doc 50 (parte 1): ajustes de UI financeira/agenda (#426–#429)

**Entregue:**
- **#426 Paleta azul (Lovable).** Ledivan sai de berinjela/creme para azul profundo #0B3D91 · azul céu
  #3BA7F2 · menta #7FE7D6 · gelo #E8F6FF. Os NOMES dos tokens foram mantidos (inclusive "eggplant") →
  só os valores mudaram, em globals.css + hex de marca espalhados (charts, landing, prontuário,
  themeColor, e-mails). Fonte do design: repo `silvanobarbosa/ledivan-practice-companion` (lido, não escrito).
- **#427 Vencimentos por dia:** avulsa mostra data+hora da sessão; coluna "Horário de atraso" removida;
  título "Cobrar" sem texto (avulsa e pacote); títulos centralizados.
- **#428 Relatório financeiro:** valores coloridos pelo filtro (Em atraso vermelho, Pagos azul, Em
  aberto/Todos preto); títulos centralizados. **Agenda:** HOUR_PX 48→60 + alturas mínimas maiores
  (os dados estavam sendo cortados).
- **#429 Atender:** removida a janela "finalizar atendimento" — Finalizar marca como realizada direto;
  as regras de cobrança já vêm do formato do cadastro.

**Ops (fora do repo):** base de dados da terapeuta Ana Raquel Bassi **zerada** (dados apagados, conta
mantida) a pedido do dono.

**PENDENTE do doc 50 (grande — próximas levas):**
- Relatório pacientes: "Avulso/Mensal" → **Formato de pagamento** (Gratuito/Avulso/Mensal Completo/
  Fracionado/Quinzenal Completo/Fracionado) + regra de Vencimento (dia / 1ª / última sessão) e Valor;
  centralizar títulos.
- **Menu Pagamentos reformula:** título "Nome" com agendaId; pagos por forma (Pix/Deb/Cre/Din/Trans)
  com **líquido** no cartão; 1º mês reduzido; "Por mês" abaixo dos cards; Pagos=soma líquida; "Por
  cadastro" só Mês+Valores recebidos (com breakdown por forma); cores = Relatório financeiro.
- **Líquido em TODAS as áreas de cobrança** (bruto só na Geral/contrato; resto bruto+líquido; somas
  pelo líquido) — exige threar `method` pelo motor `geralDoPaciente`.
- **Transações:** tabelas Despesas + Receitas (cadastro/edição/lixeira, cores por status) + área
  **Movimentações (extrato bancário)** unificada; substitui a visão de conciliado.
- **Taxa de parcelado 2x/3x** no Ajuste + crédito à vista/2x/3x na guia Geral.

---

## 2026-10-17 — Doc 49: taxa de cartão com vigência + líquido, ordem do dashboard, contagem de lembretes (#422–#424)

**Entregue:**
- **#422 Taxa de cartão com VIGÊNCIA + valor líquido.** Guia Dados/Geral seguem no **bruto** (valor
  cheio da sessão). Nos **totais recebidos**, desconta a taxa da maquininha usando a taxa **vigente na
  data do pagamento** (histórico, nunca retroativo). Peças: tabela `card_fee_rates` (débito/crédito %
  + validFrom); `taxaCartao.ts` puro (`taxaVigenteEm`/`liquidoDoPagamento`); `receitaLiquida.carregarNetter`
  (ponto único de desconto); `TaxasCard` com histórico de vigências. Captura **débito × crédito** no
  registro de pagamento (antes só "card"): enum estendido, forma copiada para a transação do caixa.
  Líquido aplicado em **Transações, Relatórios e Visão financeira**.
- **#423 Ordem do dashboard.** Painéis do topo empilhados (um embaixo do outro) na ordem do doc:
  Prospecção → Relatório → Aniversariantes → Queixa principal → Pagamentos. Resto da página já batia.
- **#424 Contagem "(Nx)".** Aniversário mostra "parabenizado Nx"; reajuste/devolutiva "lembrado Nx".
  Conta só quando o dono **confirma o envio** (abre WhatsApp → "Você enviou?" → Sim), igual ao Cobrar.
  Tabela `outbound_reminders` + `lembretes-actions`.

**Por quê:** doc 49 do dono (bruto × líquido + vigência de taxa; ordem dos cards; contagem de lembretes).

**Decisões que ficam valendo:**
- **Bruto é o fato lançado; líquido é só leitura** nos totais recebidos. Taxa descontada UMA vez, em um
  único ponto (`carregarNetter` → `liquidoDoPagamento`).
- Taxa por **vigência**: mudar a taxa nunca recalcula pagamentos anteriores; usa-se a taxa da data de cada pagamento.
- Lembrete/parabéns conta **só na confirmação de envio** (nunca na abertura do WhatsApp).

**Armadilhas:** só o provedor de IA/pagamento com "card" indistinto existia — pagamentos antigos como
"card"/sem forma **não têm split débito×crédito** (o líquido só vale daqui pra frente). Tabelas criadas
em prod de forma ADITIVA (CREATE TABLE IF NOT EXISTS / ALTER TYPE ADD VALUE), nunca db:push interativo.

**PENDENTE (reportado ao dono):** aplicar o líquido nas áreas derivadas da **cobrança** (Pagamentos
"Por mês", fechamento, relatório-financeiro matriz, TabelaAnual) e no **app mobile/admin** — exige threar
`method` pelo motor `geralDoPaciente`. Pagamentos ficou no **bruto** por ora (consistente dentro da página).

---

## 2026-10-17 — Docs 46+47 (parte 4): Menu Pagamentos reformulado, lançamento recorrente, OCR livre, taxas de cartão (#417–#420)

**Entregue:**
- **#417 Menu Pagamentos — "Por mês — todos os cadastros" reformulado** sobre o motor da guia Geral
  (`geralDoPaciente`), mesma fonte do Vencimentos por dia. Cards de resumo do ano (Atrasados/Em aberto/
  Pagos) + tabela por mês com **ID do cadastro** (clicável), Vencimento, Atrasado, Em aberto, Pago, Cobrar
  e Cobranças enviadas. Novo `resolverCobrancas.ts` (fonte única — junta pacote + avulsa embutida na
  sessão, o bug do doc 48) e `pagamentosPorMes.ts` (puro). ID = nº do registro (#0020) ou, sem número, o nome.
- **#418 Lançamento recorrente mensal**: "Novo lançamento" ganha "Repetir todo mês" por N meses (2–60).
  `recorrencia.ts` puro (clamp de fim de mês, virada de ano); datas ancoradas ao meio-dia local (sem bug de fuso).
- **#419 Ler recibo com OCR**: o 📸 do Financeiro agora LÊ e abre REVISÃO antes de lançar. Grátis =
  `tesseract.js` no navegador + heurística `reciboOcr.ts` (funciona sem chave); preciso = IA do próprio
  terapeuta (BYOK) via "Ler com IA". **Alerta de limitação** explícito. `/api/scan` passou a só devolver
  campos (não grava mais sozinho); gravação revisada por `createTransaction` com origem `scan`.
  `ScanButton` removido → `ScanRecibo`.
- **#420 Taxas de débito/crédito** nas Configurações (card novo) + valor **líquido** sob o bruto das
  receitas no cartão no Financeiro. `finance.liquidoComTaxa/normalizarTaxa`; `preferences.cardFees`. O
  valor lançado NÃO muda (líquido é só leitura).

**Por quê:** docs 46/47 do dono + fix do doc 48 (avulsa sumia do Vencimentos porque a coleta pegava só
linhas "pagamento", não a cobrança embutida na linha da sessão — agora `resolverCobrancas` junta as duas).

**Decisões que ficam valendo:**
- OCR: recurso grátis (Tesseract) + opcional BYOK; sempre com REVISÃO antes de lançar (OCR/IA erram).
- Taxas de cartão: bruto é o fato lançado; líquido é apoio de leitura, não altera o dado.
- `resolverCobrancas` é a fonte ÚNICA das cobranças de um cadastro (Vencimentos por dia + Menu Pagamentos).

**Armadilhas:** só o provedor `openai` tem visão (gpt-4o-mini); `groq` é texto e falhava calado no scan —
o caminho grátis cobre todos. `tesseract.js` é import dinâmico client-side (não entra no SSR).

**PENDENTE (reportado ao dono — precisa de direção/decisão):**
- **Taxas de cartão — tratamento contábil:** hoje o líquido é só exibição. Decisão do dono: também virar
  despesa automática "Taxa cartão"? Relatório/caixa usar o líquido no total?
- **Contagem "lembrado/parabenizado (Nx)"** em aniversário/reajuste/devolutiva: os painéis existem, mas
  falta registrar cada envio por tipo e definir o que conta (abrir WhatsApp? confirmar?). Precisa de store novo.
- **Cards na horizontal** (prospecção→devolutivas) + **mobile**: precisam do layout exato do doc e de
  verificação no navegador.

---

## 2026-10-17 — Docs 45+46 (parte 3): Faltou, troca de mês, nota nº, relatório/menu, pagamentos (#410–#414)

**Entregue:**
- **#410 Faltou "Considerar sessão realizada?"**: avulso Sim cobra / Não R$0; pacote Sim abate / Não não
  abate. Coluna `therapy_sessions.faltou_conta` (null=legado). Motor exclui Faltou/Não; pergunta na agenda
  e abaixo da sessão na guia Geral (recalcula na hora). +3 testes.
- **#411 troca de mês de vencimento** na Geral: ao mudar o mês, pergunta "aplicar às próximas parcelas?";
  Sim desloca o mês das futuras (sem pagamento) mantendo dias/anos; Não só a selecionada.
- **#412 nota**: "nota emitida — nº [recibo]" na Geral (threaded receiptNumber); aviso gov.br com
  ano-calendário/prazo automáticos na Receita Saúde. Sync Geral↔Receita Saúde já era pelo mesmo registro.
- **#413 relatório/menu**: relatório financeiro sem os 4 gráficos + linhas Sessões/Receitas por mês;
  "Visão geral/financeira/Previsão" saem do menu (rotas ficam).
- **#414 Menu Pagamentos (parte 1)**: texto novo; remove "Cobrança automática mensal"; "todos os
  pacientes"→"todos os cadastros"; "Por paciente"→"Por cadastro" (exclui prospectados); remove "Meses futuros…".

**PENDENTE (grande/novo — próximas levas):**
- **Menu Pagamentos (reformulação das colunas):** ID/Vencimento/Atrasado/Em aberto/Pago/Cobrar/Cobranças
  enviadas pelo motor da guia Geral (geralDoPaciente), cards de resumo (Atrasados/Em aberto/Pagos),
  ordenar por vencimento desc, ID clicável, Cobrar igual ao Vencimentos. (Hoje usa o lib `pagamentos`.)
- **"Novo lançamento"** (Despesas/Receitas + recorrência mensal + **taxas débito/crédito** no Ajustes) +
  **OCR por câmera** — decisão do dono: **Tesseract/PaddleOCR + chave de IA do usuário (BYOK)**, com
  alerta de limitação. Feature grande; precisa de dependência (ex. tesseract.js) + fluxo de câmera.
- **"Lembrar agendamento" (mensal)** no Dashboard + contagem "lembrado/parabenizado (Nx)" em
  aniversário/reajuste/devolutiva (precisa de armazenamento de contagem — hoje só cobrança usa cobranca_envios).
- **Cards na horizontal** (prospecção→devolutivas) e **mobile** — precisam de verificação no navegador.
- **Vencimentos:** bug "avulsa some" + "Última realizada" formato — aguardam exemplo do dono.

---

## 2026-10-17 — Doc 45 (parte 2): [Mais…], numeração, prospecção conta cadastro direto (#407–#408)

**Entregue:**
- **#407 [Mais…]/[Menos…]** (componente `TextoMais`) nos textos de Prospectados, Prospecção,
  Aniversariantes, Reajustes e Devolutivas; a linha "Ao atualizar/agendar … removido desta lista" saiu
  de baixo da lista e foi para dentro do texto expandido (sem duplicar); "Frequência" → "Frequência do
  atendimento" no novo atendimento.
- **#408 numeração + prospecção:** o prospectado não consome mais número de cadastro (nasce sem número;
  recebe o próximo só na conversão) — resolve prospectado furando a numeração; números de prospectados
  existentes zerados (dono não precisa preservar). Painel Prospecção: cadastro direto ("Novo cadastro")
  conta como Prospectado + Fechado (e na taxa), nunca como "Em aberto".

**Decisões do dono (doc 45/46/47):** OCR = incorporar com **Tesseract/PaddleOCR** + **chave de IA do
usuário (BYOK)**, com ALERTA de que a chave pode ser necessária p/ alguns OCRs e que o recurso é bom mas
tem limitação. Numeração = NÃO precisa preservar números atuais. O bug "avulsa some no Vencimentos" +
formato "Última realizada" aguardam exemplo do dono.

**AINDA PENDENTE (grande/billing — próximas levas):**
- Vencimentos: bug "avulsa aparece na Geral mas some" (aguarda exemplo); "Última realizada" data–seq–status.
- Status **"Faltou" → "Considerar sessão realizada?"** (avulso/pacote) — motor de cobrança/pacote.
- Confirmar **troca de mês de vencimento** na Geral ("próximas parcelas também?") — sequência de parcelas.
- **Cards na horizontal** (prospecção→devolutivas) — layout, verificar no navegador.
- **"Lembrar agendamento"** (mensal) no Dashboard + contagem "lembrete enviado" em aniversário/reajuste/devolutiva.
- **Converter sem ID da agenda** (esclarecer o que exibir).
- **Doc 46 (financeiro):** nota/Receita Saúde sync + "Nota emitida — nº"; Menu Pagamentos reformulado;
  "Novo lançamento" (Despesas/Receitas + recorrência + taxas); **OCR por câmera (Tesseract/Paddle + BYOK)**;
  Relatório financeiro (tira gráficos + Sessões/Receitas).
- **Mobile** (cards da agenda + menu).

---

## 2026-10-17 — Docs 45+47 (parte 1): confirmar envio no retorno + fixes do Vencimentos (#404–#405)

**Entregue:**
- **#404 confirmar envio (doc 47):** abrir o WhatsApp deixou de contar a mensagem. Em Cobrar
  (Vencimentos por dia + guia Geral) e Contatar (Prospecção), o app abre o WhatsApp e pergunta "Você
  enviou a mensagem?" — só conta no "Sim". Hook `useConfirmarEnvio` + `ConfirmarEnvioModal` (confirmação
  EXPLÍCITA logo após abrir — no PC o WhatsApp abre em aba nova e o retorno por foco não é confiável;
  assim funciona no celular e no PC e nunca conta sozinho).
- **#405 fixes do Vencimentos por dia (doc 45):** Valor = saldo em aberto (quitado = valor cheio);
  quitado mostra "Pago em [data]" sem Cobrar nem contagem; coluna "Tipo de vencimento" → "Vencimento"
  (dia específico mostra a data); mensagens de atraso próprias (pacote 6.1 / avulsa Presente 6.2 /
  avulsa Faltou 6.3) com o valor em aberto (`mensagemDeCobranca`).

**Pendente dos docs 45+46+47 (lote enorme — ainda aberto):**
- **Vencimentos:** bug "avulsa aparece na Geral mas não no Vencimentos / some após pagar" (precisa
  exemplo p/ achar a origem no motor); "Última realizada" no formato *data – seq – status*.
- **Doc 45:** [Mais…] nos textos; remover a linha duplicada abaixo da lista (reajuste/devolutiva);
  status "Faltou" → "Considerar sessão realizada?" (avulso/pacote); numeração dos cadastros pela ordem
  de atendimento (prospectado só entra ao converter); prospecção conta cadastro direto (prospectado+
  fechado+taxa); cards na horizontal; "Lembrar agendamento" (mensal); contagem "lembrete enviado" em
  aniversário/reajuste/devolutiva; Converter não traz ID agenda (bug); confirmar troca de mês de
  vencimento na Geral; renomes pequenos.
- **Doc 46:** nota/Receita Saúde sync + "Nota emitida — nº"; Menu Pagamentos reformulado; "Novo
  lançamento" (Despesas/Receitas + recorrência + taxas); **OCR de despesa por câmera (feature grande,
  exige verificação de viabilidade)**; Relatório financeiro (tira gráficos + Sessões/Receitas).
- **Mobile** (cards da agenda + menu).

---

## 2026-10-16 — Doc 44 (parte 1): contagem dos analíticos, CPF do contrato, textos das áreas (#398–#400)

**Entregue:**
- **#398 analíticos (correção):** os cards contam pelo TIPO DO CADASTRO, não pelo tipo da sessão —
  Atendimentos realizados = Presente de cadastros Paciente; Supervisões realizadas = Presente de
  cadastros Supervisionado (join com `cadastro_kind`). O card de Supervisões foi para logo à direita
  de Atendimentos e segue sempre visível (0 quando não há). Resolve o caso de sessões de supervisionado
  com `sessionKind` antigo que não contavam.
- **#399 contrato de supervisão:** CPF do responsável acrescentado ao CONTRATANTE.
- **#400 textos:** removidos os tooltips (i) de Prospectados, Prospecção, Aniversariantes, Queixa
  principal, Reajustes a vencer e Próximas devolutivas; textos revistos (cada área ganha "Clique em
  <ação> ao lado de cada nome…", o aviso de remoção desce para abaixo da lista, "Mensagem" → "Mensagem
  única para todos", ajuda reescrita). Prospecção/Aniversariantes mantêm {nome} (com Dica); Reajustes/
  Devolutivas sem {nome}. Prospectados: lixeira foi para o lado de "Atualizar dados".

**Vencimentos por dia (#402 — FEITO):** área nova no Dashboard, abaixo de Pagamentos. Seletor de data
(default hoje, não persistido). Tabela de **Sessões avulsas** e tabela de **Pacotes** (Mensal/Quinzenal),
montadas sobre `geralDoPaciente`, filtradas pela data. Botão **Cobrar** abre o WhatsApp com a mensagem
preenchida (4 modelos: avulso / pacote dia / 1ª sessão / última sessão) e registra o acionamento
(reusa `registrarCobrancaEnviada` — conta o clique, não a abertura). Lógica pura em
`src/lib/vencimentosDoDia.ts` (6 testes); extração do motor em `vencimentos-actions.ts`.

**Pendente (doc 44):** só o **mobile** (cards da agenda cortados + menu com falhas) — precisa verificar
no navegador/dispositivo, não corrigir no escuro.

---

## 2026-10-16 — Doc 43: editar a recorrência de um agendamento (#396)

**Entregue:** na janela de Editar agendamento, sessão recorrente ganha "Alterar recorrência"
(frequência Semanal 1x/2x/Quinzenal + "Repetir até"; 2º dia/horário no 2x). Recria as próximas sessões
da série a partir daquela data com a nova frequência.

**Como é seguro:** planejador puro `src/lib/replanejarRecorrencia.ts` (`sessoesDaSerieARemover`,
5 testes) — só saem as futuras da MESMA série (mesma freq+limite) que são `agendada`, recorrentes e
SEM pagamento. Ficam intactos passado, realizadas, faltas, canceladas, pagas e encaixes avulsos. A
geração nova (`datasEPuladas`) pula horário bloqueado e os já ocupados. Cobrança e pacote seguem
automáticos (derivam das sessões); diferença de valor por frequência o dono ajusta no Financeiro.

**Decisões que ficam valendo:** série identificada por `recurrenceFreq` + `recurrenceUntil` (as criadas
juntas compartilham os dois). Só sessão futura, recorrente, agendada e não paga pode ter a recorrência
replanejada (`podeReplanejar`).

**Pendente:** sobrou só o **mobile** de docs 42/43 (melhorar visualização de Prospectados, colunas do
Relatório, novo atendimento e o menu sobre a agenda) — precisa de verificação no navegador/dispositivo.

---

## 2026-10-16 — Docs 42+43 (parte 2): supervisionado completo, contrato auto-update, confirmação de exclusão (#388–#394)

**Entregue:**
- **Supervisionado completo** (frente 1, decisão do dono: mesma estrutura do paciente, só os campos da supervisão):
  - **#388 cadastro:** guias Dados + Financeiro + Contrato; Dados = pessoais + responsável (nome, CPF,
    parentesco, telefone, e-mail); somem queixa, cônjuge/casal, emergência, devolutiva e escola.
  - **#389 contrato:** modelo próprio de **Supervisão Clínica** (auto-preenchido, mesmo mecanismo do
    de paciente, partes CONTRATADA/CONTRATANTE=responsável/SUPERVISIONANDO; sem Horário Fixo nem reajuste;
    papel da assinatura vem da Descrição do atendimento). A tela de contrato escolhe o modelo pelo `cadastro_kind`.
  - **#390 recibo:** texto do serviço vira "referente aos serviços de supervisão clínica".
  - **#391 agenda:** cadastro supervisionado só agenda sessões de supervisão (campo Tipo = Supervisão,
    `sessionKind="supervisao"`); sessão marcada com **👁** à direita da modalidade + legenda.
  - **#392 analíticos:** card **Supervisões realizadas** (fora da conta de Atendimentos realizados).
- **#393 contrato auto-update:** ao salvar Dados/Financeiro o contrato acompanha os dados sem salvar/
  atualizar à mão (ContratoImpresso congelava o texto em useState — corrigido com sync na renderização).
- **#394 confirmação de exclusão:** toda exclusão pede confirmação (atividade, anamnese, reajuste,
  material, registro, meta, escala, tarefa, lançamento do caixa, reserva, chave de IA, avisos de cobrança).
  Novo `ConfirmSubmit` para forms de Server Component.

**Decisões que ficam valendo:**
- `cadastro_kind` é ortogonal a `patient_status`; supervisionado = estrutura do paciente com subset de campos.
- Supervisão é um serviço à parte dos "Atendimentos realizados" nos analíticos.
- A sessão de supervisão é identificada por `sessionKind="supervisao"` (sem coluna nova — texto já aceitava).

**Pendente (docs 42+43 — NÃO feito ainda):**
1. **Editar recorrência na agenda (doc 43):** aprovado pelo dono. Plano: na janela de Editar agendamento,
   mostrar frequência + "repetir até"; ao salvar, regenerar só as sessões FUTURAS da série (status agendada,
   sem pagamento) da data editada pra frente; NÃO tocar passado/realizadas/cobranças/pacotes anteriores;
   contrato/enquadre e cobrança/pacote seguem automaticamente (derivados das sessões); diferença de valor o
   dono ajusta na mão no Financeiro. **Frente de maior risco (motor de cobrança) — fazer com testes.**
2. **Mobile:** "melhorar visualização" de Prospectados, colunas do Relatório, janela de novo atendimento e
   o menu aberto sobre a agenda. Precisa de verificação no navegador/dispositivo (não dá para corrigir no
   escuro — lição de rolagem lateral/verificar no navegador).

---

## 2026-10-15 — Docs 42+43 (parte 1): textos, contrato 3.2, Telegram/E-mail, scroll dos analíticos (#383–#386)

**Entregue (frentes de baixo risco; o lote é grande e segue aberto):**
- **#383 textos e rótulos:** Prospectados (subtítulo + Converter → "lista de cadastros"); Relatório
  (título "Relatório", recorte sem "paciente"); Relatório financeiro (sem "dos pacientes", matriz sem
  rótulo "Paciente"); Aniversariantes (intro/dica/mensagem); situação financeira "dos seus cadastros";
  modal Ativos/Inativos → "Cadastros"; Reajustes e Devolutivas com textos revistos e **opção {nome}
  removida** (mensagem vai como escrita); Novo cadastro sem subtexto, botão "Cadastrar".
- **#384 contrato:** removida a cláusula **3.2 Horário Fixo**; 3.3 Pontualidade virou 3.2.
- **#385 ficha:** botões diretos de **Telegram** e **E-mail** ao lado do WhatsApp (compositor da casa
  com o canal pré-escolhido; MessagePatient ganhou `canalInicial`/`icone`).
- **#386:** filtro dos **Analíticos** não joga mais a tela pro topo (router.push com `scroll:false`);
  "Paciente" → "Nome" na janela de novo atendimento.

**Decisões do dono (respondidas nos docs 42/43):**
- **Devolutiva = 1 mês** confirmado; remover referências a 7 dias (feito no que havia).
- **Editar recorrência = aprovado**, só para frente (ver Pendente).
- **Supervisionado** passa a ter **Financeiro e Contrato** também (reverte a restrição "só dados
  pessoais" do doc 41 — ver Pendente).

**Pendente (frentes grandes/arriscadas de docs 42+43 — ainda NÃO feitas):**
1. **Supervisionado completo:** exibir guias Financeiro+Contrato; **contrato de SUPERVISÃO CLÍNICA**
   (modelo próprio, campos auto), recibo com "referente aos serviços de supervisão clínica"; na janela
   de novo atendimento, se o cadastro é supervisionado o único tipo é **supervisão**; sessão de
   supervisão marcada na agenda com **ícone de olho** + legenda; card **Supervisões Realizadas** nos
   analíticos (total de sessões tipo supervisão com Presente). Precisa de **campo de tipo na sessão**
   (schema) e decisão: supervisionado volta a mostrar TODOS os cards de Dados (responsável etc.), já
   que o contrato de supervisão usa o responsável? (presumo que sim — "mesmo funcionamento do Paciente").
2. **Editar recorrência na agenda:** janela mostra frequência+repetição; muda só FUTURO; preserva
   realizadas/cobranças/pacotes anteriores; ajusta contrato/enquadre, sequência de cobrança e numeração
   de pacote da data pra frente; diferença de valor o usuário ajusta na mão. (Toca motor de cobrança —
   frente de maior risco.)
3. **Confirmação para TODA exclusão do sistema** (varredura).
4. **Contrato atualiza automático ao salvar Dados/Financeiro** (verificar: a revalidação já regenera o
   padrão; o texto manual salvo é a exceção a tratar).
5. **Mobile:** melhorar corte de Prospectados, colunas do Relatório, janela de novo atendimento e o
   menu quando aberto sobre a agenda.

---

## 2026-10-14 — Docs 40+41: relatório, cadastro/supervisionado, contrato, sessões realizadas (#377–#381)

**Entregue:**
- **Relatório de pacientes (#377):** nova coluna **Qtde Atendida** (nº de sessões com status Presente),
  saiu a coluna **Escola**, saiu o bloco "Queixas principais no recorte". Intro vira "Monte o seu
  relatório conforme a sua necessidade".
- **Paciente → Cadastro (#378):** menu, lista (título/contador/botão), tela nova, edição e link de
  volta passam a falar "Cadastro(s)".
- **Tipo de cadastro Paciente/Supervisionado (#379):** coluna aditiva `patients.cadastro_kind`
  (default `paciente`, ALTER idempotente já aplicado em prod, 138 linhas → paciente). Seletor acima do
  "Número do cadastro". **Supervisionado = só dados pessoais** (somem financeiro, contrato, responsável,
  emergência, cônjuge, devolutiva, escola e queixa). `normalizeCadastroKind()` fail-safe, com testes.
- **Contrato (#380):** campo vazio da guia dados some do contrato e volta ao ser cadastrado
  (CONTRATANTE/PACIENTE; CONTRATADA e enquadre seguem com `[placeholder]`); e-mail do contratante vem
  do cadastro; cláusula **4.3** some sem periodicidade de reajuste; **novo texto da 5.2** (com ressalva
  de atestado); **terapia** troca "analítico/analítica" por "terapêutico/terapêutica" (6.1 e seção 8).
- **Sessões Realizadas (#381):** card na ficha do paciente, abaixo de "Sessões agendadas", com o total
  de presenças e um **detalhe** que abre mês/ano e mostra a contagem do período (mapa YYYY-MM do servidor).
- **Limpeza de dado (doc 41):** devolutiva de pacientes 18+ zerada no banco (1 registro: Caroline).

**Por quê:** o consultório recebe também supervisionandos (cadastro ≠ só paciente); o relatório e o
contrato precisavam refletir o uso real; e faltava enxergar presença por período na ficha.

**Decisões que ficam valendo:**
- `cadastro_kind` é ortogonal ao `patient_status` (um supervisionado também é ativo/inativo).
- Contrato: só os campos vindos da **guia dados** somem quando vazios; Perfil e agenda mantêm placeholder.
- "analítico→terapêutico" vale **só** para a formação terapia; psicanálise/psicologia mantêm "analítico".

**Armadilhas:** `git checkout main` entre PRs reverte a árvore ao estado remoto — não rebranchar antes de
mergear o PR anterior (squash-merge deixa o rebase sujo; resolvi com `reset --hard main` + reaplicar).

**Pendente (decisão do dono):**
- **Editar recorrência na agenda (doc 40, frente 7):** NÃO implementado — depende de decisão. O próprio
  dono pergunta no doc se mudar a recorrência no "Editar agendamento" afeta parâmetros já estabelecidos
  (contrato/enquadre, sequência de cobrança, contagem de pacote). Enviei plano + os efeitos colaterais a
  avaliar; aguarda o "pode ir".
- **Prazo da lista de devolutivas (contradição do doc 41):** página 8 manda a lista aparecer **1 mês**
  antes ("substituindo os 7 dias") — foi o que ficou no código (`devolutivaNaLista` ≤ 31 dias). Já as
  páginas 9–10 (exemplos + "regras importantes", 2x) dizem **7 dias**. Deixei em 31; o dono confirma qual vale.

---

## 2026-10-14 — Doc 36 item 3: repetição semanal no slot do quinzenal + Dependabot

**Entregue:**
- **Quinzenal "APENAS ESTE" — item 3:** no horário intercalado (semana anterior de um quinzenal)
  agora dá para escolher "Repetir semanalmente (1x)". A série pula sozinha a semana que o quinzenal
  já ocupa (predicado `ocupado` em `datasEPuladas` — pula em silêncio, ≠ "Hor. Bloq."), sem duplicar
  e sem contar a semana pulada. `createRecurring` passou a nunca agendar duas sessões no mesmo
  instante (previne double-booking). Mensagem explicativa na janela de Novo atendimento.
- **Dependabot:** #253 (anchore/sbom-action 0.24.3) mergeado. #214 (dotenv 18) em CI. #243 (18 deps
  minor+patch) fechou numa corrida de merge — dependabot recria no próximo ciclo.

**Decisões que ficam valendo:** `datasEPuladas` distingue BLOQUEADO (vira "Hor. Bloq.") de OCUPADO
(já tem sessão → pula silencioso). Com isto, o item 3 do quinzenal está completo (1+2 no #360).

---

## 2026-10-14 — Doc 38: logo do contrato, linha do documento, crédito Sim/Não, agenda id+altura (#363–#365)

**Entregue:**
- **#363 (contrato + documento):** o logo do contrato voltou a ficar **centralizado acima do título**
  (o doc 36 #1 tinha pinado só `#contrato-papel` com position:absolute, que cobria o logo; agora o
  bloco posicionado é o `#contrato-wrap` inteiro — logo + papel). Removida a linha horizontal (`<hr>`)
  abaixo do cabeçalho do documento.
- **#364 (crédito):** a pergunta "sobra vira crédito no saldo?" trocou o checkbox confuso por botões
  **Sim/Não** explícitos.
- **#365 (agenda):** a célula mostra o **agendaId completo** (ex. "Kelly Port") — vinha da lista
  `patients` que exclui inativo, então sessão de inativo caía no 1º nome; agora agendaId/registro vêm
  do paciente da própria sessão (join). E as **linhas ficaram mais baixas** (HOUR_PX 64→48) — cabe
  mais agendamento na tela.

**Decisões que ficam valendo:** o bloco de impressão do contrato é o WRAP inteiro (logo junto). A
identificação da célula da agenda sai da sessão (join), não da lista de pacientes ativos.

---

## 2026-10-13 — Doc 37: reajuste conta de "Vale a partir de" + esconder o campo após salvar

**Entregue:**
- **A (prazo do reajuste):** ao alterar o VALOR da sessão, o próximo reajuste conta a partir da data
  em "Vale a partir de" (reiniciado a cada alteração de valor), não do cadastro inicial nem do
  reajuste anterior — e sem mexer no histórico. Esse comportamento **já estava correto** no motor
  (`dataDoPreco` → "Vale a partir de"; o bloco de troca de valor grava
  `priceReviewDate = vencimentoDoPreco(efetiva, null, prazo)`); o que o fazia parecer errado era o
  salvamento do Financeiro que não persistia (doc 35 A2, corrigido no #352). Acrescentado o texto no
  ⓘ do campo "Próximo reajuste em" explicando a regra. Teste do exemplo do doc (15/10/2026 +12 = 15/10/2027).
- **B (esconder "Vale a partir de" após salvar):** depois de Salvar no Financeiro, o campo
  "Vale a partir de" some da tela e só volta numa nova alteração. É só na INTERFACE — a data gravada
  continua valendo nos cálculos e no histórico. Feito com `useActionState`: a cada save o tick avança
  e zeramos `financeiroAlterado` (o "mexeu nesta edição"). Vale para todas as modalidades.

**Decisões que ficam valendo:** o próximo reajuste SEMPRE conta de "Vale a partir de" na troca de
valor. O campo de vigência é efêmero na tela (some após salvar), mas a data persiste no banco.

---

## 2026-10-13 — Doc 36: miudezas, impressão, agenda, mobile, anexo e crédito (#354–#359)

Lote de 12 frentes do doc 36. 11 entregues; só a #9 (quinzenal) ficou para depois (plano primeiro).

**Entregue:**
- **#354 (miudezas):** fragmentado agora ESCONDE o campo "Quantidade de sessões do pacote" (antes
  só opcional); guia Geral mostra o dia da semana (SEG…DOM) à esquerda da data; guia Anamnese não
  "pula" mais pro último campo ao abrir (os campos padrão abriam editáveis com autoFocus, o último
  vencia); símbolo ⇄ de recorrência saiu das células da agenda.
- **#355 (impressão):** documento não sai mais em BRANCO (a tela do paciente injeta
  `body *{visibility:hidden}` p/ imprimir o Controle; o portal do documento reverte a visibilidade do
  próprio conteúdo); contrato com o logo a 2cm da margem (papel sai do fluxo com `position:absolute`,
  o vão vinha do espaço reservado pelos ancestrais hidden); exercícios mostram data e hora.
- **#356 (sequência):** "Adicionar à sequência do pacote" não pergunta mais QUAL desmarcada preenche
  — abate a primeira em aberto automaticamente.
- **#357 (mobile):** "Editar" fica ao lado de "Exportar dados" (agrupados num flex próprio; o
  flex-wrap do pai quebrava entre os dois no celular).
- **#2 (visualizar anexo):** o anexo (laudo, encaminhamento) abre num visualizador DENTRO do app
  (sobreposição), com "Fechar" e "Imprimir" — antes abria em aba nova. Imprimir abre o arquivo numa
  janela própria e manda imprimir (o arquivo mora no cofre/domínio externo, então imprimir o iframe
  daqui esbarraria em CORS).
- **#8 (crédito no saldo):** ao pagar a MAIS, o usuário decide (Sim/Não) se a sobra vira crédito no
  saldo do paciente; no próximo pagamento o crédito é abatido automaticamente. Tabela
  `patient_credits` (já em produção); regra pura `aplicarCreditoNoLancamento`. O crédito aplicado
  entra como pagamento `kind="credito"` SEM transação (fecha a cobrança sem duplicar o caixa — o
  dinheiro já entrou na sobra). Antes a tela só EXIBIA "entram como crédito" sem gravar nada.

**Decisões que ficam valendo:** pagamento a mais vira crédito SÓ por escolha do usuário (nunca
automático); crédito abate o PRÓXIMO pagamento automaticamente; crédito no caixa = `kind="credito"`
sem transação. impressão de documento/contrato depende de reverter o
`visibility:hidden` global da tela do paciente OU tirar o papel do fluxo (position:absolute) —
não basta zerar padding. Fragmentado: o campo de nº de sessões não existe nesse formato.

**Armadilhas:** backtick dentro de comentário CSS num `<style>{`…`}</style>` FECHA o template literal
→ erro de parse (aconteceu no contrato). Dia da semana/weekday vem dos componentes UTC da data de
parede, não de getDay local (fuso negativo erraria).

**#9 quinzenal "APENAS ESTE" — itens 1+2 (espelho):** ao editar um agendamento quinzenal com
"APENAS ESTE" MOVENDO a data/horário, a sessão ganha a marca `espelhoSoAnterior` — ela **continua
na sequência** (numeração, ordem, pacote e financeiro INTACTOS; a marca afeta SÓ o espelho). O
espelho dela passa a projetar só a semana **anterior**, nunca a posterior (corrige o Q que aparecia
dos dois lados). Lógica pura em `espelhosDoDia` (delta +7 = anterior) + 3 testes; coluna aditiva
`therapy_sessions.espelho_so_anterior` (já em produção). Item 3 (repetição semanal no slot anterior,
pulando a semana ocupada) fica para um 2º PR — o dono quer validar 1+2 primeiro.

---

## 2026-10-12 — Doc 35: salvamento, exclusão, fragmentado e acordeão de reajuste (#351–#353)

Correções na área de reajuste e no salvamento do cadastro. Todas no ar.

**Entregue:**
- **#351 (excluir + fragmentado):** "Excluir paciente" agora pede confirmação inline antes de apagar
  ("Tem certeza que deseja excluir? Não será possível reverter essa exclusão."). E no pacote mensal
  **fragmentado** o campo "Quantidade de sessões do pacote" deixou de ser obrigatório (o fragmentado
  é contado pelas sessões do mês).
- **#352 (salvamento — CRÍTICO):** alterar campos nas guias **Dados** e **Financeiro** e clicar em
  Salvar aparentava salvar, mas o campo voltava ao valor antigo (não persistia). Causa: cada guia era
  um `<form>` próprio com seu botão; um clique só enviava a guia daquele form. Agora Dados+Financeiro
  são **um só formulário com um Salvar** (como o cadastro) — um clique envia tudo. Contrato segue fora
  do form. Era também a causa do "valor não registrado no histórico".
- **#353 (acordeão de reajuste):** histórico agora é um acordeão por **data de vigência** — a lista
  mostra só as datas (recolhidas, recente→antiga); clicar expande as alterações daquela vigência, cada
  uma com data do pedido, descrição e lixeira individual. Mudanças de configuração (doc 33 F15) passam
  a gravar a vigência (coluna aditiva `patient_reajuste_changes.vigencia`, já em produção).

**Por quê:** o dono reportou que o cadastro "não salvava de verdade" (perda de trabalho real) e que a
lista de reajustes ocupava a tela toda.

**Decisões que ficam valendo:** na EDIÇÃO, Dados+Financeiro são um form único (um Salvar salva os
dois); a guia Contrato NUNCA entra nesse form. O servidor continua preservando campo ausente
(`existing`), então salvar não regride dados.

**Armadilhas:** o "item 3" do doc (erro ao entrar vigência do preço, "depois de várias tentativas") era
o mesmo salvamento que não ia — resolvido pelo #352, não é frente separada. O acordeão agrupa pela
hora de PAREDE (UTC), senão o fuso negativo joga a vigência p/ o dia anterior.

**Pendente:** nada do doc 35.

---

## 2026-10-12 — Doc 34: correções do doc 33 — mobile, fuso, contrato, Documentos, agenda (#345–#349)

Correções/ajustes das entregas do doc 33. Todas no ar.

**Entregue:**
- **#345 (UI/celular):** ícones de editar/excluir dos registros e exercícios só apareciam no hover —
  invisíveis no celular; agora sempre visíveis. Abas do paciente quebram em linha (sem rolagem
  horizontal). Texto de ajuda da anamnese atualizado. Ao enviar um exercício, a área de modelos fecha.
  "+ Material" no mesmo tamanho de "+ Atividades"/"+ Exercícios".
- **#346 (fuso):** data/hora das guias registro/anamnese/atividade/documento saíam 3h adiantadas
  (gravávamos o instante UTC). Novo `agoraParede()` grava o relógio de São Paulo; a tela passa a
  mostrar a hora certa.
- **#347 (contrato):** o logo volta a começar a 2 cm da margem — o vão persistia por um padding do
  wrapper do painel (`AreaTint`) que a impressão mantinha; agora é zerado no print.
- **#348 (Documentos):** ao salvar, o documento recebe um **nome** (rótulo na lista, no lugar de
  "Documento N"); o botão **Imprimir** saiu da área de edição (fica só na lista); e a **impressão
  voltou a funcionar** — saía em branco no celular porque o conteúdo era desmontado antes de o
  navegador capturar a página.
- **#349 (agenda):** "Novo atendimento" lista o paciente pela **identificação da agenda** (id da
  agenda), como as células da agenda.

**Decisões que ficam valendo:**
- Timestamps para EXIBIR na tela gravam com `agoraParede()` (relógio de SP), nunca `new Date()` cru.
- Impressão de bloco dentro de guia = portal no body, sempre montado, disparado por nonce (nunca
  desmontar antes do print — no celular `window.print()` não bloqueia).

**Armadilhas:** o merge travou um tempo porque o app do Vercel parou de postar o check obrigatório
"Vercel" (preview buildava verde, mas sem status); a branch tem `enforce_admins`, então nem admin
fura, e postar o status na mão é recusado ("not set by expected app"). Resolveu reconectando a
integração Vercel↔GitHub. O loop de merge agora confere `state == MERGED` (o `gh pr merge` saía 0
mesmo recusando).

**Pendente:** nada do doc 34. (Do doc 33, segue só o F16 aguardando re-teste do dono.)

---

## 2026-10-12 — Doc 33 (parte 3): histórico de reajuste completo (#343) + F16 investigado

**Entregue:**
- **#343 (F15) — histórico de reajuste completo.** Além de formato/preço, o "Histórico de reajuste"
  passa a mostrar mudanças de: nº de sessões do pacote, dia de vencimento (e o 2º), "pagar até",
  intervalo de reajuste, pacote completo↔fragmentado. Ao salvar a edição, o `updatePatient` compara o
  que gravou (re-leitura) com o estado anterior e grava uma linha por mudança em
  `patient_reajuste_changes` — só exibição; o motor segue nas tabelas próprias. Cada linha tem lixeira.

**F16 (bug avulso→mensal) — investigado, NÃO reproduzido.** Verifiquei AO VIVO (demo, Playwright) que
o cliente produz `paymentFormat="mensal"` corretamente ao clicar Mensal vindo de Avulso, e que o form
do Financeiro (o que tem o hidden `paymentFormat`) é o que salva — ou seja, a submissão envia "mensal".
A revisão do `updatePatient` mostra que ele aplica o valor e grava a vigência. Já existe um
`revalidatePath(.../edit)` que corrige o sintoma "o rádio volta para Avulso" (cache do RSC da edição).
Conclusão provável: resolvido pelas mudanças recentes. Pendente: re-teste do dono no ar; se persistir,
abrir o DevTools→Network e conferir o valor de `paymentFormat` enviado (diagnóstico definitivo).

**Decisões que ficam valendo:**
- Histórico de reajuste = vigências (formato) + preço + `patient_reajuste_changes` (demais campos).

**Pendente:** F16 aguarda re-teste do dono (as outras 16 frentes do doc 33 estão no ar).

---

## 2026-10-12 — Doc 33 (parte 2): as 3 features grandes — Anamnese, Atividades, Documentos (#339–#341)

**Entregue:**
- **#339 — guia Anamnese (nova).** À direita de Registros. Cada campo com Salvar/Editar próprios
  (editar grava a data/hora); 8 campos do modelo padrão + "Adicionar campo" (personalizados,
  removíveis). Nova tabela `patient_anamnese`. Saíram o botão "+ Anamnese estruturada" e o formulário
  único antigo.
- **#340 — reforma da guia Atividades.** Nova ordem: **+Atividades** (nova seção — atividades
  realizadas com o paciente, editar/excluir; tabela `patient_activities`) → **Diário de humor** com
  **Desfazer** (reverte a ativação sem apagar os humores) → **Escala de desfecho** com **Desfazer**
  (remove o último link pendente) → **+Exercícios** (ex-+Tarefas, agora com editar) → **+Material**
  (trouxe o conteúdo da guia Materiais com Compartilhar; a guia **Materiais foi removida**).
- **#341 — guia Documentos (nova).** Cabeçalho automático (logo centralizado + profissional, com
  "CRP nº" quando a descrição é Psicologia, + paciente com nascimento/idade e nº de sessões Presente),
  área de texto, Salvar/Imprimir. Documentos numerados por paciente (número fixo), lista com
  Editar/Imprimir/excluir (confirmação). Impressão via portal no body (multi-página, margem 2cm).
  Nova tabela `patient_documents`.

**Decisões que ficam valendo:**
- Anamnese e Atividades e Documentos: cada item/campo/doc é uma linha com Salvar/Editar próprios;
  editar atualiza o `updatedAt`. Documentos: número por paciente é fixo (não renumera).
- A guia "Materiais" deixou de existir — o conteúdo vive em "+Material" dentro de Atividades.
- "Desfazer" (humor/escala) reverte a geração do link sem apagar dados anteriores.

**Armadilhas:** quando a frente toca os MESMOS arquivos da anterior (PatientDetail/actions/schema/page),
só ramificar depois que o PR anterior mergeou — senão a branch nasce sem a frente anterior.

**Pendente:** F15 (histórico de reajuste completo — exige versionar campos hoje sem histórico: dia de
vencimento, pagar-até, intervalo de reajuste); F16 (bug avulso→mensal — aguarda reprodução do fluxo).

---

## 2026-10-12 — Doc 33 (parte 1): cards, contrato, guia geral, recibo, escola, registros, atraso falso (#330–#337)

Doc 33 é um backlog grande (~17 frentes). Esta leva entregou 12; faltam 5 (ver Pendente).

**Entregue:**
- **#330** card da lista de pacientes abre WhatsApp direto; card da área do paciente perdeu o 2º
  ícone (histórico de WhatsApp) e o "Prontuário PDF"; guia "Prontuário" virou "Registros"; abas do
  paciente rolam no celular (nomes não cortam mais).
- **#331** contrato em **via única** (a 2ª via automática saiu; cópias na caixa de impressão) e sem o
  vão vazio no topo do contrato impresso.
- **#332** pago o total, o "· vence" some; coluna Status centralizada com a cor de fundo na largura
  toda, coluna Sessão centralizada; o carry mostra a conta — "(valor − transferido)".
- **#333** recibo: não repete o nome quando quem paga é o próprio paciente; a assinatura leva o
  rótulo da formação (Terapeuta / Psicanalista / Psicólogo(a)).
- **#334** botão de WhatsApp no campo "Contato da escola".
- **#335** registros: lápis edita título+descrição (data/hora vira o momento da edição); "Anexar
  arquivo" abre direto o seletor; texto de confidencialidade novo; "Histórico terapêutico" saiu da
  guia Registros.
- **#337** bug "Atrasado · 1" falso no card: `situacoesDaLista` montava a conta com menos fatos que
  a tela do paciente (faltavam `quita`, `vencimentos` editados, tamanho do pacote vigente). Agora a
  lista passa os mesmos fatos → as duas contas coincidem.

**Decisões que ficam valendo:**
- Contrato = via única (impressão decide cópias). Recibo: assinatura por formação (`COMO_ASSINA`).
- `editRecord` atualiza o `createdAt` para o momento da edição (regra do dono para registros).

**Pendente (parte 2 do doc 33):** F7 guia **Anamnese** (nova), F9 reforma da guia **Atividades**,
F10 guia **Documentos** (nova) — três features grandes, cada uma com PR próprio; F15 histórico de
reajuste completo (nº sessão, vencimento, pacote, pagar até, intervalo); F16 bug avulso→mensal não
registra no histórico (investigado; sintomas = paymentFormat salvo como "sessao" em vez de "mensal",
precisa reproduzir o fluxo exato).

---

## 2026-10-11 — Doc 32: histórico WhatsApp + botão direto + logo centralizado + split por ano (#326–#328)

**Entregue:**
- **#327 (A) — WhatsApp.** O histórico de mensagens (2º ícone do card) aparecia vazio: os envios do
  sistema (crons de cobrança e aviso de pagamento) saíam mas não gravavam em `messages` (direction
  `out`), a fonte do histórico. Agora os dois crons — e a mensagem manual (`sendPatientMessage`) —
  registram via `recordOutbound` (data/hora + conteúdo). O código de login por WhatsApp (OTP) NÃO é
  registrado. O botão "enviar mensagem" do card passou a abrir o **WhatsApp direto** (`wa.me`), igual
  ao botão ao lado do telefone no cadastro, em vez do compositor interno.
- **#328 (B) — logotipo.** Logo do contrato e do recibo saiu do quadro no canto superior direito
  (doc 31) e virou **centralizado, acima do título**, com ~2 quebras de linha antes do título; sem
  imagem, não ocupa linha. Margens de impressão já eram 2 cm (`@page margin 20mm`).
- **#326 (C) — split por ano do pacote cross-year.** Continuação do doc 31 D. O cabeçalho do
  pagamento (pacote/quinzena) na tabela de Controle passou a ser posicionado pelo **vencimento** e não
  pela data do pagamento. Assim o pacote que cruza o ano aparece certo: 2024 = cabeçalho + sessão
  23/12; 2025 = sessões de janeiro. O valor pago continua contado no ano do pagamento.

**Por quê:** correções do dono sobre o que os docs 28/31 deixaram: histórico de WhatsApp sem registro,
botão de mensagem que não abria o WhatsApp direto, logo no lugar errado, e o split por ano do pacote
que cruza o ano ainda bagunçado.

**Decisões que ficam valendo:**
- Envio de WhatsApp AO PACIENTE grava em `messages` (`recordOutbound`) — é o histórico. `messageLog`
  (evento+status, sem texto) é outra coisa. OTP de login não entra no histórico.
- O ano em que a linha aparece no Controle: sessão pelo próprio dia; cabeçalho de pagamento pelo
  VENCIMENTO (`dataDoAnoControle`). O valor pago, nas Valores Recebidos, segue pela data do pagamento.

**Armadilhas:** `recordOutbound` já existia; só o engine e o dashboard de mensagens o chamavam — os
crons o ignoravam, por isso o histórico ficava vazio.

**Pendente:** nada do doc 32.

---

## 2026-10-11 — Doc 29 frente G: casca única nos cards de Ajustes (#324)

**Entregue:** os 6 cards de Ajustes que ainda usavam a casca antiga (`p-8 bg-white rounded-[48px]
shadow-sm border`) — Booking, Integrações, Locais, Reunião (vídeo), SMTP e Transcrição por IA —
foram para `glass-card rounded-[24px] p-6`, a casca do resto da página (referência: card do Telegram,
citada no doc 29). Fecha a padronização que o #319 começou pelo conteúdo.

**Por quê:** o dono deixou a frente G aberta "aguardando o padrão"; ao retomar, delegou a decisão
("faça da forma mais adequada"). O padrão da casa já era o `glass-card` (Telegram, WhatsApp e todos
os cards novos); os 6 eram o resíduo legado.

**Decisões que ficam valendo:** só a casca muda — o conteúdo (texto em cima, controle embaixo em
largura cheia) já estava padronizado. O formulário de **Perfil** fica distinto de propósito: é o bloco
de identidade da página, não um card de ajuste.

**Pendente:** nada. Docs 29, 30 e 31 sem pendência.

---

## 2026-10-11 — Doc 31: ícone balão + logo nos documentos + pagamento cross-year + editar vencimento (#320–#322)

**Entregue:**
- **#320 (B+C):** 2º ícone do WhatsApp virou **balão preenchido** igual ao de mensagem
  (`MessageCircle fill`, botão branco). **Logotipo** opcional para contrato e recibo: quadro fixo
  3×3 cm no canto superior direito do papel; sem imagem fica em branco. Campo `logoUrl` em `user`
  (Ajustes → `SingleLogo`); `ContratoImpresso`/`ReciboImpresso` desenham `LogoBox` e o print CSS
  libera `.doc-logo`.
- **#321 (D) — crítico, pagamento cruzando o ano.** Pacote 23/12 + 08/01 pago em 10/01 do ano
  seguinte: o pagamento aparecia "Pago" sem lançamento à vista e o recibo perdia as datas das
  sessões. Causa: quando o pagamento não casa pela `chave` (defasada ou antiga sem chave), ele cai
  no passo 2 de `casarPagamentos` (distribuição por vencimento), que marcava `recebido` mas NÃO
  empilhava o lançamento na lista `pagamentos` da cobrança. Agora empilha (com guarda de
  duplicidade). O recibo acha a cobrança por essa lista e volta a listar as sessões certas.
- **#322 (E) — editar vencimento à mão.** Lápis ao lado de "· vence dd/mm" na guia Geral, só
  enquanto a cobrança não tem pagamento lançado; clica → campo de data → salva sem mexer no valor
  nem nas outras cobranças; editado, aparece o ↩ "desfazer" (volta à data calculada). Nova tabela
  aditiva `cobranca_vencimentos` (override por chave, único por usuário+paciente+chave).

**Por quê:** o dono conferiu os docs anteriores e apontou (1) o 2º ícone ainda fora do padrão e a
falta do logotipo nos documentos; (2) um pagamento de pacote que cruzava o ano não correspondia às
sessões no recibo; (3) a necessidade de corrigir o dia de um vencimento sem ter de refazer a
cobrança.

**Decisões que ficam valendo:**
- Passo 2 de `casarPagamentos` empilha o pagamento na lista da cobrança — `pagamentos` é exibição +
  vínculo do recibo; a conta de dinheiro continua em `recebido`/`ultimo` (nenhum valor muda).
- Vencimento editável é um **override por chave** (tabela `cobranca_vencimentos`), aplicado pelo
  motor por cima do calculado ANTES de ordenar. Desfazer = apagar a linha; o motor recalcula o
  original. Não se guarda a data original.

**Armadilhas:** a chave do pacote é `pacote:inicio:0` quando o período é aberto (`chaveDoDia` devolve
`"inicio"`), não uma data. Script tsx que usa `@neondatabase/serverless` tem de rodar de DENTRO do
repo (node_modules); neon-http solta "Assertion failed … async.c" no exit — ruído benigno, a DDL já
rodou.

**Pendente:** nada do doc 31. (A frente G do doc 29, que seguia aberta, foi fechada no #324.)

---

## 2026-10-11 — Doc 30: vigência do tamanho do pacote (crítico) + bugs/ajustes + Ano TODOS/PDF (#315–#317)

**Entregue:**
- **#315 (bugs):** pagamento **TOTAL** voltou a aparecer na guia Geral — `ColunasDoPagamento`
  sintetiza um lançamento do representante (`c.pagamento`) quando a cobrança vem sem lista de
  lançamentos (senão a linha sumia inteira). Botão **"Restaurar contrato"** ao lado do Salvar (volta
  ao modelo padrão + limpa o override; páginas passam `textoPadrao`). 2º ícone de mensagem virou
  **ícone** (`MessageSquareText`, só ícone) do histórico de WhatsApp. Valor de sessão **avulsa** em
  **negrito** no Controle.
- **#316 (crítico) — vigência do tamanho do pacote.** Mudar a quantidade de sessões com "Vale a partir
  de" aplicava RETROATIVO (renumerava o passado). Agora vale só das sessões com data >= a vigência; a
  sequência **reinicia em 1/N** na data e o anterior fica intacto. Nova tabela `patient_package_history`
  (aditiva), `posicoesDaSequencia` ganhou `tamanhosPorData` (varredura data-aware), a edição grava a
  base + a vigência, e guia/agenda/cobranças/fechamento passam o histórico. Exemplo do doc confere.
- **#317 (A) — Ano "TODOS" + Imprimir PDF.** Filtro com "TODOS" (Controle sem filtro; Valor Recebido
  uma tabela por ano). Botão Imprimir = `window.print()` isolando `#controle-print`, ações escondidas
  por `print:hidden`, títulos no PDF.

**Decisões que ficam valendo:**
- Tamanho do pacote por **data** (`patient_package_history` + `tamanhosPorData` em `posicoesDaSequencia`);
  `sessions_in_packet` segue como o tamanho ATUAL. A sequência reinicia em 1/N na vigência.
- Pagamento total na guia: sem `pagamentos` na cobrança, usa o representante `c.pagamento` (valor = total).

**Armadilhas:** a numeração do pacote é REFEITA do zero sempre (nunca guardada) — a vigência entra no
motor (`sequenciaPacote`), não em contador. Criar a branch ANTES de commitar (quase commitei no main).

**Pendente:** frente G do doc 29 (layout dos cards do Ajustes) segue aguardando o dono confirmar o padrão.

---

## 2026-10-11 — Doc 29: FIX crítico das datas do recibo + ajustes do doc 28 (#309–#313)

**Entregue:**
- **#309 (crítico) — datas do recibo escopadas à COBRANÇA.** O recibo do doc 28 pegava TODAS as
  sessões Presente/Faltou do paciente em ordem cronológica — cruzava a fronteira da cobrança (datas de
  outro pagamento), deixava vazar **sessão gratuita** e às vezes caía no fallback (só a data do
  pagamento). Agora usa as sessões da **cobrança** do pagamento: `cobranca.ids` já é o conjunto certo
  (exclui gratuita, Desmarcou/Prof.desm/Atestado; inclui Presente/Faltou). `CobrancaNaTela` voltou a
  expor `ids`; o motor `datasDoRecibo` ficou igual, mudou só a entrada (preço = valor da cobrança ÷ nº
  de sessões). Confere com os exemplos do documento.
- **#310 — ordem dos lançamentos (guia Geral).** Total e parcial com a mesma ordem, por lançamento:
  `[valor·]data·forma·🗑` → responsável → carimbos recibo/nota → botões. Total oculta o valor; parcial
  mostra. `ColunasDoPagamento` ficou só com "Pago" + aviso de diferença.
- **#311 — contrato (negrito) + financeiro.** 3.1 sequência e 3.2 horário fixo em negrito; 4.1 gratuito
  "R$ 0,00" em negrito sem "totalizando…"; 4.2 gratuito/1ª/última do pacote em negrito. Radio Quinzenal
  → "Pagamento realizado quinzenalmente…".
- **#312 — ajustes.** Texto de ajuda do contrato em lista (+ bullet: Salvar guarda só o contrato DESTE
  paciente); mensagem de cobrança em bullets; **foto antiga fora do cabeçalho** (usa `user.image`, não
  mais `photo3x4`); **WhatsappCard** no layout dos demais (botão embaixo, largura cheia), verde #25D366,
  "Conectado" ao conectar.
- **#313 — Salvar do autoagendamento** desce para a própria linha (saía da tela no celular).

**Decisões que ficam valendo:**
- Recibo = datas das sessões da **cobrança** do pagamento (consumidas em sequência pela ordem dos
  pagamentos da cobrança) — NUNCA todas as sessões do paciente. `cobranca.ids` é a fonte do conjunto, e
  `CobrancaNaTela` passou a expô-lo.

**Pendente:** frente G (layout puro) — padronizar SMTP / Integrações / Transcrição por IA / Recursos do
paciente no mesmo layout do card do Telegram (texto em cima, botão embaixo). São ajustes visuais,
aguardando o dono confirmar o padrão.

---

## 2026-10-11 — Doc 28: contrato por modalidade, recibo por atendimento, card/perfil (#302–#307)

**Entregue (6 frentes):**
- **#302 — Contrato (texto + tela).** Título, objeto (2.1/2.2), reserva (5.1) e rótulo da assinatura
  passam a seguir a **formação** escolhida nos Ajustes (terapia/psicanálise/psicologia). DAS PARTES
  reescrito (rótulos sem "(Analista)/(Responsáveis)/(Beneficiário)", um item por linha); 3. sem
  "SETTING ANALÍTICO"; 5.3/5.4 ANALISTA→PROFISSIONAL; 4.2 (gratuito = isenção indeterminada, 1ª/última
  sessão sem "mês vigente"); data da assinatura = hoje. Na tela: campos auto-preenchidos + [colchetes]
  em **negrito**, botão **Salvar** (`patients.contrato_texto`), imprime **2 vias**, justificado.
- **#303 — Card + financeiro.** "Mensal/Quinzenal pacote" → "Pagamento mensal/quinzenal"; vencimento
  quinzenal com 2 dias, 1ª/última sessão do pacote sem vencimento; lista com valor na 2ª linha
  (mobile); menu sem Prontuário/Contratos/Mensagens; textos dos radios + contagem "(1/4, 2/4…)".
- **#304 — Perfil/Ajustes.** Foto fora; "Endereço"; "Plataformas do atendimento online"; Telegram
  vira card próprio abaixo do WhatsApp; âncoras removidas (coluna única); textos em bullets
  (Consentimento/Pix/IA/Locais); toggle da transcrição com contraste.
- **#305 — Motor do recibo** (`lib/reciboSequencia.ts`, puro). O recibo lista as **datas dos
  atendimentos** (não a do pagamento): `valor ÷ valor da sessão` sessões, consumidas em **sequência**
  sem repetir (determinístico pela ordem de lançamento), só **Presente** (`realizada`) e **Faltou**
  (`nao_realizada`); nota **"Pagamento parcial do pacote que iniciou em DD/MM"** quando não fecha
  sessão inteira.
- **#306 — Recibo por lançamento.** Com >1 pagamento, cada lançamento tem Emitir recibo/nota + carimbo
  ao lado da própria lixeira; com 1, o bloco único de cima.
- **#307 — 2º ícone WhatsApp.** Ícone preto no card abre o histórico do que o sistema enviou por
  WhatsApp (tabela `messages` out+whatsapp).

**Decisões que ficam valendo:**
- `users.descricaoAtendimento` guarda a FORMAÇÃO (`terapia|psicanalise|psicologia`), não a frase — é o
  que chaveia título/objeto/assinatura do contrato.
- Recibo: Presente=`realizada`, Faltou=`nao_realizada`; excluídos `cancelada`/`realocada`/
  `prof_desmarcou`/`atestado`. A sequência é SEM estado guardado — recalculada da ordem dos pagamentos.
- Contrato salvo (`contrato_texto`) tem prioridade sobre o gerado; a impressão usa o que está na tela,
  salvo ou não.

**Armadilhas:** `montarContrato` tem 2 callers (contrato/page e edit/page) — campo novo tem que ir nos
dois. Campos auto saem com marcador `\u0001…\u0002`; teste usa `textoLimpo()`. Coluna aditiva em prod
por `ALTER ... ADD COLUMN IF NOT EXISTS` (script tsx one-off, `sql.query` com placeholders).

**Pendente:** nada do doc 28. Itens de layout vagos ("ocupe o espaço riscado") foram tratados alargando
os blocos/removendo colunas estreitas — podem pedir um ajuste fino visual se o dono quiser.

---

## 2026-10-10 — Doc 27: guia Geral (descritor/negrito) + Perfil↔contrato + lixeira de reajuste (#298–#300)

**Entregue (4 frentes):**
- **#298 — Guia Geral.** Na linha financeiro o descritor "Pagamento · X sessões · vence DD/MM"
  mescla as 3 primeiras colunas (`colSpan=3`, a td vazia de Data/hora saiu). A linha do pagamento
  (`[valor ·] data · forma`) ficou em **negrito** e o responsável (`pagoPor`) desce pra linha de baixo.
- **#299 — Perfil ↔ contrato.** Ajustes > Perfil reorganizado na ordem **Nome · CPF · Telefone ·
  E-mail · Nº do Conselho** + seção nova **"Informações para o contrato"** (endereço do consultório,
  cidade, estado, plataforma on-line). **CPF saiu do cartão Recibo** → mora só no Perfil (fonte única).
  O **contrato** passa a preencher do Perfil: cabeçalho da analista (conselho, endereço/plataforma,
  telefone/e-mail), **Foro** e **local da assinatura** (cidade/estado). Cláusula **4.2 perdeu** a
  linha "via [PIX...] na chave: [Sua Chave PIX]". Assinatura do **Responsável 2** só sai quando há R2.
- **#300 — Lixeira de reajuste.** Cada linha de REAJUSTE do histórico ganha lixeira; a **entrada**
  (preço/formato iniciais) não. Apagar remove preço+formato daquela vigência e **reconcilia** o
  cadastro (valor/formato atuais voltam ao último restante; lembrete recalculado).

**Decisões que ficam valendo:**
- **CPF da terapeuta mora no Perfil** (`users.therapistCpf`, salvo por `updateProfile`). `saveDadosDoRecibo`
  NÃO toca mais nele (só a descrição) — evita dois formulários sobrescreverem o mesmo dado.
- 6 colunas novas em `user` (todas nullable): `therapist_phone`, `conselho`, `endereco_contrato`,
  `cidade`, `estado`, `plataforma_online`. Aplicadas em prod por **ADD COLUMN IF NOT EXISTS** ANTES
  do merge (o `findFirst` seleciona pelo schema; sem a coluna no banco = 500).
- Lixeira: só reajuste é removível; a ENTRADA (registro mais antigo de cada tabela) nunca é apagada,
  nem se a chamada pedir. `removivel` em `historicoDeReajuste` é a fonte da verdade da UI.

**Armadilhas:** `montarContrato` ganhou 7 campos novos (analistaConselho/Endereco/Plataforma/Telefone/
Email, cidade, estado) → os **dois** callers (contrato/page e edit/page) tiveram que passar todos,
senão TS quebra. `db:push` é interativo (risco de hang) → apliquei o ALTER aditivo direto por script
tsx one-off (neon serverless exige `sql.query(...)` com placeholders, não a forma de função).

**Pendente:** nada do doc 27.

---

## 2026-10-10 — Doc 26: guia Geral (colunas/linha financeiro) + contrato dinâmico (#295–#296)

**Entregue (2 frentes):**
- **#295 — Guia Geral.** Colunas reordenadas: **Data/hora | Sessão | Status | Valor | Pagamento**
  (Sessão e Status trocadas). Na linha financeiro (`tipo:"pagamento"`) a data saiu da coluna
  Data/hora (já aparece nos dados do pagamento) e o descritor "Pagamento · X sessões · vence DD/MM"
  mescla as colunas Sessão+Status (`colSpan=2`). O selo "Pago" ocupa a largura da coluna.
- **#296 — Contrato dinâmico.** O contrato preenche do cadastro/agenda em vez de placeholders:
  - **3.1 Duração** = "até X minutos", X = MAIOR `duration` das sessões do paciente.
  - **3.1 Frequência** = pela recorrência da ÚLTIMA sessão agendada: Semanal (1x/2x por
    `timesPerPeriod`), Mensal, Quinzenal; "não repetir" → Semanal.
  - **3.2 Horário Fixo** = dia da semana + hora do último agendamento (parede).
  - **4.2 Vencimento** por formato: mensal (dia X), quinzenal (dias X e X), primeira/última sessão do
    pacote, avulso (X horas antes); **gratuito → a linha vira "Isento"**.
  - **4.3 Reajuste** já era "a cada X meses" (sem mudança).
  - Sem agendamento/dado → mantém os placeholders [ex: ...].

**Decisões que ficam valendo:**
- Guia Geral: ordem das colunas é Data/hora | Sessão | Status | Valor | Pagamento. A linha
  financeiro não repete a data (ela vive nos dados do pagamento).
- O enquadre do contrato (duração/frequência/horário) vem da AGENDA do paciente — a MAIOR duração e
  a recorrência/horário da ÚLTIMA sessão agendada (`enquadreDaAgenda`, server-only em `src/lib`).
- Formatos de pagamento canônicos: `sessao | mensal | quinzenal | primeira_pacote | ultima_pacote |
  gratuito` (patients.paymentFormat). A cláusula 4.2 do contrato chaveia neles.

**Armadilhas:** `montarContrato` é puro/testado — os campos de agenda/pagamento chegam já resolvidos
pelos 2 callers (contrato/page tinha `columns:` filtrado → precisei add paymentFormat/paymentDay/
paymentDay2/horasAntesPagamento/timesPerPeriod; edit/page traz o row cheio).

**Pendente:** nada do doc 26.

## 2026-10-10 — Doc 25: vigência (fuso), contrato, pagamento na guia Geral, ⓘ (#290–#293)

**Entregue (4 frentes):**
- **#290 — Vigência do reajuste salvava 1 dia a menos (fuso).** A data "Vale a partir de"
  (AAAA-MM-DD) era lida com `new Date(string)` = UTC; em BRT caía no dia anterior ao salvar e exibir
  (10/10 virava 09/10). `dataDoPreco` e a edição da data passam a ler via `diaDoFormulario`
  (meia-noite LOCAL); a exibição do histórico formata pela PAREDE (UTC, `horaDeParede`) → corrige
  inclusive linhas antigas.
- **#291 — Contrato.** Responsável 2 sem nome → a linha inteira some (antes saía o placeholder).
  Endereço do contratante = `patients.address`. Telefone/E-mail de contato = responsável
  (`guardianPhone`) com fallback no paciente (`phone`). `DadosDoContrato` ganhou os 3 campos.
- **#292 — Pagamento na guia Geral.** Saíram as colunas separadas "Pago em / Responsável / Forma";
  tudo vive na célula PAGAMENTO, na linha de cada lançamento: `[valor ·] data · forma · responsável`
  antes da 🗑. Valor por quantidade: pagamento ÚNICO que quita o total não mostra o valor; com MAIS
  DE UM, cada linha mostra o seu. Campo "Valor recebido" com máscara monetária R$ (servidor segue
  com `parseMoedaBR`).
- **#293 — ⓘ.** Os ⓘ já usavam UM componente único (`InfoTip`) em todo o sistema — a padronização
  pedida já era estrutural. Polimento sem mudar a cara: largura responsiva (`max-w` = tela − 2rem) +
  `break-words`, pro balão nunca ultrapassar a tela no celular.

**Decisões que ficam valendo:**
- Data de DATA (sem hora, ex.: vigência): salvar meia-noite LOCAL (`diaDoFormulario`) e exibir por
  PAREDE (`horaDeParede`, UTC). Não usar `new Date("AAAA-MM-DD")` (UTC → -1 dia em fuso negativo).
- Toda dica de ⓘ passa pelo `InfoTip` — é o padrão visual único. Não criar balão ad-hoc.
- Guia Geral: forma + responsável moram na linha do lançamento, não em colunas.

**Armadilhas:** o campo "Valor recebido" é controlado (o botão mostra `Confirmar <valor>`); a máscara
foi feita no próprio input (dígitos→R$), não dá pra trocar pelo `MoneyInput` (não-controlado) sem
perder o `valorNum` ao vivo.

**Pendente:** nada do doc 25.

## 2026-10-09 — Doc 24: quinzenal respeita AS DUAS datas de vencimento (#288)

**Entregue (PR #288):** no quinzenal com dois dias de pagamento configurados (ex.: dia 10 e dia
20), cada quinzena passa a vencer na SUA data — a 1ª no 1º dia, a 2ª no 2º —, no mês da primeira
sessão daquela quinzena. Antes o motor olhava só a primeira data e repetia nos dois grupos.

**Por quê:** o dono viu os vencimentos caírem todos no mesmo dia; o cálculo ignorava a 2ª data.

**Decisões que ficam valendo:**
- Quinzena 1 → `diaPagamento`; quinzena 2 → `diaPagamento2` (cai no `diaPagamento` se o 2º não
  estiver preenchido). Vencimento = esse dia no mês da 1ª sessão da quinzena, **mesmo que já tenha
  passado** no mês (não pula para o mês seguinte).
- Isto **SUBSTITUI** a regra de 18/09 ("não vencer antes da 1ª sessão"): o dono escolheu dia 10/dia
  20 fixos mesmo que a 2ª quinzena venha a vencer alguns dias antes das sessões dela.

**Armadilhas:** a regra de 18/09 estava codificada em 5 testes (quinzenaDoPacote, cobrancas, 2×
primeiroVencimento) + na função `proximoDiaDePagamento` — todos reescritos/removidos. `diaDoMes`
não pula mês.

**Pendente:** nada do doc 24.

---

## 2026-10-09 — Doc 23: ⓘ sem caixa-alta + contrato (título, responsáveis por idade, negrito) (#285–#286)

**Entregue (PRs #285–#286):**
- **Onda 1 (#285):** labels ao lado dos ⓘ padronizados na fonte do "Novo prospectado"
  (`text-sm font-semibold`), **sem caixa-alta** — "Mensagem" (reajuste e aniversariantes), "Filtrar" e
  "Prospectados". Removido o subtítulo "Aparece 7 dias antes…" das devolutivas (o ⓘ já traz).
- **Onda 2 (#286):** CONTRATO —
  - Título só "CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE PSICANÁLISE" (saiu a linha de infantil/adolescente).
  - Bloco do paciente: "Nome:" (era "Nome da Criança / Adolescente:").
  - **Responsáveis por IDADE** (preenchimento automático do cadastro, sem duplicar): ≥ 18 **sem**
    responsável → o paciente é o Responsável 1, o 2 vazio; ≥ 18 **com** responsável → responsável no 1,
    paciente no 2; < 18 (ou idade desconhecida) → responsável do cadastro no Responsável 1.
  - **Campos manuais em negrito**: o que está `[entre colchetes]` sai em `<strong>` no ContratoImpresso
    (contentEditable → digitar por cima herda o negrito).

**Decisões que ficam valendo:**
- Label ao lado de ⓘ = fonte do "Novo prospectado", nunca em caixa-alta.
- Contrato: o paciente MAIOR de idade sem responsável é o próprio contratante (Responsável 1).
- `DadosDoContrato` tem `pacienteCpf` (as 2 telas que montam o contrato passam `patients.cpf`).

**Pendente:** nada do doc 23.

---

## 2026-10-09 — #34(e): diferença do pacote encerrado rola para a próxima cobrança (#283)

**Entregue (PR #283):** fecha o último item do doc 21 (pág 10-11), com o gatilho que o dono
confirmou. Pacote ENCERRADO (última sessão já passou) e pago PARCIALMENTE → a diferença em aberto
soma à próxima cobrança do pacote (400, pago 250 → próximo 400 + 150 = **550**).

**Decisões que ficam valendo:**
- Gatilho = **última sessão do pacote < hoje** (encerramento efetivo). Antes disso a diferença fica
  na própria cobrança.
- Só **pacote pago PARCIALMENTE** rola (recebeu algo, mas não o total). Pacote sem nenhum pagamento
  continua em atraso na própria cobrança; avulso/a-cada-sessão não participam. ("Diferença", não
  "cobrança inteira".)
- O carry é **derivado** (recalculado em `casarPagamentos` a cada leitura) — não grava nada, então
  nunca duplica ao atualizar telas. Campos novos em `CobrancaDaGeral`: `valorBase`, `arrastoRecebido`,
  `transferido`; `valor` passa a ser o efetivo (base + arrasto).
- **Saldo não duplica:** a cobrança que transferiu tem `valorDevido` reduzido pelo transferido; a que
  recebeu, aumentado. Total igual (a dívida muda de linha). Financeiro e saldo usam o mesmo motor.

**Armadilhas:**
- Primeira tentativa rolava a cobrança INTEIRA de pacotes não pagos e até avulsos — quebrou 8 testes.
  A trava é `ehPacote && receb > 0 && falta > 0` (pagamento PARCIAL de pacote).

**Pendente:** nada do doc 21/22.

---

## 2026-10-09 — Doc 22: ajustes do doc 21/doc 9 + aba Contrato (#277–#281)

**Entregue (PRs #277–#281):** feedback de iteração do dono sobre o doc 21/doc 9 (ele testou e
mandou correções) + duas features novas. 5 ondas, cada PR com gate verde.
- **Onda 1 (#277):** retirado "Este recurso também funciona pelo celular." de TODOS os ⓘ (o dono
  não quis a frase); ⓘ em "Próximas devolutivas"; "Reajustes a vencer" aparece mesmo sem paciente.
- **Onda 2 (#278):** guia Geral — cada pagamento lançado (inclusive o primeiro) tem seu 🗑; o
  formulário de lançamento fecha por um X no canto superior esquerdo (o "Cancelar" saiu); a quinzena
  mostra só o VENCIMENTO — **as datas das sessões saíram** (REVERTE o doc 9 #18b, a pedido do dono).
- **Onda 3 (#279):** ao adicionar à sequência do pacote a sessão SEMPRE preenche uma desmarcada — a
  opção "é uma sessão a mais no pacote" saiu (a primeira desmarcada já vem marcada); "Recorrência"
  virou "Repetir agendamento até".
- **Onda 4 (#280):** BUG — "Vale a partir de" não era salvo quando só o VALOR mudava (o preço nascia
  valendo de hoje e o histórico gravava a data errada). `dataDoPreco` deixou de depender de
  `formatoMudou`: a data escolhida vale sempre que preenchida. 2 testes novos.
- **Onda 5 (#281):** aba **"Contrato"** no Editar paciente (ao lado de Financeiro) — mostra o mesmo
  contrato do menu Contratos, montado no servidor e passado pronto; fica fora do `<form>`.

**Decisões que ficam valendo:**
- A quinzena na guia Geral mostra só o vencimento (sem as datas das sessões). O doc 9 #18b foi
  revertido — o dono não quis o detalhe por data.
- "Adicionar à sequência do pacote" = sempre preencher uma desmarcada; nunca acrescentar sessão a
  mais. Sem desmarcada, a sessão é avulsa.
- "Vale a partir de" (formatoDesde) é a data efetiva do preço sempre que preenchida.

**Armadilhas:**
- O PR do HISTORICO do doc 21 (#276) tinha ficado SEM mergear (a entrada vivia só na branch
  `doc21-historico`); recuperada por cherry-pick de `becb7c0`. Conferir que o PR do diário mergeou.

**Pendente:** nada — o **#34(e)** foi entregue depois (#283), ver a entrada acima.

---

## 2026-10-08 — Doc 21: tooltips, textos e comportamentos + financeiro parcial (#270–#275)

**Entregue (PRs #270–#275):** o backlog "doc 21" (tooltips ⓘ, trocas de texto, comportamentos e o
início do financeiro de pagamento parcial), em 6 ondas, cada PR com gate verde.
- **Onda 1 (#270):** `InfoTip` passou a abrir no TOQUE além do hover (botão, clica-fora/Esc fecha) —
  o doc pede tudo funcionando no celular, e no toque não há hover. Vale para TODOS os ⓘ de uma vez.
  Tooltips e textos dos painéis do dashboard (Prospecção, Relatórios, Queixa, Aniversariantes,
  Reajustes); Devolutivas aparece mesmo vazia.
- **Onda 2 (#271):** página de Prospecção — ⓘ em Novo prospectado/Filtrar/lista/Contato(s)-Converter/
  Mensagem; subtítulo e helper trocados.
- **Onda 3 (#272):** cadastro — novos textos dos ⓘ (Pagar até, Devolutiva, Próximo reajuste), ⓘ da
  Queixa removido, "Para menores…" reescrito, rodapé "💡 Etiquetas…" removido; "Vale a partir de"
  passou a aparecer quando QUALQUER campo do Financeiro muda na edição (não só o formato); subtítulo
  do Relatório de pacientes.
- **Onda 4 (#273):** Parabenizar abre o WhatsApp (como Lembrar/Contatar); lista de pacientes e lista
  de reajustes identificam pelo **ID da agenda** (não o nº do cadastro — reverte o doc 9 #11); card do
  paciente mostra só "Em atraso".
- **Onda 5 (#274):** pagamento parcial (doc 21, pág 9) — a coluna Valor mostra o EFETIVAMENTE pago
  quando há pagamento (e "de R$ X" com o previsto enquanto falta); vários pagamentos na mesma cobrança
  não se substituem (empilham, cada um com valor/data). Motor: `PagamentoLancado` ganhou `valor`; a
  cobrança expõe `valorPago` e `pagamentos` (o casamento já somava por chave). 3 testes novos.
- **Onda 6 (#275):** lista de reajustes — aceita a janela de 1 mês (corte foi de 30 p/ 31 dias, senão
  15/01→15/02 = 31 dias ficava de fora); alterar o VALOR da sessão avança o próximo reajuste e tira o
  paciente da lista (independe de "Vale a partir de").

**Decisões que ficam valendo:**
- Tooltip ⓘ é tap-first (abre no toque); todo recurso novo "funciona no celular".
- Identificação de paciente nas listas = **ID da agenda** (`agendaId`), caindo no nº do cadastro e
  depois no nome. (Muda a decisão do doc 9 #11.)
- Na guia Geral, havendo pagamento, a coluna Valor é o PAGO; o previsto vira legenda "de R$ X".

**Armadilhas:**
- `casarPagamentos` (guiaGeral) alimenta a guia Geral, o `resumoDaGeral` (saldo) E a `situacoesLista`
  (badge "Em atraso" da lista de pacientes) — mexer nela toca DUAS telas, não só o financeiro.
- `email-transport.test.ts` é flaky em suíte cheia (conexão SMTP real, ~5s); passa isolado.

**Pendente (do dono — 1 item, mexe em dinheiro):** **#34(e)** — a diferença que sobra no FIM do pacote
transferir para a próxima cobrança do mesmo paciente (pág 10-11). Precisa a palavra do dono sobre o
GATILHO ("quando o pacote fecha"): minha proposta é rolar quando a cobrança está vencida (em atraso) e
já existe uma cobrança posterior; a última concentra o saldo. Muda valores exibidos na guia Geral e na
situação da lista — por isso não foi feito sem confirmar.

---

## 2026-10-07 — Doc 9: os 3 itens de cobrança (#6, #17, #18) (#267–#268)

**Entregue (PRs #267–#268):** fecha o doc 9. O dono delegou a lógica ("adote a que faz mais sentido
com o todo"); cada decisão foi trancada em teste para ele conferir contra a realidade.
- **#6 — "abater do pacote" / preencher desmarcada (#267):** a sessão inserida num pacote fragmentado
  pode PREENCHER uma desmarcada do mês em vez de criar vaga nova: ocupa a posição aberta, nada
  atravessa para o mês seguinte, total idêntico a um mês sem intercorrência. O MOTOR já fazia isso
  desde 17/09 (reposição, `repoeSessaoId`, caso F2); o refactor da onda A (#254, item #5) tirou o
  SELETOR da agenda. Restaurado como "Preenche uma sessão desmarcada?" no Novo atendimento (só único,
  com pacote e desmarcadas em aberto). Dados já vinham do servidor (`patients[].desmarcadas`), validação
  server-side intacta. Testes F6 em `fragmentacao.test.ts`.
- **#17 — falta cobrada fica no pacote, não vira avulso (#267):** no vocabulário da casa, uma falta que
  se cobra é "Faltou" (`nao_realizada`) — um dos dois únicos status que cobram (`STATUS_QUE_PODEM_COBRAR`,
  decisão do dono de 16/09). Ela JÁ ocupa a posição e é cobrada DENTRO da sequência do pacote, nunca como
  avulso. SEM mudança de motor; só regressão F17 que tranca. Marcar a falta cobrada como avulso é o erro
  de uso que produzia o sintoma — avulso é para sessão EXTRA, fora do pacote.
- **#18 — quinzenal (#268):** (a) "2 sessões = 130, não 65": o motor cobra preço-da-sessão × nº-de-sessões,
  nunca metade do pacote — regressão nova em `quinzenaDoPacote.test.ts` (2×65=130). Ver 65 na tela = DADO
  (preço cadastrado pela metade, ou sessões em quinzenas diferentes do calendário 01–15/16–fim). (b)
  "detalhar as sessões de cada pagamento": a linha de pagamento da quinzena agora LISTA as datas que cobre
  (`16/10, 23/10`), não só a contagem — `datasSessoes` em `geralDoPaciente.ts`, puro display. (c) "compensar
  pago a mais/menos": JÁ existe (menos → "Diferença em aberto"/perdoada; mais → "crédito no saldo"; o +30
  que compensa o −30 é o saldo corrente). Mantido como está, não dupliquei numa coluna nova.

**Decisões que ficam valendo:**
- Falta cobrada ⇒ marcar **Faltou**, nunca criar avulso. Avulso é só para sessão EXTRA ao pacote.
- Sessão que tapa um buraco do mês ⇒ **Preenche a desmarcada** (reposição), não "sessão a mais" (que
  cresce o mês e ainda puxa a travessia do mês seguinte).
- Valor da quinzena é **preço × nº de sessões da quinzena**, jamais "metade do pacote".
- A compensação pago-a-mais/menos é o **saldo corrente** da Geral; não há coluna "valor real pago"
  separada — se o dono pedir ao conferir, é adição pequena.

**Armadilhas:**
- `chargeable` tem default `true` no banco e a agenda NÃO o define ao pausar (decisão do dono 16/09: a
  agenda não pergunta "será cobrada?"). Logo "ocupa se chargeable" quebraria o "atravessa" e os testes —
  o sinal de ocupar é o STATUS (`Faltou`) ou a reposição, nunca `chargeable`.
- `CobrancaNaTela` ganhou campo obrigatório `datasSessoes`; quem construir o tipo precisa preenchê-lo
  (só `geralDoPaciente.ts` constrói hoje).

**Pendente:** nada do doc 9 — os 18 itens + Contratos estão no ar. Se o dono, conferindo, quiser a coluna
"valor real pago" explícita (#18c) ou outra forma do seletor de reposição (#6), são ajustes pequenos.

---

## 2026-10-07 — Doc 9: 16 itens + menu Contratos (#254–#265)

**Entregue (PRs #254–#265):** 16 dos 18 itens do doc 9, em ondas, cada PR com testes + lint + build.
- **Onda A (#254):** #5 tira "repõe desmarcada" do novo agendamento · #10 limpa a legenda da agenda
  (símbolo segue no card) · #13 fonte menor nos cards de Analíticos · #16 remove a caixinha "Em aberto".
- **Onda B (#255):** #7 `min-w-0` nas colunas do dia (feriado longo não desalinha) · #9 linha da data
  fixa — o wrapper virou scroller dos 2 eixos (max-h); verificado no /demo (header `position:sticky`).
- **Onda C (#256–#258):** #15 aviso de choque de horário para QUALQUER agendamento (antes só p/ outro
  paciente) · #3 excluir série limpa os `sessoesPuladas` (Hor. Bloq.) órfãos, bloqueio PERMANECE · #4
  recorrência Avulso/Gratuito independente do pacote (pergunta de sequência passou a valer no recorrente;
  createRecurring grava `extra` por linha).
- **Onda D (#259–#261):** #12 Contatar vazio abre o WhatsApp sem texto + registra "contato externo" ·
  #11 lista de Pacientes identifica pelo ID (registrationNumber) em vez do nome · #14 frequência da lista
  DERIVADA da agenda (mensal não aparece mais como semanal), nova `rotuloFrequenciaReal`.
- **Onda E (#262–#263):** #1 Aviso de Reajuste no Dashboard + "Lembrar" (wa.me); saiu da Agenda · #2
  Próximas devolutivas no Dashboard (Agendar wa.me + ✓ dispensa; coluna `devolutiva_dispensada_em`).
- **#8 (#264):** investigado por TDD — o motor JÁ respeita as 2 datas de pagamento (fragmentado e
  completo testados); SEM mudança de código, só regressão. O relato é cadastrar a 2ª data no paciente.
- **Contratos / G (#265):** menu "Contratos" → `/dashboard/contratos` escolhe o paciente →
  `/dashboard/patients/[id]/contrato` abre o modelo de psicanálise JÁ preenchido (analista dos Ajustes +
  cadastro do paciente) e EDITÁVEL na tela para completar e imprimir (padrão recibo, sem logotipo, não
  guarda no banco). `lib/contrato.ts` puro. Verificado no /demo.

**Decisões que ficam valendo:**
- Frequência e reajuste da lista/painel vêm da AGENDA, não dos campos cacheados do cadastro (que viram
  mentira ao mudar na agenda) — mesma razão que já valia para dia/hora.
- Reajuste e devolutiva concentram no Dashboard; a Agenda não indica mais reajuste.
- O aviso de choque de horário vale para qualquer agendamento, não só de outro paciente.

**Armadilhas:**
- `db:push` é a fonte do schema (não há arquivo de migração): a coluna `devolutiva_dispensada_em` foi
  aplicada ao PROD por ALTER aditivo ANTES do merge, para o deploy não dar 500 ao selecionar a coluna.
- #9 (sticky): `glass-card` tem `overflow-hidden` e prendia o `sticky top-0`; a correção foi tornar o
  wrapper interno o scroller dos dois eixos (`overflow-auto max-h`), como o sticky-left da hora já exigia.

**Pendente (do dono):** **#6, #17, #18** — correções do FRAGMENTADO (billing). Mexem no coração do motor
de pacote (sessão faltada-paga ocupar a posição sem contar como efetuada; "abater do pacote"; detalhamento
quinzenal + compensar pago a mais/menos). Pelo padrão da casa, dinheiro se corrige com os NÚMEROS EXATOS
do dono travados em teste ANTES do código — aguardam ele confirmar os valores esperados de 1–2 exemplos.

---

## 2026-10-05 — Contatar individual + sequência pela qtd na agenda (doc 20)

**Entregue (PRs #250, #251):**
- **#250 — bug da sequência (1/4 com 6 cadastradas):** a numeração 1/N do pacote na **agenda** ignorava
  a "Quantidade de sessões do pacote". A página chamava `rotulosDasSessoes` **sem `tamanhoPacote`** (nem
  selecionava `sessionsInPacket`), então o Completo caía no padrão antigo `4×vezes`. Fix: a query da
  agenda passou a trazer `sessionsInPacket` e a passá-lo como `tamanhoPacote`. Completo agora é 1/6..6/6
  (ou 1/8..8/8), mesmo atravessando o mês; Fragmentado segue por mês. (#244 corrigira o SALVAR; este
  corrige o USO na sequência.)
- **#251 — Contatar individual:** na Prospecção, o checkbox de seleção saiu; cada prospectado tem um
  botão **"Contatar"** que envia a mensagem (definida uma vez abaixo da lista) **só para ele** (WhatsApp
  dele) e registra o contato só dele, com **data + horário** + conteúdo.

**Decisão que fica valendo:** a quantidade do pacote vale em TODAS as telas que numeram a sequência
(agenda incluída) — qualquer caller de `rotulosDasSessoes`/sequência precisa receber `tamanhoPacote`.
O envio de mensagem na prospecção é 1-a-1 (Contatar), nunca em lote.

---

## 2026-10-05 — Prospecção, agenda e financeiro (doc "1.pdf", 6 itens)

**Entregue (PRs #244–#248):**
- **#244 — bug qtd do pacote não salvava:** `updatePatient` só gravava `sessionsInPacket` quando
  `isPacote` (= `newFormat === "pacote"`), mas os formatos reais são mensal/quinzenal/primeira/ultima
  — nunca "pacote" — então o campo caía em `null` a cada save. Agora salva para qualquer formato de
  pacote (`usaPacote(newFormat)`); preserva o existente se vier vazio.
- **#245 — prospecção:** botão "Adicionar prospectado" trava no 1º clique (SubmitButton/useFormStatus,
  sem duplicata); filtro por **telefone** (dígitos, trecho, ao vivo).
- **#246 — Novo atendimento só pacientes ATIVOS:** o seletor da agenda não lista mais prospectado nem
  inativo; filtro `status === "ativo"` no dropdown (a query segue trazendo não-inativos p/ resolver o
  nome de sessões já marcadas).
- **#247 — "Quando cobrar o pacote" também no Fragmentado:** aparece no Mensal no Completo E no
  Fragmentado; no Fragmentado só "No dia do vencimento" e "Na 1ª sessão" ("última" clampada p/ mensal).
  Motor já suporta primeira_pacote + fragmentado (teste novo no guiaGeral).
- **#248 — envio de mensagens na prospecção:** checkbox à direita de cada prospectado + campo de
  mensagem + Enviar; abre o WhatsApp (wa.me) de cada selecionado ({nome} resolvido) e registra o
  contato (data + mensagem) só dos marcados. Action `registrarEnvioMensagem({ envios })` valida dono.

**Decisão que fica valendo:** a quantidade do pacote vale para QUALQUER formato de pacote (não só o
legado `contractType === "pacote"`); Novo atendimento é exclusivo de pacientes ativos; "última sessão"
do pacote não existe no Fragmentado.

---

## 2026-10-05 — Prospecção: Valor previsto R$ + lista colapsada (doc 19)

**Entregue (#241):**
- **"Valor previsto"** (criar e editar prospectado) ganhou **máscara de moeda** ao digitar. O
  `MoneyInput` saiu de dentro do cadastro para um componente **compartilhado**
  (`src/components/MoneyInput`, aceita `className`), reusado no cadastro de paciente e na prospecção.
- **Lista de prospectados** passou a mostrar só **data do 1º contato + nome**; clicar na linha abre as
  informações completas (a caixa editável + histórico de contatos que já existiam). Data do 1º contato
  = a mais antiga entre a data do cadastro e os contatos registrados.

**Decisão que fica valendo:** a lista é colapsada por padrão (data+nome), detalhe só ao clicar; o
estado `verContatos` controla o histórico de contatos dentro do card aberto.

---

## 2026-10-04 — Pacote: textos/ordem + histórico do 1º cadastro (doc 18)

**Entregue:**
- **#238 (textos/ordem):** a opção do campo Pacote mostra só **Completo**/**Fragmentado** (explicação
  na legenda; acabou "Completo — N sessões"). **Quantidade de sessões do pacote** virou **obrigatória**.
  **"Quando cobrar o pacote"** passou a vir **antes** do dia, com opções renomeadas ("No dia do
  vencimento" / "Na 1ª sessão do pacote" / "Na última sessão do pacote") + legenda da data que vira
  vencimento. **"Dia de pagamento" → "Dia do vencimento"**. Valores do select inalterados (motor intacto).
- **#239 (bug + motor):** o **1º cadastro financeiro** não inventa mais um **"Avulso" fictício** antes
  da modalidade escolhida — o histórico mostrava "Avulso → Gratuito" de uma troca que nunca houve.
  Causa: `vigenciasAGravar` normalizava formato nulo→"sessao" e empilhava base. Agora, sem modalidade
  anterior real, grava **só a escolhida** como entrada (inclui Avulso como 1ª escolha). `sessoesNoMes`/
  `valorDoMes` passam a usar a **quantidade informada** no Completo (4×vezes vira só rede p/ legado).

**Decisão que fica valendo:** "não definido" (null/"") **não é Avulso**; "anterior → nova" só vale após
existir financeiro real. Total do pacote Completo = quantidade informada (campo obrigatório); o 4 fixo
deixou de ser regra. O motor de cobrança real (`sequenciaPacote`) já usava a quantidade desde a Onda A.

---

## 2026-10-04 — Pagamento: Valor editável + diferença na própria linha (2º backlog, doc 17)

**Entregue (#235):** "Lançar pagamento" (guia Geral) ganhou campo **Valor editável**, pré-preenchido
com o que falta.
- Recebeu **menos** → registra o parcial; a cobrança segue **Em aberto/Em atraso** com
  **"Diferença em aberto: R$X" na própria linha**. O selo "pago em parte" **saiu** (dono: nunca).
- Opção **"Não haverá diferença de valor"** → quita a cobrança mesmo faltando (diferença perdoada).
- Recebeu **mais** → registra o valor informado; a sobra vira crédito no saldo.

**Como:** coluna `session_payments.quita_diferenca` (boolean). O **caixa fica honesto** — guarda o
valor realmente recebido (`amount`); quem fecha a cobrança é a marca. No motor
(`guiaGeral.casarPagamentos`), conjunto de `quitadas` + campo **`valorDevido`** (= recebido quando
quitada com desconto); `resumoDaGeral` soma `valorDevido`, então o saldo não carrega a diferença
perdoada. A action `lancarPagamento` aceita `valor` (via `parseMoedaBR`) e `quitarDiferenca`.

**Decisão que fica valendo:** parcial **nunca** é "pago em parte" — é a cobrança Em aberto/Atraso com
a diferença à mostra. "Não haverá diferença" é perdão explícito da terapeuta; o caixa registra o
dinheiro real, o saldo usa `valorDevido`.

---

## 2026-10-04 — Cadastro: Salvar Dados ≠ Salvar Financeiro (2º backlog, doc 17)

**Entregue (#234):** salvar o **primeiro cadastro** só com a aba **Dados** não cria mais financeiro
("Gratuito"/padrão) sem a pessoa pedir. O formato fica **"não definido"** (null) até ela abrir e salvar
a aba Financeiro.
- `payment_format` agora é **nullable** (migração aplicada em PROD).
- `createPatient` ganhou a flag `financeiroTocado` (input hidden, ligada pelo 1º `onChange` na seção
  Financeiro). Sem toque: formato `null`, sem `priceReviewDate`, sem histórico de preço/formato, e
  **redireciona para a aba Financeiro** (`edit?guia=financeiro`) para completar.
- Motor trata formato `null`/`""` como **sem cobrança** (`vigenciaDoFormato` cai para `""`;
  `rotuloDoFormato("")` = "Não definido"). Paciente novo não tem sessões → nenhuma cobrança de todo jeito.

**Por quê:** o form é único (Dados + Financeiro juntos); quem só queria cadastrar a pessoa saía com um
contrato financeiro que não escolheu. Editar já isolava (updatePatient só grava histórico em troca real);
o furo era só o 1º cadastro.

**Decisão que fica valendo:** financeiro "não definido" é estado legítimo (null). Quem lê `paymentFormat`
tem que aceitar `string | null`.

---

## 2026-10-03 — Financeiro: ordem dos campos + quantidade de sessões do pacote (2º backlog, doc 16)

**Entregue:**
- **Quantidade de sessões do pacote** (campo `sessionsInPacket`) passou a valer no **pacote Completo**:
  acabou o padrão fixo 4/8 — quem define é o cadastro. **Motor:** `sequenciaPacote.tamanhoDe` usa
  `tamanhoPacote` para o Completo (fallback 4×vezes quando vazio, para não quebrar quem nunca informou);
  o campo foi threadado por `cobrancas` → `guiaGeral`/`geralDoPaciente` e por `fechamento` (`linhaDoFechamento`
  + a página). Fracionado segue sendo o mês (agenda).
- **Ordem dos campos** no Financeiro (doc 16): Avulso = Valor · Pagar até · Vale a partir de · Reajuste;
  Mensal/Quinzenal = Valor · **Qtd do pacote** · Pacote · Dia(s) de pagamento (Mensal: + opção 1ª/última
  sessão) · Vale a partir de · Reajuste.
- **"Vale a partir de"** deixou de ser um bloco separado: mora **dentro da modalidade** selecionada
  (inclusive Gratuito), aparecendo só quando a troca de formato muda o que vale (edição).

**Decisão que fica valendo:** o tamanho do pacote Completo vem do cadastro (`sessionsInPacket`); sem valor,
cai no antigo 4×(vezes por semana). Testes do motor cobrindo tamanhoPacote (sequenciaPacote).

---

## 2026-10-03 — Histórico de reajuste no formato do dono (2º backlog, doc 16)

**Entregue:** o Histórico de reajuste (aba Financeiro do cadastro) passou a mostrar **uma linha por
mudança, combinando modalidade e valor**, em vez de duas linhas separadas (valor + modalidade):
- Entrada Gratuito → **"Gratuito"** (sem a linha de R$ 0,00).
- Entrada paga → **"Mensal → R$ 150,00"**.
- Troca de modalidade → **"Gratuito → Mensal → R$ 150,00"** (de → para → valor novo); se a nova for
  Gratuito, **"Mensal → Gratuito"** (sem valor).
- Só valor (mesma modalidade) → **"Mensal → R$ 150,00 → R$ 180,00"**.

Nova função pura `historicoDeReajuste` em `reajuste.ts` (5 testes com os exemplos do doc); a UI usa ela.
`eventosDeReajuste` (antiga) fica no código, sem uso na tela.

**Nota:** usei **"Avulso"** (rótulo unificado, decisão do prints6 #23) onde o doc escreveu "A cada
sessão (Avulso)" — fonte única `rotuloDoFormato`. Se o dono quiser o texto longo no histórico, é trivial.

---

## 2026-10-03 — Remove o badge "Risco alto" do card do paciente (2º backlog, doc 16)

**Entregue:** o card do paciente não exibe mais o selo de risco (baixo/médio/alto) — o dono pediu
remover o "Risco alto". O cálculo de risco (`risk`) continua existindo no modelo, só não aparece no
card. Sem outras telas afetadas.

---

## 2026-10-03 — Agenda: lembrete de reajuste 30 dias antes (onda 6 — #19)

**Entregue:** fecha a onda 6 (e o backlog do prints 6.pdf, salvo o WhatsApp). A agenda mostra um
lembrete **"⏰ Reajuste <nome>"** no dia **30 dias antes** da data de reajuste prevista do paciente
(`patients.priceReviewDate`), ao lado dos aniversários no cabeçalho do dia. Só exibição (nada é
gravado): a página passa `reajustes` e o `AgendaClient` calcula `data − 30 dias`.

**Backlog prints 6.pdf: completo** (ondas 1–6). Em aberto só o WhatsApp (mídia/anexo), que aguarda a
definição do dono de como deve funcionar.

---

## 2026-10-03 — Formato de pagamento: 1ª/última do pacote viram opção do Mensal completo (onda 6 — #20)

**Entregue:** "Na primeira sessão do pacote" e "Na última sessão do pacote" **deixaram de ser
modalidades à parte** no cadastro (prints 6.pdf, item 20). Agora, ao escolher **Mensal + pacote
completo**, aparece **"Quando cobrar o pacote"**: no dia do mês (padrão) · na 1ª sessão · na última.
O dia de pagamento some quando a cobrança é na sessão.

**Como (sem tocar no motor):** o `paymentFormat` enviado é um `formatoEfetivo` derivado em tela — Mensal
completo + "quando cobrar" vira `mensal`/`primeira_pacote`/`ultima_pacote`, os mesmos valores que o motor
de cobranças (`cobrancas.ts`) e os rótulos já entendiam. Os radios controlam só o estado visual; um
hidden único manda o valor. A vigência (troca de formato) compara o formato efetivo.

**Decisão que fica valendo:** cobrar na 1ª/última sessão é uma OPÇÃO do Mensal pacote completo, não uma
modalidade própria. Valores no banco inalterados (`primeira_pacote`/`ultima_pacote`).

---

## 2026-10-03 — Lista de pacientes: card cabe na tela + ordenar por cadastro (onda 5 — #13, #14)

**Entregue:**
- **#13** O nome do paciente no card passa a quebrar em **até 2 linhas** (`line-clamp-2`), em vez de
  cortar — cabe na tela sem rolar para o lado; o nome completo também abre no cadastro.
- **#14** Nova ordenação: **Cadastro antigo→novo** e **novo→antigo** (além de A–Z e horário). Usa
  `patients.createdAt` (ISO ordena cronologicamente como texto); exposto no card pela página.

**Onda 5 completa.**

---

## 2026-10-03 — Agenda: aviso de colisão de horário (onda 3 — #21)

**Entregue:** fecha a onda 3. Ao salvar um **agendamento novo** ou uma **mudança** de horário que cai
sobre outro paciente, a agenda **avisa** ("Já há Fulano agendado nesse horário — agendar mesmo
assim?") e o profissional decide. **Não barra** (dois no mesmo horário só faz sentido ao bloquear).
Status que pausam (desmarcou/atestado/prof. desm.) liberam o horário e não disparam o aviso; o próprio
paciente no mesmo horário também não. `colisaoDeHorario` + `avisaColisao` em `AgendaClient`.

**Decisão que fica valendo:** colisão de pacientes é aviso, não bloqueio.

**Onda 3 completa** (#9,#10,#11,#18,#21).

---

## 2026-10-03 — Agenda: horário fixo, legenda, escolher data, rótulos (onda 3 — #9,#10,#11,#18)

**Entregue:** quatro ajustes da agenda (prints 6.pdf).
- **#9** O **gutter de horas** (cabeçalho + corpo) virou `sticky left-0` — ao rolar a agenda para o
  lado no celular, o horário continua visível.
- **#10** Legenda de cores compactada (`gap-3` → `gap-x-3 gap-y-1`), menos espaço entre linhas.
- **#11** Botão **"Escolher data"** voltou a abrir o calendário: o input é `sr-only` e clicar o rótulo
  nem sempre abria o picker (mobile) — agora chama `showPicker()` no clique (fallback: foco).
- **#18** No agendamento: **"Repetição" → "Frequência"** e **"Repetir até" → "Recorrência"**.

**Pendente da onda 3:** #21 (aviso ao salvar quando 2 pacientes caem no mesmo horário) — PR próprio.

---

## 2026-10-03 — Prontuário: anexo em cada registro do histórico terapêutico (onda 1 — #5)

**Entregue:** fecha a onda 1. Cada registro do histórico terapêutico ganhou um **"Anexar arquivo"**
próprio (prints 6.pdf, item 5) — PDF/imagem até 15 MB, privado (o paciente não vê), com abrir/excluir.
- Schema: `patient_document.record_id` (FK → `patient_records`, `onDelete: cascade`, nullable) + índice.
  Anexo preso ao registro cai junto quando o registro é apagado; anexo geral do prontuário segue com
  `record_id` nulo. **`drizzle-kit push`** aplicado no banco (coluna aditiva).
- Ações: `uploadAnexoDoRegistro` / `listAnexosDoRegistro` (mesmo cofre privado, `/api/files/[id]` para
  abrir). `listAnexosProntuario` passou a excluir os presos a registro (`record_id IS NULL`) — eles
  aparecem só dentro do registro.
- UI: componente `AnexosDoRegistro` compacto, renderizado em cada entrada do histórico.

**Decisão que fica valendo:** anexo pode ser do prontuário em geral (nível do paciente, `record_id`
nulo) OU preso a um registro específico.

**Onda 1 completa** (#1–#8). Pendente geral do backlog: ondas 3, 5, 6; e "como o WhatsApp vai funcionar".

---

## 2026-10-03 — Prontuário: limpeza + registro livre (onda 1 — #1,2,3,4,6,7,8)

**Entregue:** faxina do prontuário pedida pelo dono (prints 6.pdf), com as decisões dele.
- **#1/#2** Removido o **cabeçalho do prontuário** (etiquetas + observações + "Salvar cabeçalho") e o
  **"Histórico de alterações"** que vinha junto. O prontuário fica só com o histórico terapêutico + os
  registros + anexos. (As etiquetas/observações já gravadas persistem e ainda aparecem no prontuário
  impresso; deixam de ser EDITÁVEIS aqui — se o dono quiser editá-las, levo ao cadastro.)
- **#3** "Plano terapêutico" → **"Histórico terapêutico"** (aba do paciente + prontuário impresso).
- **#4** Removido o botão **"+ Objetivo"** e o formulário de objetivo (os objetivos já existentes
  seguem listados; novas entradas vão pelo registro livre).
- **#7** "Novo registro" virou **registro livre**: sem as opções Evolução/Anamnese/Nota (type fixo
  `registro`). O profissional registra o que achar interessante.
- **#6** Como o seletor de tipo saiu, some a **"Anamnese" duplicada** — fica só o botão dedicado
  "Anamnese estruturada".
- **#8** **Trava o salvar duplicado**: o botão "Salvar registro" se desabilita enquanto envia
  (`useFormStatus`), evitando os 2 registros iguais do clique-duplo.

**Decisões que ficam valendo:** prontuário sem cabeçalho de etiquetas/observações; registro é livre
(sem tipo escolhível), anamnese só pelo botão próprio; "Histórico terapêutico" é o nome.

**Pendente (#5):** botão de **anexo em cada inclusão** do histórico terapêutico — precisa vincular
anexo↔registro (schema/ação); fica para o próximo PR. Há anexos no nível do paciente (AnexosProntuário).

---

## 2026-10-03 — Rótulos: Dashboard, Caixa, Avulso (onda 4 — #16, #17, #23)

**Entregue:** três renomeações de rótulo pedidas pelo dono (prints 6.pdf), com as decisões dele.
- **#17** BottomNavBar: "Início" → **"Dashboard"** (a sidebar já usava Dashboard).
- **#16** "Financeiro" confundia ("nos faz procurar os pagamentos lá") → **"Caixa"**: botão do
  BottomNavBar e título do grupo na sidebar (`nav.ts`). Rotas inalteradas.
- **#23** "A cada sessão" (cadastro) e "AVUL" (agenda) eram o MESMO formato (`sessao`) com nomes
  diferentes → unificado para **"Avulso"** na fonte canônica (`ROTULO_FORMATO` em `reajuste.ts`,
  usado por `rotuloDoFormato`/`rotuloFinanceiro`) + cadastro, fechamento e log de auditoria. A agenda
  segue com o código curto AVUL (abreviação de Avulso).

**Decisões que ficam valendo:** o formato `sessao`/legado `avulso` chama-se **"Avulso"** em toda a
UI (abreviado AVUL na célula da agenda). "Caixa" é o nome do grupo financeiro na navegação.

**Validado:** tsc limpo, lint limpo, **711 testes verdes** (os 2 que fixavam "A cada sessão" em
`rotuloDoFormato`/`rotuloFinanceiro` passaram a esperar "Avulso").

---

## 2026-10-03 — Cobrança: em aberto × em atraso + o que cada cobrança cobre (onda 2 — #12, #15, #22) (#222)

**Entregue (no ar):** decisão do dono — **manter o cálculo, corrigir a exibição**.
- **#22** O "3 e não 5 do mês" é a troca **avulso→pacote no meio do mês**: pela regra de 15/09
  (vigência: só vale a partir da data, nunca mexe no passado) as sessões anteriores à troca seguem
  avulsas e as posteriores viram o pacote (1/3–3/3). Decisão: **manter**. Para o mês inteiro virar
  um pacote, registrar a troca no **1º dia do mês** (fluxo, sem código).
- **#12** Cards "Em aberto"/"Em atraso" ganharam tooltip (no prazo × vencida) + sub-linha. O dono
  perguntava a diferença.
- **#15** O formulário de confirmar pagamento passou a dizer o que **aquela** cobrança cobre
  (N sessões · valor · falta), para não confundir com "o valor do mês".

**Decisões que ficam valendo:** troca de formato nunca reescreve cobrança passada (vigência vale da
data em diante). "Em aberto" = no prazo; "em atraso" = vencida e não paga. Sem mudança no motor.

**Armadilha:** a raiz parecia bug de fragmentação; era a troca mid-mês + confusão de rótulos. Ler o
motor (`cobrancas.ts`/`sequenciaPacote.ts`/`vigenciaDoFormato.ts`) antes de prometer evitou mexer no
cálculo à toa.

---

## 2026-09-27 — Reorganização do dashboard: analíticos + relatórios (#219)

**Entregue:** reorganização dos painéis do dashboard pedida pelo dono (PDF).
- **Removidos** os painéis **Presença** e **Ativos e inativos**.
- **Analíticos de atendimento** ganhou, no mesmo layout dos atendimentos realizados, dois cartões:
  **Faltas** e **% Comparecimento** — no período que o dono escolhe na tela (`nao_realizada` vs
  `realizada`). É onde a informação de presença passou a viver.
- **Relatórios** absorveu **Ativos / Inativos / "Não vieram na semana"**, cada um com **ver lista**
  (modal `ModalPacientes`), além do "Montar relatório".
- Junto: o teste órfão do #217 (preço 0 do período gratuito não zera cobrança) que ficou sem commit.

**Por quê:** o painel Presença duplicava a leitura de faltas e o "Ativos e inativos" competia com
Relatórios. Consolidação num lugar só, sem perder nenhum número.

**Decisões que ficam valendo:**
- Faltas e comparecimento vivem nos **analíticos**, no período da tela — não há mais painel Presença.
- Ativos/Inativos/Não-vieram são **atalhos de lista** dentro de Relatórios, não painel próprio.

**Pendente:** segue a decisão do dono sobre **como o WhatsApp vai funcionar** (mídia/anexo).

---

## 2026-09-27 — Cinco correções: cobrança R$0, pagamento, cor Presente, horas, presenças (#217)

**Entregue:** cinco demandas do dono (PDF).
- **Gratuito→Mensal mostrava R$0,00** na guia Geral e **"Confirmar pagamento" dizia "já está paga"**
  (mesma raiz): o cadastro gratuito grava `patientPriceHistory` **valor 0** (`createPatient`); numa
  cobrança cujo período cai sobre essa faixa, `precoNaData` devolvia 0 → valor 0 e `falta ≤ 0`. Novo
  **`precoCobravel`** (`preco.ts`): num formato QUE COBRA, preço 0 cai no valor do cadastro
  (mensalidade). Motor `cobrancas.ts` passou a usá-lo nos 3 pontos de preço. Teste de regressão em
  `tests/unit/preco.test.ts`.
- **Status "Presente" aparecia verde** no modal de editar agendamento: `sessionStatusColor("realizada")`
  era verde; virou **amarelo**, igual à legenda e à célula da agenda.
- **Agenda passa a exibir 6h–21h** (`END_HOUR` 21→22).
- **Presenças/Faltas do dashboard incluem INATIVOS**: a consulta de presença cortava em 24 meses;
  agora conta por **status do agendamento** no período escolhido, sem corte e sem filtro de ativo.

**Decisões que ficam valendo:**
- Um formato que COBRA nunca vale R$0,00 quando há mensalidade — a faixa 0 (resíduo do gratuito) não
  zera a cobrança; vale o valor do cadastro.
- Contagem de presença/falta é por status de agendamento no período, nunca pela lista de ativos.

**Pendente:** segue a decisão do dono sobre **como o WhatsApp vai funcionar** (mídia/anexo).

---

## 2026-09-27 — Agenda de anos anteriores + salvar por guia (#215)

**Entregue:** duas demandas do dono (PDF).
- **Agendamento de 2024 não aparecia na Agenda.** A consulta do dashboard (`agenda/page.tsx`) cortava
  em `date >= hoje-120dias` e o `AgendaClient` navega semanas só sobre o que veio — sessão de ano
  anterior nunca carregava (salvava, mas sumia). Agora a **exibição carrega o histórico inteiro**;
  **risco** e **pagamento atrasado** continuam na janela de 120 dias (sem regressão).
- **Salvar independente por guia.** "Salvar alterações" de **Dados** e **Financeiro** virou um
  `<form>` por guia (componente `Secao`, só no modo edição). Cada form envia só os seus campos e o
  `updatePatient` mantém coluna ausente no valor atual → salvar uma guia não persiste o pendente da
  outra. O cadastro (novo paciente) segue com form único (sem `save` → `Secao` vira `<div>`).

**Decisões que ficam valendo:**
- A janela de 120 dias é só para **cálculo** (risco/atraso), nunca para **exibição** da agenda.
- `updatePatient` não redireciona (só revalida) → dá pra salvar as duas guias sem sair da tela.

**Armadilha (custou e não pode custar de novo):** o `git config` LOCAL do repo estava como
`renan@rdmss.com.br` — o commit nasceu com autor errado e a Vercel BLOQUEIA deploy de produção de
autor não-membro (gitForkProtection). Sempre conferir `git config user.email` = `silvanobarbosa@gmail.com`
ANTES de commitar; se errar, `git commit --amend --reset-author` + force-push.

**Pendente:** segue o do bloco anterior — decisão do dono sobre **como o WhatsApp vai funcionar**
(envio de mídia/anexo).

---

## 2026-09-20 — Nova leva de testes: base da Gisele e da Ana zerada

**Entregue:** os dados de paciente das duas beta testers apagados para recomeçar os testes, com as
configurações intactas. Gisele tinha 7 pacientes/284 sessões, Ana 14 pacientes/233 sessões. Backup
JSON gravado antes do primeiro delete.

**Por quê:** o dono pediu para limpar e recomeçar.

**Armadilha (custou e vale para a próxima):** o `scripts/limpar-dados-beta.mjs` estava
**desatualizado** — três tabelas ganharam `patient_id` desde 13/09 e ficaram fora da lista:
`cobranca_envios`, `patient_payment_format_history` e `sessoes_puladas` (#210). As três têm FK para
`patients`, então o script antigo **abortaria no DELETE de patients** por constraint. Antes de rodar
qualquer limpeza, conferir no schema quais tabelas têm `patient_id`/`user_id` e comparar com a lista
— o schema anda, o script não anda sozinho.

**Decisões que ficam valendo:** as mesmas duas travas de sempre — lista **fechada** de ids (a demo do
Dr. Sócrates e a conta do dono ficam de fora por construção) e **backup antes** do delete. Config
× dado continua sendo decidido no script, não no schema.

---

## 2026-09-19 — "Hor. Bloq." na guia Geral e o remanejamento (#210)

**Entregue:** a data que a série pulou por bloqueio aparece na guia Geral como "Hor. Bloq.", some
sozinha ao desbloquear, e a tela oferece remanejar a agenda para devolver a sequência àquela data.

**Por quê:** ela mandou as duas tabelas desenhadas — antes e depois do desbloqueio —, o que resolveu
a decisão de modelagem que estava em aberto.

**Decisões que ficam valendo:**
- **A falta fica GUARDADA** (`sessoes_puladas`), não deduzida da recorrência. O bloqueio mora em
  tabela própria e **não conhece paciente nenhum** — é o que impede que vire contagem de pacote ou
  dinheiro. Mas a guia precisa dizer "Hor. Bloq." NAQUELA linha, e isso exige saber de quem era a
  vaga. Deduzir quebraria assim que ela movesse uma sessão à mão.
- **A guia só mostra falta cujo horário AINDA está bloqueado** (join com `blocked_slots`).
  Desbloqueou, a linha some sozinha; o registro fica, porque é ele que sabe para onde devolver a
  sequência. Some a linha, não a memória.
- **O remanejamento usa as PRÓPRIAS datas**, não o ritmo da série: cada sessão anda para a data da
  anterior, em cascata. Deduzir "semanal"/"quinzenal" inventaria um ritmo que ela pode ter mudado.
- **Não move sessão que já teve desfecho** (realizada, faltou, desmarcada): reescreveria o histórico.
- **Remanejar é confirmado, não automático.** Mover sessão de paciente é coisa que ela precisa
  querer — o documento de 18/09 pedia a pergunta.

**Armadilhas:**
- Ia devolver as datas puladas por **variável de módulo** (estado global escondido). Virou uma função
  que devolve `{ datas, puladas }`. Função pura não fala por canal lateral.
- A linha "Hor. Bloq." **ficaria na tela depois de desbloquear** se a guia lesse a falta direto.
  Perceber isso levou ao filtro por "ainda bloqueado", que é o que a torna auto-limpante.

**Pendente:** com o dono — **como o WhatsApp vai funcionar**. Hoje o aniversário envia pelo servidor
via Evolution (e só com a instância conectada), `wa.me` não manda imagem, e envio de mídia não existe
no repo. Disso dependem: aniversariantes só-WhatsApp com anexo, e a lista de Prospecção com botão
"Mensagem".

---

## 2026-09-18 — Quinzenal por contagem, menu do celular e série × bloqueio (#204–#208)

**Entregue:** o pacote completo do quinzenal parte em 2+2 e o vencimento sai da sessão (#204);
formatos com o nome do Financeiro e pacote em caixa de lista (#205); o menu do celular parou de
cortar itens (#206); "Prospecção"/"Prospectado" nos textos (#207); a série pula horário bloqueado
(#208).

**Por quê:** documento com seis demandas. A dona mandou o calendário inteiro de um paciente, e ele
provou que eu tinha entendido o quinzenal pela metade.

**Decisões que ficam valendo:**
- **No pacote COMPLETO o quinzenal divide por CONTAGEM** (4 → 2+2, 8 → 4+4). No **fracionado**
  continua sendo a quinzena do calendário (01–15 / 16–fim), porque ali o mês já é a unidade.
- **O vencimento de cada quinzena é o próximo dia combinado a partir da PRIMEIRA SESSÃO dele** — não
  um dia fixo do mês em que o pacote começou. Isso põe o primeiro pagamento em 20/10 quando o
  paciente começou em 16/10, e torna a regra de #199 desnecessária no quinzenal (no mensal ela fica).
- **A série de agendamentos pula horário bloqueado**, nas três repetições. No 2x na semana derruba
  só o dia bloqueado, não o par. O bloqueio segue em tabela própria, sem vínculo com paciente.
- **A gaveta do celular termina ACIMA da barra inferior** (`h-[calc(100dvh-6rem)]`), e não só com
  respiro interno: no tablet a lista cabe sem rolar e o último item pousa onde pousar.
- **Os três grupos do menu se parecem.** A caixa azul do Financeiro saiu.

**Armadilhas:**
- **`Intl` separa `R$` do valor com espaço NÃO-SEPARÁVEL (código 160).** Comparar com espaço comum
  em teste de tela nunca casa — e o e2e acusa falha onde o app está certo.
- **Respiro interno não resolve sobreposição quando o conteúdo CABE.** O `pb` só empurra quando há
  rolagem; sem ela, o último item fica onde estava. O contêiner é que precisa terminar antes.
- **Medir item a item, não só o último.** Foi assim que o tablet apareceu: o celular passava e o
  tablet não.
- **O modal do tutorial (z-100) engole o clique** em teste de navegação; tirar do caminho antes de
  medir. Já registrado em 04/09 e voltou a custar tempo.
- **Teste de tela mede o AMBIENTE se o servidor não estiver em UTC.** Ver a entrada anterior.

**Pendente:** com o dono — **como o WhatsApp vai funcionar** (hoje o aniversário envia pelo servidor
via Evolution, e só se a instância dela estiver conectada; `wa.me` não manda imagem, e envio de
mídia não existe no repo). Disso dependem: aniversariantes só-WhatsApp com anexo, e a lista de
Prospecção com botão "Mensagem". E a escolha de modelagem para as partes 2 e 3 do bloqueio (guardar
a falta numa tabela, ou derivar da recorrência).

---

## 2026-09-18 — Tabela da guia Geral: vencimento, status e o caixa (#199, #200, #201)

**Entregue:** o primeiro vencimento deixou de cair antes da primeira sessão (#199); "pago" passou a
exigir baixa lançada, pagamento parcial parou de sumir e nasceu o "Remover pagamento" (#200); e
apagar entrada do caixa vinda de pagamento passou a ser recusado, com o caminho certo na tela (#201).

**Por quê:** documento "Tabela área geral". Das quatro regras, duas já estavam certas e duas eram
defeito — um deles inventando dinheiro recebido.

**Decisões que ficam valendo:**
- **O PRIMEIRO vencimento nunca cai antes da primeira sessão.** Paciente que começa dia 15 com dia
  de pagamento 10 vence 15, não 10 — senão a cobrança nasce em atraso por um atendimento que não
  aconteceu. **Só o primeiro ciclo**; os seguintes usam o dia combinado sempre.
- **"Pago" exige BAIXA LANÇADA**, não saldo zerado. Duas condições: existe pagamento casado com a
  cobrança E o saldo fechou. Vencimento, passagem do vencimento ou qualquer outro dado financeiro
  não podem marcar como pago.
- **O que já foi recebido não some quando falta o resto.** A cobrança carrega o pagamento mesmo sem
  estar quitada; quem decide a coluna "Pago" na tela é a `situacao`, não a existência do pagamento.
- **Apagar pagamento apaga a transação junto**, e **a recíproca é bloqueada**: entrada do caixa
  vinda de pagamento não se apaga pelo Financeiro (decisão do dono, 18/09 — "bloquear e avisar do
  efeito"). São o mesmo fato em duas telas, e desfazer se faz de um lugar só: a guia Geral do
  paciente. A tela troca a lixeira pelo caminho para o paciente, explicando o porquê.

**Armadilhas:**
- **Contornar o sintoma deixa a causa viva, e ela volta.** Em #192 eu escrevi um comentário
  admitindo que cobrança de R$ 0,00 aparecia como "Pago" — e tratei UM caso (pular a quinzena
  vazia) em vez da conta errada. Seis dias depois a dona relatou o mesmo defeito por outro caminho.
  **Quando escrever um comentário explicando por que um caso é contornado, esse comentário é um
  relatório de bug: ou conserte a causa, ou registre como pendência.**
- **Ação correta e órfã é pior que ausente:** `deletePayment` existia, apagava a transação junto e
  tinha ZERO chamadas no repositório. A funcionalidade parecia existir no código e não existia para
  quem usa. Removida; ficou uma implementação só, ligada a um botão.
- **A base de demonstração nem sempre tem o caso.** Ela não tem paciente sem preço, então o "Pago"
  fantasma não foi reproduzível no navegador — provado só por teste, e dito assim no PR.

**Pendente:** com a Gisele — avisar que cobranças que apareciam "Pago" por valor zero passarão a
aparecer como Em aberto/Em atraso (o dono já está ciente); e renovar a sessão de QA para rodar
`scripts/e2e-semanal2x.mjs`, a gravação das 8 sessões, única parte sem prova de ponta a ponta.

---

## 2026-09-18 — "2x na semana" mudou de lugar, e três correções (#195)

**Entregue:** "Semanal (2x na semana)" na repetição da janela de agendamento, com segundo dia e
horário; aniversário deixou de andar um dia; slot espelho do quinzenal sem o nome; e o número do
WhatsApp do botão Cobrar.

**Por quê:** a leva anterior (#193) pôs a escolha do ritmo no cadastro, e ela pediu o contrário —
que fosse na repetição do agendamento, e que o sistema marcasse os dois dias. A conta do pacote de
oito ficou como estava; mudou só por onde ela diz.

**Decisões que ficam valendo:**
- **O ritmo semanal se escolhe na REPETIÇÃO do agendamento**, não no cadastro. Escolher "Semanal
  (2x na semana)" pede o segundo dia e horário, marca as duas séries intercaladas e **grava
  `times_per_period` no paciente** — é de lá que a cobrança lê o tamanho do pacote.
- **O dia da primeira sessão não pode ser o segundo dia.** Duas no mesmo dia da semana não são "2x
  na semana" e fariam o pacote contar oito à toa. Não foi pedido; é trava minha, confirmar com ela.
- **Data de nascimento é data de calendário** — passa por `horaDeParede` em toda leitura. A conta da
  IDADE tinha o mesmo defeito e fazia a pessoa "fazer aniversário" um dia antes; as duas cópias
  dessa conta (prospects e relatório) agora chamam `lib/idade`.
- **Uma regra só para o número do WhatsApp** (`lib/telefoneWhatsapp`), usada pelo botão da tela e
  pelo envio do servidor. Número sem DDD devolve `null` de propósito: abrir a conversa de um
  desconhecido é pior do que avisar que falta o telefone.
- **Sem telefone, "Cobrar" não marca mais como avisada.** Antes copiava calado e marcava — o
  paciente aparecia avisado sem ninguém ter avisado.

**Armadilhas:**
- **O relato "o botão não funciona" pode ser um número malformado.** O Cobrar já abria o WhatsApp e
  já registrava o aviso; o `55` colado sem critério fazia o WhatsApp dizer "número inválido", o que
  de fora é idêntico a não funcionar. **Antes de reescrever o que foi relatado, confira se o que
  existe está apenas recebendo lixo.**
- **Existem DOIS botões "Cobrar"** com comportamentos diferentes: o da guia Geral (abre o WhatsApp,
  usa o modelo dela, registra) e o de `/dashboard/pagamentos` (envia pela Evolution, não abre nada,
  ignora o modelo, só olha `patients.phone`, não registra). Pendente saber qual ela usa.
- **A conta de demonstração (`/demo`) serve de banco de provas sem credencial.** Quando a sessão de
  QA expirou, ela permitiu conferir aniversário, repetição, slot Q e a URL do WhatsApp — sempre
  comparando com o banco. O que ela não permite é escrever.
- Heurística de "última linha de import" quebra em import multilinha — conferir depois de inserir.

**Pendente:** com a Gisele — qual botão "Cobrar" ela usa; se o segundo dia pode repetir o primeiro.
Da casa — renovar a sessão de QA (`node scripts/e2e-escrita.mjs <email> <senha>`) para rodar
`scripts/e2e-semanal2x.mjs`, a única parte sem prova de ponta a ponta (a gravação das 8 sessões).

---

## 2026-09-17 — Segunda leva ("prints 5") e o fim do atendimento social (#190–#193)

**Entregue:** remoção do "atendimento social" (#190); prospecção no menu e relatório sem aba
duplicada (#191); a quinzena virou do calendário (#192); 2x por semana virou um pacote de oito
(#193). Plano em `PLANO-DEMANDAS-2026-09-17-b.md`.

**Por quê:** duas das quatro demandas eram de dinheiro e estavam cobrando errado; as outras duas
eram caminho no lugar errado. O atendimento social era pendência antiga, decidida agora.

**Decisões que ficam valendo:**
- **A quinzena é do CALENDÁRIO**: 01–15 e 16–fim, e cada uma cobra as sessões que caíram nela, ao
  preço da sessão. Antes eram duas metades de valor igual, sem olhar data — daí a cobrança vencendo
  05/09 de uma quinzena sem atendimento. **Quinzena sem atendimento não vira cobrança**: uma linha de
  R$ 0,00 apareceria como "Pago" sem ninguém pagar, porque falta zero é tratada como quitada. (Se o
  dono quiser a linha zerada, é uma linha de código.)
- **O pacote fechado é um mês do RITMO combinado**: 4 sessões para quem vem 1x por semana, 8 para
  quem vem 2x. Quem diz é `patients.times_per_period`, que já existia e que nenhuma tela enviava.
  Contrato registrado (`patient_packages`) continua mandando sobre tudo; o fracionado segue pelo mês.
- **"Atendimento social" não existe mais** — coluna, selo SOC e leituras. Zero pacientes estavam
  marcados. Se o caso "social e pagante" voltar, volta como campo novo e explícito, não como resto.
- **Prospecção tem porta própria no menu**; o dashboard ficou só com o número. Nota: o formulário de
  paciente comum também cria prospect (status "prospect") — são duas portas para a mesma coisa.

**Armadilhas:**
- **O diagnóstico do documento estava errado em D1**, e seguir por ele custaria caro. Não eram "dois
  agendamentos": a numeração não sabe de que repetição a sessão veio — ela fechava a cada 4 porque
  `TAMANHO_PADRAO` era fixo. Com uma repetição só daria no mesmo. **Ler o código antes de aceitar a
  causa relatada encurtou a demanda inteira.**
- **Um teste que não falha com o defeito presente não é cobertura.** Escrevi um teste do conserto da
  Fechamento que passava nos dois lados — batia em `sessoesCobradas`, que não é a função alterada.
  Desde então, todo conserto de conta é conferido revertendo o código e vendo o teste falhar.
- **A mesma regra de "descartar a parte 2" estava em TRÊS lugares** (Fechamento, guia Geral e o
  rótulo). Fazia sentido quando as duas quinzenas diziam o total inteiro; com valores diferentes,
  passaria a subcontar. Quando um cálculo muda de forma, procure quem compensava a forma antiga.
- **Coluna do banco só cai depois do deploy** que parou de lê-la — derrubar antes deixa produção
  rodando código que ainda a seleciona.
- A tabela de usuários é `"user"` (com aspas) e a coluna do 2º vencimento é `payment_day_2`.

**Pendente:** com a Gisele — escolher entre marcar os dois dias da semana ela mesma (como agora) ou
o sistema marcar os dois de uma vez; a base de 8 sessões já está pronta para as duas. Da casa —
`sessoesNoMes`/`valorDoMes` em `reajuste.ts` não têm chamador em produção, candidatos a remoção.

---

## 2026-09-17 — Demandas do documento: ondas 4, 5 e 6 (#186, #187, #188)

**Entregue:** recibo e nota a partir da linha paga (#186); a pergunta da sequência do pacote, que
estava inalcançável na agenda (#187); a fragmentação com o mês que não encolhe (#188). Fecha o
`PLANO-DEMANDAS-2026-09-17.md`.

**Por quê:** as ondas 4 a 6 saíram do mesmo documento das anteriores, mas duas delas viraram
conserto em vez de construção — o que estava no papel já existia no código e não chegava à tela ou
cobrava errado.

**Decisões que ficam valendo:**
- **A nota fiscal reaproveita `receipt_issued_at`.** Essa coluna já significava "emitido no Receita
  Saúde" e é a que a tela `/dashboard/receita-saude` usa para listar o que falta emitir. Uma coluna
  nova para a mesma emissão faria as duas telas discordarem. O recibo em papel, esse sim, ganhou a
  sua (`recibo_emitido_em`): são dois documentos.
- **Quem pagou não vira coluna no paciente.** `guardian_name`/`guardian_cpf` já eram o pagador do
  cadastro. O nome e o CPF sugeridos no lançamento saem do ÚLTIMO pagamento; guardar de novo no
  paciente criaria duas verdades sobre o mesmo fato. (Cheguei a criar `payer_name`/`payer_cpf` e
  desfiz antes de ir ao banco.)
- **CPF: dígitos no banco, pontuado no papel.** `apenasCpf` na entrada, `cpfBR` na saída.
- **No fracionado, desmarcar não encolhe o mês.** Setembro com três marcadas e uma desmarcada segue
  valendo /3; a vaga é ocupada pela próxima sessão real, que pode ser de outubro — ela atravessa
  como 3/3 e pertence a setembro. O mês fica ABERTO até a vaga ser ocupada: não cobra 2 (encolher o
  combinado) nem 3 (cobrar o que não houve).
- **Reposição é um vínculo, não uma dedução.** `therapy_sessions.repoe_sessao_id`. "Desmarcou sem
  repor" e "repôs no mesmo mês" chegam ao cálculo como os mesmos dados — um mês com uma desmarcada e
  uma sessão a mais — e pedem contas diferentes. A janela de Novo atendimento pergunta; uma vaga só
  aceita uma reposição.
- **Havendo tamanho contratado (`patient_packages`), ele manda sobre o calendário.** Nenhum dos 6
  pacientes fracionados tem esse tamanho gravado, então o caminho do mês é o que roda hoje.

**Armadilhas:**
- **O gate do S1 olhava um campo que a agenda nunca grava.** A pergunta "entra na sequência do
  pacote?" dependia de `s.pkg`, que vem de `derivePackageLabels` e ignora sessão sem `package_id` —
  e `createSessionFromAgenda` nunca grava esse campo. Resultado: a pergunta não aparecia para
  ninguém, e AVUL/GRAT ficaram fora de alcance apesar de implementados ponta a ponta. **Lição: uma
  feature com teste unitário verde pode estar inalcançável na tela; o gate que a exibe também é
  código.** O `scripts/e2e-sessao-extra.mjs` já denunciava isso e estava quebrado.
- **Teste verde pode estar fixando o defeito.** `"fragmentado: a pausa reduz o que o mês cobra"`
  passava e descrevia exatamente o erro de dinheiro que o dono mandou corrigir. Três testes de 16/09
  foram reescritos, cada um com o motivo no comentário.
- **Locator por texto pega o cabeçalho.** `tr` com "Pago" casou com a linha de títulos, que tem a
  coluna "PAGO EM" — dois checks falharam com os botões visíveis na tela.
- **Página de impressão dentro do `/dashboard` imprime o painel junto.** O recibo esconde tudo e
  revela só o papel (`#recibo-papel`), com `@page { margin: 20mm }`.
- **Duas telas de recibo é uma a mais.** Existia `/recibo/[paymentId]` com logotipo, órfã. Virou
  redirect para o recibo novo.

**Pendente:** do dono — confirmar as ondas em produção; decidir sobre "Atendimento social"
(contradiz a decisão dele de 14/09); as 13 sessões antigas de reserva. Da casa — os 6 pacientes
fracionados seguem sem tamanho contratado gravado; enquanto não tiverem, o mês manda.

---

## 2026-09-17 — Demandas do documento: ondas 1, 2 e 3 (#182, #183, #184)

**Entregue:** limpeza de tela e a data que andava um dia (#182); recibo nos Ajustes, cobranca com
histórico e a data do pedido no reajuste (#183); GRAT sempre R$ 0,00, "em aberto" sem o futuro e um
filtro de ano só (#184). Plano completo em `PLANO-DEMANDAS-2026-09-17.md`.

**ROTAÇÃO DE CREDENCIAL — leia antes de tudo.** Durante a onda 2, uma mensagem de erro do driver do
Neon imprimiu a **string de conexão inteira, com a senha**, no log da sessão. Não foi um `console.log`
nosso: foi a própria lib. A senha do banco de PRODUÇÃO foi rotacionada no mesmo dia, com autorização
do dono: `ALTER ROLE` no banco, teste de conexão com a senha nova **antes** de gravar em qualquer
lugar, `.env.local` atualizado, `DATABASE_URL` trocada na Vercel e redeploy. Conferido depois: 184
pacientes carregando em producao. **Lição:** filtrar `postgresql://` e `npg_` na saída de todo
comando que toque o banco — a lib erra e imprime o que você nunca imprimiria.

**Decisões que ficam valendo:**
- **A data de parede vale tambem para a DATA, não só para o horário.** `formatDate`/`formatDateTime`
  passam por `horaDeParede`: a coluna é `timestamp` sem fuso, e valor de meia-noite lido como UTC
  recuava para o dia anterior. Era a causa ÚNICA dos dois sintomas relatados (aniversário e
  histórico de ajuste).
- **O botao "Marcar enviada" saiu.** Cada clique em "Cobrar" registra o aviso sozinho, e os avisos
  **não se substituem**: o índice único de `cobranca_envios` virou comum, e cada clique é uma linha.
  A tela mostra o último e quantas vezes ("Avisada 12/10 · 3x").
- **O recibo tem descrição própria por terapeuta** (Terapia/Psicanálise/Psicologia): "atendimentos
  psicológicos" num recibo de quem não é psicóloga é declaração errada num documento que vai para o
  imposto de renda do paciente. Valor fora da lista cai em "terapia", nunca numa profissão que a
  pessoa não tem.
- **"Em aberto" não conta mês futuro** — só o vigente e o que ficou para trás.
- **GRAT mostra R$ 0,00 mesmo com status que pausa.** Vazio parece dado faltando.
- **Um filtro de ano só**, antes da tabela de Controle, valendo para as duas tabelas. O ano sai do
  TEXTO da data, nunca de `Date`.

**Armadilhas:**
- O driver do Neon só aceita template marcado (`sql\`...\``) ou `sql.query(...)` — a mesma pegadinha
  já catalogada no Portal, e ela apareceu de novo aqui, no script de rotação.
- `drizzle-kit generate` pede prompt interativo quando o snapshot local está defasado; `db:push`
  passa. E o `push` aplica direto em **produção**.
- A tabela de usuários do Ledivan se chama `user`, não `users`: uma conferência pós-`push` disse
  "coluna não existe" só porque eu consultei o nome errado.

**Pendente:** as ondas 4 (pagamento e recibo), 5 (sequência do pacote no agendamento) e 6
(fragmentação). E o desalinhamento da coluna na agenda segue **não reproduzido** — medido em
produção nos dois tamanhos, colunas de largura idêntica e nenhum cartão fora do lugar.

---

## 2026-09-16 — Pendências zeradas (#181)

**PAG1 (RESOLVIDO — era cache de rota).** O relato "salvo Gratuito, volta em A cada sessão" tinha
causa real: `updatePatient` revalidava `/dashboard/patients/[id]` e a lista, mas **não** a rota
`/dashboard/patients/[id]/edit`. O banco salvava certo, mas o RSC da tela de edição ficava em cache
com o formato antigo — reabrindo, o rádio voltava em "A cada sessão". Fix: uma linha,
`revalidatePath(.../edit)`. Lição: mutação que afeta uma tela de edição precisa revalidar a rota
DELA, não só a de leitura.

**Gestão de pacotes (P1/P2) restaurada.** Saiu com a guia Financeiro na onda 6; voltou como um card
"Pacotes" na guia Geral (Controle), só para formatos de pacote — incluir/editar/excluir, como antes.

**Mensagem de cobrança personalizável.** Nova coluna `users.cobrancaMessage` (variáveis {nome},
{valor}, {vencimento}); editor em Ajustes (`CobrancaMessageCard`); helper puro `montarMensagemCobranca`
(modelo vazio cai no padrão). Na guia Geral, cada cobrança em aberto/atraso ganhou o botão **Cobrar**,
que compõe a mensagem com o nome/valor/vencimento e abre o WhatsApp do paciente (ou copia, sem
telefone). GOTCHA: `db:push` aplica a coluna no Neon de PRODUÇÃO (aditiva).

---

## 2026-09-16 — Demandas: onda 8 (agenda: fragmentado, sequência, layout)

**#180 — as 8 ondas fechadas.**
- **AGD3 (fragmentado por mês):** o fragmentado deixou de usar os tamanhos contratados e passou a
  derivar do CALENDÁRIO — cada mês é uma sequência própria, do tamanho dos atendimentos daquele mês
  (setembro com 3 → 1/3..3/3; outubro com 4 → 1/4..4/4). Os meses NÃO se juntam. A pausa (Desmarcou/
  Prof. desm./Atestado) não conta no total do mês, mas segura a posição. O valor do mês é o total ×
  preço. `posicoesFragmentado` em `sequenciaPacote.ts`. **Efeito:** um fragmentado com 1 sessão num
  mês agora cobra 1/1 daquele mês (antes ficava "aberto" esperando fechar 4) — vários testes de
  sequência/fechamento foram reescritos para a regra nova.
- **AGD2:** a pergunta "entra na sequência do pacote?" só aparece se o paciente JÁ TEM sequência (tem
  sessão com posição de pacote); o primeiro agendamento não pergunta.
- **AGD4:** os botões Hoje/Escolher data/Bloquear horário desceram para uma linha própria.

**Decisão que fica valendo:** fragmentado = uma sequência por MÊS. Isso muda quem "fecha" e quando
cobra — cada mês fecha e cobra no seu mês, sem herdar sessões do mês anterior.

**Pendências que ficam com o dono:** PAG1 (formato salvo — aguardando repro), gestão de pacotes P1/P2
(saiu com a guia Financeiro na onda 6 — dizer se/onde volta), e a mensagem de cobrança personalizável.

---

## 2026-09-16 — Demandas: onda 7 (guia Geral & Controle)

**#179.** GER4: a guia Geral ganhou um cabeçalho com **valor da sessão** e **"Reajuste previsto
para …"**. GER5: a tabela da Geral tem uma coluna **Status** (à direita de Data/hora) que mostra só
Presente/Faltou/Desmarcou/Prof. desm./Atestado, com a cor da agenda; sessão sem esses status fica com
a célula vazia, sem cor. GER6: abaixo da tabela, a **TabelaAnual** — valores recebidos por mês (com
Total), com seletor de **ano** (dentro do paciente, filtra por ano em vez de por paciente). Lógica
pura em `tabelaAnual.ts`.

---

## 2026-09-16 — Demandas: onda 6 (página do paciente)

**#178.** GER1: a guia "Dados" saiu; o **Histórico de status** virou um bloco logo abaixo do
cabeçalho, acima dos cards. GER2: os cards agora são três — **Sessões agendadas · Em aberto · Em
atraso** (número e valor, do motor da onda 1). GER3: saíram as guias **Sessões, Financeiro e Linha do
tempo** (restam Geral, Prontuário, Atividades, Materiais). CAD3: o cabeçalho passou a mostrar nome,
**Ativo/Inativo**, financeiro por extenso, valor, **vencimento** (dia do mês, ou "pagar até Xh antes"
no avulso), idade, casal, telefone e **responsável + telefone**.

**Consequência do GER3 (a confirmar com o dono):** com a guia Financeiro saíram o "Registrar
pagamento", a **gestão de pacotes (P1/P2)** e o Fluxo financeiro. O pagamento agora é pela guia Geral
("Lançar pagamento" por cobrança). Se a gestão de pacotes precisar voltar, o dono diz onde ela mora.

**Nota técnica:** a remoção das 3 guias exigiu apagar ~285 linhas de JSX morto e limpar imports/estado
órfãos (o `tab` ficou restrito a 4 valores, então o TS acusava os blocos mortos). Ficou 0 warning.

---

## 2026-09-16 — Demandas: onda 5 (lista de pacientes)

**#177 · LST1.** Cada card da lista passou a mostrar: **Id da agenda** (#), **Ativo/Inativo**,
**Financeiro** por extenso (`rotuloFinanceiro` — mensal/quinzenal ganham "pacote"/"fragmentado"),
**Frequência** (`rotuloFrequencia` — não repetir→"Sem recorrência", semanal→dia e hora,
quinzenal→"Quinzenal · dia hora", mensal→"Mensal") e **Situação** (Em dia / Em aberto / Atrasado).

**Decisão que fica valendo:** a situação da lista vem do **mesmo motor** do paciente individual
(`resumoDaGeral`), não de uma conta paralela. Para não fazer N× queries, `situacoesDaLista` carrega os
fatos em **lote** (uma consulta por tabela) e computa por paciente na memória — a lista abre com uma
leva fixa de queries. Saiu o antigo "Devendo X sessões / crédito" e o badge de paymentStatus, que
divergiam do motor.

---

## 2026-09-16 — Demandas: onda 4 (cadastro)

**#176.** CAD1: removido o checkbox "Atendimento social" do cadastro (reverte a decisão de 14/09 a
pedido do dono; o SOC de pacientes antigos ainda aparece, só não se define mais aqui). CAD2: o status
do paciente passou a oferecer só **Ativo/Inativo** — Prospect/Pausado saíram da lista, mas se o
paciente já está num deles a opção é mantida para o save não virar Ativo sozinho; o fluxo de
prospecção segue definindo prospect. CAD4: `MoneyInput` mostra R$ enquanto se digita (trata dígitos
como centavos, formata pt-BR); envia o texto formatado, que `parseMoedaBR` já entende no servidor.

---

## 2026-09-16 — Demandas: onda 3 (reajuste com modalidade; formato investigado)

**PAG2 — histórico de reajuste unificado (#175).** O "Histórico de reajuste" (form de edição, aba
Financeiro) passou a mostrar também a mudança de MODALIDADE (gratuito, a cada sessão, mensal…), não
só de valor. `eventosDeReajuste(precos, formatos)` em `reajuste.ts` funde `patient_price_history` com
`patient_payment_format_history` numa linha do tempo; no mesmo dia a modalidade vem antes do valor
(a troca de formato arrasta o preço). Modalidade sem mudança real é descartada.

**PAG1 — investigado, sem fix às cegas.** O relato é: salva "Gratuito" e a tela volta em "A cada
sessão". O caminho no código está CORRETO — `updatePatient` grava `patients.paymentFormat` sem guarda
e o form relê dele. Não reproduzível por inspeção; sem credencial de QA e com o `.env.local`
apontando pra prod, não dá pra testar escrita com segurança. **Fica aguardando o dono confirmar** se
ainda ocorre (pós ondas 1–2) e os passos exatos. Não mexer em lógica de dinheiro no escuro.

---

## 2026-09-16 — Demandas do documento: plano de 8 ondas (ondas 1 e 2)

**Contexto:** o dono mandou um PDF de 10 páginas com 21 demandas e pediu para fazer **tudo**, em
ondas seguras com evolução salva. O plano vive em `PLANO-DEMANDAS-2026-09.md` (marcado onda a onda).

**Onda 1 — situação em aberto × em atraso (#173).** A guia Geral trocou a taxonomia de
`pago|em_aberto|a_vencer` para `pago|em_aberto|em_atraso`. em_aberto = ainda no prazo; em_atraso =
venceu sem pagamento. Vencimento: mensal/quinzenal/pacote no DIA (vale o dia inteiro); "a cada
sessão"/avulsa `horasAntesPagamento` antes da sessão (campo já existia — sem migração). `resumoDaGeral`
passou a expor `nAberto/nAtraso`, `emAberto/emAtraso`, `sessoesEmAberto/sessoesEmAtraso` para os cards
e a lista (ondas 5 e 6). **Saldo preservado:** exigível = pago + em atraso.

**Onda 2 — agenda: status, legenda, cobrança (#174).**
- Tirado "Agendada" da lista de status oferecidos (nasce agendado; o desfecho é escolhido ao clicar).
- Removidos os sinais/legenda "chegou", "pagamento atrasado" e "histórico de faltas".
- "Desmarcou" agora é **violeta**, longe do vermelho do "Faltou".
- Removido o "Esta sessão será cobrada?" (Cobrar/Não cobrar). O `chargeable` da consulta não mexia na
  cobrança (o motor só o usa em devolutiva), então o desfecho é aplicado direto. O controle de
  pagamento é assunto do financeiro, não da agenda (decisão do dono).

**Decisão que fica valendo:** cobrança e desfecho da sessão são coisas separadas — a agenda só diz o
que aconteceu; quem cobra é a guia Geral/Controle.

---

## 2026-09-16 — Reserva vencida: aviso e pendente de análise (agenda)

**Entregue:** #171. Reserva (agendamento `agendada`) cujo dia passou sem desfecho agora fica com
**cor de aviso** (laranja) na agenda, sinal **🕓 pendente** na célula + legenda, e um aviso "pendente
de análise" no painel da sessão. A terapeuta resolve escolhendo o status no seletor que já existe.

**Por quê:** essas reservas ficavam invisíveis (sem status = célula transparente) e escapavam;
sobraram 13 no ar, a mais antiga de 06/09. Definição do dono: **não** mudar automático — só sinalizar
e deixar a terapeuta escolher entre as opções disponíveis.

**Decisões que ficam valendo:**
- Reserva vencida = `agendada` com o **DIA** no passado. Reserva de hoje mais cedo NÃO venceu (o dia
  não acabou). Qualquer status já resolvido nunca vence.
- É a única exceção ao "sem status = transparente": aqui a cor volta a ter função (chamar a decisão).
- **Derivado de status+data — sem coluna nova no banco.** `reservaVencida()` em `therapy.ts`, sinal
  em `ocupacaoDaAgenda.ts`, tudo ligado no `AgendaClient.tsx`.

**Armadilha (fica de nota, não mexida):** enquanto a reserva vencida segue `agendada`, ela já conta
como sessão cheia na cobrança/fechamento (comportamento pré-existente, pois `agendada` está em
`STATUS_QUE_AVANCAM` e não pausa). Resolver o status corrige conforme a escolha — mais um motivo para
não deixá-la escapar.

**Pendente:** nada desta. Mensagem de cobrança personalizável por terapeuta segue aberta (do dono).

---

## 2026-09-16 — Marcar cobrança como enviada (guia Geral)

**Entregue:** #169. Cada cobrança em aberto na guia Geral ganhou **"Marcar enviada"**: registra que
o paciente já foi avisado daquela cobrança (quando e quem), mostra "Enviada DD/MM" com desfazer, e
remarcar é reenvio que atualiza a data. **Não envia nada** — é registro manual.

**Por quê:** a pendência de 13/09 ("marcar a cobrança como enviada — hoje ela só mostra"). A
terapeuta cobra por fora (WhatsApp) e não tinha como saber o que já passou; corria o risco de cobrar
duas vezes ou esquecer.

**Decisões que ficam valendo:**
- **A cobrança continua NÃO guardada** — o motor (`cobrancas.ts`) a recalcula pela `chave`. O envio é
  um FATO à parte, na tabela `cobranca_envios`, 1 linha por `(user, paciente, chave)` com índice
  único: remarcar vira UPDATE da data, não uma segunda linha. Mesmo padrão do pagamento, que também
  se prende à cobrança pela chave.
- **Feito na guia Geral, não na Fechamento** (onde a pendência nasceu) — combinado com o dono: a
  Geral é a visão por-cobrança onde já se lança pagamento.
- Data guardada como o **dia SP ao meio-dia** (hora de parede), para o dia não escorregar no fuso —
  a mesma regra do resto do financeiro.
- Lógica pura de casamento envio↔cobrança em `guiaGeral.ts` (testável); loader e actions à parte.

**Armadilhas:**
- `db:push` do local aplica no **Neon de produção** (é pra lá que o `.env.local` aponta). A mudança é
  aditiva (CREATE TABLE), então segura — mas é bom saber que "empurrar schema" mexe em prod.
- A verificação com clique fica atrás do login por terapeuta; a demo (Sócrates) é read-only e o proxy
  recusa POST, então marcar/desfazer não é testável pela demo. É passo do dono.

**Pendente:** mensagem de cobrança **personalizável por terapeuta** (texto com variáveis
nome/valor/vencimento) — pedido do dono nesta sessão, ainda não feito. E a regra de expiração de
reserva de slot (as 13 sessões passadas ainda "reserva") segue aguardando definição do dono.

---

## 2026-09-15 — Formato de pagamento com data, sessão fora do pacote, guia Geral

**Entregue:** #165 (vigência do formato + motor único de cobranças), #166 (sessão fora da
sequência: AVUL/GRAT) e o PR da guia Geral com "Lançar pagamento". Tudo a partir do documento do
dono de 15/09 e da regra do Gratuito.

**Por quê:** "o Financeiro não salva" era outra coisa — salvava, mas `patients.payment_format` não
tinha data e a Fechamento o aplicava ao passado inteiro: trocar de gratuito para pago transformava
agosto, atendido de graça, em R$ 800 de dívida; o inverso escondia crédito como "sem cobrança". O
paciente de teste alternou quatro vezes o formato achando que a troca não pegava.

**Decisões que ficam valendo:**

- **Formato tem vigência** (`patient_payment_format_history`). A troca vale a partir da data que o
  profissional escolhe; nada passado é criado, apagado ou alterado. Backfill: 1 linha por paciente
  com o formato atual desde o início (congelar, não reconstruir — `patient_contract_history`
  guarda rótulo, e replicá-lo inventaria cobrança).
- **Um motor só** (`src/lib/cobrancas.ts`): Fechamento, agenda (rótulo 1/4, AVUL, GRAT) e guia
  Geral leem a mesma conta. `competencia` (quando entra na Fechamento: fechamento da sequência, ou
  abertura na "primeira do pacote") é separada de `vencimento` (o dia de cobrar, na Geral).
- **Preço novo nasce na data da troca do formato**, não hoje — senão as sessões entre a data da
  troca e hoje caem no preço antigo (achado no e2e, não em teste unitário).
- **Sessão extra** (`therapy_sessions.extra` = `avul`/`grat`, `valor_extra`): fora da sequência,
  independente do formato. A pergunta só aparece se o formato NA DATA usa pacote, e o servidor lê o
  formato do banco, não do formulário.
- **Pagamento se prende à cobrança pela chave** (`session_payments.cobranca_chave`); os antigos,
  sem chave, quitam por ordem de vencimento. O valor lançado é o que falta, refeito no servidor.
- **Situação na Geral**: a primeira cobrança fica em aberto até ser paga; as demais "a vencer" até
  o dia do vencimento.

**Armadilhas:**

- Teste que passa pelo caminho errado: o de "pagamento com chave" usava uma chave inexistente e
  passava pela distribuição por vencimento. Só apareceu lendo o log do e2e. Mutante confirmou.
- A transação de caixa criada pelo pagamento **não** cai em cascata com o paciente — e2e tem de
  apagá-la pelo `linked_transaction_id`.
- Função assíncrona exportada de arquivo `"use server"` vira endpoint: `ensureSessionCategory`
  (recebe `userId`) saiu para `src/lib/categoriaSessoes.ts`.
- e2e em aba fechada: clicar no rádio escondido muda o DOM e a tela não reage. Agir como pessoa.

**Respostas do dono no mesmo dia (entraram no PR seguinte):**

- Gratuito na Geral mostra **R$ 0,00** — deixa claro que foi gratuita, não que falta valor.
- **Saldo único**: cartões do topo, Financeiro ("Fluxo financeiro") e Geral leem `resumoDaGeral`.
  Saldo = pagamentos − cobranças exigíveis (em aberto ou pagas; "a vencer" não conta). Sessões
  devendo são CONTADAS nas cobranças em aberto, não valor ÷ preço. O dono ainda vai decidir se os
  cartões do topo continuam ou se tudo fica só na Geral.
- **Devolutiva gratuita em "a cada sessão"** (`chargeable = false`) é GRAT, sem cobrança; a cobrada
  segue DEVOL e cobrada. Medido antes: nenhum paciente "a cada sessão" tinha devolutiva sem cobrar,
  então nenhuma Fechamento mudou.

---

## 2026-09-14 — O celular, e a hora que andava 3h até a tela

**Entregue:** #158, #162 e #163, a partir de dois documentos das beta testers usando o produto no
celular.

**Por quê:** relataram três coisas que nenhuma conferência minha tinha pegado — janela que não dá
para ver inteira, botões embaralhando o nome do paciente, e **agendamento marcado às 6h aparecendo
às 3h**.

**Decisões que ficam valendo:**

- **A hora no banco é hora de PAREDE.** A coluna é `timestamp` sem fuso: "18:00" quer dizer 18:00
  para quem marcou. Para atravessar até a tela sem se mover, o servidor escreve um texto **sem
  `Z`** (`horaDeParede` em `src/lib/horaLocal.ts`) e o navegador o lê como hora local. O `Z` é a
  mentira que move o horário.
- **Medidas de janela num lugar só** (`src/lib/modal.ts`): as oito janelas e os dois botões
  flutuantes tiram dali altura e camada. Cada um escolhendo a sua foi como dois acabaram no mesmo
  canto.
- **Agendamento único não é reserva.** O campo "Só reservar (confirmar depois)" saiu: perguntar
  isso a quem marcou uma data pontual criava pendência que ninguém pediu.
- **O semanal não tem letra.** Eu tinha posto (S) por conta própria; elas pediram para tirar, e com
  razão — é o ritmo padrão, apareceria em quase toda célula e não distinguiria ninguém.

**Armadilhas:**

- **O defeito do fuso só existia em PRODUÇÃO.** Minha máquina fica no mesmo fuso da usuária, então
  local tudo batia. Só abrindo a produção e comparando com o texto cru do banco ele apareceu.
- **Dois caminhos do mesmo driver, duas convenções.** O Drizzle `neon-http` monta a data com a hora
  de parede nos campos **UTC**; o tag `sql` cru do mesmo pacote monta nos campos **locais**. Errei a
  primeira correção usando a convenção errada — e só descobri olhando o que a página mandava ao
  navegador. Não há como deduzir isto: tem que medir.
- **A barra de navegação tem 96px**, não os ~70 que se imagina. Por isso "subir um pouco" não
  resolvia.
- **Empate de `z-index` resolve por ordem do documento.** A barra é renderizada depois das janelas;
  no mesmo `z-50`, ela ganhava e escondia o botão de salvar.
- **`vh` mente no celular** — mede como se a barra do navegador nunca estivesse lá. Use `dvh`.
- **A varredura de largura diz "ok" para defeito de altura e de camada.** Ver a lição no cérebro:
  *verificação verde só prova o que o instrumento mede*.

**Pendente — com o dono:**

- **"Atendimento social": elas pedem para remover, e isso CONTRADIZ a decisão de 14/09.** O dono
  definiu que social é vínculo e independe do formato de pagamento, justamente porque alguém pode
  ser social e pagar mensal. Removendo, esse caso deixa de ter como ser marcado.
- **"Financeiro não salva o formato": NÃO REPRODUZ.** Testada a sequência exata do relato, com dois
  salvamentos (mensal → gratuito → a cada sessão + valor): voltou correto. Conferido também que
  todos os `payment_format` do banco existem na lista da tela. Falta saber o aparelho e se foi em
  produção.
- Prazo da reserva: nada expira, e há 13 sessões passadas ainda marcadas como reserva sem status.

---

## 2026-09-14 — Clareza visual da agenda, e o espelho que nunca aparecia

**Entregue:** #156 e a limpeza de dívida que veio junto.

**Por quê:** o dono perguntou por quanto tempo um slot fica pré-reservado e como o quinzenal é
tratado na semana sem atendimento. Ao medir para responder, apareceu que a marca do espelho
**nunca havia aparecido uma vez sequer**.

**Decisões que ficam valendo:**

- **O espelho do quinzenal sai do CADASTRO, não da sessão.** A frequência só é gravada na sessão
  quando o agendamento nasce pela janela de repetição; a base tem 43 pacientes quinzenais cujas
  sessões não guardam isso, e por isso o espelho não existia na prática.
- **A agenda fala em três canais separados:** a FORMA do bloco diz o tipo de ocupação (paciente,
  bloqueio preto, espelho tracejado com Q); a COR diz o que aconteceu; os SÍMBOLOS dizem os fatos,
  um significado cada. Misturar canais apaga informação — quando a cor diz duas coisas, deixa de
  dizer qualquer uma.
- **Todo símbolo tem legenda na tela.** Símbolo sem legenda é adivinhação, e adivinhar numa agenda
  cheia é o começo de marcar em cima de alguém.
- **A ampulheta significa uma coisa só:** "o paciente pediu pelo link e falta confirmar". Ela
  marcava também "sessão futura da série", que é o estado normal de 83% da agenda futura — e aviso
  em tudo é aviso em nada.

**Armadilhas:**

- **Marca que nunca aparece é marca que não existe.** O espelho estava implementado, testado e
  invisível. Só a contagem no banco revelou: 43 pacientes quinzenais, zero espelhos.
- **Conferir se um achado é regressão ANTES de chamá-lo de regressão.** A varredura responsiva
  acusou nomes truncados; rodando nos dois estados, eram idênticos. É o limite de duas sessões
  dividindo meia coluna de celular, e some quando o paciente tem identificação curta.
- **`pendingConfirmation` marca duas coisas diferentes** e não há campo que as separe. A distinção
  hoje é `!recurring`.

**Pendente — tudo com o dono:**

- **Prazo da reserva.** O slot fica bloqueado pelo tempo que a terapeuta escolher no "Repetir até",
  e NADA expira. O teto é técnico (260 ocorrências: 5 anos no semanal, 10 no quinzenal). Existem
  13 sessões já passadas ainda marcadas como reserva e sem status, a mais antiga de 06/09, que
  ninguém recolhe.
- **Separar "reserva pedida pelo paciente" de "sessão futura da série"** no banco, se o dono quiser
  que as duas voltem a ser distinguíveis sem depender do `recurring`.
- Marcar a cobrança como enviada a partir da tela de fechamento (vem de 13/09).

**Dívida zerada:** o lint saiu de 4 avisos para **zero** — três variáveis mortas e um import que
sobrou de refatorações antigas.

---

## 2026-09-14 — Social separado de gratuito, e o saldo que virou posição

**Entregue:** #153 e #154, depois das revisões do dono sobre o lote da agenda.

**Por quê:** três pontos voltaram da leitura do `PLANO-AGENDA.md`. Um confirmou o que estava feito,
outro apontou um conceito que o código tinha colapsado, e o terceiro pediu para evoluir no
entendimento — e ao medir, o entendimento mudou mesmo.

**Decisões que ficam valendo:**

- **A identificação na agenda continua OPCIONAL.** A reserva (registro → primeiro nome) é o que
  impede a célula de ficar muda, já que o campo está vazio em quase todo mundo.
- **Social é VÍNCULO, gratuito é FORMATO DE PAGAMENTO.** Eram a mesma coisa no código — `social`
  era só a palavra que a tela usava para `paymentFormat === "gratuito"`. Agora convivem: quem é
  social e fecha por pacote mostra `1/4 SOC`; quem é social e gratuito mostra `GRAT SOC`. Nenhum
  paciente nasceu social na migração, porque converter os gratuitos repetiria a confusão.
- **O saldo do fechamento é a POSIÇÃO ACUMULADA**, não a diferença do mês. Um pagamento de setembro
  quita um pacote de agosto. Os três números do alto não fecham entre si de propósito: dois são
  fotos do mês, um é posição — e a tela diz isso.
- **Cada cobrança vale o preço do DIA DELA.** Somar o passado com o preço de hoje faria a dívida de
  um ano atrás crescer sozinha a cada reajuste.

**Armadilhas:**

- **Medir antes de opinar mudou o diagnóstico.** Eu havia dito que a cobrança por sequência deixava
  o mês "irregular". A medição de 12 meses mostrou a cobrança acompanhando o consumo de perto (~R$
  205 por sessão) e fechando com 5% de diferença contra os pagamentos. O que parecia irregularidade
  era o volume da demonstração caindo pela metade ao longo do ano.
- **O defeito real era a comparação, não a regra.** A tela comparava cobrado do mês com pago do mês:
  28 de 31 pacientes ativos alternavam entre dever e ter crédito, e só 3 deviam. É anterior ao lote;
  a cobrança por sequência só o tornou estrutural.
- **Consulta pela metade não é pega por teste.** Ao mudar as sessões para o histórico inteiro (fatia
  3) os PAGAMENTOS ficaram presos ao mês. O acumulado cobrava tudo e descontava trinta dias: R$ 873
  mil de dívida inventada. A regra estava certa; a consulta é que não.
- **12 de 103 pacientes não têm histórico de preço**, e sem reserva o preço virava zero — receita
  que some sem avisar, o mesmo erro da dívida inventada na direção contrária. Agora cai no valor do
  cadastro.

**Pendente:** nada do lote. A caixa "Abater do pacote" existe e grava, mas nenhuma devolutiva antiga
está marcada — o efeito só aparece nas novas.

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

**Pendente:** nada. As três perguntas que estavam aqui — `agenda_id` obrigatório, `GRAT` no lugar
de `SOCIAL`, e a suposta irregularidade do mês — foram respondidas em 14/09; ver a entrada daquele
dia. A "irregularidade" não existia: era o volume da demonstração caindo ao longo do ano.

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

**Pendente:** marcar a cobrança como enviada a partir desta tela — hoje ela só mostra. (O reinício
da sequência do pacote, que estava aqui, foi resolvido pelo motor da fatia 3 em 13/09: a sequência
recomeça sozinha ao completar o total contratado.)

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

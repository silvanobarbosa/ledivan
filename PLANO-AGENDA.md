# A agenda que as beta testers pediram

Duas profissionais do meio estão testando o produto e mandaram 18 páginas de ajustes na agenda.
Este documento é a leitura daquele lote contra o código que existe hoje: o que é acréscimo, o que
**contradiz** uma regra já implementada, e em que ordem entregar.

Não é um resumo do PDF. O PDF diz o que elas querem; aqui está o que isso custa, e onde ele
esbarra no que já está no ar.

---

## 1. Onde o pedido e o código discordam

Três lugares. Nenhum é "faltou implementar": em todos, a regra nova **substitui** uma regra que
está rodando. Cada um abaixo diz o que elas pediram, o que o código faz hoje, **por que** diverge e
**o que muda na tela** quando trocar.

---

### 1.1 Os status respondem a perguntas diferentes

**O que elas pediram:** Presente, Faltou, Desmarcou, Prof. desm., Atestado.

**O que existe:** `agendada`, `realizada`, `nao_realizada`, `cancelada`, `realocada`.

**Por que diverge.** Os status de hoje respondem *"a sessão aconteceu?"*. Os pedidos respondem
*"quem causou a ausência?"* — e essa é outra pergunta, porque dela depende se o paciente **perde**
ou **não perde** a sessão. Faltar por conta própria e faltar com atestado são a mesma coisa para o
sistema atual, e coisas opostas para quem atende.

| Pedido | Existe hoje | Situação |
| --- | --- | --- |
| (sem status) | `agendada` | mesmo conceito |
| Presente | `realizada` | mesmo conceito, outro nome |
| Faltou | `nao_realizada` | mesmo conceito, outro nome |
| Desmarcou | `cancelada` | mesmo conceito, outro nome |
| Prof. desm. | — | **não existe** |
| Atestado | — | **não existe** |
| — | `realocada` ("Remarcada") | **sobra**: sem lugar na legenda nova |

**O que muda de verdade.** Criar dois status é barato. Caro é que todo lugar que **lê** status
precisa decidir o que fazer com os dois novos:

- O **risco de falta** hoje conta "não realizada" e "cancelada" como falta. Se Atestado entrar
  nessa conta, quem adoeceu vira paciente de risco — o contrário do que a informação serve para
  dizer.
- O **fechamento do mês** exclui "cancelada" e "realocada" da cobrança. Prof. desm. e Atestado
  precisam entrar na mesma lista, senão o paciente é cobrado por sessão que o profissional
  desmarcou.

**Sobre o `realocada`:** há sessões assim no banco. A recomendação é **manter o valor** e
exibi-lo como Desmarcou, porque é assim que ele já se comporta (fora da conta, fora da cobrança).
Apagá-lo destruiria histórico; deixá-lo sem lugar na legenda deixaria sessões antigas sem cor nem
nome.

**Não muda:** a cobrança. Faltou continua sendo cobrado (o paciente perdeu a sessão) e Desmarcou
continua não sendo. Isso já é o comportamento de hoje.

---

### 1.2 A sequência X/X — pequena no pacote completo, grande no fracionado

Aqui é preciso separar os dois pacotes, porque o tamanho do problema é muito diferente.

#### Pacote completo: o código já acerta os números, só não escreve um deles

`src/lib/pacoteMes.ts` **joga fora** a sessão desmarcada antes de numerar. O efeito colateral é
que ela fica sem número nenhum na agenda.

```
hoje                          pedido
16/09  1/4  Presente          16/09  1/4  Presente
23/09   —   Desmarcou   ←     23/09  2/4  Desmarcou   ← a diferença está só nesta linha
30/09  2/4  Presente          30/09  2/4  Presente
07/10  3/4  Presente          07/10  3/4  Presente
```

**As sessões ativas recebem os mesmos números nos dois casos.** Jogar a desmarcada fora e pular a
posição dela dão no mesmo resultado. O pedido é que a linha pausada **exiba** onde parou, em vez de
ficar muda. É acréscimo de rótulo, não troca de motor.

#### Pacote fracionado: aqui o número muda, e hoje muda para pior

O código agrupa por **mês do calendário**, e o total é *quantas sessões sobraram naquele mês*. Ou
seja: **cada desmarcação encolhe o total**.

```
setembro com 3 sessões contratadas, a de 23/09 desmarcada e reposta em 07/10

hoje                          pedido
16/09  1/2   ← encolheu       16/09  1/3
30/09  2/2                    23/09  2/3  (pausada)
07/10  1/4                    30/09  2/3
14/10  2/4                    07/10  3/3   ← ainda é a sequência de SETEMBRO
21/10  3/4                    14/10  1/3   ← outubro só começa aqui
28/10  4/4                    21/10  2/3
                              28/10  3/3
```

**Por que diverge.** Para o código, "o pacote de setembro" é o conjunto de sessões que caíram em
setembro. Para elas, é o que foi **contratado** para setembro — três sessões — e uma reposição em
outubro ainda pertence a setembro. O agrupador deixa de ser o calendário e passa a ser a sequência.

**O que isso arrasta junto, e é o ponto mais importante deste documento.** Hoje o `X/X` da agenda e
a cobrança do fechamento saem do **mesmo cálculo**: sessões ativas no mês. Por isso sempre batem.
Com a regra nova passam a sair de lugares diferentes — o rótulo segue a sequência contratada, a
cobrança segue a data:

| | setembro | outubro |
| --- | --- | --- |
| rótulo na agenda | 3 sessões | 3 sessões |
| cobrança no fechamento | 2 sessões | 4 sessões |

Duas telas que hoje mostram o mesmo número passam a mostrar números diferentes, e **as duas estão
certas**. Ou se aceita isso e se explica na tela, ou o fechamento passa a cobrar por sequência em
vez de por data. É decisão do dono, não do código.

---

### 1.3 A cor da célula responde a outra pergunta

**O que elas pediram:** amarelo Presente, vermelho Faltou, vermelho claro Desmarcou, cinza claro
Prof. desm., azul claro Atestado — e fundo **transparente** enquanto não há status.

**O que existe:** azul Recorrente, âmbar Reserva, roxo Agendada, verde Realizada, vermelho Não
realizada.

**Por que diverge.** A cor de hoje diz *"que tipo de compromisso é este"*. A cor pedida diz *"o que
aconteceu neste compromisso"*. São duas informações disputando o mesmo pixel, e só uma cabe.

**O que se perde ao trocar, e precisa de outro lugar:**

- **O âmbar "Reserva"** hoje significa *"o paciente pediu este horário pelo link público e você
  ainda não confirmou"*. Na legenda nova, amarelo é Presente. Repintar sem mais nada faz um pedido
  pendente ficar idêntico a uma sessão que aconteceu. Essa informação tem que virar ícone ou selo,
  ou desaparece.
- **O azul "Recorrente"** é parcialmente coberto pelos `(M)` e `(Q)` que elas pediram — mas o
  semanal não ganhou marca nenhuma no pedido, e hoje é azul.
- **Verde vira amarelo** para a mesma coisa (sessão realizada). Quem já usa vai ler a tela errado
  por um tempo. Vale avisar as duas antes de subir.

---

### 1.4 Duas trocas menores, com efeito visível

- **A célula passa a mostrar o ID em vez do nome.** O campo é `patients.agenda_id`, que o schema já
  descreve como "identificação do paciente na agenda". Ele é **opcional** e hoje costuma estar
  vazio — se ficar vazio, a célula não mostra nada. Precisa de um valor de reserva (o número de
  cadastro, ou o primeiro nome) enquanto a terapeuta não preencher.
- **A cor do feriado sai da coluna inteira e vai só para o cabeçalho.** É o que elas pediram e
  deixa a agenda mais limpa, mas hoje é a coluna tingida que faz o feriado saltar aos olhos. Fica
  mais discreto de propósito.

---

## 2. O que é acréscimo limpo

Nada disso conflita; é trabalho novo.

- **Grade das 6h** (hoje começa às 7h), horas dentro das linhas, bordas nas colunas.
- **Cabeçalho de três linhas**: dia da semana, `dd/mm/aa`, nome do feriado. Hoje mostra o dia da
  semana e o número do dia, sem a data completa.
- **Cor do feriado só no cabeçalho.** Hoje a coluna inteira é tingida.
- **Sem o botão "Novo atendimento".** O agendamento nasce do clique na célula — que já funciona,
  mas só na hora cheia. Precisa de meia em meia hora.
- **Botão "Escolher data"** que salta a agenda para a semana daquela data.
- **Bloquear/desbloquear horário**: tabela nova, modal com data, horários livres, checkbox e texto
  por horário; na agenda, fundo preto e texto branco com "HORÁRIO BLOQUEADO" ou o texto digitado.
- **Modal de novo agendamento inteiro**: tipo (Consulta/Devolutiva), repetição, modalidade com os
  locais cadastrados em Ajustes, "Repetir até", "Confirmar sessão" com quantas horas antes.
- **Conteúdo da célula**: o **ID da agenda** do paciente (`patients.agenda_id`, que existe e é
  exatamente "identificação do paciente na agenda") e o código da sessão — DEVOL, GRAT, AVUL, X/X,
  `(M)`/`(Q)`, ícone de câmera quando online. Hoje a célula mostra o **nome**.
- **Slot Q intercalado**: o "Vago Quinzenal" já existe e já é clicável, mas não pergunta nada. Falta
  a confirmação nomeando o paciente e a repetição limitada a Não repetir / 1x no mês / A cada
  quinzena.
- **Mensal**: sem repetição automática, e o paciente entra numa lista "Lembrar agendamento" no
  Dashboard, abaixo de "Sessões do dia", aparecendo nos últimos 3 dias do mês.
- **Ativo → Inativo** apaga os agendamentos futuros **sem status** e preserva os que têm.
- **Editar Agendamento**: só data/hora, duração, modalidade e lembrete editáveis; ao salvar, "apenas
  este" ou "este e os próximos"; horário ocupado recusa; excluir com as mesmas duas opções, e a
  segunda desdobrando em "mesmos dias e horários" ou "todos". Nunca duplicar.
- **Responsividade** de ponta a ponta, sem nada cortado ou sobreposto.

---

## 3. A ordem de entrega

Onze fatias, cada uma um PR que fica de pé sozinho. A ordem não é a do PDF: é a que deixa o motor
certo antes de a tela depender dele.

| # | Fatia | Por que nesta posição |
| --- | --- | --- |
| 1 | Grade e cabeçalho (6h–21h, dd/mm/aa, feriado só no topo, bordas, sem o botão, clique de 30 em 30) | Visual puro, risco zero, e é o que elas veem primeiro |
| 2 | Os cinco status, a legenda nova e a tela "Vamos atender?" | Tudo depois disto depende do status existir |
| 3 | O motor da sequência X/X (avanço, pausa, virada de mês, recálculo) | Função pura + testes; a fatia mais arriscada, feita longe da tela |
| 4 | Conteúdo da célula (ID, DEVOL/GRAT/AVUL, X/X, câmera, M/Q, fundo transparente) | Consome 2 e 3 |
| 5 | Bloquear/desbloquear horário | Independente; tabela nova |
| 6 | Modal de novo agendamento completo | Maior peça de tela do lote |
| 7 | Slot Q intercalado (confirmação e repetição limitada) | Depende de 6 |
| 8 | Mensal + "Lembrar agendamento" no Dashboard | Depende de 6 |
| 9 | Editar e excluir agendamento | Depende de 3 (recálculo) e 6 (campos) |
| 10 | Ativo → Inativo apaga futuros sem status | Independente; mexe no cadastro |
| 11 | Responsividade em telefone e tablet | Por último, quando não há mais tela nova entrando |

---

## 4. O que depende de uma decisão do dono

Duas das três dúvidas iniciais se resolveram sozinhas ao olhar o código, e viram recomendação. A
terceira é de verdade, e é a mais cara de errar.

**Resolvidas — recomendação, não pergunta:**

- **`realocada`:** fica no banco, sai da legenda, aparece como Desmarcou. É como ele já se comporta
  (fora da contagem e fora da cobrança), e apagar o valor destruiria histórico.
- **Horário bloqueado:** entra em **tabela própria**, não em `therapy_sessions`. Assim ele não tem
  como vazar para o fechamento do mês nem para a contagem do pacote — a pergunta "bloqueio cobra?"
  deixa de existir em vez de precisar de resposta.

**Aberta, e precisa do dono:**

**No pacote fracionado, a agenda e a cobrança vão passar a mostrar números diferentes.** Hoje as
duas saem do mesmo cálculo (sessões ativas no mês do calendário) e por isso sempre batem. Com a
regra de pausa, o rótulo `X/X` passa a seguir a **sequência contratada** e a cobrança continua
seguindo a **data** — e uma reposição que caiu no mês seguinte fica contada de um jeito na agenda e
de outro no fechamento (o exemplo com números está em 1.2).

São dois caminhos, e é escolha de negócio:

1. **Aceitar a diferença** e explicar na tela do fechamento que o mês cobra o que aconteceu naquele
   mês, independentemente de a que sequência a sessão pertence. Mais simples, e não mexe no
   fechamento que já está no ar.
2. **Cobrar por sequência**, e não por data: setembro cobra as três sessões contratadas, mesmo que
   uma tenha acontecido em outubro. Mais fiel ao combinado com o paciente, mas muda o fechamento e
   exige guardar, quando a sequência nasce, quantas sessões ela tem — número que hoje não existe em
   lugar nenhum.

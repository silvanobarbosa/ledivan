# A agenda que as beta testers pediram

Duas profissionais do meio estão testando o produto e mandaram 18 páginas de ajustes na agenda.
Este documento é a leitura daquele lote contra o código que existe hoje: o que é acréscimo, o que
**contradiz** uma regra já implementada, e em que ordem entregar.

Não é um resumo do PDF. O PDF diz o que elas querem; aqui está o que isso custa, e onde ele
esbarra no que já está no ar.

---

## 1. Os três choques com o que existe

Estes não são "faltou implementar". São lugares onde a regra nova **substitui** uma regra antiga
que está rodando em produção. Entrar com eles sem decidir o que fazer com o dado velho quebra a
agenda de quem já usa.

### 1.1 Os status não são os mesmos

O banco tem cinco status (`session_status`), e o lote pede outros cinco. Só três se encontram:

| O que elas pedem | O que existe hoje | Situação |
| --- | --- | --- |
| (sem status) | `agendada` | mesmo conceito |
| Presente | `realizada` | mesmo conceito, outro nome |
| Faltou | `nao_realizada` | mesmo conceito, outro nome |
| Desmarcou | `cancelada` | mesmo conceito, outro nome |
| Prof. desm. | — | **não existe** |
| Atestado | — | **não existe** |
| — | `realocada` ("Remarcada") | **sobra**: não tem lugar na legenda nova |

Duas decisões saem daqui, e nenhuma é técnica:

- `realocada` some da tela ou continua existindo para o histórico? Há sessões com esse status no
  banco, e elas hoje **saem da conta do pacote** (ver 1.2). Some da legenda, mas o dado fica.
- Renomear na tela é barato; renomear no enum é migração. A escolha aqui é manter os valores do
  banco e trocar só o rótulo, acrescentando `prof_desmarcou` e `atestado`. Menos risco, e o
  fechamento do mês continua lendo o que já lê.

### 1.2 A sequência X/X hoje faz o contrário do que elas pedem

`src/lib/pacoteMes.ts` **remove** a sessão cancelada da lista antes de numerar — a linha
`const FORA = new Set(["cancelada", "realocada"])`. O efeito é que a desmarcada não recebe posição
nenhuma e simplesmente desaparece da contagem.

O lote pede outra coisa: a desmarcada **fica na agenda com a posição em que parou**, e a sessão
seguinte assume a mesma posição.

```
hoje:              23/09 (desmarcou) → sem número      30/09 → 2/4
o que elas querem: 23/09 (desmarcou) → 2/4             30/09 → 2/4
```

E há uma segunda diferença, mais funda. Hoje o pacote fracionado agrupa por **mês do calendário**.
A regra nova é por **sequência**: se a pausa empurrar a última sessão de setembro para 07/10, aquele
07/10 ainda é `3/3` de setembro, e a sequência de outubro só começa em 14/10. Mês-calendário deixa
de ser o agrupador.

Isso é reescrita de `numeracaoDoPacote`, não ajuste. É a fatia de maior risco do lote e a que mais
se defende com teste — é função pura, dá para acertar sem abrir a tela.

### 1.3 O fundo da célula

`sessionColorClasses` pinta toda célula: recorrente de azul, reserva de âmbar, agendada de roxo.
O lote pede fundo **transparente** no agendamento sem status, e cor só quando o status chega,
seguindo a legenda nova (amarelo Presente, vermelho Faltou, vermelho claro Desmarcou, cinza claro
Prof. desm., azul claro Atestado).

Ou seja: as cores atuais não são as cores pedidas, e o critério (recorrência, reserva) não é o
critério pedido (status). A função inteira troca de regra.

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

## 4. O que ainda não está decidido

Três pontos que o PDF não fecha e que mudam o que se constrói:

1. **`realocada` some ou fica?** A legenda nova não tem "Remarcada". Há sessões assim no banco.
2. **Sessão bloqueada conta como quê no fechamento do mês?** O horário bloqueado não é sessão de
   paciente, então a resposta provável é "não conta" — mas convém dizer isso em voz alta antes de
   a tela de fechamento começar a somar diferente.
3. **Pacote fracionado: de onde sai a quantidade de sessões do mês?** Hoje sai da agenda (quantas
   caíram no mês). Com a regra de pausa, a sequência de um mês pode terminar no mês seguinte, e aí
   "quantas sessões o mês tem" deixa de ser uma pergunta sobre o calendário. Precisa de um número
   guardado quando a sequência nasce.

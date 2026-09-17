# Plano de ataque — demandas de 17/09/2026

Dois documentos: o primeiro traz 24 pedidos; o segundo responde as três dúvidas que eles
levantavam e detalha a fragmentação em quatro casos. Aqui ficam as ondas, o que cada uma entrega e
o que precisa ser verificado antes de fechar.

**O que o segundo documento resolveu:**
- O card "Pacotes" da guia Geral **pode sair** — a inserção de pacote passa a ser pela agenda.
- O botão "Marcar enviada" **sai**, e cada clique em "Cobrar" registra o envio (com histórico).
- A fragmentação: o denominador do mês **não** encolhe quando alguém desmarca; a sessão vira
  crédito e atravessa o mês, se não houver reposição.

---

## Onda 1 — Limpeza e os dois bugs

| # | O quê | Onde |
|---|---|---|
| L1 | Tirar o `#id` do paciente na lista | lista de pacientes |
| L2 | Tirar o e-mail do cartão do paciente | detalhe do paciente |
| L3 | Tirar o texto "inclui reservas" | card de sessões agendadas |
| L4 | Tirar o seletor de status da janela de **agendamento** (a baixa é na janela do agendamento já feito) | agenda |
| L5 | Remover o card "Pacotes" (autorizado no 2º documento) | guia Geral |
| B1 | **Aniversário um dia antes** — e o mesmo no histórico de ajuste | agenda + ajustes |
| B2 | Agendamento **desalinha a coluna** da agenda | agenda |

**B1 — causa já diagnosticada:** `birthDate` é `timestamp` e a data gravada à meia-noite volta lida
como UTC; no nosso fuso, cai no dia anterior. É a mesma armadilha catalogada no Portal. A cura vale
para os dois sintomas, porque a causa é uma só.

## Onda 2 — Ajustes do terapeuta e registro de cobrança

| # | O quê |
|---|---|
| A1 | Campo **CPF do terapeuta** em Ajustes |
| A2 | Campo **Descrição do atendimento**: Terapia / Psicanálise / Psicologia |
| C1 | Remover "Marcar enviada"; cada clique em **Cobrar** registra data e hora |
| C2 | **Histórico** de todos os envios, sem substituir os anteriores |
| H1 | Histórico de reajuste com **data e hora** do pedido, o que mudou, o valor e a **vigência** |

## Onda 3 — Regras de dinheiro na tabela de controle

| # | O quê |
|---|---|
| D1 | Sessão **GRAT** mostra R$ 0,00 sempre, independente do status |
| D2 | **"Em aberto"** = mês vigente + anteriores não pagas |
| D3 | Seletor de **ano** antes da tabela, filtrando **as duas** tabelas (sessões e pagamentos) |

## Onda 4 — Pagamento e recibo

| # | O quê |
|---|---|
| P1 | "Lançar pagamento" abre janela: data, responsável (sugerindo paciente e responsável), CPF opcional, forma de pagamento |
| P2 | Responsável e CPF **ficam salvos** para os próximos lançamentos daquele paciente |
| P3 | Botões **Emitir recibo** e **Emitir nota** após o pagamento |
| P4 | Recibo preenchido, **sem logotipo**, com o texto da descrição escolhida em Ajustes |
| P5 | "Emitir nota fiscal" abre o **Receita Saúde** |
| P6 | Marca ao lado de Pago: *emitido recibo* / *emitido nota* |

## Onda 5 — Sequência do pacote no agendamento

| # | O quê |
|---|---|
| S1 | A área "Sequência do pacote" aparece quando o paciente **já tem outros agendamentos** |
| S2 | "Adicionar" → entra respeitando o **status e o número do último** agendamento |
| S3 | "Não adicionar" → pergunta **se cobra e quanto** → vira **AVUL**; se gratuita, **GRAT** |

## Onda 6 — Fragmentação (sozinha, com teste antes do código)

A regra, nas palavras do documento, com os quatro casos:

| Caso | O que acontece |
|---|---|
| **F1** Desmarcou **sem** reposição no mês | O denominador do mês **não** encolhe (setembro continua /3). A posição vaga é ocupada pela próxima sessão real, e a última do mês **atravessa** para o mês seguinte mantendo o número. O mês seguinte recomeça a partir da próxima. |
| **F2** Reposição **no mesmo mês** | A sessão inserida **ocupa a posição** da desmarcada. Nada muda no mês seguinte, nem os valores previstos. |
| **F3** Reposição da **última** sessão, ainda no mês | Igual à F2: ocupa a posição, e o mês seguinte segue intacto. |
| **F4** Sessão **não adicionada** à sequência | Fora do pacote: **AVUL** ou **GRAT**, conforme a escolha (onda 5). |

**O invariante que precisa de teste:** a sessão transferida **já foi paga** no mês dela. Ela não pode
ser cobrada de novo no mês em que for realizada — "sem perder atendimentos e sem gerar cobranças
duplicadas", como o documento diz.

---

## Como cada onda fecha

Um PR por onda, com CI verde antes do merge; teste primeiro no que é regra de dinheiro; e o que é
tela, verificado no navegador antes de eu dizer que está pronto.

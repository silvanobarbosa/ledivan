# Plano de ataque — demandas do documento (16/09/2026)

Backlog do PDF do dono (21 itens), em 8 ondas por dependência. Cada onda = 1 PR pequeno com
testes, CI verde, merge, verificação e evolução salva (este arquivo + `HISTORICO.md` + memória).
Marcar `[x]` ao concluir. Códigos batem com o checklist (artifact) e com a memória do backlog.

**Regra da ordem:** o que muitas telas leem vem primeiro (situação de pagamento). O mais delicado
(fragmentado) fica por último, com dados de teste.

---

## Onda 1 — Situação: em aberto × em atraso  ✅ (PR #173)
- [x] **PAG3** — em aberto até o vencimento; depois, em atraso. Mensal/quinzenal/pacote vencem no
  DIA (vale o dia inteiro); "a cada sessão"/avulsa vencem `horasAntesPagamento` antes da sessão
  (campo já existente no schema). Registrado = não pendente.
- [x] **PAG4** — contadores separando em aberto de em atraso (`nAberto`/`nAtraso`, `emAberto`/
  `emAtraso`, `sessoesEmAberto`/`sessoesEmAtraso` no `resumoDaGeral`). Exibição nos cards/lista vem
  nas ondas 5 e 6, que leem daqui.
- Nota: taxonomia da guia Geral mudou de `pago|em_aberto|a_vencer` para `pago|em_aberto|em_atraso`.
  Saldo preservado (exigível = pago + em atraso).

## Onda 2 — Agenda: status, legenda, cobrança  ✅
- [x] **AGD1** — tirar "Agendada" da lista de status oferecidos (todo agendamento nasce agendado; o
  desfecho é escolhido ao clicar na sessão).
- [x] **LEG1** — legenda: remover "chegou", "pagamento atrasado", "histórico de faltas" (e os sinais
  correspondentes na célula).
- [x] **LEG2** — cor do "Desmarcou" agora é violeta (`#ede9fe`/`#6d28d9`), longe do vermelho do "Faltou".
- [x] **LEG3** — removido o "Esta sessão será cobrada?" (Cobrar/Não cobrar); o desfecho é aplicado
  direto. O `chargeable` da consulta não afetava a cobrança (o motor só o usa em devolutiva).

## Onda 3 — Financeiro: formato + reajuste  ◐ (PAG2 feito; PAG1 aguardando repro)
- [ ] **PAG1** — após salvar, manter selecionado o formato salvo. **INVESTIGADO:** o caminho no
  código está correto — `updatePatient` grava `patients.paymentFormat = newFormat` (sem guarda) e o
  form de edição relê de `patient.paymentFormat`. Não reproduzível por inspeção; não fizemos fix às
  cegas em lógica de dinheiro. **Aguardando o dono confirmar** se ainda acontece na prod atual (pós
  ondas 1–2) e, se sim, os passos exatos + qual paciente.
- [x] **PAG2** — histórico de reajuste unificado: mostra mudança de VALOR e de MODALIDADE
  (`eventosDeReajuste` em `reajuste.ts`), lendo `patient_price_history` + `patient_payment_format_history`.

## Onda 4 — Cadastro (formulário)  ✅
- [x] **CAD1** — removido o checkbox "Atendimento social". (SOC de pacientes antigos ainda exibe; só
  não se define mais no cadastro.)
- [x] **CAD2** — status só Ativo/Inativo. Prospect/Pausado saíram da lista; se o paciente já está num
  deles (veio da prospecção), a opção é mantida para não virar Ativo ao salvar. Fluxo de prospecção intacto.
- [x] **CAD4** — `MoneyInput`: valor da sessão mostra R$ enquanto digita; envia pt-BR, servidor parseia.

## Onda 5 — Lista de pacientes  ✅
- [x] **LST1** — cada card mostra Id da agenda (#), Ativo/Inativo, Financeiro por extenso
  (`rotuloFinanceiro`, com pacote/fragmentado), Frequência (`rotuloFrequencia`: sem recorrência /
  dia+hora / Quinzenal·dia+hora / Mensal) e Situação (Em dia/Em aberto/Atrasado). A situação vem do
  motor da onda 1, carregado em LOTE (`situacoesDaLista` — 1 query por tabela, computa por paciente).

## Onda 6 — Página do paciente: guias, cards, cabeçalho  ✅
- [x] **GER1** — removida a guia "Dados"; o Histórico de status virou um bloco abaixo do cabeçalho,
  acima dos cards.
- [x] **GER2** — cards agora são 3: Sessões agendadas · Em aberto (nº + valor) · Em atraso (nº + valor).
  O banner de agenda recorrente segue abaixo.
- [x] **GER3** — removidas as guias Sessões, Financeiro e Linha do tempo. Guias restantes: Geral,
  Prontuário, Atividades, Materiais. **CONSEQUÊNCIA:** o "Registrar pagamento", a gestão de pacotes
  (P1/P2) e o Fluxo financeiro saíram com a guia Financeiro — pagamento agora é pela guia Geral
  ("Lançar pagamento" por cobrança). Se o dono quiser a gestão de pacotes de volta, dizer onde.
- [x] **CAD3** — cabeçalho mostra nome, Ativo/Inativo, financeiro por extenso, valor, vencimento
  (dia do mês, ou "pagar até Xh antes" no avulso), idade, casal, telefone e responsável + telefone.

## Onda 7 — Guia Geral & Controle  ✅
- [x] **GER4** — cabeçalho da guia Geral: valor da sessão + "Reajuste previsto para …".
- [x] **GER5** — coluna "Status" na guia Geral, à direita de Data/hora. Mostra só Presente/Faltou/
  Desmarcou/Prof. desm./Atestado com a cor da agenda; sem status = célula vazia sem cor.
- [x] **GER6** — `TabelaAnual`: valores recebidos por mês (com Total), filtrados por ANO (seletor),
  abaixo da tabela da Geral. Pura em `tabelaAnual.ts`.

## Onda 8 — Agenda: fragmentado, sequência, layout  ✅
- [x] **AGD3** — fragmentado agora é POR MÊS: cada mês do calendário é uma sequência do tamanho dos
  atendimentos daquele mês (set 3 → 1/3..3/3; out 4 → 1/4..4/4). Ignora tamanhos contratados; os meses
  não se juntam; a pausa não conta no total do mês (mas segura a posição); valor = total × preço.
  `posicoesFragmentado` em `sequenciaPacote.ts`.
- [x] **AGD2** — a pergunta "entra na sequência?" só aparece se o paciente JÁ TEM sequência (tem
  sessão com posição de pacote). Primeiro agendamento não pergunta. Gate em `perguntaSeEntraNaSequencia`.
- [x] **AGD4** — Hoje/Escolher data/Bloquear horário desceram para uma linha própria abaixo da semana.

---

### Todas as 8 ondas concluídas (16/09/2026). Pendências ZERADAS (#181):
- [x] **PAG1** — RESOLVIDO: `updatePatient` não revalidava a rota `/edit`, então o RSC dela ficava em
  cache com o formato antigo (o banco salvava certo, mas a tela reabria em "A cada sessão"). Fix:
  `revalidatePath(.../edit)`.
- [x] **Gestão de pacotes (P1/P2)** — RESTAURADA na guia Geral (Controle), só para formatos de pacote.
- [x] **Mensagem de cobrança personalizável** — `users.cobrancaMessage` (variáveis {nome}/{valor}/
  {vencimento}), editável em Ajustes; botão **Cobrar** na guia Geral compõe a mensagem e abre o WhatsApp.

---

### Pendências fora do PDF (do dono, já mapeadas)
- [ ] Mensagem de cobrança **personalizável por terapeuta** (variáveis nome/valor/vencimento).

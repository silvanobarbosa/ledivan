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

## Onda 2 — Agenda: status, legenda, cobrança
- [ ] **AGD1** — tirar "Agendada" da lista de status oferecidos (todo agendamento nasce agendado; o
  desfecho é escolhido ao clicar na sessão).
- [ ] **LEG1** — legenda: remover "chegou", "pagamento atrasado", "histórico de faltas" (e os sinais
  correspondentes na célula).
- [ ] **LEG2** — cor do "Desmarcou" distinta do vermelho do "Faltou".
- [ ] **LEG3** — remover o "Marcar como presente. Esta sessão será cobrada?" (Cobrar/Não cobrar).

## Onda 3 — Financeiro: formato + reajuste
- [ ] **PAG1** — após salvar, manter selecionado o formato efetivamente salvo (bug Gratuito→"A cada
  sessão").
- [ ] **PAG2** — histórico de reajuste mostra também a mudança de MODALIDADE, não só de valor.

## Onda 4 — Cadastro (formulário)
- [ ] **CAD1** — remover checkbox "Atendimento social".
- [ ] **CAD2** — status do paciente só Ativo/Inativo (tirar Prospect e Pausado da lista; manter o
  fluxo de prospecção intacto).
- [ ] **CAD4** — valor da sessão com máscara de moeda ao digitar.

## Onda 5 — Lista de pacientes
- [ ] **LST1** — por paciente: Id da agenda, Ativo/Inativo, Financeiro (formato completo), Frequência
  (não repetir→sem recorrência; semanal→dia+hora; quinzenal→dia+horário; mensal→"mensal"), situação
  Em dia/Em aberto/Atrasado (lê a onda 1).

## Onda 6 — Página do paciente: guias, cards, cabeçalho
- [ ] **GER1** — remover guia "Dados"; histórico de status abaixo dos dados, acima dos cards.
- [ ] **GER2** — cards só: sessões agendadas · X em aberto e X em atraso · recorrentes (se houver).
- [ ] **GER3** — remover guias Sessões, Financeiro, Linha do tempo.
- [ ] **CAD3** — cabeçalho/ficha do paciente: nome completo, ativo/inativo, idade, telefone, se é
  casal, responsável, telefone do responsável, financeiro (formato), valor + dia de vencimento (ou
  horas antes, no avulso — `horasAntesPagamento`).

## Onda 7 — Guia Geral & Controle
- [ ] **GER4** — acima da tabela do Controle: data do próximo reajuste + valor da sessão.
- [ ] **GER5** — coluna "Status da sessão" na guia Geral, à direita de Data/Hora (Presente/Faltou/
  Desmarcou/Prof. desm./Atestado; cor de fundo do padrão da agenda; sem status = vazia sem cor).
- [ ] **GER6** — abaixo do Controle, a tabela de valores recebidos por mês (com Total) filtrada por
  ANO em vez de por paciente.

## Onda 8 — Agenda: fragmentado, sequência, layout
- [ ] **AGD3** — fragmentado: numeração por qtd de sessões de CADA mês, reiniciando no mês seguinte
  (set 1/3..3/3, out 1/4..4/4); não juntar meses; valor = total pelo nº de sessões; ajuste por
  status/reposição sem perder/duplicar. (Reproduzir o erro atual com dados de teste antes de mexer.)
- [ ] **AGD2** — "Sequência do pacote" só aparece se o paciente já tem sequência; ao inserir no meio,
  perguntar sessão à parte vs acrescentada.
- [ ] **AGD4** — botões Hoje/Escolher data/Bloquear horário na linha de baixo (layout).

---

### Pendências fora do PDF (do dono, já mapeadas)
- [ ] Mensagem de cobrança **personalizável por terapeuta** (variáveis nome/valor/vencimento).

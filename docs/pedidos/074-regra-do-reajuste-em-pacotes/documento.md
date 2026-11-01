# Doc 74 — Regra de aplicação do reajuste em pacotes

Recebido em 01/11/2026 ("Documento sem título (16).pdf"). Transcrição; o PDF chegou pela conversa.

## O que o dono escreveu, em resumo

**1. Pacote em andamento** — o novo valor vale da primeira sessão com data **igual ou posterior**
à vigência. As anteriores ficam no valor antigo; o total do pacote é recalculado.
Exemplo: 65 → 70 a partir de 01/09. Pacote de 18/08, 27/08, 03/09, 10/09 passa de 260 para
**270**; o pacote seguinte (17/09 em diante) vira **280**.

**Pagamento já lançado:** preserva o pago, recalcula o total, e a diferença aparece como **valor
em aberto** — sem alterar o pagamento nem gerar cobrança nova. Pago 260, novo total 270, em
aberto **10**.

**2. Próximo pacote a iniciar** — o pacote em andamento fica **inteiro** no valor antigo, mesmo
tendo sessões depois da vigência. O sistema procura o próximo pacote cujo **início** seja igual ou
posterior à vigência. *"Não deverá considerar apenas o mês de vencimento ou as datas individuais
dos atendimentos. Deverá identificar a sequência e a data efetiva de início de cada pacote."*

**3. Pacotes já pagos** — se o pacote identificado já tem **pagamento lançado**, preserva e
procura o próximo **sem pagamento**.

**4 e 5. Preservação** — nada retroativo; a regra nova vale só para alterações feitas depois da
implementação.

## Triagem (feita antes de escrever código)

Rodei os **exemplos do próprio documento** no motor atual, antes de mexer em qualquer coisa:

| Cena | Esperado pelo doc | Motor atual |
|---|---|---|
| Antes do reajuste | 260 e 260 | 260 e 260 ✓ |
| Opção 1, vigência 01/09 | 270 e 280 | 270 e 280 ✓ |
| Opção 2, vigência 05/09 | 260 e 280 | 260 e 280 ✓ |
| Opção 1 com pacote pago | 270, em aberto 10 | 270, falta 10 ✓ |

Ou seja: **as opções 1 e 2, o recálculo e a preservação do histórico já estavam implementados**
(docs 69, 72 e 73). O documento confirma o desenho e trava os números.

**O que MUDOU:** a identificação do "próximo pacote".

- O doc 73 tinha lido *"o pacote que não tem nenhum status lançado"* e o critério virou **status**.
- O doc 74 é explícito: o pacote é identificado pela **data de início**, e o que o desqualifica é
  **pagamento lançado**. Um pacote com sessões já realizadas mas sem dinheiro lançado **ainda
  recebe** o valor novo.

Essa é a única mudança de comportamento desta leva, e ela vale só para reajustes salvos daqui
para a frente — nada retroativo (medido: 0 cobranças diferentes de 2.219).

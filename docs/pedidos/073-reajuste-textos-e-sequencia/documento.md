# Doc 73 — reajuste que mexia no passado, textos e sequência

Recebido em 01/11/2026 ("Documento sem título (15).pdf"). O PDF chegou pela conversa, não como
arquivo em disco — este texto é a transcrição. Documento seguinte ao [doc 72](../../..//HISTORICO.md).

## O que o dono escreveu

**1. Rótulo do motivo do crédito**

> alterar: `Motivo para o valor não entrar como crédito:`
> Por: `Motivo pelo qual o valor a mais não entrou como crédito`

**2. O reajuste "próximo pacote a iniciar" está mexendo no passado**

> Estou escolhendo a opção **Próximo pacote a iniciar** — "O pacote em andamento fica inteiro no
> valor antigo; o novo valor só vale quando um novo pacote começar." — vigência 01/08/2025.
> Porém todos os valores anteriores a esta data estão sendo alterados.
> Exemplo paciente Roberta (usuária ana). Preciso corrigir isso.
> Ao escolher pacote a iniciar, ele precisa verificar qual o pacote (sequência) não tem nenhum
> status lançado e corrigir a partir deste.

**3. Textos da pergunta do pacote**

> Substituir:
> **Sim:** A sessão será contabilizada como utilizada no pacote, avançando a numeração das sessões.
> **Não:** A sessão não será contabilizada como utilizada no pacote. A numeração das sessões
> seguintes será mantida, sem consumir uma sessão do pacote.
>
> Por:
> Sim: A sessão será abatida do pacote, avançando a numeração.
> Não: A sessão não será abatida, mantendo a numeração para o próximo atendimento.

**4. A janela "Alterar quais?"**

> Esta mensagem só deve aparecer se houver próximas sessões; se não houver, apenas realizar o
> salvamento da alteração sem exibir esta janela.

**5 e 6. Os textos do "Esta sessão será cobrada?"**

> No caso da escolha ser **não (GRAT)**, substituir "Fica fora do pacote: não muda a numeração, a
> contagem nem o valor da sequência." por: **"Acrescenta uma sessão extra gratuita"**.
>
> No caso da escolha ser **sim (AVUL)**, substituir o mesmo texto por: **"Acrescenta uma sessão
> avulsa ao pacote, cobrada separadamente."**

**7. Série com AVUL ou GRAT e "repetir até"**

> Ao salvar, deverá abrir uma janela:
>
> - **Não (grat):** "Deseja tornar gratuitas todas as sessões desta sequência ou apenas esta
>   sessão?" Todas → todas agendadas como GRAT. Apenas esta → só esta como GRAT, e as demais
>   iniciando/seguindo a sequência.
> - **Sim (avul):** "Deseja que todas as sessões desta sequência sejam agendadas como avulsas ou
>   apenas esta sessão?" Todas → todas AVUL com o valor definido. Apenas esta → só esta AVUL, e as
>   demais iniciando/seguindo a sequência.

**8. Cortesia com "repetir até"**

> "Deseja tornar todas as sessões desta sequência cortesia ou apenas esta sessão?"
> Todas → todas as sessões da sequência agendadas como GRAT. Apenas esta → esta como GRAT e o
> restante como AVUL.

## Triagem (feita antes de escrever código)

| # | Item | Situação |
|---|------|----------|
| 1 | Rótulo do motivo do crédito | **NOVO** — texto entregue no doc 72 (`GeralTab.tsx`) |
| 2 | Reajuste mexendo no passado | **NOVO** — dois defeitos distintos, medidos abaixo |
| 3 | Textos da pergunta do pacote | **NOVO** — `perguntaFalta.ts` |
| 4 | "Alterar quais?" sem próximas | **NOVO** — `AgendaClient.tsx` perguntava sempre |
| 5–6 | Textos AVUL/GRAT | **NOVO** — a mesma frase servia às duas respostas |
| 7–8 | Janelas da série | **NOVO** — não existe nada parecido hoje |

## O que a medição mostrou (item 2)

A Roberta tem duas faixas: R$ 50 desde 19/02/2025 e R$ 65 desde 01/08/2025 ("próximo pacote").
O pacote `pacote:inicio:0` é de **janeiro/2025** — anterior à primeira faixa —, está fechado e foi
**pago em R$ 200**. Ele aparecia valendo **R$ 260 = 4 × 65**.

São **dois defeitos** no mesmo sintoma:

1. **O cadastro respondia pelo passado.** Sem faixa que alcance a data, o motor caía na "reserva",
   que é `patients.session_fee` — o preço de HOJE. Todo reajuste reprecificava todo pacote anterior
   à primeira faixa, em qualquer formato. A diferença de R$ 60 inventada em janeiro virou arrasto e
   seguiu a paciente por **oito pacotes**.
2. **"Próximo pacote a iniciar" usava a data digitada**, e a data digitada pode ser retroativa.

Raio de explosão da correção: **8 cobranças de 2.189 na base real**, todas da Roberta, todas
correções — cada pacote fechado passou a valer exatamente o que foi pago, com falta zero.

## Estado

Documento FECHADO. Itens 1 a 6 no PR #539; itens 7 e 8 na leva seguinte.

Sobre 7 e 8, a decisão do dono ao liberar a segunda leva: **"sem alterar os dados do financeiro,
apenas da guia geral e agenda"**. A entrega respeita isso — a escolha decide com que marca cada
sessão NASCE (`therapy_sessions`), e nada é escrito em preço, histórico de preço ou pagamento.
Medido: **0 cobranças diferentes** de 2.208 na base real.

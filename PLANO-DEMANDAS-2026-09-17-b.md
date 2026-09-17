# Plano — segunda leva de 17/09 ("prints 5")

Quatro demandas. Duas são de dinheiro e vão com teste antes do código; duas são de navegação.

Antes do plano, o que a leitura do código mudou no diagnóstico — porque em dois casos a causa não é
a que o documento supõe, e isso muda o tamanho do conserto.

---

## D1 — 2x por semana vira UMA cobrança de 8 sessões

**O que o documento diz:** paciente atendido 2x/semana aparece com dois pagamentos de 4 sessões no
mês; deveria ser um de 8. A marcação passa de 1/4..4/4 para 1/8..8/8. Pede opção "2x na semana" no
cadastro e na repetição da agenda, perguntando o segundo dia/horário.

**A causa NÃO é "são dois agendamentos".** A numeração não sabe de que repetição cada sessão veio:
`posicoesDaSequencia` varre todas as sessões do paciente por data e fecha a sequência quando a
posição passa do total. O total é `TAMANHO_PADRAO = 4`, fixo para todo pacote que não seja
fragmentado. Oito sessões no mês viram duas sequências de quatro — viriam de uma repetição só,
daria no mesmo.

**Então o conserto é menor do que parece:** o tamanho da sequência precisa ser configurável também
no pacote completo. Tudo que vem depois — numeração 1/8 e valor 8 × sessão — já sai do mesmo
número. `patient_packages` já guarda tamanhos livres e já é lido nos quatro pontos que importam.

**E há um campo órfão:** `timesPerPeriod` já existe, já entende `2x_semana` na action do cadastro, e
**nenhum formulário o envia**. Hoje só a Previsão o lê. Capturar "2x na semana" é ressuscitar o que
já está lá, não inventar.

Fatias:
- **D1.1** tamanho de sequência valendo no completo (hoje ele é ignorado fora do fragmentado).
- **D1.2** capturar "2x na semana" no cadastro e na repetição da agenda, com o segundo dia/horário.
- **D1.3** `reajuste.ts` (`sessoesNoMes`, `valorDoMes`) ainda assume 4 no completo — passa a mentir
  quando 8 for válido.

## D2 — A quinzena é do calendário, e cada uma cobra o que caiu nela

**O que o documento diz:** primeira quinzena é do dia 01 ao 15, segunda do 16 ao fim, e cada uma
cobra as sessões que caem nela. Mês com 2 sessões, ambas na segunda → R$ 0,00 e R$ 230,00. Mês com
5 (2 + 3) → R$ 230,00 e R$ 345,00. **Não pode dividir o valor por 2.**

**Hoje a quinzena não é de calendário nem de sequência: não existe.** São duas linhas de 50% do
pacote, sem nenhum recorte por data — por isso a primeira vence 05/09 mesmo sem sessão nenhuma
naquela quinzena. É partir o valor no meio e escolher dois vencimentos.

**Bug latente que vem junto:** a tela Fechamento monta a cobrança sem passar `diaPagamento2`, então
lá as duas quinzenas caem no mesmo dia. Entra no mesmo PR.

O que precisa nascer: particionar as sessões da sequência por dia do mês, cobrar `valor da sessão ×
quantas caíram em cada quinzena, e decidir o caso da quinzena vazia — o exemplo do dono pede a linha
de R$ 0,00, então ela é emitida.

Testes que afirmam a regra velha e serão reescritos com o motivo no comentário: o describe
"quinzenal" em `cobrancas.test.ts` (três casos) e dois casos em `guiaGeral.test.ts`.

## D3 — Cadastrar prospect não é coisa de dashboard

Hoje o **único** caminho para cadastrar prospect é o link `abrir →` do painel Prospecção do
dashboard. Não há item de menu. O dono quer o caminho no menu ou um botão na tela de Pacientes, e o
dashboard ficando só com o relatório que já mostra.

(O formulário de paciente comum já cria prospect quando o status é "prospect" — são duas portas para
a mesma coisa, e vale dizer isso ao dono.)

## D4 — Relatório de pacientes: duas portas, uma tela

O item de menu "Relatório de pacientes" e o botão "Montar relatório" do dashboard abrem **a mesma
página**. Sai o item do menu; fica o do dashboard.

Cuidado para não confundir com "Relatórios" (financeiro), que é outra tela e fica.

---

## Ordem

1. **D4 + D3** juntas — as duas mexem no mesmo arquivo de navegação, e separá-las só cria conflito.
2. **D2** — dinheiro, teste antes do código.
3. **D1** — a maior, e depende de D2 estar de pé: um paciente 2x/semana quinzenal precisa que a
   partição por quinzena opere sobre as 8 sessões.

Cada uma fecha com CI verde, e o que é tela é verificado no navegador antes de eu dizer que está
pronto.

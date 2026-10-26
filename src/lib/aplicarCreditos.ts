import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { patientCredits, sessionPayments, therapySessions } from "@/db/schema";
import { geralDoPaciente } from "@/lib/geralDoPaciente";
import { aplicacoesDeCredito, type CobrancaAberta } from "@/lib/creditoPendente";

/**
 * LEVA O CRÉDITO QUE ESTÁ ESPERANDO PARA A PRÓXIMA SESSÃO QUE TEM O QUE PAGAR (doc 59).
 *
 * O crédito nasce quando uma sessão AVUL já paga vira GRAT e não há, naquele momento, sessão
 * seguinte para receber o dinheiro. Ele fica guardado. O documento pede que, assim que exista uma
 * sessão AVUL ou X/X em aberto, o valor vá para lá sozinho, "com os dados de pagamento" — e é
 * literal: a data, a forma e quem pagou são os do pagamento ORIGINAL, porque foi naquele dia que o
 * paciente pagou, não neste.
 *
 * Roda depois de qualquer mudança que possa criar esse lugar: uma sessão nova, uma falta desfeita,
 * um pagamento removido. É de propósito que ela seja chamada de vários pontos e não de um só: o
 * "momento em que passa a haver onde usar" não é um evento do app, é uma consequência de vários.
 *
 * Nada acontece quando não há crédito ou não há cobrança elegível — é o caso comum, e sai em uma
 * consulta.
 *
 * Uma aplicação por vez, recalculando. Um crédito pode se partir entre duas cobranças, e a parte
 * que sobra vira uma LINHA NOVA; calcular tudo de uma vez obrigaria a adivinhar o id dessa linha
 * antes de ela existir. Como o laço só gira enquanto há crédito e cobrança aberta, ele para sozinho
 * — e o teto é uma rede contra defeito meu, não uma regra de negócio.
 */
const TETO = 50;

export async function aplicarCreditosPendentes(userId: string, patientId: string): Promise<void> {
  for (let volta = 0; volta < TETO; volta++) {
    const creditos = await db
      .select({ id: patientCredits.id, valor: patientCredits.valor, origemPagamentoId: patientCredits.origemPagamentoId })
      .from(patientCredits)
      .where(and(
        eq(patientCredits.userId, userId),
        eq(patientCredits.patientId, patientId),
        isNull(patientCredits.consumidoEm),
        eq(patientCredits.naoAuto, false),
      ))
      .orderBy(asc(patientCredits.createdAt));
    if (!creditos.length) return;

    const geral = await geralDoPaciente(userId, patientId);
    if (!geral) return;

    const abertas: CobrancaAberta[] = geral.linhas.flatMap((l) => {
      if (l.tipo === "bloqueio") return [];
      const c = l.tipo === "sessao" ? l.cobranca : l;
      if (!c || c.situacao === "pago" || c.falta <= 0.005) return [];
      // A data ordena: na sessão é a do atendimento; na cobrança solta (pacote/quinzena), o
      // vencimento. Sem data não há como dizer qual vem antes, e a ordem é a regra.
      const data = l.tipo === "sessao" ? l.data : c.vencimento;
      if (!data) return [];
      return [{
        chave: c.chave,
        rotulo: l.tipo === "sessao" ? l.rotulo : null,
        tipo: c.tipoDeCobranca,
        falta: c.falta,
        sessaoId: l.tipo === "sessao" ? l.id : null,
        data: new Date(data),
      }];
    });

    const [aplicacao] = aplicacoesDeCredito(abertas, creditos.map((c) => ({
      id: c.id, valor: Number(c.valor) || 0, origemPagamentoId: c.origemPagamentoId,
    })));
    if (!aplicacao) return;

    /**
     * Os dados do pagamento de ORIGEM seguem junto — é o que o documento pede com todas as letras:
     * "preservando as datas e os valores registrados". O paciente pagou naquele dia.
     */
    const [origem] = aplicacao.origemPagamentoId
      ? await db.select({ data: sessionPayments.date, metodo: sessionPayments.method, pagoPor: sessionPayments.pagoPor, pagoPorCpf: sessionPayments.pagoPorCpf, chave: sessionPayments.cobrancaChave })
          .from(sessionPayments)
          .where(and(eq(sessionPayments.id, aplicacao.origemPagamentoId), eq(sessionPayments.userId, userId)))
          .limit(1)
      : [];

    /**
     * Entra como pagamento `kind="credito"` e SEM transação: não é dinheiro novo no caixa, é o
     * mesmo dinheiro de antes mudando de cobrança. A transação do pagamento original continua lá.
     */
    const [pgCredito] = await db.insert(sessionPayments).values({
      userId,
      patientId,
      sessionId: aplicacao.sessaoId,
      amount: aplicacao.valor.toFixed(2),
      date: origem?.data ?? new Date(),
      method: (origem?.metodo as "pix" | "card" | "cash" | "transfer" | "debito" | "credito" | "credito_2x" | "credito_3x") ?? "cash",
      status: "paid",
      pagoPor: origem?.pagoPor ?? null,
      pagoPorCpf: origem?.pagoPorCpf ?? null,
      cobrancaChave: aplicacao.chave,
      kind: "credito",
      linkedTransactionId: null,
    }).returning();

    // O crédito é marcado pelo que FOI USADO; o que sobrou vira uma linha nova, nunca uma segunda
    // sugestão do mesmo valor. É isto que o "não pode ser acumulativo" quer dizer na prática.
    await db.update(patientCredits)
      .set({ valor: aplicacao.valor.toFixed(2), consumidoEm: new Date(), consumidoPagamentoId: pgCredito.id })
      .where(and(eq(patientCredits.id, aplicacao.creditoId), eq(patientCredits.userId, userId)));
    if (aplicacao.sobra > 0.005) {
      await db.insert(patientCredits).values({
        userId, patientId, valor: aplicacao.sobra.toFixed(2), origemPagamentoId: aplicacao.origemPagamentoId,
      });
    }

    // E a sessão de ORIGEM troca a mensagem: deixa de prometer um abatimento que já aconteceu.
    const idDaOrigem = origem?.chave?.split(":")[1];
    if (idDaOrigem) {
      await db.update(therapySessions)
        .set({ creditoUsadoEm: aplicacao.dataDaSessao })
        .where(and(eq(therapySessions.id, idDaOrigem), eq(therapySessions.userId, userId)));
    }
  }
}

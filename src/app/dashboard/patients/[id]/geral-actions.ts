"use server";

import { and, asc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { auth } from "@/auth";
import { cobrancaEnvios, cobrancaVencimentos, financialAccounts, patientCredits, patients, sessionPayments, transactions } from "@/db/schema";
import { ensureSessionCategory } from "@/lib/categoriaSessoes";
import { creditoDisponivel, geralDoPaciente, hojeDeParede } from "@/lib/geralDoPaciente";
import { diaDoFormulario } from "@/lib/trocaDeFormato";
import { apenasCpf } from "@/lib/recibo";
import { parseMoedaBR } from "@/lib/money";
import { aplicarCreditoNoLancamento } from "@/lib/credito";

/**
 * "Lançar pagamento" da guia Geral: data, responsável, forma e VALOR.
 *
 * O valor passou a ser editável (doc 17): vem pré-preenchido com o que falta, mas a terapeuta pode
 * registrar um pagamento parcial (recebeu menos) ou a mais. O que ela NÃO controla é a cobrança a
 * que o pagamento se prende — essa é refeita aqui pelo mesmo motor da tela, e tem de existir para
 * ESTE paciente DESTE profissional (a chave é texto que qualquer um digita).
 *
 * - valor MENOR que o que falta → registra o parcial; a cobrança segue em aberto/atraso com a
 *   diferença à mostra (nunca "pago em parte").
 * - `quitarDiferenca` + valor menor → a cobrança é QUITADA mesmo faltando (diferença perdoada). O
 *   caixa guarda o valor realmente recebido; quem fecha a cobrança é a marca `quitaDiferenca`.
 * - valor MAIOR → registra o valor informado; a sobra vira crédito no saldo, como qualquer
 *   pagamento a mais.
 */

const METODOS = new Set(["pix", "card", "cash", "transfer", "debito", "credito"]);

export async function lancarPagamento(entrada: {
  patientId: string;
  cobrancaChave: string;
  data: string;
  pagoPor: string;
  pagoPorCpf?: string | null;
  metodo: string;
  valor?: string | null;
  quitarDiferenca?: boolean;
  /** Doc 36: o usuário pediu para guardar a sobra (pagou a mais) como crédito no saldo? */
  creditarExcedente?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sessão inválida." };
  const userId = session.user.id;

  const patientId = String(entrada?.patientId ?? "");
  const chave = String(entrada?.cobrancaChave ?? "").slice(0, 200);
  const metodo = String(entrada?.metodo ?? "");
  const pagoPor = String(entrada?.pagoPor ?? "").trim().slice(0, 120);
  // CPF é opcional por decisão do dono: quem paga nem sempre quer informar, e o recibo sai sem a
  // linha quando ele falta. Guardado só em dígitos (`apenasCpf`); a pontuação entra na hora de imprimir.
  const pagoPorCpf = apenasCpf(entrada?.pagoPorCpf);
  const dia = diaDoFormulario(entrada?.data);

  if (!/^[0-9a-f-]{36}$/i.test(patientId)) return { ok: false, error: "Paciente inválido." };
  if (!dia) return { ok: false, error: "Informe a data do pagamento." };
  if (!pagoPor) return { ok: false, error: "Informe quem pagou." };
  if (!METODOS.has(metodo)) return { ok: false, error: "Escolha a forma de pagamento." };

  const geral = await geralDoPaciente(userId, patientId);
  if (!geral) return { ok: false, error: "Paciente não encontrado." };

  const cobranca = geral.linhas
    .flatMap((l) => (l.tipo === "pagamento" ? [l] : l.tipo === "sessao" && l.cobranca ? [l.cobranca] : []))
    .find((c) => c.chave === chave);
  if (!cobranca) return { ok: false, error: "Cobrança não encontrada." };
  if (cobranca.situacao === "pago" || cobranca.falta <= 0) return { ok: false, error: "Esta cobrança já está paga." };

  const [paciente] = await db.select({ name: patients.name }).from(patients).where(eq(patients.id, patientId));

  // Valor: o que a pessoa digitou (pt-BR), caindo no que falta quando o campo vem vazio (retro-
  // compat com quem só confirma). Tem de ser um número positivo — zerar ou negativar não lança nada.
  const valorInformado = parseMoedaBR(entrada?.valor);
  const valorNum = valorInformado != null ? Number(valorInformado) : cobranca.falta;
  if (!(valorNum > 0)) return { ok: false, error: "Informe um valor maior que zero." };
  const amount = valorNum.toFixed(2);

  // Doc 36: crédito do saldo. O disponível abate automaticamente o que o dinheiro não cobrir; a
  // sobra de dinheiro vira crédito novo SE o usuário pediu. Regra pura em `aplicarCreditoNoLancamento`.
  const disponivel = await creditoDisponivel(userId, patientId);
  const { creditoAplicado, creditoNovo } = aplicarCreditoNoLancamento({
    falta: cobranca.falta, cashRecebido: valorNum, creditoDisponivel: disponivel,
    creditarExcedente: entrada?.creditarExcedente === true,
  });

  // Quitar a diferença só faz sentido quando AINDA falta depois do dinheiro + crédito aplicado.
  const quita = entrada?.quitarDiferenca === true && valorNum + creditoAplicado < cobranca.falta - 0.005;
  // Meio-dia: a coluna é hora de parede, e meio-dia não troca de dia em fuso nenhum do caminho.
  const date = new Date(`${entrada.data}T12:00:00`);

  // Todo pagamento PAGO entra no caixa — mesma regra do "Registrar pagamento".
  const categoryId = await ensureSessionCategory(userId);
  const account = await db.query.financialAccounts.findFirst({ where: eq(financialAccounts.userId, userId) });
  const [tx] = await db.insert(transactions).values({
    userId,
    accountId: account?.id ?? null,
    amount,
    type: "income",
    categoryId,
    description: `Sessão — ${paciente?.name ?? ""}`,
    date,
    source: "session_payment",
    method: metodo, // doc 49: forma (débito/crédito) vai para o caixa calcular o líquido
  }).returning();

  const [pgCash] = await db.insert(sessionPayments).values({
    userId,
    patientId,
    // Cobrança de UMA sessão: preenche o vínculo que a agenda usa para tirar o "pagamento atrasado".
    sessionId: /^(sessao|extra):[0-9a-f-]{36}$/i.test(chave) ? chave.split(":")[1] : null,
    amount,
    date,
    method: metodo as "pix" | "card" | "cash" | "transfer" | "debito" | "credito",
    status: "paid",
    pagoPorCpf,
    pagoPor,
    cobrancaChave: chave,
    quitaDiferenca: quita,
    linkedTransactionId: tx.id,
  }).returning();

  // CRÉDITO APLICADO: entra como um pagamento `kind="credito"` SEM transação (o dinheiro já entrou
  // quando houve a sobra; não é receita nova). Fecha a cobrança junto com o dinheiro. Depois marca
  // os créditos consumidos (FIFO, partindo a última linha se sobrar saldo nela).
  if (creditoAplicado > 0.005) {
    const [pgCredito] = await db.insert(sessionPayments).values({
      userId, patientId,
      sessionId: /^(sessao|extra):[0-9a-f-]{36}$/i.test(chave) ? chave.split(":")[1] : null,
      amount: creditoAplicado.toFixed(2), date, method: "cash", status: "paid",
      pagoPor, pagoPorCpf, cobrancaChave: chave, kind: "credito", linkedTransactionId: null,
    }).returning();

    let restante = creditoAplicado;
    const abertos = await db.select().from(patientCredits)
      .where(and(eq(patientCredits.userId, userId), eq(patientCredits.patientId, patientId), isNull(patientCredits.consumidoEm)))
      .orderBy(asc(patientCredits.createdAt));
    for (const c of abertos) {
      if (restante <= 0.005) break;
      const v = Number(c.valor) || 0;
      if (v <= restante + 0.005) {
        await db.update(patientCredits).set({ consumidoEm: date, consumidoPagamentoId: pgCredito.id }).where(eq(patientCredits.id, c.id));
        restante = Math.round((restante - v) * 100) / 100;
      } else {
        // Consome só uma PARTE desta linha: marca o pedaço consumido e devolve o resto ao saldo.
        await db.update(patientCredits).set({ valor: restante.toFixed(2), consumidoEm: date, consumidoPagamentoId: pgCredito.id }).where(eq(patientCredits.id, c.id));
        await db.insert(patientCredits).values({ userId, patientId, valor: (Math.round((v - restante) * 100) / 100).toFixed(2), origemPagamentoId: c.origemPagamentoId });
        restante = 0;
      }
    }
  }

  // CRÉDITO NOVO: a sobra de dinheiro que o usuário pediu para guardar.
  if (creditoNovo > 0.005) {
    await db.insert(patientCredits).values({ userId, patientId, valor: creditoNovo.toFixed(2), origemPagamentoId: pgCash.id });
  }

  revalidatePath(`/dashboard/patients/${patientId}`);
  revalidatePath("/dashboard/fechamento");
  revalidatePath("/dashboard/transactions");
  return { ok: true };
}

/**
 * DESFAZ um pagamento lancado.
 *
 * A dona pediu o par completo (18/09): *"ao remover essa data, o pagamento volta para Em aberto ou
 * Atrasado, conforme a data de vencimento"*. Sem isso, um lancamento errado ficava para sempre.
 *
 * Apaga tambem a transacao vinculada. Pagamento e transacao sao o MESMO fato contado em duas telas;
 * deixar a transacao para tras faria a guia Geral dizer "em aberto" enquanto o caixa segue com o
 * dinheiro — foi por esse caminho que o financeiro ja divergiu antes.
 *
 * O `userId` vai nas duas clausulas: id de pagamento de outro consultorio responde "nao encontrado"
 * em vez de apagar.
 */
export async function removerPagamento(
  entrada: { pagamentoId: string; patientId: string },
): Promise<{ ok: boolean; error?: string }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sessão inválida." };
  const userId = session.user.id;

  const pagamentoId = String(entrada?.pagamentoId ?? "");
  const patientId = String(entrada?.patientId ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(pagamentoId)) return { ok: false, error: "Pagamento inválido." };

  const [pagamento] = await db
    .select({ id: sessionPayments.id, linkedTransactionId: sessionPayments.linkedTransactionId })
    .from(sessionPayments)
    .where(and(eq(sessionPayments.id, pagamentoId), eq(sessionPayments.userId, userId), eq(sessionPayments.patientId, patientId)))
    .limit(1);
  if (!pagamento) return { ok: false, error: "Pagamento não encontrado." };

  if (pagamento.linkedTransactionId) {
    await db.delete(transactions)
      .where(and(eq(transactions.id, pagamento.linkedTransactionId), eq(transactions.userId, userId)));
  }
  await db.delete(sessionPayments)
    .where(and(eq(sessionPayments.id, pagamentoId), eq(sessionPayments.userId, userId)));

  // Doc 36: desfaz o efeito no saldo de crédito. (1) Crédito GERADO por este pagamento (sobra) e
  // ainda não usado some junto. (2) Crédito CONSUMIDO por este pagamento (quando se apaga o
  // lançamento de crédito) volta a ficar disponível.
  await db.delete(patientCredits)
    .where(and(eq(patientCredits.userId, userId), eq(patientCredits.origemPagamentoId, pagamentoId), isNull(patientCredits.consumidoEm)));
  await db.update(patientCredits).set({ consumidoEm: null, consumidoPagamentoId: null })
    .where(and(eq(patientCredits.userId, userId), eq(patientCredits.consumidoPagamentoId, pagamentoId)));

  revalidatePath(`/dashboard/patients/${patientId}`);
  revalidatePath("/dashboard/fechamento");
  revalidatePath("/dashboard/transactions");
  return { ok: true };
}

/** Valida a dupla paciente+cobrança para as ações de envio. Devolve o userId ou um erro. */
async function contexto(patientId: string, chave: string): Promise<{ userId: string } | { error: string }> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sessão inválida." };
  if (!/^[0-9a-f-]{36}$/i.test(patientId)) return { error: "Paciente inválido." };
  const userId = session.user.id;

  const geral = await geralDoPaciente(userId, patientId);
  if (!geral) return { error: "Paciente não encontrado." };
  const existe = geral.linhas
    .flatMap((l) => (l.tipo === "pagamento" ? [l.chave] : l.tipo === "sessao" && l.cobranca ? [l.cobranca.chave] : []))
    .includes(chave);
  if (!existe) return { error: "Cobrança não encontrada." };
  return { userId };
}

/**
 * Marca uma cobrança como ENVIADA ao paciente — o "hoje ela só mostra" da guia Geral (dono, 13/09).
 *
 * Nao envia nada: registra o FATO de que a terapeuta avisou o paciente daquela cobranca, com o
 * instante e quem avisou.
 *
 * CADA CHAMADA E UMA LINHA. Antes havia um indice unico por (usuario, paciente, cobranca) e o
 * segundo aviso SUBSTITUIA a data do primeiro — o documento de 17/09 pede o contrario: "manter o
 * historico de todos os envios, sem substituir os registros anteriores". Quem cobrou tres vezes
 * precisa ver as tres datas, senao nao da para saber se o paciente esta sendo lembrado ou ignorado.
 */
export async function registrarCobrancaEnviada(entrada: { patientId: string; cobrancaChave: string }): Promise<{ ok: boolean; error?: string }> {
  const patientId = String(entrada?.patientId ?? "");
  const chave = String(entrada?.cobrancaChave ?? "").slice(0, 200);
  const ctx = await contexto(patientId, chave);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const session = await auth();
  // O INSTANTE, nao o dia ao meio-dia: o documento pede a hora junto da data, e dois avisos no
  // mesmo dia tem de ser distinguiveis. Gravado como hora de parede (ver horaLocal.ts).
  const agora = new Date();
  const enviadaEm = new Date(Date.UTC(
    agora.getFullYear(), agora.getMonth(), agora.getDate(),
    agora.getHours(), agora.getMinutes(), agora.getSeconds(),
  ));

  await db.insert(cobrancaEnvios)
    .values({ userId: ctx.userId, patientId, cobrancaChave: chave, enviadaEm, enviadaPor: session?.user?.name ?? null });

  revalidatePath(`/dashboard/patients/${patientId}`);
  return { ok: true };
}

/** Apaga TODOS os avisos daquela cobranca (registrei por engano). */
export async function limparEnviosDaCobranca(entrada: { patientId: string; cobrancaChave: string }): Promise<{ ok: boolean; error?: string }> {
  const patientId = String(entrada?.patientId ?? "");
  const chave = String(entrada?.cobrancaChave ?? "").slice(0, 200);
  const ctx = await contexto(patientId, chave);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  await db.delete(cobrancaEnvios).where(
    and(eq(cobrancaEnvios.userId, ctx.userId), eq(cobrancaEnvios.patientId, patientId), eq(cobrancaEnvios.cobrancaChave, chave)),
  );

  revalidatePath(`/dashboard/patients/${patientId}`);
  return { ok: true };
}

/**
 * EDITA o vencimento de UMA cobrança (doc 31). A terapeuta troca o dia mostrado na guia Geral, sem
 * mexer no valor nem nas outras cobranças. Guarda um override por chave; o motor passa a usar a data
 * nova. Editar de novo substitui a mesma linha (índice único).
 *
 * SÓ enquanto o pagamento NÃO foi lançado — depois de pago não faz sentido remarcar o vencimento, e
 * o documento restringe a edição a esse caso.
 */
export async function editarVencimento(entrada: { patientId: string; cobrancaChave: string; data: string; proximasTambem?: boolean }): Promise<{ ok: boolean; error?: string }> {
  const patientId = String(entrada?.patientId ?? "");
  const chave = String(entrada?.cobrancaChave ?? "").slice(0, 200);
  const ctx = await contexto(patientId, chave);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  const dia = diaDoFormulario(entrada?.data);
  if (!dia) return { ok: false, error: "Informe a nova data de vencimento." };

  // A cobrança não pode ter pagamento lançado (regra do doc). Refaz a conta pelo mesmo motor da tela.
  const geral = await geralDoPaciente(ctx.userId, patientId);
  const cobranca = geral?.linhas
    .flatMap((l) => (l.tipo === "pagamento" ? [l] : l.tipo === "sessao" && l.cobranca ? [l.cobranca] : []))
    .find((c) => c.chave === chave);
  if (!cobranca) return { ok: false, error: "Cobrança não encontrada." };
  if (cobranca.pagamentos.length > 0) return { ok: false, error: "Esta cobrança já tem pagamento lançado — o vencimento não pode ser editado." };

  // Meio-dia hora de parede: não escorrega de dia em fuso nenhum do caminho (igual ao pagamento).
  const vencimento = new Date(`${entrada.data}T12:00:00`);
  const overrides: { chave: string; vencimento: Date }[] = [{ chave, vencimento }];

  // Doc 45: ao mudar o MÊS do vencimento, o dono pode aplicar às PRÓXIMAS parcelas também. Desloca o
  // mês de cada cobrança futura (sem pagamento) pelo mesmo delta, mantendo o dia e a progressão de ano.
  // Sem pagamento registrado, não mexe em cobrança já quitada.
  const anoMes = (iso: string | null | undefined) => { const m = iso ? String(iso).match(/^(\d{4})-(\d{2})/) : null; return m ? Number(m[1]) * 12 + (Number(m[2]) - 1) : null; };
  const atualAM = anoMes(cobranca.vencimento);
  const novoAM = Number(entrada.data.slice(0, 4)) * 12 + (Number(entrada.data.slice(5, 7)) - 1);
  const delta = atualAM != null ? novoAM - atualAM : 0;
  if (entrada.proximasTambem && delta !== 0) {
    const limite = cobranca.vencimento ? new Date(`${String(cobranca.vencimento).slice(0, 10)}T12:00:00`).getTime() : 0;
    const futuras = (geral?.linhas ?? [])
      .flatMap((l) => (l.tipo === "pagamento" ? [l] : []))
      .filter((c) => c.chave !== chave && c.pagamentos.length === 0 && c.vencimento && new Date(`${String(c.vencimento).slice(0, 10)}T12:00:00`).getTime() > limite);
    for (const f of futuras) {
      const d = new Date(`${String(f.vencimento).slice(0, 10)}T12:00:00`);
      const alvoMes = d.getMonth() + delta;
      const ultimo = new Date(d.getFullYear(), alvoMes + 1, 0).getDate();
      overrides.push({ chave: f.chave, vencimento: new Date(d.getFullYear(), alvoMes, Math.min(d.getDate(), ultimo), 12, 0, 0) });
    }
  }

  for (const o of overrides) {
    await db.insert(cobrancaVencimentos)
      .values({ userId: ctx.userId, patientId, cobrancaChave: o.chave, vencimento: o.vencimento })
      .onConflictDoUpdate({
        target: [cobrancaVencimentos.userId, cobrancaVencimentos.patientId, cobrancaVencimentos.cobrancaChave],
        set: { vencimento: o.vencimento, updatedAt: new Date() },
      });
  }

  revalidatePath(`/dashboard/patients/${patientId}`);
  return { ok: true };
}

/** DESFAZ a edição do vencimento: apaga o override, e o motor volta a calcular a data original (doc 31). */
export async function desfazerVencimento(entrada: { patientId: string; cobrancaChave: string }): Promise<{ ok: boolean; error?: string }> {
  const patientId = String(entrada?.patientId ?? "");
  const chave = String(entrada?.cobrancaChave ?? "").slice(0, 200);
  const ctx = await contexto(patientId, chave);
  if ("error" in ctx) return { ok: false, error: ctx.error };

  await db.delete(cobrancaVencimentos).where(
    and(eq(cobrancaVencimentos.userId, ctx.userId), eq(cobrancaVencimentos.patientId, patientId), eq(cobrancaVencimentos.cobrancaChave, chave)),
  );

  revalidatePath(`/dashboard/patients/${patientId}`);
  return { ok: true };
}

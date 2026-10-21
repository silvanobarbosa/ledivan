"use server";

import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { auth } from "@/auth";
import { therapySessions, sessoesPuladas, blockedSlots, sessionPayments, patients, patientPaymentFormatHistory } from "@/db/schema";
import { formatoNaData } from "@/lib/vigenciaDoFormato";
import { extraParaGravar } from "@/lib/sessaoExtra";
import {
  deslocamento,
  horarioOcupado,
  sessoesAlcancadas,
  type AlcanceDaExclusao,
} from "@/lib/editarAgendamento";
import { canalParaGravar, datasEPuladas, ehOnline, geraRepeticoes, horasAntesParaGravar, pedeLocal, segundoDiaValido } from "@/lib/agendamentoNovo";
import { podeReplanejar, sessoesDaSerieARemover } from "@/lib/replanejarRecorrencia";

/**
 * Editar e excluir agendamento, com o alcance que a pessoa escolheu.
 *
 * As duas travas que este arquivo existe para garantir:
 *
 * - **Nada atravessa para outro dono.** Toda leitura e toda escrita filtram pelo `userId` da
 *   sessão. Um id de agendamento é um `uuid` que qualquer um digita.
 * - **Nada duplica.** Mover é `UPDATE` da linha existente, nunca `INSERT` no destino mais `DELETE`
 *   na origem — o lote é explícito nisso, e a segunda forma deixa cópia para trás na primeira vez
 *   que algo falha no meio.
 */

type Resultado = { ok: boolean; error?: string; afetadas?: number };

const alcanceValido = (v: string): v is AlcanceDaExclusao =>
  v === "apenas_esta" || v === "mesmos_dias" || v === "todas";

/** Tudo que este terapeuta tem marcado dali para a frente — base do alcance e da checagem. */
async function agendaDaqui(userId: string, desde: Date) {
  return db
    .select({ id: therapySessions.id, date: therapySessions.date, patientId: therapySessions.patientId })
    .from(therapySessions)
    .where(and(eq(therapySessions.userId, userId), gte(therapySessions.date, desde)));
}

/**
 * Salva a edição de um agendamento.
 *
 * Quando a data muda e o alcance é "os próximos", as seguintes andam junto por DESLOCAMENTO: mover
 * de quarta para quinta empurra todas um dia, mantendo o intervalo. Copiar a data nova para todas
 * empilharia a série num único dia.
 */
export async function salvarEdicao(opts: {
  sessionId: string;
  alcance: string;
  date?: string;
  duration?: number;
  modality?: string;
  location?: string;
  confirmChannel?: string;
  confirmLeadHours?: string;
  /** Doc 52: a sessão entra ou não na sequência do pacote. "sim" | "nao" | undefined (não mexer). */
  naSequencia?: string;
  cobrada?: string;
  valorExtra?: string;
}): Promise<Resultado> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sessão inválida." };
  const userId = session.user.id;

  if (!alcanceValido(opts.alcance)) return { ok: false, error: "Alcance inválido." };

  const atual = await db.query.therapySessions.findFirst({
    where: and(eq(therapySessions.id, opts.sessionId), eq(therapySessions.userId, userId)),
  });
  if (!atual) return { ok: false, error: "Agendamento não encontrado." };

  const novaData = opts.date ? new Date(opts.date) : null;
  if (novaData && Number.isNaN(novaData.getTime())) return { ok: false, error: "Data inválida." };

  // O alcance sai de uma janela que começa na sessão atual: é o passado que não pode ser mexido.
  const daqui = await agendaDaqui(userId, atual.date);
  const alvos = sessoesAlcancadas({
    escolhida: { id: atual.id, data: atual.date, pacienteId: atual.patientId },
    todas: daqui.map((s) => ({ id: s.id, data: s.date, pacienteId: s.patientId })),
    alcance: opts.alcance,
  });

  const mudancas: Partial<typeof therapySessions.$inferInsert> = {};
  if (opts.duration && Number.isFinite(opts.duration)) mudancas.duration = Math.max(5, Math.floor(opts.duration));
  if (opts.modality) {
    mudancas.modality = opts.modality;
    mudancas.isOnline = ehOnline(opts.modality);
    mudancas.location = pedeLocal(opts.modality) ? (opts.location || atual.location || null) : null;
  }
  if (opts.confirmChannel !== undefined) {
    mudancas.confirmChannel = canalParaGravar(opts.confirmChannel);
    mudancas.confirmLeadHours = horasAntesParaGravar(opts.confirmChannel, opts.confirmLeadHours);
  }
  // Doc 36: editar "APENAS ESTE" movendo data/horário tira ESTA sessão do compasso da série — ela
  // continua na sequência (numeração/pacote/financeiro intactos), mas o espelho dela passa a valer
  // só na semana ANTERIOR. Só quando a data muda de fato; o alcance "apenas_esta" afeta uma sessão só.
  if (opts.alcance === "apenas_esta" && novaData && novaData.getTime() !== atual.date.getTime()) {
    mudancas.espelhoSoAnterior = true;
  }

  // Mudou a data: confere o destino ANTES de escrever qualquer coisa. Recusar depois de já ter
  // movido metade do bloco deixaria a agenda pela metade.
  const novas = novaData ? deslocamento({ de: atual.date, para: novaData, sessoes: daqui.filter((s) => alvos.includes(s.id)).map((s) => ({ id: s.id, data: s.date, pacienteId: s.patientId })) }) : [];
  for (const n of novas) {
    const ocupado = horarioOcupado({
      destino: n.data,
      todas: daqui.map((s) => ({ id: s.id, data: s.date, pacienteId: s.patientId })),
      ignorar: alvos,
    });
    if (ocupado) {
      return { ok: false, error: `Já existe agendamento em ${n.data.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}.` };
    }
  }

  /**
   * Doc 52: a sequência do pacote também pode ser decidida ao EDITAR, não só ao criar.
   *
   * Só vale para ESTA sessão, mesmo quando o alcance pega as próximas: "entra ou não na
   * sequência" é uma propriedade do agendamento avulso que foi encaixado, não do bloco. Aplicar
   * ao bloco inteiro transformaria uma correção pontual numa mudança financeira em série.
   *
   * O formato é o VIGENTE NA DATA da sessão, como no resto da agenda.
   */
  let extraDaSessao: { extra: "avul" | "grat" | null; valorExtra: string | null } | null = null;
  if (opts.naSequencia !== undefined) {
    const vigencias = await db
      .select({ formato: patientPaymentFormatHistory.formato, pacoteTipo: patientPaymentFormatHistory.pacoteTipo,
                desde: patientPaymentFormatHistory.dataEfetiva, criadoEm: patientPaymentFormatHistory.dataCriacao })
      .from(patientPaymentFormatHistory)
      .where(eq(patientPaymentFormatHistory.patientId, atual.patientId));
    const paciente = await db.query.patients.findFirst({ where: eq(patients.id, atual.patientId) });
    const formato = formatoNaData(vigencias, novaData ?? atual.date, {
      formato: paciente?.paymentFormat ?? "sessao", pacoteTipo: paciente?.pacoteTipo ?? null,
    }).formato;
    const r = extraParaGravar({
      formato, sessionKind: atual.sessionKind ?? undefined,
      naSequencia: opts.naSequencia, cobrada: opts.cobrada ?? null, valor: opts.valorExtra ?? null,
    });
    if (!r.ok) return { ok: false, error: r.error };
    extraDaSessao = { extra: r.extra, valorExtra: r.valorExtra };
  }

  const porId = new Map(novas.map((n) => [n.id, n.data]));
  for (const id of alvos) {
    const data = porId.get(id);
    // UPDATE da linha que já existe. Nunca apagar e recriar: o lote proíbe duplicar, e apagar e
    // recriar deixa cópia para trás na primeira vez que algo falha no meio.
    await db
      .update(therapySessions)
      .set(data ? { ...mudancas, date: data } : mudancas)
      .where(and(eq(therapySessions.id, id), eq(therapySessions.userId, userId)));
  }

  // A sequência é da sessão editada, nunca do bloco — ver o comentário acima.
  if (extraDaSessao) {
    await db.update(therapySessions)
      .set({ extra: extraDaSessao.extra, valorExtra: extraDaSessao.valorExtra })
      .where(and(eq(therapySessions.id, atual.id), eq(therapySessions.userId, userId)));
  }

  revalidatePath("/dashboard/agenda");
  revalidatePath(`/dashboard/patients/${atual.patientId}`);
  return { ok: true, afetadas: alvos.length };
}

/** Exclui o agendamento, com o alcance escolhido. */
export async function excluirAgendamento(sessionId: string, alcance: string): Promise<Resultado> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sessão inválida." };
  const userId = session.user.id;

  if (!alcanceValido(alcance)) return { ok: false, error: "Alcance inválido." };

  const atual = await db.query.therapySessions.findFirst({
    where: and(eq(therapySessions.id, sessionId), eq(therapySessions.userId, userId)),
  });
  if (!atual) return { ok: false, error: "Agendamento não encontrado." };

  const daqui = await agendaDaqui(userId, atual.date);
  const alvos = sessoesAlcancadas({
    escolhida: { id: atual.id, data: atual.date, pacienteId: atual.patientId },
    todas: daqui.map((s) => ({ id: s.id, data: s.date, pacienteId: s.patientId })),
    alcance,
  });

  // O `userId` no WHERE de novo: os ids vieram de uma consulta já filtrada, mas a defesa não custa
  // nada e é a única coisa entre um id trocado e a agenda de outra pessoa.
  await db.delete(therapySessions).where(and(eq(therapySessions.userId, userId), inArray(therapySessions.id, alvos)));

  // Excluir uma SÉRIE leva junto os marcadores de horário PULADO (Hor. Bloq.) dela: senão ficam
  // órfãos na lista de sessões do paciente, em Dados (doc 9, item 3). O BLOQUEIO em si (blockedSlots)
  // NÃO é tocado — o horário continua bloqueado; só o marcador que pendurava na série some. Numa
  // exclusão de uma sessão só ("apenas_esta") não há série para limpar.
  if (alcance !== "apenas_esta" && alvos.length) {
    const alvosSet = new Set(alvos);
    const datas = daqui.filter((s) => alvosSet.has(s.id)).map((s) => new Date(s.date).getTime());
    if (datas.length) {
      await db.delete(sessoesPuladas).where(and(
        eq(sessoesPuladas.userId, userId),
        eq(sessoesPuladas.patientId, atual.patientId),
        gte(sessoesPuladas.date, new Date(Math.min(...datas))),
      ));
    }
  }

  revalidatePath("/dashboard/agenda");
  revalidatePath(`/dashboard/patients/${atual.patientId}`);
  return { ok: true, afetadas: alvos.length };
}

/**
 * Replaneja a RECORRÊNCIA a partir desta sessão (doc 43).
 *
 * Só o futuro muda: as sessões já realizadas, faltas, canceladas, qualquer uma JÁ PAGA e os encaixes
 * avulsos ficam intactos (o planejador puro `sessoesDaSerieARemover` garante o alcance). As futuras da
 * MESMA série (agendadas, sem pagamento, daqui pra frente) saem e são recriadas com a nova frequência
 * até o novo limite, pulando horário bloqueado e os que já têm sessão (sem duplicar).
 *
 * Cobrança e pacote seguem automáticos — são DERIVADOS das sessões. Diferença de valor por causa da
 * nova frequência o profissional ajusta à mão no Financeiro, como o lote pediu.
 */
export async function reagendarRecorrencia(sessionId: string, opts: {
  freq: string;
  until: string;
  segundoDia?: number | null;
  segundoHorario?: string | null;
}): Promise<Resultado> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sessão inválida." };
  const userId = session.user.id;

  const atual = await db.query.therapySessions.findFirst({
    where: and(eq(therapySessions.id, sessionId), eq(therapySessions.userId, userId)),
  });
  if (!atual) return { ok: false, error: "Agendamento não encontrado." };

  // O anchor precisa poder ser recriado: futuro, recorrente, agendado e sem pagamento.
  const pagoAnchor = !!(await db.query.sessionPayments.findFirst({ where: and(eq(sessionPayments.userId, userId), eq(sessionPayments.sessionId, atual.id)) }));
  if (!podeReplanejar({ status: atual.status, recurring: atual.recurring, pago: pagoAnchor })) {
    return { ok: false, error: "Só dá para alterar a recorrência de uma sessão futura, recorrente e sem pagamento." };
  }

  if (!geraRepeticoes(opts.freq)) return { ok: false, error: "Esta repetição não gera agendamentos." };
  const until = new Date(opts.until);
  if (Number.isNaN(until.getTime())) return { ok: false, error: "Data limite inválida." };
  until.setHours(23, 59, 59, 999);
  if (until <= atual.date) return { ok: false, error: "Data limite deve ser depois desta sessão." };
  const segundoDia = opts.segundoDia == null ? null : Number(opts.segundoDia);
  const segundoHorario = opts.segundoHorario || null;
  if (!segundoDiaValido(opts.freq, segundoDia, segundoHorario, atual.date)) {
    return { ok: false, error: "Informe o segundo dia da semana e o horário. No mesmo dia, o horário tem de ser outro." };
  }

  // Futuras do paciente daqui pra frente, com info de pagamento.
  const futuras = await db
    .select({ id: therapySessions.id, date: therapySessions.date, status: therapySessions.status, recurring: therapySessions.recurring, recurrenceFreq: therapySessions.recurrenceFreq, recurrenceUntil: therapySessions.recurrenceUntil })
    .from(therapySessions)
    .where(and(eq(therapySessions.userId, userId), eq(therapySessions.patientId, atual.patientId), gte(therapySessions.date, atual.date)));
  const idsFuturas = futuras.map((s) => s.id);
  const pagosRows = idsFuturas.length
    ? await db.select({ sessionId: sessionPayments.sessionId }).from(sessionPayments).where(and(eq(sessionPayments.userId, userId), inArray(sessionPayments.sessionId, idsFuturas)))
    : [];
  const pagos = new Set(pagosRows.map((r) => r.sessionId));
  const existentes = futuras.map((s) => ({ id: s.id, data: s.date, status: s.status, recurring: s.recurring, pago: pagos.has(s.id), recurrenceFreq: s.recurrenceFreq, recurrenceUntil: s.recurrenceUntil }));

  const removiveis = sessoesDaSerieARemover({
    anchor: { data: atual.date, recurrenceFreq: atual.recurrenceFreq, recurrenceUntil: atual.recurrenceUntil },
    existentes,
  });
  if (!removiveis.includes(atual.id)) {
    return { ok: false, error: "Não consegui identificar a série desta sessão." };
  }

  // Geração nova: pula horário bloqueado e os que JÁ TÊM sessão (as mantidas), sem duplicar.
  const removSet = new Set(removiveis);
  const mantidasTimes = new Set(futuras.filter((s) => !removSet.has(s.id)).map((s) => new Date(s.date).getTime()));
  const bloqueios = await db.select({ date: blockedSlots.date }).from(blockedSlots).where(and(eq(blockedSlots.userId, userId), gte(blockedSlots.date, atual.date), lte(blockedSlots.date, until)));
  const bloqueadoTimes = new Set(bloqueios.map((b) => new Date(b.date).getTime()));

  const freqGravada = opts.freq === "quinzenal" ? "quinzenal" : "semanal";
  const { datas, puladas } = datasEPuladas({
    primeira: atual.date, limite: until, freq: opts.freq, segundoDia, segundoHorario,
    bloqueado: (quando) => bloqueadoTimes.has(quando.getTime()),
    ocupado: (quando) => mantidasTimes.has(quando.getTime()),
  });
  if (!datas.length) return { ok: false, error: "Todas as datas dessa repetição caem em horário bloqueado ou já ocupado." };

  const patient = await db.query.patients.findFirst({ where: and(eq(patients.id, atual.patientId), eq(patients.userId, userId)) });
  const fee = patient?.sessionFee ?? atual.fee;

  // Apaga as futuras da série e recria. Delete antes do insert: as datas antigas podem coincidir com
  // as novas, e o insert cairia no índice/duplicidade se as antigas ainda estivessem lá.
  await db.delete(therapySessions).where(and(eq(therapySessions.userId, userId), inArray(therapySessions.id, removiveis)));
  // Marcadores de "Hor. Bloq." órfãos da série, daqui pra frente, saem junto.
  await db.delete(sessoesPuladas).where(and(eq(sessoesPuladas.userId, userId), eq(sessoesPuladas.patientId, atual.patientId), gte(sessoesPuladas.date, atual.date)));

  const rows: typeof therapySessions.$inferInsert[] = datas.map((quando) => ({
    userId, patientId: atual.patientId, date: quando, duration: atual.duration, fee,
    status: "agendada" as const, chargeable: atual.chargeable, isOnline: atual.isOnline, location: atual.location,
    modality: atual.modality, confirmChannel: atual.confirmChannel, confirmLeadHours: atual.confirmLeadHours,
    pendingConfirmation: true, recurring: true, recurrenceFreq: freqGravada, recurrenceUntil: until,
    sessionKind: atual.sessionKind, extra: atual.extra, valorExtra: atual.valorExtra,
  }));
  await db.insert(therapySessions).values(rows);
  if (puladas.length) await db.insert(sessoesPuladas).values(puladas.map((date) => ({ userId, patientId: atual.patientId, date })));

  // O ritmo semanal manda no tamanho do pacote (18/09): 2x fecha em oito, 1x em quatro.
  if (opts.freq === "semanal" || opts.freq === "semanal2x") {
    await db.update(patients).set({ frequency: "semanal", timesPerPeriod: opts.freq === "semanal2x" ? 2 : 1 }).where(and(eq(patients.id, atual.patientId), eq(patients.userId, userId)));
  }

  revalidatePath("/dashboard/agenda");
  revalidatePath(`/dashboard/patients/${atual.patientId}`);
  revalidatePath("/dashboard");
  return { ok: true, afetadas: rows.length };
}

/** Quantas sessões cada alcance pegaria — a janela mostra isso antes de a pessoa confirmar. */
export async function contarAlcance(sessionId: string): Promise<{ mesmosDias: number; todas: number }> {
  const session = await auth();
  if (!session?.user?.id) return { mesmosDias: 0, todas: 0 };
  const userId = session.user.id;

  const atual = await db.query.therapySessions.findFirst({
    where: and(eq(therapySessions.id, sessionId), eq(therapySessions.userId, userId)),
  });
  if (!atual) return { mesmosDias: 0, todas: 0 };

  const daqui = (await agendaDaqui(userId, atual.date)).map((s) => ({ id: s.id, data: s.date, pacienteId: s.patientId }));
  const escolhida = { id: atual.id, data: atual.date, pacienteId: atual.patientId };
  return {
    mesmosDias: sessoesAlcancadas({ escolhida, todas: daqui, alcance: "mesmos_dias" }).length,
    todas: sessoesAlcancadas({ escolhida, todas: daqui, alcance: "todas" }).length,
  };
}

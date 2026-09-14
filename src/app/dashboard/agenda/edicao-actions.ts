"use server";

import { and, eq, gte, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { auth } from "@/auth";
import { therapySessions } from "@/db/schema";
import {
  deslocamento,
  horarioOcupado,
  sessoesAlcancadas,
  type AlcanceDaExclusao,
} from "@/lib/editarAgendamento";
import { canalParaGravar, ehOnline, horasAntesParaGravar, pedeLocal } from "@/lib/agendamentoNovo";

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

  revalidatePath("/dashboard/agenda");
  revalidatePath(`/dashboard/patients/${atual.patientId}`);
  return { ok: true, afetadas: alvos.length };
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

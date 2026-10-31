"use server";

import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { auth } from "@/auth";
import { blockedSlots, therapySessions, sessoesPuladas } from "@/db/schema";
import { remanejamento } from "@/lib/remanejamento";
import { datasDaRepeticao, emRotulo, horariosLivres, notaParaGravar } from "@/lib/bloqueioDeHorario";

/**
 * Bloquear e desbloquear horário.
 *
 * Tudo aqui é por dono: nenhuma consulta sai sem o `user_id` da sessão, e nenhum id vindo da tela é
 * usado sem conferir que pertence a quem está pedindo. Um id de bloqueio é um `uuid` que qualquer
 * um pode digitar; sem a conferência, apagar o bloqueio de outra terapeuta seria trocar um número
 * na requisição.
 */

type Resultado = { ok: boolean; error?: string };

/** Desbloquear pode revelar series que pularam aquela data. A tela pergunta antes de remanejar. */
type ResultadoDeDesbloqueio = Resultado & {
  /** Quantas sessões ficaram esperando aquele horário. Zero = nada a perguntar. */
  puladas?: number;
};

const diaInteiro = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number);
  if (!a || !m || !d) return null;
  // Montar com `new Date(texto)` cairia em UTC e poderia voltar um dia em fuso negativo.
  return { inicio: new Date(a, m - 1, d, 0, 0, 0, 0), fim: new Date(a, m - 1, d + 1, 0, 0, 0, 0) };
};

/**
 * O MESMO DIA, em hora de PAREDE — que é o que as colunas guardam.
 *
 * A coluna é `timestamp` sem fuso, e o Drizzle monta a data lendo-a como UTC (ver `lib/horaLocal`).
 * Comparar com um limite montado em hora local acerta na Vercel, onde o processo roda em UTC, e
 * erra em qualquer outro fuso — três horas de deslocamento, calado.
 */
const diaDeParede = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number);
  if (!a || !m || !d) return null;
  return { inicio: new Date(Date.UTC(a, m - 1, d)), fim: new Date(Date.UTC(a, m - 1, d + 1)) };
};

/**
 * Os horários daquele dia que não têm nada marcado — nem paciente, nem bloqueio anterior.
 *
 * É o que a janela oferece para marcar. Devolve também o que já está bloqueado, para a mesma janela
 * conseguir desbloquear sem uma segunda ida ao servidor.
 */
export async function horariosDoDia(dataISO: string): Promise<{
  livres: { inicio: number; rotulo: string }[];
  bloqueados: { id: string; rotulo: string; note: string | null }[];
}> {
  const session = await auth();
  if (!session?.user?.id) return { livres: [], bloqueados: [] };

  const dia = diaDeParede(dataISO);
  if (!dia) return { livres: [], bloqueados: [] };

  const [sessoes, bloqueios] = await Promise.all([
    db
      .select({ date: therapySessions.date, duration: therapySessions.duration })
      .from(therapySessions)
      .where(and(eq(therapySessions.userId, session.user.id), gte(therapySessions.date, dia.inicio), lt(therapySessions.date, dia.fim))),
    db
      .select({ id: blockedSlots.id, date: blockedSlots.date, duration: blockedSlots.duration, note: blockedSlots.note })
      .from(blockedSlots)
      .where(and(eq(blockedSlots.userId, session.user.id), gte(blockedSlots.date, dia.inicio), lt(blockedSlots.date, dia.fim))),
  ]);

  // Hora de parede: ela mora nos campos UTC do objeto que o Drizzle monta.
  const emMinutos = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();

  return {
    livres: horariosLivres({
      ocupados: [
        ...sessoes.map((s) => ({ inicio: emMinutos(s.date), duracao: s.duration })),
        ...bloqueios.map((b) => ({ inicio: emMinutos(b.date), duracao: b.duration })),
      ],
      primeiraHora: 6,
      ultimaHora: 21,
    }),
    bloqueados: bloqueios
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .map((b) => ({ id: b.id, rotulo: emRotulo(emMinutos(b.date)), note: b.note })),
  };
}

/**
 * Bloqueia os horários marcados, cada um com o seu texto.
 *
 * Com "repetir até", o mesmo conjunto de horários é bloqueado no MESMO dia da semana, de sete em
 * sete dias, até o limite (doc 69). Nas semanas seguintes a grade não é a mesma de hoje: o que já
 * tem paciente ou já está bloqueado é PULADO, nunca sobrescrito — bloquear em cima de um
 * atendimento marcado seria esconder o paciente atrás de uma célula preta. Quantos foram pulados
 * volta para a tela dizer.
 */
export async function bloquearHorarios(
  dataISO: string,
  horarios: { inicio: number; nota?: string | null }[],
  repetirAteISO?: string | null,
): Promise<Resultado & { bloqueados?: number; pulados?: number }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sessão inválida." };
  const userId = session.user.id;

  const dia = diaInteiro(dataISO);
  if (!dia) return { ok: false, error: "Data inválida." };

  // Teto de um dia inteiro de grade: a tela não oferece mais do que isso, e um número maior só
  // chegaria aqui por requisição forjada.
  const limpos = (Array.isArray(horarios) ? horarios : [])
    .filter((h) => Number.isFinite(h?.inicio) && h.inicio >= 0 && h.inicio < 24 * 60)
    .slice(0, 48);

  if (limpos.length === 0) return { ok: false, error: "Escolha ao menos um horário." };

  const ate = repetirAteISO ? diaInteiro(repetirAteISO) : null;
  const datas = datasDaRepeticao(dia.inicio, ate?.inicio ?? null);

  /**
   * A HORA DE PAREDE MORA NOS CAMPOS UTC — medido aqui, custou um percurso.
   *
   * A coluna é `timestamp` sem fuso e guarda hora de parede; o Drizzle com `neon-http` lê "14:00"
   * e monta a data como 14:00**Z**. Em produção o processo roda em UTC e `getHours()` devolve a
   * hora certa por coincidência — em qualquer outro fuso ele devolve a hora deslocada, e a
   * conferência de choque passa a comparar 11h com 14h e não encontra nada. Ver `lib/horaLocal`.
   *
   * Então lemos e escrevemos pelos campos UTC: a resposta fica igual em qualquer fuso de servidor.
   */
  const emMinutosDeParede = (d: Date) => d.getUTCHours() * 60 + d.getUTCMinutes();
  const paredeEm = (base: Date, minutos = 0) =>
    new Date(Date.UTC(base.getFullYear(), base.getMonth(), base.getDate(), Math.floor(minutos / 60), minutos % 60, 0, 0));
  const inicioDaJanela = paredeEm(datas[0]);
  const fimDaJanela = new Date(paredeEm(datas[datas.length - 1]).getTime() + 24 * 60 * 60 * 1000);

  // O que já ocupa a janela inteira. Uma consulta só: uma por semana seria o mesmo trabalho em
  // dezenas de idas ao banco.
  const [sessoes, bloqueios] = await Promise.all([
    db
      .select({ date: therapySessions.date, duration: therapySessions.duration })
      .from(therapySessions)
      .where(and(eq(therapySessions.userId, userId), gte(therapySessions.date, inicioDaJanela), lt(therapySessions.date, fimDaJanela))),
    db
      .select({ date: blockedSlots.date, duration: blockedSlots.duration })
      .from(blockedSlots)
      .where(and(eq(blockedSlots.userId, userId), gte(blockedSlots.date, inicioDaJanela), lt(blockedSlots.date, fimDaJanela))),
  ]);

  const chaveDoDia = (d: Date) => `${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}`;
  const ocupadosPorDia = new Map<string, { de: number; ate: number }[]>();
  for (const o of [...sessoes, ...bloqueios]) {
    const inicio = emMinutosDeParede(o.date);
    const chave = chaveDoDia(o.date);
    const lista = ocupadosPorDia.get(chave) ?? [];
    lista.push({ de: inicio, ate: inicio + Math.max(1, o.duration) });
    ocupadosPorDia.set(chave, lista);
  }

  const aGravar: { userId: string; date: Date; duration: number; note: string | null }[] = [];
  let pulados = 0;
  for (const data of datas) {
    const chave = chaveDoDia(paredeEm(data));
    const ocupados = ocupadosPorDia.get(chave) ?? [];
    for (const h of limpos) {
      const fim = h.inicio + 60;
      if (ocupados.some((o) => h.inicio < o.ate && o.de < fim)) {
        pulados++;
        continue;
      }
      // Dois horários iguais na mesma repetição não existem, mas o que acabou de entrar na lista
      // passa a ocupar o dia — senão a conferência olharia só o banco de antes.
      ocupados.push({ de: h.inicio, ate: fim });
      aGravar.push({ userId, date: paredeEm(data, h.inicio), duration: 60, note: notaParaGravar(h.nota) });
    }
    ocupadosPorDia.set(chave, ocupados);
  }

  if (aGravar.length === 0) return { ok: false, error: "Esses horários já estão ocupados." };
  await db.insert(blockedSlots).values(aGravar);

  revalidatePath("/dashboard/agenda");
  return { ok: true, bloqueados: aGravar.length, pulados };
}

/** Desbloqueia. Só apaga o que é de quem pediu. */
export async function desbloquearHorarios(ids: string[]): Promise<ResultadoDeDesbloqueio> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sessão inválida." };
  const userId = session.user.id;

  const limpos = (Array.isArray(ids) ? ids : []).filter((id) => typeof id === "string" && id.length > 0).slice(0, 48);
  if (limpos.length === 0) return { ok: false, error: "Escolha ao menos um horário." };

  // As datas ANTES de apagar: depois nao ha como saber quais horarios foram liberados.
  const alvos = await db
    .select({ date: blockedSlots.date })
    .from(blockedSlots)
    .where(and(eq(blockedSlots.userId, userId), inArray(blockedSlots.id, limpos)));

  // O `user_id` no WHERE é o que impede apagar o bloqueio de outra terapeuta trocando um id.
  await db.delete(blockedSlots).where(and(eq(blockedSlots.userId, userId), inArray(blockedSlots.id, limpos)));

  /**
   * Alguma serie pulou essas datas? (dona, 18 e 19/09)
   *
   * Se sim, a tela pergunta "Remanejar a agenda?" — o remanejamento nao acontece sozinho, porque
   * mover sessao de paciente e coisa que ela precisa querer. So contamos aqui; quem move e a acao
   * `remanejarAgenda`.
   */
  const datas = alvos.map((a) => a.date);
  const puladas = datas.length
    ? await db
        .select({ id: sessoesPuladas.id })
        .from(sessoesPuladas)
        .where(and(eq(sessoesPuladas.userId, userId), inArray(sessoesPuladas.date, datas)))
    : [];

  revalidatePath("/dashboard/agenda");
  return { ok: true, puladas: puladas.length };
}

/**
 * REMANEJA a agenda depois de um desbloqueio, se a terapeuta confirmar.
 *
 * Roda por PACIENTE e por VAGA: cada data liberada que alguma serie tinha pulado devolve a
 * sequencia para la, em cascata (ver `lib/remanejamento`). A falta registrada some junto — ela
 * existia so para a guia Geral poder dizer "Hor. Bloq." naquela linha.
 *
 * Nao move sessao que ja teve desfecho, e nao move para cima de horario ainda bloqueado: as vagas
 * consideradas sao justamente as que acabaram de ser liberadas.
 */
export async function remanejarAgenda(): Promise<Resultado & { movidas?: number }> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "Sessão inv\u00e1lida." };
  const userId = session.user.id;

  // Faltas registradas cujo bloqueio nao existe mais = vagas abertas esperando a sequencia voltar.
  const pendentes = await db
    .select({ id: sessoesPuladas.id, patientId: sessoesPuladas.patientId, date: sessoesPuladas.date })
    .from(sessoesPuladas)
    .where(eq(sessoesPuladas.userId, userId));
  if (!pendentes.length) return { ok: true, movidas: 0 };

  const aindaBloqueadas = new Set(
    (await db.select({ date: blockedSlots.date }).from(blockedSlots).where(eq(blockedSlots.userId, userId)))
      .map((b) => new Date(b.date).getTime()),
  );
  const vagas = pendentes.filter((p) => !aindaBloqueadas.has(new Date(p.date).getTime()));
  if (!vagas.length) return { ok: true, movidas: 0 };

  let movidas = 0;
  // Da mais antiga para a mais nova: remanejar de tras para frente embaralharia a cascata.
  for (const vaga of vagas.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())) {
    const doPaciente = await db
      .select({ id: therapySessions.id, date: therapySessions.date, status: therapySessions.status })
      .from(therapySessions)
      .where(and(eq(therapySessions.userId, userId), eq(therapySessions.patientId, vaga.patientId)));

    for (const m of remanejamento(new Date(vaga.date), doPaciente)) {
      await db.update(therapySessions)
        .set({ date: m.para })
        .where(and(eq(therapySessions.id, m.id), eq(therapySessions.userId, userId)));
      movidas++;
    }
    await db.delete(sessoesPuladas).where(and(eq(sessoesPuladas.id, vaga.id), eq(sessoesPuladas.userId, userId)));
    revalidatePath(`/dashboard/patients/${vaga.patientId}`);
  }

  revalidatePath("/dashboard/agenda");
  return { ok: true, movidas };
}

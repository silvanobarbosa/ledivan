/**
 * LEMBRAR AGENDAMENTO: quem atende uma vez por mês e ainda não marcou o mês que vem.
 *
 * Nasce de uma decisão das beta testers na fatia do agendamento mensal. O mensal **não gera** as
 * sessões seguintes: quem atende uma vez por mês combina a data na própria sessão, e uma agenda
 * cheia de datas presumidas atrapalha mais do que ajuda. Mas sem gerar nada, o paciente
 * simplesmente sumiria da vista até alguém lembrar dele — e é exatamente o que acontece na prática
 * com paciente de baixa frequência.
 *
 * A lista é o contrapeso: no fim do mês ela junta quem é mensal e ainda não tem data marcada para o
 * mês seguinte. Assim que a data é marcada, a pessoa sai da lista sozinha — não há nada para
 * "concluir", e por isso não há nada que alguém possa esquecer de concluir.
 *
 * Ela aparece nos ÚLTIMOS TRÊS DIAS do mês. Antes disso seria barulho: ainda há mês pela frente e
 * a conversa sobre a próxima data costuma acontecer na sessão. Depois disso é tarde.
 */

/** Quantos dias antes do fim do mês a lista começa a aparecer. */
export const DIAS_ANTES_DO_FIM = 3;

export type PacienteMensal = {
  id: string;
  nome: string;
  /** A última sessão conhecida dele, para a lista dizer desde quando ele está sem data. */
  ultimaSessao?: Date | string | null;
};

export type SessaoMarcada = {
  pacienteId: string;
  data: Date | string;
};

const emData = (d: Date | string): Date => (d instanceof Date ? d : new Date(d));

/** O último dia do mês de uma data. */
export function ultimoDiaDoMes(hoje: Date): number {
  return new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
}

/**
 * A lista aparece hoje?
 *
 * Nos últimos três dias do mês, o último inclusive. Em fevereiro isso é 26, 27 e 28 (ou 29); em
 * março, 29, 30 e 31 — a conta sai do mês, e não de um número fixo.
 */
export function apareceHoje(hoje: Date = new Date()): boolean {
  const ultimo = ultimoDiaDoMes(hoje);
  return hoje.getDate() > ultimo - DIAS_ANTES_DO_FIM;
}

/** O primeiro e o último instante do mês SEGUINTE ao de `hoje`. */
export function mesQueVem(hoje: Date = new Date()): { inicio: Date; fim: Date } {
  const inicio = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 1, 0, 0, 0, 0);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth() + 2, 0, 23, 59, 59, 999);
  return { inicio, fim };
}

export type ALembrar = {
  id: string;
  nome: string;
  /** Há quantos dias foi a última sessão dele. Nulo quando não se sabe. */
  diasSemSessao: number | null;
};

/**
 * Quem entra na lista: mensal SEM data marcada no mês que vem.
 *
 * Quem já marcou não aparece, e é por isso que a lista se esvazia sozinha à medida que a pessoa
 * trabalha. Uma lista que exige ser marcada como concluída é uma lista que fica desatualizada.
 */
export function pacientesALembrar(opts: {
  mensais: PacienteMensal[];
  /** Todas as sessões futuras conhecidas. Basta as do mês que vem, mas aceita mais. */
  sessoes: SessaoMarcada[];
  hoje?: Date;
}): ALembrar[] {
  const hoje = opts.hoje ?? new Date();
  const { inicio, fim } = mesQueVem(hoje);

  const jaMarcou = new Set(
    opts.sessoes
      .map((s) => ({ id: s.pacienteId, data: emData(s.data) }))
      .filter((s) => !Number.isNaN(s.data.getTime()))
      .filter((s) => s.data >= inicio && s.data <= fim)
      .map((s) => s.id),
  );

  return opts.mensais
    .filter((p) => !jaMarcou.has(p.id))
    .map((p) => {
      const ultima = p.ultimaSessao ? emData(p.ultimaSessao) : null;
      const dias =
        ultima && !Number.isNaN(ultima.getTime())
          ? Math.max(0, Math.floor((hoje.getTime() - ultima.getTime()) / 86400000))
          : null;
      return { id: p.id, nome: p.nome, diasSemSessao: dias };
    })
    // Quem está há mais tempo sem sessão primeiro: é de quem se esquece mais fácil.
    .sort((a, b) => (b.diasSemSessao ?? -1) - (a.diasSemSessao ?? -1) || a.nome.localeCompare(b.nome, "pt-BR"));
}

/** O modelo de mensagem, com o primeiro nome no lugar de `{nome}`. */
export const MODELO_PADRAO_DO_LEMBRETE =
  "Oi {nome}! Vamos marcar nosso próximo encontro? Me diga os dias e horários que ficam melhores para você.";

export function mensagemPara(modelo: string, nome: string): string {
  const primeiro = (nome ?? "").trim().split(/\s+/)[0] ?? "";
  return (modelo || MODELO_PADRAO_DO_LEMBRETE).replace(/\{nome\}/g, primeiro);
}

/**
 * BLOQUEAR UM HORÁRIO.
 *
 * A agenda até agora só sabia dizer que um horário estava ocupado por um PACIENTE. Mas a maior
 * parte do que tira um horário do ar não é paciente: é supervisão, curso, consulta médica, a
 * viagem de sexta. Sem um jeito de marcar isso, a pessoa ou deixava o buraco aberto e arriscava
 * marcar em cima, ou criava um paciente falso — que é o que se faz quando a ferramenta não ajuda,
 * e que depois contamina relatório, contagem de pacote e fechamento.
 *
 * O bloqueio mora numa tabela PRÓPRIA, separada das sessões. Não é preciosismo: se ele fosse uma
 * sessão com um nome especial, teria que ser excluído à mão de toda contagem — do pacote, do
 * fechamento, do risco de falta, da previsão — e bastaria alguém esquecer uma para o bloqueio
 * virar dinheiro. Separado, ele não tem como vazar para lugar nenhum.
 */

export type HorarioLivre = {
  /** Minutos desde a meia-noite. */
  inicio: number;
  /** "08:00", como aparece na caixa de seleção. */
  rotulo: string;
};

export type OcupacaoDoDia = {
  inicio: number;
  duracao: number;
};

const dois = (n: number) => String(n).padStart(2, "0");

export const emRotulo = (minutos: number): string => `${dois(Math.floor(minutos / 60))}:${dois(minutos % 60)}`;

/**
 * Os horários da grade daquele dia que NÃO têm nada marcado.
 *
 * São os que a janela de bloqueio oferece. Um horário já ocupado não aparece: bloquear em cima de
 * um paciente não é uma coisa que alguém queira fazer sem perceber, e oferecer a opção seria
 * convidar ao engano.
 *
 * Um horário conta como ocupado quando QUALQUER parte dele encosta num compromisso — a sessão das
 * 8h30 que dura uma hora atravessa as 9h, e as 9h não estão livres.
 */
export function horariosLivres(opts: {
  ocupados: OcupacaoDoDia[];
  /** A primeira e a última hora da grade. */
  primeiraHora: number;
  ultimaHora: number;
  /** De quanto em quanto tempo a grade oferece horário. Padrão: de hora em hora. */
  passoMinutos?: number;
  /** Quanto dura um bloqueio. Padrão: uma hora. */
  duracaoMinutos?: number;
}): HorarioLivre[] {
  const passo = Math.max(5, Math.floor(opts.passoMinutos ?? 60));
  const duracao = Math.max(5, Math.floor(opts.duracaoMinutos ?? 60));

  const ocupados = opts.ocupados
    .filter((o) => Number.isFinite(o.inicio) && Number.isFinite(o.duracao))
    .map((o) => ({ de: o.inicio, ate: o.inicio + Math.max(1, o.duracao) }));

  const livres: HorarioLivre[] = [];
  for (let m = opts.primeiraHora * 60; m < opts.ultimaHora * 60; m += passo) {
    const fim = m + duracao;
    const encosta = ocupados.some((o) => m < o.ate && o.de < fim);
    if (!encosta) livres.push({ inicio: m, rotulo: emRotulo(m) });
  }
  return livres;
}

/** O texto padrão quando a pessoa bloqueia sem escrever nada. */
export const TEXTO_PADRAO_DO_BLOQUEIO = "HORÁRIO BLOQUEADO";

/**
 * O que a célula preta escreve.
 *
 * Sem texto, "HORÁRIO BLOQUEADO", que é o que elas pediram. Com texto, o que foi digitado — a
 * terapeuta escreve "supervisão" ou "médico" e a semana passa a se explicar sozinha.
 */
export function textoDoBloqueio(nota?: string | null): string {
  const limpo = (nota ?? "").trim();
  return limpo || TEXTO_PADRAO_DO_BLOQUEIO;
}

/** O que vai para o banco: sem texto vazio ocupando espaço, e sem texto gigante. */
export function notaParaGravar(nota?: string | null): string | null {
  const limpo = (nota ?? "").trim().slice(0, 120);
  return limpo || null;
}

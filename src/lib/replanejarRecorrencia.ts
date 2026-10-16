/**
 * REPLANEJAR A RECORRÊNCIA de um agendamento (doc 43).
 *
 * Editar a frequência/limite de uma série muda SÓ o futuro: as sessões já realizadas, as faltas, as
 * canceladas, qualquer uma JÁ PAGA e os encaixes avulsos ficam intactos. Esta função pura decide
 * apenas QUAIS sessões saem (as futuras da mesma série, ainda só agendadas e sem pagamento) — a
 * geração das novas datas fica no `datasEPuladas`, e a escrita no banco no server action.
 *
 * Fica separada da escrita de propósito: um alcance errado tira da agenda sessões que ninguém mandou
 * tirar, e isso dá para conferir sem tocar em dado de verdade.
 */

export type SessaoDaSerie = {
  id: string;
  data: Date | string;
  status: string;
  recurring: boolean;
  /** Tem pagamento lançado? Sessão paga nunca é removida. */
  pago: boolean;
  recurrenceFreq?: string | null;
  /** Limite da recorrência — as sessões criadas juntas compartilham o mesmo valor. */
  recurrenceUntil?: Date | string | null;
};

const ms = (d: Date | string | null | undefined): number | null => {
  if (d == null) return null;
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? null : x.getTime();
};

/**
 * Os ids das sessões da série do `anchor` que devem sair para o replanejamento.
 *
 * Série = mesma frequência E mesmo limite de recorrência do anchor (as criadas na mesma vez
 * compartilham os dois). Dentro dela, só saem as que é SEGURO recriar:
 * - daqui para a frente (data >= data do anchor);
 * - ainda `recurring` (nunca um encaixe avulso solto);
 * - status "agendada" (realizada/falta/cancelada/realocada ficam — são histórico);
 * - sem pagamento lançado.
 * O próprio anchor entra quando satisfaz as regras (é o início do novo compasso).
 */
export function sessoesDaSerieARemover(opts: {
  anchor: { data: Date | string; recurrenceFreq?: string | null; recurrenceUntil?: Date | string | null };
  existentes: SessaoDaSerie[];
}): string[] {
  const inicio = ms(opts.anchor.data);
  if (inicio == null) return [];
  const freqAnchor = opts.anchor.recurrenceFreq ?? null;
  const untilAnchor = ms(opts.anchor.recurrenceUntil);

  return opts.existentes
    .filter((s) => {
      const quando = ms(s.data);
      if (quando == null || quando < inicio) return false;
      if (!s.recurring) return false;
      if (s.status !== "agendada") return false;
      if (s.pago) return false;
      // Mesma série do anchor: freq + limite batem.
      if ((s.recurrenceFreq ?? null) !== freqAnchor) return false;
      if (ms(s.recurrenceUntil) !== untilAnchor) return false;
      return true;
    })
    .map((s) => s.id);
}

/**
 * O anchor pode ter a recorrência replanejada? Só se ele próprio for uma sessão futura, recorrente,
 * agendada e não paga — senão não há compasso para redesenhar sem mexer em histórico/pagamento.
 */
export function podeReplanejar(anchor: { status: string; recurring: boolean; pago: boolean }): boolean {
  return anchor.recurring && anchor.status === "agendada" && !anchor.pago;
}

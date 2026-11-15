/**
 * "NÃO VIERAM NA SEMANA" — quem é ativo e não teve sessão realizada na janela que já passou.
 *
 * Doc 74: o cartão estava "trazendo a informação da próxima semana e não da semana vigente".
 *
 * A causa era uma janela sem teto. O painel recebe TODAS as sessões `realizada`/`nao_realizada` do
 * profissional, sem corte de data (é a mesma lista que alimenta a contagem de presença, que precisa
 * do histórico inteiro), e o filtro só perguntava se a sessão era **posterior** ao corte. Uma sessão
 * da semana QUE VEM já marcada como realizada passava nesse teste e tirava a pessoa da lista: o
 * cartão respondia pela agenda futura, não pelos últimos sete dias que o rótulo promete.
 *
 * A comparação é por DIA (YYYY-MM-DD), em texto. As datas chegam como hora de parede
 * ("2026-11-10T09:00:00") e o corte vem do servidor no mesmo formato de dia — comparar texto evita
 * passar por fuso, que é onde a meia-noite vira o dia anterior.
 *
 * Função pura.
 */

export type PresencaDaSemana = { patientId: string; presente: boolean; date: string };

/** O dia (YYYY-MM-DD) de um texto de data de parede. */
const dia = (iso: string): string => String(iso).slice(0, 10);

/**
 * Quem, entre os ativos, NÃO teve sessão realizada entre `corte` e `hoje` (ambos inclusive).
 *
 * `corte` e `hoje` são YYYY-MM-DD. O teto é hoje: sessão marcada para depois de hoje é expectativa,
 * e expectativa não é comparecimento.
 */
export function naoVieramNaSemana<T extends { id: string }>(
  ativos: T[],
  presenca: PresencaDaSemana[],
  corte: string,
  hoje: string,
): T[] {
  const vieram = new Set(
    presenca
      .filter((r) => r.presente && dia(r.date) >= corte && dia(r.date) <= hoje)
      .map((r) => r.patientId),
  );
  return ativos.filter((p) => !vieram.has(p.id));
}

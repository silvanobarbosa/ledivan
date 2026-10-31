/**
 * A FRASE "AGENDA RECORRENTE: terça 17:00 · até 31 de dez. de 2026".
 *
 * Ela descreve o COMBINADO do paciente, e por isso não pode sair de uma sessão só. Era o que
 * acontecia: a tela pegava a primeira sessão recorrente futura e lia dia e hora dela. Bastava
 * remarcar UM atendimento para a frase passar a anunciar o horário daquela exceção como se fosse
 * o combinado — "esta aparecendo a última alterada e não está se baseando nas últimas agendadas"
 * (dono, doc 67).
 *
 * A regra nova: vale o par dia-da-semana + horário que MAIS SE REPETE entre as sessões
 * recorrentes futuras. Uma remarcação isolada não derruba um combinado que se repete; e havendo
 * empate, vence o mais recente, que é o que está valendo daqui para a frente.
 *
 * Função pura.
 */

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

export type SessaoRecorrente = { date: Date | string; recurrenceUntil?: Date | string | null };
export type AgendaRecorrente = { day: string; time: string; until: string | null };

const emData = (d: Date | string | null | undefined): Date | null => {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  return Number.isNaN(x.getTime()) ? null : x;
};
const doisDigitos = (n: number) => String(n).padStart(2, "0");

export function agendaRecorrente(sessoes: SessaoRecorrente[]): AgendaRecorrente | null {
  const datas = sessoes.map((s) => emData(s.date)).filter((d): d is Date => !!d);
  if (!datas.length) return null;

  // Conta cada par dia+hora e guarda a data mais recente de cada um (o desempate).
  const contagem = new Map<string, { n: number; maisRecente: number; dow: number; hora: string }>();
  for (const d of datas) {
    const hora = `${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`;
    const chave = `${d.getDay()}|${hora}`;
    const atual = contagem.get(chave);
    if (atual) {
      atual.n += 1;
      atual.maisRecente = Math.max(atual.maisRecente, d.getTime());
    } else {
      contagem.set(chave, { n: 1, maisRecente: d.getTime(), dow: d.getDay(), hora });
    }
  }

  const vencedor = [...contagem.values()].sort((a, b) => b.n - a.n || b.maisRecente - a.maisRecente)[0];

  // O "até" é o limite mais distante declarado em qualquer uma delas.
  const limites = sessoes.map((s) => emData(s.recurrenceUntil)).filter((d): d is Date => !!d);
  const until = limites.length ? new Date(Math.max(...limites.map((d) => d.getTime()))).toISOString() : null;

  return { day: DIAS[vencedor.dow], time: vencedor.hora, until };
}

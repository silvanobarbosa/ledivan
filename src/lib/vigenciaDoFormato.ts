/**
 * A VIGÊNCIA DO FORMATO DE PAGAMENTO.
 *
 * Regra do dono (15/09/2026):
 *
 * > A alteração da forma de cobrança deve valer somente a partir da data definida, sem modificar
 * > os atendimentos anteriores. Gratuito é gratuito enquanto essa modalidade estiver vigente. Ao
 * > passar para uma modalidade paga, somente os atendimentos a partir da data de início geram
 * > cobrança. Ao passar de uma modalidade paga para gratuita, as cobranças anteriores permanecem.
 * > O sistema nunca deve apagar, criar ou modificar cobranças passadas apenas porque você alterou o
 * > financeiro do paciente.
 *
 * O PORQUÊ DESTE MÓDULO. `patients.payment_format` é UM valor, sem data, e o fechamento o aplicava a
 * todos os meses da história. Trocar de gratuito para "a cada sessão" hoje fazia agosto — que
 * aconteceu de graça — virar dívida; trocar de pago para gratuito apagava a cobrança passada e
 * transformava o que já tinha sido pago em crédito invisível. Medido no banco: o paciente de teste
 * alternou quatro vezes, que é o que alguém faz quando a troca "parece" não pegar.
 *
 * O preço nunca teve esse problema, porque `patient_price_history` tem `dataEfetiva`. O formato
 * passa a ter o mesmo modelo: `patient_payment_format_history`, uma linha por troca.
 *
 * TRÊS DECISÕES:
 *
 * 1. **A troca vale a partir do DIA, não da hora.** A pessoa escolhe uma data no formulário; a
 *    sessão das 8h daquele dia já é do formato novo.
 * 2. **O primeiro registro vale para trás.** Sessão anterior à primeira linha do histórico não pode
 *    ficar sem regra — ela segue o primeiro formato conhecido, que é o que valia quando o paciente
 *    começou.
 * 3. **Sem histórico nenhum, vale o cadastro.** É o estado de quem foi criado antes desta mudança e
 *    ainda não passou pela migração: nada muda para ele.
 *
 * Função pura: não lê banco, não grava.
 */

export type VigenciaDoFormato = {
  formato: string;
  pacoteTipo?: string | null;
  /** A partir de quando vale. Só o DIA importa. */
  desde: Date | string;
  /** Desempate de duas trocas no mesmo dia: vale a registrada por último. */
  criadoEm?: Date | string | null;
};

export type PeriodoDeVigencia = {
  formato: string;
  pacoteTipo: string | null;
  /** Início, inclusivo. `null` = desde sempre. */
  inicio: Date | null;
  /** Fim, EXCLUSIVO. `null` = até hoje e adiante. */
  fim: Date | null;
};

type Reserva = { formato: string | null | undefined; pacoteTipo?: string | null };

const emData = (v: Date | string | null | undefined): Date | null => {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

const inicioDoDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * A história do paciente partida em períodos, cada um com o formato que valia nele.
 *
 * Linhas consecutivas com o mesmo formato (e o mesmo tipo de pacote) viram um período só: salvar o
 * cadastro sem mexer no financeiro não pode abrir um "contrato novo" e reiniciar a sequência.
 */
export function periodosDeVigencia(vigencias: VigenciaDoFormato[], reserva: Reserva): PeriodoDeVigencia[] {
  const validas = vigencias
    .map((v, ordem) => ({
      formato: v.formato,
      pacoteTipo: v.pacoteTipo ?? null,
      desde: emData(v.desde),
      criadoEm: emData(v.criadoEm ?? null),
      ordem,
    }))
    .filter((v): v is typeof v & { desde: Date } => !!v.desde && !!v.formato)
    .map((v) => ({ ...v, desde: inicioDoDia(v.desde) }))
    .sort(
      (a, b) =>
        a.desde.getTime() - b.desde.getTime() ||
        (a.criadoEm?.getTime() ?? 0) - (b.criadoEm?.getTime() ?? 0) ||
        a.ordem - b.ordem,
    );

  if (validas.length === 0) {
    return [{ formato: reserva.formato || "sessao", pacoteTipo: reserva.pacoteTipo ?? null, inicio: null, fim: null }];
  }

  // Duas trocas no mesmo dia: a última apaga a anterior. Ninguém quer um período de zero dias.
  const porDia: typeof validas = [];
  for (const v of validas) {
    const ultima = porDia[porDia.length - 1];
    if (ultima && ultima.desde.getTime() === v.desde.getTime()) porDia[porDia.length - 1] = v;
    else porDia.push(v);
  }

  const periodos: PeriodoDeVigencia[] = [];
  for (const v of porDia) {
    const anterior = periodos[periodos.length - 1];
    if (anterior && anterior.formato === v.formato && (anterior.pacoteTipo ?? null) === v.pacoteTipo) continue;
    if (anterior) anterior.fim = v.desde;
    periodos.push({ formato: v.formato, pacoteTipo: v.pacoteTipo, inicio: v.desde, fim: null });
  }
  // O primeiro vale para trás.
  periodos[0].inicio = null;
  return periodos;
}

function cabe(periodo: PeriodoDeVigencia, quando: Date): boolean {
  const t = quando.getTime();
  if (periodo.inicio && t < periodo.inicio.getTime()) return false;
  if (periodo.fim && t >= periodo.fim.getTime()) return false;
  return true;
}

/** O formato que valia naquele dia. */
export function formatoNaData(
  vigencias: VigenciaDoFormato[],
  quando: Date | string,
  reserva: Reserva,
): PeriodoDeVigencia {
  const periodos = periodosDeVigencia(vigencias, reserva);
  const d = emData(quando);
  if (!d) return periodos[periodos.length - 1];
  return periodos.find((p) => cabe(p, d)) ?? periodos[periodos.length - 1];
}

/**
 * As sessões agrupadas pelo período em que aconteceram.
 *
 * Todo período aparece, mesmo sem sessão — a lista espelha a história do contrato, e não só a da
 * agenda.
 */
export function separarPorVigencia<T extends { date: Date | string }>(
  sessoes: T[],
  periodos: PeriodoDeVigencia[],
): { periodo: PeriodoDeVigencia; sessoes: T[] }[] {
  const grupos = periodos.map((periodo) => ({ periodo, sessoes: [] as T[] }));
  for (const s of sessoes) {
    const d = emData(s.date);
    if (!d) continue;
    const g = grupos.find((x) => cabe(x.periodo, d));
    if (g) g.sessoes.push(s);
  }
  return grupos;
}

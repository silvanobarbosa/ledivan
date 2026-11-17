/**
 * "NÃO VIERAM NA SEMANA" — quem desmarcou, faltou ou apresentou atestado na SEMANA VIGENTE.
 *
 * A pergunta mudou de sinal (pedido do dono de 17/11/2026). Antes era uma AUSÊNCIA de prova: ativo sem
 * sessão realizada na janela. Isso trazia junto todo mundo que simplesmente não tinha sessão
 * marcada naquela semana — paciente quinzenal, mensal, quem está de férias — e esse é o "status
 * vazio" que o dono mandou não considerar. Agora é uma PRESENÇA de registro: só entra quem tem, na
 * semana, uma sessão marcada com um dos status que dizem que o encontro não aconteceu.
 *
 * **A semana é a do calendário, de domingo a sábado**, não os últimos sete dias. Um recorte móvel
 * responde "sete dias para trás a partir de hoje", que na quarta-feira mistura metade da semana
 * passada com metade desta — não é a semana que a terapeuta tem na cabeça quando olha a agenda.
 *
 * **`prof_desmarcou` fica de fora.** O dono nomeou três situações — desmarcou, faltou, atestado — e
 * no doc 74, quando quis incluir a desmarcação do profissional, escreveu-a por extenso. Aqui não
 * escreveu. Faz sentido: quando foi a terapeuta que desmarcou, o paciente não deixou de vir. É a
 * mesma razão pela qual "Profissional desmarcou" nunca entrou no card de Faltas dos analíticos.
 *
 * As datas chegam como hora de parede ("2026-11-10T09:00:00") e a semana é calculada em texto
 * (YYYY-MM-DD) — comparar texto evita passar por fuso, que é onde a meia-noite vira o dia anterior.
 *
 * Funções puras.
 */

/** Os status que põem alguém nesta lista: "Desmarcou" (as duas formas), "Faltou" e "Atestado". */
export const STATUS_DE_AUSENCIA: ReadonlySet<string> = new Set([
  "cancelada",
  "realocada",
  "nao_realizada",
  "atestado",
]);

export type SessaoDaSemana = { patientId: string; status: string | null; date: string };

/** O dia (YYYY-MM-DD) de um texto de data de parede. */
const dia = (iso: string): string => String(iso).slice(0, 10);

/**
 * O domingo e o sábado da semana que contém `hoje` (YYYY-MM-DD), ambos inclusive.
 *
 * A conta é feita em UTC de propósito: a data entra como texto de calendário, sem hora, e passar
 * por horário local faria o dia virar em quem está a oeste de Greenwich.
 */
export function semanaVigente(hoje: string): { domingo: string; sabado: string } {
  const [a, m, d] = hoje.split("-").map(Number);
  const base = Date.UTC(a, m - 1, d);
  const diaDaSemana = new Date(base).getUTCDay(); // 0 = domingo
  const texto = (t: number) => new Date(t).toISOString().slice(0, 10);
  return {
    domingo: texto(base - diaDaSemana * 86400000),
    sabado: texto(base + (6 - diaDaSemana) * 86400000),
  };
}

/**
 * Quem, entre os ativos, tem na semana de `hoje` ao menos uma sessão desmarcada, faltada ou com
 * atestado. Quem não tem nada marcado na semana não aparece — é o "status vazio" do pedido de 17/11.
 */
export function naoVieramNaSemana<T extends { id: string }>(
  ativos: T[],
  sessoes: SessaoDaSemana[],
  hoje: string,
): T[] {
  const { domingo, sabado } = semanaVigente(hoje);
  const ausentes = new Set(
    sessoes
      .filter((s) => STATUS_DE_AUSENCIA.has(s.status ?? "") && dia(s.date) >= domingo && dia(s.date) <= sabado)
      .map((s) => s.patientId),
  );
  return ativos.filter((p) => ausentes.has(p.id));
}

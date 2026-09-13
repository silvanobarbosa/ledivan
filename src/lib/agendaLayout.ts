/**
 * DUAS SESSÕES NO MESMO HORÁRIO: onde cada uma fica.
 *
 * Acontece de verdade — encaixe, atendimento de casal, remarcação em cima de outra. Até agora a
 * agenda empilhava as duas no mesmo lugar e a de baixo sumia atrás da de cima, o que só não
 * aparecia porque o bloco tinha fundo opaco. Com o fundo transparente que as beta testers pediram,
 * os dois textos passaram a se sobrepor na tela.
 *
 * Esconder de novo não serve: o lote é explícito em que nada pode ficar cortado ou sobreposto, e
 * uma sessão invisível na agenda é uma sessão que alguém vai perder. A saída é a dos calendários:
 * quem se sobrepõe divide a largura da coluna.
 *
 * O cálculo é em duas etapas. Primeiro os GRUPOS: sessões que se tocam, direta ou indiretamente
 * (A cruza com B, B cruza com C, então as três dividem espaço mesmo que A e C não se toquem — do
 * contrário B ficaria por cima de alguém). Depois as FAIXAS dentro do grupo: cada sessão vai para
 * a primeira faixa que já esvaziou no horário dela, e por isso duas sessões seguidas sem encosto
 * reaproveitam a mesma faixa em vez de estreitar a coluna à toa.
 */

export type BlocoNaAgenda = {
  id: string;
  /** Minutos desde a meia-noite. */
  inicio: number;
  /** Duração em minutos. */
  duracao: number;
};

export type PosicaoDoBloco = {
  /** Em qual faixa o bloco entra, a partir de zero. */
  faixa: number;
  /** Quantas faixas o grupo dele tem — é o divisor da largura da coluna. */
  faixas: number;
};

/** Duração de zero ou negativa não desenha nada; um mínimo evita bloco invisível e divisão por zero. */
const DURACAO_MINIMA = 5;

const fim = (b: BlocoNaAgenda) => b.inicio + Math.max(DURACAO_MINIMA, b.duracao);

/**
 * Onde cada bloco do dia fica: mapa do id do bloco para `{ faixa, faixas }`.
 *
 * Quem não divide horário com ninguém recebe `{ faixa: 0, faixas: 1 }` e ocupa a coluna inteira,
 * que é o caso da esmagadora maioria dos dias.
 */
export function posicoesDoDia(blocos: BlocoNaAgenda[]): Map<string, PosicaoDoBloco> {
  const mapa = new Map<string, PosicaoDoBloco>();

  const ordenados = [...blocos]
    .filter((b) => Number.isFinite(b.inicio) && Number.isFinite(b.duracao))
    .sort((a, b) => a.inicio - b.inicio || fim(a) - fim(b) || a.id.localeCompare(b.id));

  let grupo: BlocoNaAgenda[] = [];
  let fimDoGrupo = -Infinity;

  const fecharGrupo = () => {
    if (grupo.length === 0) return;

    // As faixas guardam em que minuto cada uma se desocupa. Um bloco entra na primeira faixa já
    // livre; se nenhuma estiver, abre outra.
    const livreEm: number[] = [];
    const daFaixa = new Map<string, number>();

    for (const bloco of grupo) {
      let faixa = livreEm.findIndex((quando) => quando <= bloco.inicio);
      if (faixa === -1) {
        faixa = livreEm.length;
        livreEm.push(0);
      }
      livreEm[faixa] = fim(bloco);
      daFaixa.set(bloco.id, faixa);
    }

    for (const bloco of grupo) {
      mapa.set(bloco.id, { faixa: daFaixa.get(bloco.id) ?? 0, faixas: livreEm.length });
    }

    grupo = [];
    fimDoGrupo = -Infinity;
  };

  for (const bloco of ordenados) {
    // Encosta no grupo aberto? Começar exatamente quando o outro termina NÃO é sobreposição —
    // 8h–9h e 9h–10h são vizinhos, não concorrentes.
    if (grupo.length > 0 && bloco.inicio >= fimDoGrupo) fecharGrupo();
    grupo.push(bloco);
    fimDoGrupo = Math.max(fimDoGrupo, fim(bloco));
  }
  fecharGrupo();

  return mapa;
}

/**
 * A largura e o deslocamento de um bloco, em porcentagem da coluna.
 *
 * Sobra uma folga entre as faixas para que duas bordas coladas não pareçam uma só.
 */
export function geometriaDaFaixa(pos: PosicaoDoBloco | undefined): { left: string; width: string } {
  const faixas = Math.max(1, pos?.faixas ?? 1);
  const faixa = Math.min(Math.max(0, pos?.faixa ?? 0), faixas - 1);
  if (faixas === 1) return { left: "0%", width: "100%" };
  const largura = 100 / faixas;
  return { left: `${faixa * largura}%`, width: `calc(${largura}% - 2px)` };
}

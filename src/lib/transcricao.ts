/**
 * ONDE O ÁUDIO DA SESSÃO É OUVIDO.
 *
 * Duas fontes possíveis, e a ORDEM entre elas é uma regra da casa, não uma preferência de custo:
 *
 *  - **a chave da terapeuta (BYOK)** é o CHÃO. O Ledivan tem de funcionar sozinho — `PENDENCIAS.md`
 *    é explícito: "VPS única é ponto único de falha; hub/apps NÃO dependem dela". Por isso o
 *    caminho padrão não passa pela nossa infraestrutura.
 *  - **a IA da casa** (gateway → Whisper na VPS) é um BÔNUS que a terapeuta LIGA. Ali o áudio não
 *    sai da nossa infraestrutura e não custa nada a ela — mas é escolha dela assumir essa
 *    dependência, não nossa impô-la.
 *
 * Ligada a casa, ela vem primeiro e a chave da terapeuta fica de reserva REAL: se a VPS não
 * responder, a transcrição cai para a chave dela na mesma requisição. A primeira versão disto
 * tinha failover de papel — perguntava se o gateway estava CONFIGURADO, não se estava
 * respondendo, e portanto nunca caía. Configuração não é disponibilidade.
 *
 * Funções puras.
 */

export type MotorDeAudio = "casa" | "byok";

/**
 * Os motores a tentar, NA ORDEM. Lista vazia = não há como transcrever.
 *
 * Devolve uma lista, e não um motor só, porque a reserva precisa existir no momento da chamada:
 * é tentando que se descobre que a VPS não responde.
 */
export function ordemDosMotores(o: {
  /** A terapeuta ligou "usar a IA da casa" nas Configurações. */
  optouPelaCasa: boolean;
  /** O gateway está configurado neste ambiente. */
  casaConfigurada: boolean;
  terapeutaTemChave: boolean;
}): MotorDeAudio[] {
  const casa: MotorDeAudio[] = o.optouPelaCasa && o.casaConfigurada ? ["casa"] : [];
  const byok: MotorDeAudio[] = o.terapeutaTemChave ? ["byok"] : [];
  return [...casa, ...byok];
}

/**
 * A dica de nomes próprios para o Whisper.
 *
 * Medido em 31/10 no gateway da casa: sem dica, "Thais Duarte" virou "tais do arte"; com a dica,
 * saiu certo. Nome próprio é justamente o que mais erra e o que mais importa num prontuário — e o
 * app JÁ SABE o nome, então não há razão para deixar o modelo adivinhar.
 *
 * Só os nomes de QUEM É DESTA sessão. Mandar a lista inteira de pacientes faria a dica empurrar o
 * nome errado para dentro da transcrição de outro — e um prontuário com o nome de outro paciente
 * é pior do que um nome escrito errado.
 */
export function dicaDeNomes(nomes: (string | null | undefined)[]): string | undefined {
  const limpos = [...new Set(nomes.map((n) => (n ?? "").trim()).filter(Boolean))];
  if (!limpos.length) return undefined;
  return `Nomes próprios que podem aparecer: ${limpos.join(", ")}.`;
}

/** Teto do arquivo. O mesmo 25 MB que os provedores aceitam, conferido ANTES de subir. */
export const TETO_DO_AUDIO = 25 * 1024 * 1024;

export function audioAceitavel(bytes: number): { ok: true } | { ok: false; error: string } {
  if (!Number.isFinite(bytes) || bytes <= 0) return { ok: false, error: "O áudio chegou vazio." };
  if (bytes > TETO_DO_AUDIO) return { ok: false, error: "Áudio grande demais. Envie um arquivo de até 25 MB." };
  return { ok: true };
}

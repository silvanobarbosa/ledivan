/**
 * ONDE O ÁUDIO DA SESSÃO É OUVIDO.
 *
 * Até aqui a transcrição era só BYOK: a terapeuta cadastrava a chave DELA e o áudio ia para a
 * OpenAI ou a Groq. A razão escrita na época era boa — o app não carrega chave de provedor, e
 * chave compartilhada que morre derruba o recurso (foi o que aconteceu no Kardec).
 *
 * O que mudou: a casa passou a ter ouvido próprio. O gateway (`ia.reverblabs.com.br`) roda um
 * Whisper na nossa VPS, e com ele o áudio clínico **não sai da nossa infraestrutura** — não chega
 * à OpenAI, não chega a ninguém. Isso é melhor que BYOK para o dado do paciente, não só mais
 * barato. O app continua sem chave de PROVEDOR: ele tem chave do gateway, que é da casa.
 *
 * A objeção antiga continua de pé e por isso a reserva continua existindo: **a casa primeiro, a
 * chave dela depois**. Gateway fora do ar com chave cadastrada = transcreve pela chave dela.
 * Nenhum dos dois = recusa com mensagem clara, nunca 500 genérico.
 *
 * Funções puras.
 */

export type MotorDeAudio = "casa" | "byok";

/**
 * Qual motor usar. A ordem é deliberada e não é preferência de custo: o de casa é o único em que
 * o áudio do paciente não atravessa a internet até um terceiro.
 */
export function escolherMotor(o: { casaDisponivel: boolean; terapeutaTemChave: boolean }): MotorDeAudio | null {
  if (o.casaDisponivel) return "casa";
  if (o.terapeutaTemChave) return "byok";
  return null;
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

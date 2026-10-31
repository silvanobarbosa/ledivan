/**
 * REGRAS DA TRANSCRIÇÃO DA SESSÃO.
 *
 * O áudio vai para o provedor da própria terapeuta, com a chave dela (BYOK). **É o único
 * caminho**, por decisão do dono (31/10): o Ledivan não depende de infraestrutura nossa para
 * funcionar — `docs/PENDENCIAS.md` já dizia "VPS única é ponto único de falha; hub/apps NÃO
 * dependem dela". Chegou a existir aqui uma opção de usar a IA da casa, inclusive como opt-in da
 * terapeuta; foi removida inteira. Não reintroduzir sem o dono pedir.
 *
 * O que sobrou deste arquivo não depende de motor nenhum: vale para qualquer provedor.
 *
 * Funções puras.
 */

/**
 * A dica de nomes próprios para o Whisper.
 *
 * Medido em 31/10: sem dica, "Thais Duarte" virou "tais do arte"; com a dica, saiu certo. Nome
 * próprio é justamente o que mais erra e o que mais importa num prontuário — e o app JÁ SABE o
 * nome, então não há razão para deixar o modelo adivinhar.
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

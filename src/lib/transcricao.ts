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

/**
 * O TETO DA DICA — 896, e a unidade é BYTE UTF-8, não caractere.
 *
 * O provedor escreve "characters" na mensagem de erro, e a mensagem MENTE sobre a unidade. Medido
 * em 02/11 com a chave da terapeuta: a dica tinha 885 caracteres e o Groq recusou com
 * `prompt length must be 896 characters or fewer, but provided prompt contains 898 characters`.
 * 898 é exatamente o tamanho dela em bytes — cada acento de nome português ("Thaís", "João",
 * "Conceição") custa 2. Num app em português, contar caractere é errar por uma folga que CRESCE
 * com a lista: 32 pacientes dela davam 13 bytes de diferença; as outras contas chegavam a 22.
 *
 * O número 896 continua valendo: é 224 tokens × 4, a régua do Whisper, igual nos dois provedores.
 *
 * Foi este teto que quebrou o Divã da Gisele duas vezes seguidas — primeiro porque o corte era
 * por QUANTIDADE de nomes (80), depois porque era por caractere. Nas duas, o sintoma na tela foi
 * o mesmo "Não consegui ouvir agora", e TODO comando de voz falhava.
 */
export const TETO_DA_DICA = 896;

/** O tamanho como o provedor mede: bytes UTF-8. */
const CONTADOR = new TextEncoder();

export function bytesDe(texto: string): number {
  return CONTADOR.encode(texto).length;
}

/**
 * Corta em bytes sem partir um caractere no meio.
 *
 * Cortar por byte cru deixaria meio acento no fim, que o encoder troca pelo caractere de
 * substituição (3 bytes) e volta a estourar o teto. Aqui o corte anda para trás por CARACTERE até
 * caber; como byte nunca é menor que caractere, começar no teto já cai perto do fim.
 */
function cortadaEmBytes(texto: string, teto: number): string {
  let fim = Math.min(texto.length, teto);
  while (fim > 0 && bytesDe(texto.slice(0, fim)) > teto) fim--;
  const corte = texto.slice(0, fim);
  // Par substituto partido ao meio (emoji num nome): melhor não levar o pedaço.
  const ultimo = corte.charCodeAt(corte.length - 1);
  return ultimo >= 0xd800 && ultimo <= 0xdbff ? corte.slice(0, -1) : corte;
}

/**
 * A dica cortada para caber: a base inteira mais quantos nomes couberem, na ordem recebida.
 *
 * Quem chama manda os nomes na ordem de importância — os primeiros sobrevivem ao corte. Sem
 * nenhum nome, devolve só a base; se nem a base couber, ela é truncada, porque mandar um pedaço
 * de dica é melhor do que derrubar a transcrição inteira.
 */
export function dicaQueCabe(base: string, nomes: (string | null | undefined)[], teto = TETO_DA_DICA): string {
  const limpa = base.trim();
  if (bytesDe(limpa) >= teto) return cortadaEmBytes(limpa, teto);
  const limpos = [...new Set(nomes.map((n) => (n ?? "").trim()).filter(Boolean))];
  if (!limpos.length) return limpa;

  const cabem: string[] = [];
  for (const nome of limpos) {
    const tentativa = `${limpa} Pacientes: ${[...cabem, nome].join(", ")}.`;
    if (bytesDe(tentativa) > teto) break;
    cabem.push(nome);
  }
  return cabem.length ? `${limpa} Pacientes: ${cabem.join(", ")}.` : limpa;
}

/** Teto do arquivo. O mesmo 25 MB que os provedores aceitam, conferido ANTES de subir. */
export const TETO_DO_AUDIO = 25 * 1024 * 1024;

export function audioAceitavel(bytes: number): { ok: true } | { ok: false; error: string } {
  if (!Number.isFinite(bytes) || bytes <= 0) return { ok: false, error: "O áudio chegou vazio." };
  if (bytes > TETO_DO_AUDIO) return { ok: false, error: "Áudio grande demais. Envie um arquivo de até 25 MB." };
  return { ok: true };
}

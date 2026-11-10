/**
 * OS AVISOS DO DIA (doc 63) — o que o aplicativo manda para a terapeuta de manhã.
 *
 * Dois avisos, com as palavras do documento: os aniversariantes de hoje e as cobranças que vencem
 * hoje. Módulo puro — quem busca os dados é o cron; aqui só se decide o que o texto diz e quando
 * ele não deve existir.
 *
 * O teto é real e vem de fora: o push do Expo recusa mensagem grande, e uma lista de 40 pacientes
 * passaria do limite — a mensagem não chegaria, calada. Por isso a lista corta e diz quantos
 * ficaram de fora, em vez de confiar que "não vai acontecer" ([[licao-limite-sem-unidade-na-frota]]).
 */

/** Quantos nomes cabem num aviso antes de ele virar "e mais N". */
export const NOMES_NO_AVISO = 12;

export type AvisoPush = { title: string; body: string };

const brl = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Corta a lista no teto e acrescenta a linha do que sobrou — ninguém some sem aviso. */
function listaCortada(linhas: string[]): string {
  if (linhas.length <= NOMES_NO_AVISO) return linhas.join("\n");
  const sobra = linhas.length - NOMES_NO_AVISO;
  return [...linhas.slice(0, NOMES_NO_AVISO), `e mais ${sobra}`].join("\n");
}

/** O aviso de aniversário. `null` quando ninguém faz aniversário hoje — aviso vazio não se manda. */
export function avisoDeAniversario(nomes: string[]): AvisoPush | null {
  const limpos = nomes.map((n) => n.trim()).filter(Boolean);
  if (!limpos.length) return null;
  return {
    title: limpos.length === 1 ? "Hoje é aniversário do paciente:" : "Hoje é aniversário dos pacientes:",
    body: listaCortada(limpos),
  };
}

export type CobrancaDoAviso = { nome: string; valor: number };

/**
 * O aviso dos vencimentos de hoje. `null` quando não vence nada.
 *
 * O valor é o que FALTA receber daquela cobrança, não o valor cheio: uma cobrança já paga pela
 * metade avisada pelo cheio manda a terapeuta cobrar o que ela já recebeu.
 */
export function avisoDeVencimento(cobrancas: CobrancaDoAviso[]): AvisoPush | null {
  const linhas = cobrancas
    .filter((c) => c.nome.trim())
    .map((c) => `Paciente: ${c.nome.trim()} valor: ${brl(c.valor)}`);
  if (!linhas.length) return null;
  return { title: "Pacotes e sessões a vencer hoje.", body: listaCortada(linhas) };
}

/** O dia de hoje (YYYY-MM-DD) e o par mês-dia do aniversário, na hora de parede. */
export function diaEAniversario(agora: Date): { diaISO: string; mesDia: string } {
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");
  return { diaISO: `${agora.getFullYear()}-${mes}-${dia}`, mesDia: `${mes}-${dia}` };
}

/**
 * QUANDO ELA DISSE — a data e a hora, lidas da fala.
 *
 * Determinístico de ponta a ponta, e isso é escolha de projeto: pedir a data a um modelo é pedir
 * para ele acertar quase sempre, e "quase sempre" numa agenda significa marcar alguém no dia
 * errado de vez em quando, sem ninguém perceber até o paciente não aparecer.
 *
 * O que não é entendido vira `null`, e a tela pergunta. É melhor perguntar do que acertar sete
 * vezes e errar a oitava em silêncio.
 *
 * Devolve também `porExtenso`: o que o app ENTENDEU, escrito de volta para ela conferir. É a
 * última defesa antes de a sessão nascer — "quinta, 06/11, às 16h" é lido num piscar, e um engano
 * salta aos olhos.
 *
 * Funções puras.
 */

export type QuandoDito = { quando: Date; porExtenso: string };

const DIAS = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
const DIAS_POR_EXTENSO = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const MESES = ["janeiro", "fevereiro", "marco", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const semAcento = (s: string) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

const dois = (n: number) => String(n).padStart(2, "0");

/**
 * A HORA. Aceita "16h", "16:30", "às 16", "16 horas", "16h30", "meio-dia".
 *
 * Sem hora, devolve `null` — e o comando fica incompleto de propósito. Um horário presumido
 * ("as 8h, deve servir") é uma sessão marcada na hora errada.
 */
function horaDaFala(texto: string): { hora: number; minuto: number } | null {
  if (/\bmeio[\s-]?dia\b/.test(texto)) return { hora: 12, minuto: 0 };

  const m =
    texto.match(/\b(\d{1,2})\s*[h:]\s*(\d{2})\b/) ??
    texto.match(/\b(\d{1,2})\s*h\b/) ??
    texto.match(/\b(\d{1,2})\s*horas?\b/) ??
    texto.match(/\bas\s+(\d{1,2})\b/);
  if (!m) return null;

  const hora = Number(m[1]);
  const minuto = m[2] ? Number(m[2]) : 0;
  if (!Number.isInteger(hora) || hora < 0 || hora > 23 || minuto < 0 || minuto > 59) return null;

  // "às 4" num consultório é 16h, não 4 da manhã. Só desambigua quando ela não disse "da manhã".
  const madrugada = hora >= 1 && hora <= 7 && !/\bda manha\b|\bde manha\b/.test(texto);
  return { hora: madrugada ? hora + 12 : hora, minuto };
}

/**
 * O DIA, sem a hora. `null` quando a fala não diz nada reconhecível.
 *
 * Exportado porque CANCELAR não precisa de hora: "cancela a sessão da Marcela de amanhã" basta,
 * desde que ela tenha uma sessão só naquele dia — e, tendo mais de uma, a tela mostra as duas e
 * ela toca. Exigir hora para cancelar seria exigir que ela lembrasse de cor o horário do que quer
 * desmarcar.
 */
export function diaDaFala(fala: string, agora: Date = new Date()): Date | null {
  return diaDoTexto(semAcento(fala), agora);
}

function diaDoTexto(texto: string, agora: Date): Date | null {
  const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());

  if (/\bhoje\b/.test(texto)) return hoje;
  if (/\bamanha\b/.test(texto)) { const d = new Date(hoje); d.setDate(d.getDate() + 1); return d; }
  if (/\bdepois de amanha\b/.test(texto)) { const d = new Date(hoje); d.setDate(d.getDate() + 2); return d; }

  // "dia 5 de novembro" / "05/11" / "5 de novembro"
  const comMes = texto.match(/\b(?:dia\s+)?(\d{1,2})\s*(?:\/|\s+de\s+)\s*(\d{1,2}|[a-z]+)\b/);
  if (comMes) {
    const dia = Number(comMes[1]);
    const mes = /^\d+$/.test(comMes[2]) ? Number(comMes[2]) - 1 : MESES.indexOf(semAcento(comMes[2]));
    if (dia >= 1 && dia <= 31 && mes >= 0 && mes <= 11) {
      const d = new Date(hoje.getFullYear(), mes, dia);
      // Data que já passou neste ano = ano que vem. Ninguém agenda para trás.
      if (d.getTime() < hoje.getTime()) d.setFullYear(d.getFullYear() + 1);
      if (d.getDate() === dia && d.getMonth() === mes) return d;
    }
  }

  // "dia 5" sozinho: o próximo dia 5 que ainda não passou.
  const soDia = texto.match(/\bdia\s+(\d{1,2})\b/);
  if (soDia) {
    const dia = Number(soDia[1]);
    if (dia >= 1 && dia <= 31) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth(), dia);
      if (d.getTime() < hoje.getTime() || d.getDate() !== dia) {
        const prox = new Date(hoje.getFullYear(), hoje.getMonth() + 1, dia);
        return prox.getDate() === dia ? prox : null;
      }
      return d;
    }
  }

  // Dia da semana: SEMPRE o próximo que ainda não chegou. "quinta" numa quinta é a de hoje.
  const queSemana = DIAS.findIndex((nome) => new RegExp(`\\b${nome}(?:-feira)?\\b`).test(texto));
  if (queSemana >= 0) {
    const d = new Date(hoje);
    let avanca = (queSemana - d.getDay() + 7) % 7;
    // "na próxima quinta" pula a desta semana.
    if (/\bproxima\b|\bque vem\b/.test(texto)) avanca = avanca === 0 ? 7 : avanca + 7;
    d.setDate(d.getDate() + avanca);
    return d;
  }

  return null;
}

export function quandoDaFala(fala: string, agora: Date = new Date()): QuandoDito | null {
  const texto = semAcento(fala);
  if (!texto) return null;

  const dia = diaDoTexto(texto, agora);
  const hora = horaDaFala(texto);
  if (!dia || !hora) return null;

  const quando = new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), hora.hora, hora.minuto, 0, 0);
  const porExtenso = `${DIAS_POR_EXTENSO[quando.getDay()]}, ${dois(quando.getDate())}/${dois(quando.getMonth() + 1)}, às ${dois(quando.getHours())}h${hora.minuto ? dois(hora.minuto) : ""}`;
  return { quando, porExtenso };
}

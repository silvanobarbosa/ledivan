/**
 * O LEMBRETE DE SESSÃO (doc 61) — o texto e a hora de mandar.
 *
 * A terapeuta escolhe UMA vez, em Ajustes, quando o lembrete sai: no dia da sessão (às 6h da
 * manhã) ou na véspera (às 15h). A escolha é dela e vale para todos os pacientes; quem recebe ou
 * não continua sendo decidido paciente a paciente, no cadastro.
 *
 * São duas redações, e a diferença entre elas não é enfeite: quem paga por PACOTE precisa saber em
 * que ponto do pacote está ("Sessão 3 de 4"), porque é isso que diz quando vem a próxima cobrança.
 * Para avulsa e cortesia a contagem não existe, e inventá-la seria dizer uma coisa falsa.
 *
 * Funções puras — a hora de disparar também, para poder ser conferida sem esperar o cron.
 */

/** Quando a terapeuta quer que o lembrete saia. */
export type QuandoLembrar = "dia" | "vespera";

/** A hora local (horário de Brasília) de cada escolha — doc 61. */
export const HORA_DO_LEMBRETE: Record<QuandoLembrar, number> = { dia: 6, vespera: 15 };

export const ROTULO_DO_LEMBRETE: Record<QuandoLembrar, string> = {
  dia: "No dia da sessão, às 6h",
  vespera: "No dia anterior, às 15h",
};

export type DadosDoLembrete = {
  /** Nome do paciente (ou de quem recebe). Só o primeiro nome entra. */
  nome?: string | null;
  /** A data da sessão (ISO de parede). */
  quando: string | Date;
  /** `true` quando o lembrete sai na véspera: muda "hoje" para "amanhã". */
  vespera: boolean;
  /** Pacote (mensal ou quinzenal): a posição desta sessão e o tamanho do pacote. */
  pacote?: { posicao: number; total: number } | null;
};

const doisDigitos = (n: number) => String(n).padStart(2, "0");

/** `2026-11-09T16:00:00` → `09/11/26`. Aceita Date (hora de parede do servidor). */
export function dataDoLembrete(quando: string | Date): string {
  if (quando instanceof Date) {
    return `${doisDigitos(quando.getDate())}/${doisDigitos(quando.getMonth() + 1)}/${String(quando.getFullYear()).slice(2)}`;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(quando));
  return m ? `${m[3]}/${m[2]}/${m[1].slice(2)}` : "";
}

/** `2026-11-09T16:00:00` → `16h00`. */
export function horaDoLembrete(quando: string | Date): string {
  if (quando instanceof Date) return `${doisDigitos(quando.getHours())}h${doisDigitos(quando.getMinutes())}`;
  const m = /T(\d{2}):(\d{2})/.exec(String(quando));
  return m ? `${m[1]}h${m[2]}` : "";
}

/**
 * O texto do lembrete, nas palavras do dono (doc 61) — com as linhas em branco que ele pediu.
 *
 * A linha "Sessão x de x do pacote" existe só para pacote; sem ela, o texto é o da sessão avulsa,
 * que também muda o verbo ("sessão de terapia", não "terapia").
 */
export function mensagemDoLembrete(d: DadosDoLembrete): string {
  const nome = (d.nome || "").trim().split(/\s+/)[0] || "";
  const dia = dataDoLembrete(d.quando);
  const hora = horaDoLembrete(d.quando);
  const quando = d.vespera ? "amanhã" : "hoje";

  const linhas = d.pacote
    ? [
        `Olá ${nome}!`,
        "",
        `Passando para lembrar que ${quando}, ${dia}, você tem terapia às ${hora}.`,
        "",
        `Sessão ${d.pacote.posicao} de ${d.pacote.total} do pacote.`,
        "",
        "Aguardo você! 😊",
      ]
    : [
        `Olá ${nome}!`,
        "",
        `Passando para lembrar que ${quando} ${dia}, você tem sessão de terapia às ${hora}.`,
        "",
        "Aguardo você! 😊",
      ];

  return linhas.join("\n").replace(/[ \t]+([!,.;:?])/g, "$1");
}

/**
 * A JANELA de sessões que este disparo cobre.
 *
 * O cron roda de hora em hora na prática (a Vercel não garante o minuto), então a regra não pode
 * ser "é 6h em ponto": é "estamos no turno da manhã" ou "no da tarde". Quem escolheu a véspera só
 * recebe do turno da tarde, e quem escolheu o dia só do turno da manhã — nunca os dois, senão o
 * mesmo paciente recebe dois lembretes da mesma sessão.
 */
export function quandoDoDisparo(horaLocal: number): QuandoLembrar {
  return horaLocal < 12 ? "dia" : "vespera";
}

/** Quantos dias à frente olhar: hoje (0) para o disparo da manhã, amanhã (1) para o da tarde. */
export const DIAS_A_FRENTE: Record<QuandoLembrar, number> = { dia: 0, vespera: 1 };

/** O que o lembrete precisa saber de uma cobrança: se é pacote e quais sessões ela cobre. */
export type CobrancaDoLembrete = { tipoDeCobranca: string; ids: string[]; sessoes: number };

/**
 * "Sessão 3 de 4 do pacote" — a posição desta sessão dentro do pacote que a cobre.
 *
 * `null` quando a sessão não pertence a pacote nenhum (avulsa, cortesia, gratuita): aí o texto é
 * o outro, sem contagem. A ordem de `ids` é a cronológica com que o motor fecha a sequência, que é
 * a mesma que a paciente vê na agenda.
 */
export function posicaoNoPacote(cobrancas: CobrancaDoLembrete[], sessaoId: string): { posicao: number; total: number } | null {
  for (const c of cobrancas) {
    if (c.tipoDeCobranca !== "pacote" && c.tipoDeCobranca !== "quinzena") continue;
    const i = c.ids.indexOf(sessaoId);
    if (i >= 0) return { posicao: i + 1, total: Math.max(c.sessoes, c.ids.length) };
  }
  return null;
}

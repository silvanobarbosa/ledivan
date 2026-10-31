/**
 * QUEM É O PACIENTE QUE ELA DISSE.
 *
 * **O Divã nunca escolhe o paciente sozinho.** Medido na base real da Gisele, 28 pacientes: o
 * primeiro nome NÃO identifica ninguém — "Thais" serve a duas, "Fernanda" a duas, e há uma
 * **Eloá** e uma **Eloah**, que são homófonas. Nenhuma transcrição separa essas duas, hoje nem
 * nunca: só perguntar resolve. Na conta de demonstração, com 61, são dezesseis primeiros nomes
 * repetidos — "Tiago" serve a quatro pessoas.
 *
 * Então esta função devolve TRÊS respostas possíveis, e duas delas param para perguntar:
 *
 *   `{ tipo: "um" }`      → um só candidato, e ela ainda confirma na tela;
 *   `{ tipo: "varios" }`  → a tela lista e ela toca;
 *   `{ tipo: "nenhum" }`  → a tela diz que não achou.
 *
 * Função pura.
 */

export type PacienteConhecido = { id: string; nome: string };

export type AchadoDoPaciente =
  | { tipo: "um"; paciente: PacienteConhecido }
  | { tipo: "varios"; candidatos: PacienteConhecido[] }
  | { tipo: "nenhum" };

const semAcento = (s: string) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

/** Palavras que não ajudam a identificar ninguém e atrapalham a comparação. */
const VAZIAS = new Set(["a", "o", "da", "do", "de", "paciente", "sra", "sr", "dona", "senhora", "senhor"]);

const palavras = (s: string) => semAcento(s).split(" ").filter((p) => p && !VAZIAS.has(p));

/** Distância de edição — para aguentar o que a transcrição erra por uma letra. */
function distancia(a: string, b: string): number {
  if (a === b) return 0;
  const m: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array<number>(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return m[a.length][b.length];
}

/** Uma palavra dita "casa" com uma do nome? Igual, ou a uma letra de distância em palavras longas. */
function casa(dita: string, doNome: string): boolean {
  if (dita === doNome) return true;
  if (dita.length < 4 || doNome.length < 4) return false;
  return distancia(dita, doNome) <= 1;
}

export function pacienteDaFala(dito: string, pacientes: PacienteConhecido[]): AchadoDoPaciente {
  const ditas = palavras(dito);
  if (!ditas.length || !pacientes.length) return { tipo: "nenhum" };

  /**
   * Pontua cada paciente: quantas palavras ditas aparecem no nome dele.
   *
   * Quem casa MAIS palavras vence — é o que faz "Thais Duarte" ganhar de "Thais Alves" quando o
   * sobrenome é dito. Empate NÃO é desempatado por critério nenhum: vira pergunta.
   */
  const pontuados = pacientes.map((p) => {
    const doNome = palavras(p.nome);
    const acertos = ditas.filter((d) => doNome.some((n) => casa(d, n))).length;
    return { paciente: p, acertos };
  });

  const melhor = Math.max(...pontuados.map((x) => x.acertos));
  if (melhor === 0) return { tipo: "nenhum" };

  const empatados = pontuados.filter((x) => x.acertos === melhor).map((x) => x.paciente);
  if (empatados.length === 1) return { tipo: "um", paciente: empatados[0] };
  return { tipo: "varios", candidatos: empatados };
}

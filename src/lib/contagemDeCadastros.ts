/**
 * QUANTOS PACIENTES A TERAPEUTA TEM — e por que isso precisava de uma regra escrita.
 *
 * O app tinha TRÊS respostas diferentes para a mesma pergunta, cada tela com a sua:
 *
 * - o painel do dashboard dizia **73**: só `ativo` + `inativo`;
 * - a lista `/dashboard/patients` mostrava **91**: tudo menos `prospect`;
 * - o banco tinha **103**: tudo.
 *
 * A diferença de 18 entre as duas primeiras eram exatamente os PAUSADOS — gente que interrompeu a
 * terapia e é esperada de volta. Eles existiam no banco, apareciam na lista e sumiam do painel.
 *
 * A decisão do dono (22/10/2026): o pausado **entra** em "No cadastro", e ganha número próprio no
 * painel. É justamente quem pede ação — o paciente que pode voltar, ou que ela deveria procurar —,
 * e escondê-lo do painel era esconder o que mais interessa lembrar.
 *
 * `prospect` continua FORA: ainda não é paciente, é alguém que procurou. Ele tem painel próprio
 * (Prospecção) e é o mesmo recorte que a lista de pacientes já usava.
 *
 * Função pura.
 */

export type CadastroContavel = { status: string };

export type ContagemDeCadastros = {
  /** Ativos + pausados + inativos. É o que "No cadastro" quer dizer. */
  noCadastro: number;
  ativos: number;
  /** Interrompeu e é esperado de volta. Nem ativo nem encerrado. */
  pausados: number;
  inativos: number;
};

const ehStatus = (p: CadastroContavel, status: string) => String(p.status ?? "").trim().toLowerCase() === status;

export function contagemDeCadastros(pacientes: CadastroContavel[]): ContagemDeCadastros {
  const ativos = pacientes.filter((p) => ehStatus(p, "ativo")).length;
  const pausados = pacientes.filter((p) => ehStatus(p, "pausado")).length;
  const inativos = pacientes.filter((p) => ehStatus(p, "inativo")).length;
  return { noCadastro: ativos + pausados + inativos, ativos, pausados, inativos };
}

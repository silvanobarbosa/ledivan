/**
 * QUEM "LANÇAR PAGAMENTO" JÁ TRAZ PREENCHIDO — nome e CPF.
 *
 * Doc 66 (dono, 31/10): "deve exibir os dados do responsável; caso não haja nenhum cadastrado, aí
 * sim preencher com os dados do paciente — inclusive se tiver o CPF cadastrado, utilizá-lo".
 *
 * A regra que faltava é mais estreita do que parece, e é por isso que o defeito passou: **o nome e
 * o CPF têm de ser da MESMA pessoa**. A conta antiga era `guardianCpf || cpf`, independente de
 * quem estava no campo do nome — então um cadastro com responsável sem CPF e paciente COM CPF
 * mostrava o nome do responsável ao lado do CPF do paciente. Um cadastro na base estava assim
 * (Giulia / Elaine, medido em 31/10), e um recibo emitido daí atribui a alguém um pagamento que
 * não é dela.
 *
 * A memória do último pagador continua valendo (documento de 17/09): quem paga é fato de cada
 * pagamento, e a terapeuta digitou aquilo uma vez. O que mudou é que, quando esse pagamento não
 * guardou CPF, o CPF vem do cadastro DAQUELA pessoa — comparando o nome — em vez de vir de
 * qualquer um dos dois.
 *
 * Função pura.
 */

export type CadastroDoPagador = {
  pacienteNome: string;
  pacienteCpf?: string | null;
  responsavelNome?: string | null;
  responsavelCpf?: string | null;
};

export type Pagador = { nome: string; cpf: string };

const limpo = (v?: string | null) => (v ?? "").trim();
const mesmaPessoa = (a: string, b: string) => !!a && a.toLowerCase() === b.toLowerCase();

/** O CPF que o cadastro conhece PARA AQUELE NOME. Vazio quando o cadastro não sabe. */
export function cpfCadastradoDe(nome: string, c: CadastroDoPagador): string {
  const alvo = limpo(nome);
  if (mesmaPessoa(alvo, limpo(c.responsavelNome))) return limpo(c.responsavelCpf);
  if (mesmaPessoa(alvo, limpo(c.pacienteNome))) return limpo(c.pacienteCpf);
  return "";
}

/**
 * O NOME COMPLETO, quando o que chegou foi só o primeiro.
 *
 * Doc 70 (dona, 31/10): "existem lançamentos que não estão aparecendo o nome completo — por
 * exemplo a paciente Renata". A memória do último pagador repete o que foi digitado uma vez, e o
 * que foi digitado uma vez pode ter sido "Renata".
 *
 * Medido na base antes de escrever a regra, e o número mudou o desenho: dos 12 pagadores gravados
 * com uma palavra só, **dez têm o cadastro assim** — o responsável chama-se "Gabriela" e pronto.
 * Nesses não há nome completo a buscar, e inventar sobrenome seria pior que o sintoma. O caso da
 * dona é o décimo primeiro: o pagador é a própria paciente, e o cadastro TEM o nome inteiro.
 *
 * Então a regra é estreita: só completa quando o que foi digitado é exatamente o começo de UM dos
 * dois nomes do cadastro. Começando os dois (mãe e filha "Ana"), não dá para saber qual — e aí
 * fica como está, porque errar o nome de quem pagou é pior do que mostrá-lo curto.
 */
export function nomeCompletoDoCadastro(nome: string, c: CadastroDoPagador): string {
  const dito = limpo(nome);
  if (!dito || dito.includes(" ")) return dito;

  const comecaCom = (completo: string) => {
    const alvo = limpo(completo);
    return !!alvo && alvo.toLowerCase().startsWith(`${dito.toLowerCase()} `);
  };
  const candidatos = [limpo(c.responsavelNome), limpo(c.pacienteNome)].filter(comecaCom);
  return candidatos.length === 1 ? candidatos[0] : dito;
}

/**
 * @param ultimo o último pagamento que disse quem pagou, se houver.
 */
export function pagadorSugerido(c: CadastroDoPagador, ultimo?: { nome?: string | null; cpf?: string | null } | null): Pagador {
  const doUltimo = nomeCompletoDoCadastro(limpo(ultimo?.nome ?? ""), c);
  if (doUltimo) return { nome: doUltimo, cpf: limpo(ultimo?.cpf) || cpfCadastradoDe(doUltimo, c) };

  const responsavel = limpo(c.responsavelNome);
  // Há responsável cadastrado: o par é dele. CPF em branco é o cadastro dizendo que não sabe —
  // NÃO é permissão para usar o CPF do paciente.
  if (responsavel) return { nome: responsavel, cpf: limpo(c.responsavelCpf) };

  return { nome: limpo(c.pacienteNome), cpf: limpo(c.pacienteCpf) };
}

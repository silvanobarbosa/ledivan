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
 * @param ultimo o último pagamento que disse quem pagou, se houver.
 */
export function pagadorSugerido(c: CadastroDoPagador, ultimo?: { nome?: string | null; cpf?: string | null } | null): Pagador {
  const doUltimo = limpo(ultimo?.nome);
  if (doUltimo) return { nome: doUltimo, cpf: limpo(ultimo?.cpf) || cpfCadastradoDe(doUltimo, c) };

  const responsavel = limpo(c.responsavelNome);
  // Há responsável cadastrado: o par é dele. CPF em branco é o cadastro dizendo que não sabe —
  // NÃO é permissão para usar o CPF do paciente.
  if (responsavel) return { nome: responsavel, cpf: limpo(c.responsavelCpf) };

  return { nome: limpo(c.pacienteNome), cpf: limpo(c.pacienteCpf) };
}

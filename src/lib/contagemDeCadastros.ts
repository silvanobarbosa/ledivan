/**
 * QUANTOS PACIENTES A TERAPEUTA TEM — e em quais duas caixas eles caem.
 *
 * O painel do dashboard classifica os cadastros em **duas** categorias apenas: Ativos e Inativos
 * (dono, 23/10/2026). Não há caixa para Pausado ali — mas o status existe no cadastro, e os
 * pacientes que estão nele precisam cair em alguma das duas.
 *
 * **A regra: pausado com sessão marcada À FRENTE é Ativo; sem nenhuma, é Inativo.**
 *
 * É o que "pausado" quer dizer na prática. Quem interrompeu mas já tem a volta marcada está em
 * tratamento — some do painel de ativos e a terapeuta perde de vista alguém que ela vai atender na
 * semana que vem. Quem interrompeu e não tem nada marcado não está sendo atendido, e contá-lo como
 * ativo infla o número que ela usa para saber o tamanho da carteira.
 *
 * Medido antes de escolher a regra: dos 18 pausados da base, **nenhum** tinha sessão futura, e a
 * última realizada de todos passava de 136 dias. Pela regra, os 18 caem em Inativos — que é
 * exatamente onde a leitura humana os colocaria.
 *
 * Isto é classificação de EXIBIÇÃO. O status gravado no cadastro continua "pausado": a ficha, a
 * lista de pacientes e o filtro da visão financeira seguem mostrando-o, porque lá a distinção
 * ainda serve. O que o dono pediu foi não ter a caixa separada no painel.
 *
 * `prospect` continua fora de tudo: ainda não é paciente, e tem painel próprio.
 *
 * Função pura.
 */

export type CadastroContavel = {
  status: string;
  /** Tem alguma sessão marcada para o futuro? Só importa para quem está pausado. */
  temAgendaFutura?: boolean;
};

export type ContagemDeCadastros = {
  /** Ativos + inativos. É o que "No cadastro" quer dizer. */
  noCadastro: number;
  ativos: number;
  inativos: number;
};

const normal = (s: string | null | undefined) => String(s ?? "").trim().toLowerCase();

/**
 * Em qual das duas caixas este cadastro cai. `null` = em nenhuma (prospect, status desconhecido).
 */
export function categoriaDoCadastro(p: CadastroContavel): "ativo" | "inativo" | null {
  const s = normal(p.status);
  if (s === "ativo") return "ativo";
  if (s === "inativo") return "inativo";
  if (s === "pausado") return p.temAgendaFutura ? "ativo" : "inativo";
  return null;
}

export function contagemDeCadastros(pacientes: CadastroContavel[]): ContagemDeCadastros {
  let ativos = 0;
  let inativos = 0;
  for (const p of pacientes) {
    const c = categoriaDoCadastro(p);
    if (c === "ativo") ativos += 1;
    else if (c === "inativo") inativos += 1;
  }
  return { noCadastro: ativos + inativos, ativos, inativos };
}

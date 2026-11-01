/**
 * TEM PACOTE EM ANDAMENTO NESTA DATA?
 *
 * Doc 72 (dono): a pergunta "sobre qual pacote aplicar o novo valor?" (doc 69) "deverá ser exibida
 * somente quando houver alteração de valor e existir um pacote em andamento na data informada".
 * Sem pacote partido ao meio não há escolha a fazer: as duas respostas dão o mesmo resultado, e
 * perguntar mesmo assim faz a terapeuta decidir algo que não existe.
 *
 * O julgamento é o MESMO de `partiuNoMeio`, em `preco.ts`, de propósito: a faixa que começa no dia
 * da PRIMEIRA sessão de um pacote não o parte — esse pacote é justamente "o próximo a iniciar".
 * Duas regras diferentes para a mesma pergunta discordariam em silêncio, que é o defeito do doc 71.
 *
 * Comparação por TEXTO `aaaa-mm-dd`: é o que o campo `<input type="date">` entrega, e montar Date
 * a partir dele reintroduz o fuso numa conta que é de dia de calendário.
 *
 * Função pura.
 */

export type JanelaDoPacote = {
  /** O dia da primeira sessão do pacote, `aaaa-mm-dd`. */
  inicio: string;
  /** O dia da última sessão dele, `aaaa-mm-dd`. */
  fim: string;
};

const dia = (iso: string) => (iso ?? "").slice(0, 10);

/** As janelas de cada pacote, a partir das sessões que pertencem a uma cobrança de pacote. */
export function janelasDosPacotes(sessoes: { data: string; chave: string }[]): JanelaDoPacote[] {
  const porChave = new Map<string, { inicio: string; fim: string }>();
  for (const s of sessoes) {
    const d = dia(s.data);
    if (!d || !s.chave) continue;
    const atual = porChave.get(s.chave);
    if (!atual) porChave.set(s.chave, { inicio: d, fim: d });
    else {
      if (d < atual.inicio) atual.inicio = d;
      if (d > atual.fim) atual.fim = d;
    }
  }
  return [...porChave.values()].sort((a, b) => a.inicio.localeCompare(b.inicio));
}

/** A data cai DENTRO de algum pacote (depois da primeira sessão dele, até a última). */
export function pacoteEmAndamentoEm(janelas: JanelaDoPacote[], data: string): boolean {
  const d = dia(data);
  if (!d) return false;
  return janelas.some((j) => j.inicio < d && d <= j.fim);
}

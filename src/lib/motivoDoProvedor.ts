/**
 * POR QUE O DIVÃ NÃO OUVIU — dito, não escondido.
 *
 * "Não consegui ouvir agora" é uma frase honesta para ela e inútil para quem conserta. Em 01/11
 * ela escondeu por dias um 400 de dica longa demais; em 02/11 escondeu outra coisa. E não há para
 * onde correr depois do fato: o projeto está no plano free da Vercel, que **não expõe log de
 * runtime por API** (medido: `/v1/deployments/{id}/runtime-logs` e `/v1/projects/{id}/logs`
 * respondem 404 com o token da casa). O que não viaja na resposta, ninguém lê depois.
 *
 * Então o motivo técnico viaja junto com o erro — curto, de uma linha, para a tela mostrar embaixo
 * da mensagem e ela conseguir ler ou mandar um print.
 *
 * Como isso vai para a tela, ele não pode carregar segredo: a mensagem do provedor às vezes
 * devolve a própria chave dentro ("Incorrect API key provided: sk-..."). Mascarar aqui é a única
 * garantia — ver [[licao-lib-imprime-o-segredo]].
 *
 * Funções puras.
 */

/** O teto do motivo. Uma linha de tela, não um despejo de JSON. */
export const TETO_DO_MOTIVO = 180;

/** Chave de provedor: `sk-...`, `gsk_...`, `api_key_...`. Sobra o prefixo, que já é pista bastante. */
const CHAVE = /\b[A-Za-z]{0,4}(?:sk|key)[-_][A-Za-z0-9_-]{6,}/gi;

export type FalhaDaEscuta = { erro: string; motivo: string | null };

/** O texto legível de um erro desconhecido, sem segredo e numa linha. O teto é aplicado no fim. */
function umaLinha(texto: string): string {
  return texto.replace(CHAVE, (m) => `${m.slice(0, 4)}***`).replace(/\s+/g, " ").trim();
}

/** O teto vale para o motivo INTEIRO, status incluído — é uma linha de tela, não um campo. */
function comTeto(motivo: string): string {
  return motivo.length > TETO_DO_MOTIVO ? `${motivo.slice(0, TETO_DO_MOTIVO - 1)}…` : motivo;
}

/**
 * A mensagem para ELA e o motivo para quem conserta.
 *
 * Chave recusada e limite de uso são coisas que ela resolve, e dizer qual é poupa a viagem
 * inteira. O resto continua genérico na frase principal: detalhe de provedor no lugar da mensagem
 * não ajuda quem só quer ditar uma anotação.
 */
export function falhaDaEscuta(e: unknown): FalhaDaEscuta {
  const bruto = e as { status?: number; message?: string } | null | undefined;
  const status = typeof bruto?.status === "number" ? bruto.status : null;
  const texto = typeof bruto?.message === "string" ? bruto.message : "";

  const erro = status === 401 || status === 403
    ? "Sua chave de IA foi recusada pelo provedor. Confira em Ajustes."
    : status === 429
      ? "Seu provedor de IA está limitando os pedidos agora. Tente em alguns minutos."
      : "Não consegui ouvir agora. Tente de novo.";

  const corpo = umaLinha(texto);
  const motivo = corpo
    ? comTeto(status ? `${status} · ${corpo}` : corpo)
    : status ? String(status) : null;

  return { erro, motivo };
}

/**
 * Prints anexados ao "Reportar erro" (doc 51).
 *
 * O anexo viaja dentro do próprio chamado (`context.extra.anexos`), que o hub grava num campo
 * jsonb. Isso evita criar rota de upload e armazenamento só para isto — mas obriga disciplina de
 * tamanho: base64 dentro de JSON em banco incha rápido, e um print de celular moderno passa
 * fácil de 3 MB.
 *
 * Por isso a imagem é REDUZIDA no navegador antes de virar texto. O que o suporte precisa é
 * enxergar a tela, não ter o original em resolução máxima.
 */

/** Quantos prints por chamado. Três cobrem "antes, durante e depois" sem virar um álbum. */
export const LIMITE_ANEXOS = 3;

/** Maior lado da imagem depois de reduzida. 1280 mantém texto de tela legível. */
export const LADO_MAXIMO = 1280;

/** Teto por arquivo ANTES de reduzir. Acima disso nem vale tentar — é vídeo ou foto gigante. */
export const TAMANHO_MAXIMO_BYTES = 12 * 1024 * 1024;

export type ArquivoSimples = { type: string; size: number; name?: string };

export type Recusa = { ok: false; motivo: string };
export type Aceite = { ok: true };

/**
 * O arquivo serve como print? Mensagem de recusa escrita para quem está com um problema na tela
 * — dizer "tipo inválido" não ajuda ninguém.
 */
export function aceitaArquivo(f: ArquivoSimples, jaAnexados: number): Aceite | Recusa {
  if (jaAnexados >= LIMITE_ANEXOS) {
    return { ok: false, motivo: `Já são ${LIMITE_ANEXOS} prints. Remova um para anexar outro.` };
  }
  if (!String(f.type || "").startsWith("image/")) {
    return { ok: false, motivo: "Anexe uma imagem (print da tela)." };
  }
  if (!Number.isFinite(f.size) || f.size <= 0) {
    return { ok: false, motivo: "Arquivo vazio." };
  }
  if (f.size > TAMANHO_MAXIMO_BYTES) {
    return { ok: false, motivo: "Imagem muito grande. Tire um print da tela em vez de enviar a foto original." };
  }
  return { ok: true };
}

/**
 * O tamanho que a imagem terá depois de reduzida, preservando a proporção.
 * Imagem já menor que o limite não é AMPLIADA — ampliar só gera peso sem ganho.
 */
export function dimensaoReduzida(largura: number, altura: number, ladoMaximo = LADO_MAXIMO): { largura: number; altura: number } {
  const w = Math.max(1, Math.round(largura) || 1);
  const h = Math.max(1, Math.round(altura) || 1);
  const maior = Math.max(w, h);
  if (maior <= ladoMaximo) return { largura: w, altura: h };
  const fator = ladoMaximo / maior;
  return { largura: Math.max(1, Math.round(w * fator)), altura: Math.max(1, Math.round(h * fator)) };
}

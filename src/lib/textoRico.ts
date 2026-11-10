/**
 * O TEXTO FORMATADO DOS DOCUMENTOS (doc 63).
 *
 * A área Documentos ganhou barra de formatação — fonte, tamanho, cor, alinhamento e marcador —, e
 * com ela o conteúdo salvo deixou de ser texto puro e passou a ser HTML. Dois mundos convivem no
 * mesmo campo: tudo o que foi escrito ANTES desta mudança está lá como texto com quebras de linha,
 * e o relatório gerado pela IA também nasce assim. Por isso nada aqui presume HTML: o que chega em
 * texto é convertido na leitura, sem migração e sem reescrever o que já está salvo.
 *
 * Este módulo é puro e roda nos dois lados. A FAXINA do HTML (o que pode entrar no banco) mora em
 * `htmlDoDocumento.ts`, que é do servidor — a biblioteca que a faz não tem por que viajar para o
 * navegador.
 */

/** As tags que um documento pode carregar. O que o editor produz, e nada além disso. */
export const TAGS_DO_DOCUMENTO = [
  "p", "div", "br", "span", "b", "strong", "i", "em", "u", "s", "strike", "ul", "ol", "li",
];

const ESCAPA: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

/** Texto do usuário virando texto de HTML: nada do que ele escreveu vira marcação. */
export function escaparHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ESCAPA[c]);
}

/**
 * Já é HTML, ou é texto puro?
 *
 * Pergunta pela PRESENÇA de uma tag nossa, não pela de um `<` qualquer: "sessão das 9 < das 10" é
 * texto, e tratá-lo como marcação apagaria pedaço do documento.
 */
export function ehHtml(conteudo: string): boolean {
  return new RegExp(`<(${TAGS_DO_DOCUMENTO.join("|")})(\\s[^>]*)?/?>`, "i").test(conteudo);
}

/**
 * O conteúdo salvo virando o HTML que o editor e a impressão mostram.
 *
 * Texto puro vira uma linha por `div`, que é o que o próprio campo editável produz ao digitar —
 * assim o documento antigo entra no editor novo já no formato em que ele vai continuar.
 */
export function comoHtml(conteudo: string): string {
  const c = conteudo ?? "";
  if (ehHtml(c)) return c;
  if (!c.trim()) return "";
  return c
    .split(/\r?\n/)
    .map((linha) => (linha.trim() ? `<div>${escaparHtml(linha)}</div>` : "<div><br></div>"))
    .join("");
}

const DESESCAPA: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " ",
};

/**
 * O documento em texto corrido — para o rótulo na lista, para a pergunta do "excluir" e para
 * qualquer lugar que mostre o conteúdo SEM formatação. Não é faxina de segurança: é leitura.
 */
export function somenteTexto(conteudo: string): string {
  if (!ehHtml(conteudo ?? "")) return (conteudo ?? "").trim();
  return conteudo
    .replace(/<\s*(br|\/p|\/div|\/li)\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/gi, (m) => DESESCAPA[m.toLowerCase()] ?? m)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

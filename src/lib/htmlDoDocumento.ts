import "server-only";
import sanitizeHtml from "sanitize-html";
import { TAGS_DO_DOCUMENTO } from "@/lib/textoRico";

/**
 * A FAXINA do HTML de um documento, feita no servidor, antes de gravar (doc 63).
 *
 * O editor só produz o que a barra de formatação manda, e o campo recebe colagem como texto puro —
 * mas nada disso é garantia: quem posta é o navegador, e um Server Action aceita o que mandarem.
 * O que entra no banco é o que depois volta para a tela e para o papel, então a fronteira é aqui.
 *
 * Passam as tags do editor e, dentro de `style`, só as quatro propriedades que a barra aplica.
 * Some tudo o mais — atributo de evento, `href`, `src`, classe, id, tag fora da lista.
 */
export function limparHtmlDoDocumento(html: string): string {
  return sanitizeHtml(html ?? "", {
    allowedTags: [...TAGS_DO_DOCUMENTO],
    allowedAttributes: { "*": ["style"] },
    allowedStyles: {
      "*": {
        // Nome de fonte, tamanho e alinhamento: palavras, aspas e medidas. Nada de `url(...)`.
        "font-family": [/^[\w\s"',-]+$/],
        "font-size": [/^[\w.%-]+$/],
        "text-align": [/^(left|center|right|justify)$/],
        // Cor: só as três do documento, nos formatos que o navegador escreve.
        color: [/^#[0-9a-fA-F]{3,6}$/, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/, /^[a-z]+$/],
      },
    },
    // Um documento não tem link nem imagem; não há esquema a liberar.
    allowedSchemes: [],
    disallowedTagsMode: "discard",
  });
}

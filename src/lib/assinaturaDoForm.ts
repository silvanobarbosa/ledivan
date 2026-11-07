/**
 * A ASSINATURA DO QUE O FORMULÁRIO MOSTRA (doc 62).
 *
 * O formulário do cadastro é enviado por Server Action, e seus campos são NÃO-CONTROLADOS: quem
 * manda neles é o `defaultValue`, que o React só aplica ao MONTAR. Terminada a ação, o React
 * reseta o form e cada campo volta ao valor que está no DOM — o antigo. O doc 67 já tinha
 * trocado a tela por uma navegação nova, que traz os dados salvos; mas navegar não remonta o
 * componente, porque o React reconcilia o mesmo elemento no mesmo lugar. Os dados novos chegam e
 * os campos continuam exibindo os velhos.
 *
 * Com uma `key` derivada do que o servidor devolveu, a troca de valor vira troca de identidade: o
 * React desmonta e monta de novo, e TODOS os `defaultValue` são aplicados. Enquanto nada muda a
 * chave é a mesma, então digitar não remonta nada.
 *
 * Função pura. Hash FNV-1a em base 36 — não é criptografia, é só um nome curto e estável para um
 * conteúdo; o que importa é mudar quando o conteúdo muda.
 */

/** JSON com as chaves em ordem, para que a mesma informação dê sempre o mesmo texto. */
function estavel(valor: unknown): string {
  if (valor === null || typeof valor !== "object") return JSON.stringify(valor ?? null) ?? "null";
  if (Array.isArray(valor)) return `[${valor.map(estavel).join(",")}]`;
  if (valor instanceof Date) return JSON.stringify(valor.toISOString());
  const o = valor as Record<string, unknown>;
  return `{${Object.keys(o).sort().map((k) => `${JSON.stringify(k)}:${estavel(o[k])}`).join(",")}}`;
}

export function assinaturaDoForm(dados: unknown): string {
  const texto = estavel(dados);
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/**
 * Leitura de recibo/nota a partir do TEXTO cru de um OCR (doc 47).
 *
 * O OCR grátis (Tesseract, no navegador) devolve texto bruto, barulhento. Esta função pura tira dele
 * o essencial de um lançamento: valor, data e uma descrição. Fica longe do OCR e da tela para a
 * heurística poder ser conferida sozinha — OCR erra, então o resultado é SEMPRE um palpite que a
 * pessoa confere (o recurso é bom, mas tem limitação).
 */

export type ReciboLido = {
  valor?: number;
  /** YYYY-MM-DD (hora de parede, sem fuso). */
  dataISO?: string;
  descricao?: string;
};

/** "1.234,56" | "1234,56" | "12,00" → number. Devolve null se não casar. */
function moedaBR(bruto: string): number | null {
  const n = Number(bruto.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Todos os valores monetários (padrão brasileiro) de uma linha, em ordem. */
function valoresDaLinha(linha: string): number[] {
  const out: number[] = [];
  const re = /(?:R\$\s*)?(\d{1,3}(?:\.\d{3})+|\d+),(\d{2})(?!\d)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(linha)) !== null) {
    const v = moedaBR(`${m[1]},${m[2]}`);
    if (v != null) out.push(v);
  }
  return out;
}

/** Normaliza um ano de 2 dígitos para 20xx; mantém 4 dígitos. */
function anoCheio(a: string): string {
  return a.length === 2 ? `20${a}` : a;
}

/** A primeira data plausível do texto, como YYYY-MM-DD. */
function acharData(texto: string): string | undefined {
  const dmy = texto.match(/\b(\d{2})\/(\d{2})\/(\d{2,4})\b/);
  if (dmy) {
    const dia = Number(dmy[1]), mes = Number(dmy[2]);
    if (dia >= 1 && dia <= 31 && mes >= 1 && mes <= 12) {
      return `${anoCheio(dmy[3])}-${dmy[2]}-${dmy[1]}`;
    }
  }
  const iso = texto.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const mes = Number(iso[2]), dia = Number(iso[3]);
    if (mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  }
  return undefined;
}

/** O valor do recibo: prefere a linha de TOTAL (não SUBTOTAL); senão, o maior valor visto. */
function acharValor(linhas: string[]): number | undefined {
  const totais: number[] = [];
  let maior: number | undefined;

  for (const linha of linhas) {
    const vs = valoresDaLinha(linha);
    for (const v of vs) if (maior === undefined || v > maior) maior = v;

    const baixa = linha.toLowerCase();
    // "total" valendo, mas não "subtotal" / "total de itens" (contagem, não dinheiro).
    const ehTotal = /\btotal\b/.test(baixa) && !/\bsub\s*-?\s*total\b/.test(baixa);
    const ehValorAPagar = /valor\s+(a\s+pagar|total|pago)|total\s+a\s+pagar|total\s+r\$/.test(baixa);
    if ((ehTotal || ehValorAPagar) && vs.length) totais.push(Math.max(...vs));
  }

  if (totais.length) return Math.max(...totais);
  return maior;
}

/** A descrição: a primeira linha "de texto" (nome do estabelecimento), limpa e curta. */
function acharDescricao(linhas: string[]): string | undefined {
  for (const bruta of linhas) {
    const linha = bruta.trim();
    if (linha.length < 3) continue;
    const letras = (linha.match(/[A-Za-zÀ-ÿ]/g) || []).length;
    // Precisa parecer texto (tem letras) e não ser um cabeçalho fiscal genérico.
    if (letras < 3) continue;
    if (/^(cupom|nota fiscal|documento|cnpj|cpf|data|hora)\b/i.test(linha)) continue;
    return linha.replace(/\s{2,}/g, " ").slice(0, 60);
  }
  return undefined;
}

/** Lê um recibo a partir do texto cru do OCR. Tudo é opcional: o que não achar, não inventa. */
export function lerReciboTexto(texto: string): ReciboLido {
  const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out: ReciboLido = {};
  const valor = acharValor(linhas);
  if (valor != null) out.valor = valor;
  const dataISO = acharData(texto);
  if (dataISO) out.dataISO = dataISO;
  const descricao = acharDescricao(linhas);
  if (descricao) out.descricao = descricao;
  return out;
}

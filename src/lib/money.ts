/**
 * Parser de moeda em pt-BR → string decimal canônica ("1500.00") pronta para coluna numeric.
 *
 * Por que existe: o código espalhava `String(v).replace(",", ".")`, que troca só a PRIMEIRA
 * ocorrência. "1.500,00" virava "1.500.00" → Postgres `22P02 invalid input syntax for numeric`
 * → o insert do cadastro estourava com 500. Pior ainda em silêncio: "1.500" (sem centavos)
 * era gravado como 1.50 — preço errado sem erro nenhum.
 *
 * Regras (a entrada vem de um formulário pt-BR, placeholder "200,00", inputMode decimal):
 *  - tem vírgula  → vírgula é o decimal; pontos são separador de milhar e somem.
 *  - só ponto(s):
 *      · um único ponto com 1–2 casas ("200.5", "200.50") → ponto é decimal, mantém.
 *      · qualquer outro caso ("1.500", "1.000.000") → pontos são milhar e somem.
 *  - remove "R$", espaços e demais caracteres não numéricos.
 * Retorna null se não sobrar número finito (deixa o chamador decidir: erro amigável ou default).
 */
export function parseMoedaBR(raw: unknown): string | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;

  const negativo = /^-/.test(s.replace(/[^\d,.-]/g, ""));
  // mantém só dígitos, ponto e vírgula
  s = s.replace(/[^\d.,]/g, "");
  if (!s) return null;

  if (s.includes(",")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (!/^\d+\.\d{1,2}$/.test(s)) {
    // sem vírgula e não é "inteiro.decimal de 1-2 casas" → pontos são milhar
    s = s.replace(/\./g, "");
  }

  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  const val = negativo ? -Math.abs(n) : n;
  return val.toFixed(2);
}

/** Igual ao parseMoedaBR, mas devolve `fallback` quando a entrada é vazia/ inválida. */
export function moedaOuPadrao(raw: unknown, fallback = "0"): string {
  return parseMoedaBR(raw) ?? fallback;
}

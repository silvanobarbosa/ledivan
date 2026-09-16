/**
 * A mensagem de COBRANÇA, personalizável por terapeuta (dono, 16/09/2026).
 *
 * A terapeuta escreve um modelo com variáveis — `{nome}`, `{valor}`, `{vencimento}` — e o sistema
 * troca pelos dados da cobrança na hora de mandar. Sem modelo, usa o texto padrão. Função pura.
 */

export const VARIAVEIS_COBRANCA = ["{nome}", "{valor}", "{vencimento}"] as const;

export const MODELO_PADRAO_COBRANCA =
  "Olá {nome}! Passando para lembrar do pagamento de {valor}, com vencimento em {vencimento}. " +
  "Qualquer dúvida, estou à disposição 🙂";

export type DadosDaCobranca = {
  /** Primeiro nome do paciente (ou responsável). */
  nome: string;
  /** Já formatado, ex.: "R$ 520,00". */
  valor: string;
  /** Já formatado, ex.: "05/10". Vazio quando não há data (cobrança sem vencimento). */
  vencimento?: string | null;
};

/** Troca as variáveis do modelo pelos dados. Modelo vazio cai no padrão. */
export function montarMensagemCobranca(modelo: string | null | undefined, dados: DadosDaCobranca): string {
  const base = (modelo ?? "").trim() || MODELO_PADRAO_COBRANCA;
  const primeiroNome = (dados.nome || "").trim().split(/\s+/)[0] || "";
  return base
    .replaceAll("{nome}", primeiroNome)
    .replaceAll("{valor}", dados.valor || "")
    .replaceAll("{vencimento}", (dados.vencimento || "").trim() || "a combinar");
}

/**
 * Lê um segredo obrigatório do ambiente, na ordem dada, e FALHA ALTO se nenhum existir.
 *
 * Existe porque `patient-token.ts` e `confirm-token.ts` traziam um literal de fallback
 * ("ledivan-patient-fallback", "ledivan-confirm-fallback") — que está no repositório, logo é
 * público. Se o app subisse sem a env, qualquer um forjaria o token e leria o espaço do paciente
 * ou confirmaria sessões alheias. Segredo ausente = erro, nunca um valor inventado. Mesmo
 * princípio que `session-secret.ts` já aplica ao cookie de sessão.
 */
export function segredoObrigatorio(...envNames: string[]): string {
  for (const name of envNames) {
    const v = process.env[name];
    if (v && v.length >= 16) return v;
  }
  throw new Error(
    `Segredo ausente: defina uma de [${envNames.join(", ")}] (>=16 chars). Necessário para assinar/verificar tokens.`,
  );
}

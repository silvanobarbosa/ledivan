/**
 * A PENEIRA, antes de qualquer texto de erro ir para o banco ou para a tela.
 *
 * Mensagem de erro de driver de banco carrega a string de conexão INTEIRA, com a senha — já
 * aconteceu nesta casa. O que sai daqui não tem credencial, não tem token e não tem a chave de IA
 * da terapeuta, e trunca, porque pilha inteira não cabe e não ajuda.
 *
 * Mora fora de `falhas.ts` de propósito: `falhas.ts` abre conexão com o banco ao ser importado, e o
 * que precisa de teste é justamente esta função. O que não se testa, não se confia.
 */
export function peneirar(texto: string | null | undefined, limite = 2000): string {
  if (!texto) return "";
  return String(texto)
    // postgres://usuario:senha@host/base → o esquema e mais nada.
    .replace(/\b([a-z][a-z0-9+.-]*):\/\/[^\s"'<>]+/gi, "$1://[omitido]")
    // Chave de provedor de IA e afins: prefixo conhecido seguido de corpo longo.
    .replace(/\b(sk|rk|pk|gsk|xoxb|ghp|ya29)[-_][A-Za-z0-9_-]{8,}/gi, "[chave omitida]")
    // Qualquer palavra que se anuncie como segredo e venha com valor colado. A aspa opcional antes
    // do separador é o caso do JSON (`"token":"abc"`), que é como erro de API chega — sem ela a
    // peneira passava reto pelo formato mais comum de todos.
    .replace(/\b(password|senha|secret|token|api[_-]?key|authorization)\b"?\s*[:=]\s*"?[^\s,}"]+/gi, "$1=[omitido]")
    // Sobra longa de base64/hex que não é palavra de gente — chave ou cookie assinado.
    .replace(/\b[A-Za-z0-9_-]{40,}\b/g, "[longo omitido]")
    .slice(0, limite);
}

/**
 * Um código curto e legível em voz alta, para a pessoa ditar o que está na tela.
 *
 * Seis caracteres de A-Z0-9: é o que cabe numa foto de tela e no telefone, e o bastante para não
 * colidir no volume de falhas de um consultório. Não é identificador de segurança: quem acha a
 * linha pelo código é quem já tem acesso ao banco.
 */
export function codigoDaFalha(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase().padEnd(6, "0");
}

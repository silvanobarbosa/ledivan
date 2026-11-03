/**
 * ENTRAR SEM SENHA, com um código de 6 dígitos (doc 55).
 *
 * O pedido da terapeuta foi direto: *"tem como o sistema configurar o acesso de uma forma mais
 * simples, sendo esse feito apenas com o usuário informando o e-mail e o telegram do mesmo"*.
 * Senha é a coisa que ela esquece, e "esqueci a senha" é a tela que ninguém quer abrir às oito
 * da noite com paciente esperando.
 *
 * Este arquivo é a parte que se testa: gerar, guardar com segurança, e decidir se um código vale.
 * Quem fala com e-mail, Telegram e cookie é a rota.
 *
 * Três decisões de segurança que moram aqui:
 *
 * 1. **O código NÃO é guardado em claro.** Vai um HMAC-SHA256 dele. O fluxo do paciente guarda o
 *    código puro (`patient_auth_code.code`), e isso significa que quem lê o banco entra na conta
 *    de qualquer um durante os 10 minutos de validade. Não repito isso aqui.
 * 2. **A comparação é em tempo constante.** Comparar hash com `===` vaza, por tempo, quantos
 *    caracteres bateram. Com 6 dígitos e um atacante paciente, isso encurta a busca.
 * 3. **O código morre de três formas:** expira em 10 minutos, é usado uma vez, ou estoura as
 *    tentativas. Faltar qualquer uma transforma 6 dígitos numa senha fraca e permanente.
 */

import crypto from "node:crypto";

/** 10 minutos: tempo de ir no e-mail e voltar, não de deixar aberto. */
export const VALIDADE_MS = 10 * 60_000;
/** Erros antes de o código ser queimado. 6 dígitos são 1 milhão — 5 chutes não chegam perto. */
export const MAX_TENTATIVAS = 5;

/** Um código de 6 dígitos, de fonte criptográfica. `Math.random()` não serve para isto. */
export function gerarCodigo(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

/**
 * O que vai para o banco. HMAC, não hash simples: sem o segredo do servidor, uma tabela de
 * 1 milhão de hashes resolveria todos os códigos possíveis em um passe.
 */
export function hashDoCodigo(codigo: string, segredo: string): string {
  if (!segredo) throw new Error("segredo ausente para o código de acesso");
  return crypto.createHmac("sha256", segredo).update(codigo).digest("hex");
}

/** Comparação em tempo constante, resistente a tamanhos diferentes. */
export function hashConfere(a: string, b: string): boolean {
  const x = Buffer.from(a ?? "", "utf8");
  const y = Buffer.from(b ?? "", "utf8");
  if (x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}

export type CodigoGravado = {
  codigoHash: string;
  expiraEm: Date | string;
  tentativas: number;
  usadoEm: Date | string | null;
};

export type Veredito =
  | { ok: true }
  | { ok: false; motivo: "expirado" | "usado" | "tentativas" | "incorreto" };

/** Normaliza o que a pessoa digitou: ela cola com espaço, traço, ou o código dentro de uma frase. */
export function digitosDoCodigo(bruto: string): string {
  return (bruto ?? "").replace(/\D/g, "").slice(0, 6);
}

/**
 * O código digitado vale?
 *
 * A ORDEM importa: expiração e uso vêm ANTES da comparação. Checar o código primeiro faria o
 * servidor responder "incorreto" para um código certo porém vencido — e a pessoa ficaria
 * conferindo os dígitos de um código que estava certo o tempo todo.
 */
export function conferirCodigo(
  gravado: CodigoGravado | null | undefined,
  digitado: string,
  segredo: string,
  agora = new Date(),
): Veredito {
  if (!gravado) return { ok: false, motivo: "incorreto" };
  if (gravado.usadoEm) return { ok: false, motivo: "usado" };
  if (new Date(gravado.expiraEm).getTime() < agora.getTime()) return { ok: false, motivo: "expirado" };
  if (gravado.tentativas >= MAX_TENTATIVAS) return { ok: false, motivo: "tentativas" };

  const limpo = digitosDoCodigo(digitado);
  if (limpo.length !== 6) return { ok: false, motivo: "incorreto" };
  return hashConfere(gravado.codigoHash, hashDoCodigo(limpo, segredo))
    ? { ok: true }
    : { ok: false, motivo: "incorreto" };
}

/** O que a pessoa lê na tela. Nunca diz se a conta existe. */
export const RECADO: Record<Exclude<Veredito, { ok: true }>["motivo"], string> = {
  expirado: "Esse código expirou. Peça um novo.",
  usado: "Esse código já foi usado. Peça um novo.",
  tentativas: "Muitas tentativas com esse código. Peça um novo.",
  incorreto: "Código incorreto.",
};

/** A mensagem enviada pelo canal escolhido. Curta: ela lê no aviso do celular. */
export function mensagemDoCodigo(codigo: string): string {
  return `Seu código de acesso ao Ledivan: ${codigo}\nVale por 10 minutos e só pode ser usado uma vez.\nSe não foi você que pediu, ignore esta mensagem.`;
}

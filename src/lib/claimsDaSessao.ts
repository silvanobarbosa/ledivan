/**
 * O QUE UMA SESSÃO CARREGA — num lugar só (achado de 13/11/2026).
 *
 * A conta de demonstração (Dr. Sócrates) é pública: a senha dela está no repositório de propósito,
 * e o repositório é público. O que impede um visitante de ESTRAGAR a conta que todos veem é um
 * claim só — `demo` no token —, que o proxy usa para recusar qualquer método de escrita.
 *
 * O claim era posto à mão em cada porta de entrada. O login do app nativo punha; o login por SENHA
 * do site, não. Quem lesse o repo entrava pelo site com aquela senha e recebia sessão SEM a marca:
 * escrita liberada. Provado em 13/11 — o token voltava `{"userId":"…","via":"senha"}`, sem `demo`.
 *
 * A correção não é "lembrar de pôr nas quatro portas": é não haver onde esquecer. Toda porta monta
 * os claims aqui, a partir da LINHA DO USUÁRIO. Porta nova que invente os claims por conta própria
 * é a única forma de o furo voltar — e é o que este arquivo torna visível em revisão.
 *
 * Função pura.
 */

/**
 * Por onde a pessoa entrou. O tipo é o que já existia em `session-secret` — duas listas do mesmo
 * conjunto divergem na primeira porta nova que alguém acrescenta num lado só.
 */
import type { ViaDaSessao } from "./session-secret";
export type ViaDeEntrada = ViaDaSessao;

/**
 * Os claims da sessão daquele usuário.
 *
 * `demo` exige o booleano `true` de verdade: um "true" de texto, vindo de uma leitura frouxa, não
 * pode trancar uma conta real em somente-leitura — nem um `1` pode passar por marca válida.
 */
export function claimsDaSessao(
  usuario: { isDemo?: boolean | null },
  via: ViaDeEntrada,
): { via: ViaDeEntrada; demo: boolean } {
  return { via, demo: usuario.isDemo === true };
}

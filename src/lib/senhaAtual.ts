import type { ViaDaSessao } from "./session-secret";

/**
 * A senha atual é exigida para trocar a senha? (doc 19)
 *
 * Só quando as DUAS coisas são verdade: já existe uma senha, e foi ela que abriu esta sessão.
 * Quem entrou pelo Google ou pelo código do e-mail já provou quem é por um caminho que não passa
 * pela senha — pedir a antiga ali não protege o cadastro, só impede de consertá-lo. Para quem
 * entrou COM a senha a trava continua sendo o que sempre foi: a defesa contra alguém que senta
 * num navegador já logado e troca a senha da terapeuta.
 *
 * Função pura, em arquivo próprio: `comoEntrou` lê o cookie e por isso arrasta o segredo da
 * sessão junto, que não carrega em teste nem em Client Component.
 */
export function pedeSenhaAtual(temSenha: boolean, via: ViaDaSessao | null): boolean {
  return temSenha && via !== "google" && via !== "codigo";
}

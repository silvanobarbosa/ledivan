/**
 * Decide se o tour de boas-vindas deve abrir sozinho.
 *
 * Existe como função pura (fora do componente) porque a regra já quebrou o app uma vez e
 * precisa de teste: o `OnboardingTour` é montado no layout do dashboard, então até então ele
 * auto-abria sobre QUALQUER página filha. Sendo um backdrop `fixed inset-0 z-[100]`, ele
 * engolia o primeiro clique — em "Novo paciente", apertar "Cadastrar paciente" só fechava o
 * tour, e o cadastro parecia não funcionar.
 */
export function deveAbrirTour(opts: {
  /** rota atual, ex.: "/dashboard" ou "/dashboard/patients/new" */
  pathname: string;
  /** valor do parâmetro ?tour= na URL */
  tourParam?: string | null;
  /** já dispensou o tour antes (flag no localStorage) */
  jaViu: boolean;
}): boolean {
  // Pedido explícito (link ?tour=1 ou botão da Ajuda) vale em qualquer tela.
  if (opts.tourParam === "1") return true;
  // Sozinho, só na home do dashboard — nunca por cima de um formulário.
  return opts.pathname === "/dashboard" && !opts.jaViu;
}

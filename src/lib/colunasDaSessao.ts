import { therapySessions } from "@/db/schema";

/**
 * AS COLUNAS QUE O MOTOR DE COBRANÇAS PRECISA LER.
 *
 * Existe porque a lista estava copiada em quatro telas, e uma delas ficou para trás. Quando o doc
 * 54 acrescentou `faltou_conta`, só a guia Geral passou a trazê-la — a agenda, a Fechamento e a
 * lista de pacientes continuaram sem. O efeito não foi um erro na tela: foi o motor recebendo um
 * dado a menos e respondendo OUTRA COISA, em silêncio.
 *
 * Na agenda, a sessão marcada "Faltou" com a resposta "não abater" avançava a numeração; na guia
 * Geral, não. A mesma sessão aparecia como 2/4 numa tela e 1/4 na outra, e foi assim que a
 * terapeuta percebeu — com um print, depois de a conferência automática passar verde.
 *
 * Na Fechamento, o mesmo dado faltando mudava o DINHEIRO do mês.
 *
 * Agora a lista mora aqui. Acrescentar uma coluna que o motor lê é mexer num lugar só, e nenhuma
 * tela pode ficar para trás sem alguém notar.
 */
export const COLUNAS_DA_SESSAO = {
  id: therapySessions.id,
  date: therapySessions.date,
  status: therapySessions.status,
  /** `consulta` ou `devolutiva` — a devolutiva comum fica fora da sequência. */
  sessionKind: therapySessions.sessionKind,
  /** Devolutiva marcada para ocupar posição no pacote. */
  abaterDoPacote: therapySessions.abaterDoPacote,
  chargeable: therapySessions.chargeable,
  /** Doc 45/54: a resposta de "Faltou". É a que faltava em três telas. */
  faltouConta: therapySessions.faltouConta,
  /** Doc 54: atendimento do pacote dado de cortesia. */
  cortesia: therapySessions.cortesia,
  /** Sessão extra, fora da sequência: `avul` cobra à parte, `grat` não cobra. */
  extra: therapySessions.extra,
  valorExtra: therapySessions.valorExtra,
  /** Qual desmarcada esta aqui repõe — reposição ocupa vaga, não cria. */
  repoeSessaoId: therapySessions.repoeSessaoId,
} as const;

/** O mesmo, mais o dono da linha — para as telas que leem vários pacientes de uma vez. */
export const COLUNAS_DA_SESSAO_COM_PACIENTE = {
  ...COLUNAS_DA_SESSAO,
  patientId: therapySessions.patientId,
} as const;

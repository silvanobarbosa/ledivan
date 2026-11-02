/**
 * O DIVÃ — o assistente que pergunta "o que deseja fazer?" e leva até lá.
 *
 * Três regras o definem, e as três existem para que ele nunca invente nada:
 *
 * 1. **O catálogo é FECHADO.** Ele só oferece o que o app sabe fazer, e cada item é uma rota que
 *    existe. Um assistente que compõe caminhos livremente acaba oferecendo uma tela que não há.
 * 2. **O modelo OUVE; o app DECIDE.** A fala vira texto no provedor da terapeuta (Whisper) e o
 *    texto vira tarefa aqui, por correspondência determinística sobre um vocabulário fechado.
 *    Nenhum modelo escolhe a ação, calcula número ou resolve paciente — se escolhesse, uma hora
 *    escolheria errado, com fluência. Não entendeu, pergunta.
 * 3. **Ele orienta sobre a PRÁTICA e o APP, nunca sobre conduta clínica.** A fronteira está aqui,
 *    no catálogo, e não numa instrução de prompt que se possa contornar.
 *
 * Funções puras.
 */

export type TarefaDoDiva = {
  /** Identificador estável — é o que os testes e o histórico usam. */
  id: string;
  /** O que a terapeuta lê. Sempre um verbo: ela veio fazer alguma coisa. */
  rotulo: string;
  /** Para onde levar. Rota que EXISTE no app. */
  rota: string;
  /** Uma linha de ajuda, quando o rótulo sozinho não basta. */
  dica?: string;
  /**
   * O rótulo é um verbo que ESCREVE alguma coisa, e a voz, aqui, só abre a tela.
   *
   * Existe por um caso real (01/11): ela ditou "dar entrada em um pagamento para a paciente
   * Talita", o Divã entendeu, mostrou um botão verde "Lançar um pagamento", levou-a à tela — e
   * nada foi lançado. O app não errou; ele rebaixou um pedido completo a uma navegação **sem
   * dizer**, e ela saiu achando que tinha lançado.
   *
   * Uma fala COMPLETA (verbo + paciente + valor) vira comando e nem passa por aqui. Isto é para
   * a fala incompleta: a tela diz, em uma linha, que o preenchimento é lá.
   */
  soLeva?: boolean;
  /**
   * O que reconhecer na fala. Minúsculas e sem acento — a comparação normaliza os dois lados.
   * Pensados como a terapeuta fala, não como o menu se chama ("quem me deve", "quem ta devendo").
   */
  ditos: string[];
};

export const TAREFAS: TarefaDoDiva[] = [
  {
    id: "agenda-hoje",
    rotulo: "Ver a agenda de hoje",
    rota: "/dashboard/agenda",
    ditos: ["agenda", "agenda de hoje", "tenho hoje", "meus atendimentos", "minha agenda", "quem eu atendo hoje", "quem atendo hoje", "sessoes de hoje", "ver a semana"],
  },
  {
    id: "marcar",
    rotulo: "Marcar um atendimento",
    rota: "/dashboard/agenda?novo=1",
    dica: "Abre a agenda com a janela de novo atendimento.",
    ditos: ["marcar", "marcar atendimento", "marcar sessao", "agendar", "agendar paciente", "novo atendimento", "nova sessao", "encaixar"],
  },
  {
    id: "bloquear",
    rotulo: "Bloquear um horário",
    rota: "/dashboard/agenda?bloquear=1",
    dica: "Para congresso, férias ou um dia que não vai atender.",
    soLeva: true,
    ditos: ["bloquear", "bloquear horario", "bloquear o dia", "nao vou atender", "ferias", "congresso"],
  },
  {
    id: "lancar-pagamento",
    rotulo: "Lançar um pagamento",
    rota: "/dashboard/pagamentos",
    soLeva: true,
    ditos: ["lancar pagamento", "lancar", "receber", "recebi", "pagamento", "pagou", "dar baixa", "baixa"],
  },
  {
    id: "devendo",
    rotulo: "Ver quem está devendo",
    rota: "/dashboard/fechamento",
    ditos: ["quem esta devendo", "quem ta devendo", "quem me deve", "devendo", "em atraso", "atrasados", "inadimplentes", "cobrancas"],
  },
  {
    id: "recibo",
    rotulo: "Emitir um recibo",
    rota: "/dashboard/pagamentos",
    dica: "No pagamento desejado, clique em recibo.",
    soLeva: true,
    ditos: ["recibo", "emitir recibo", "nota", "comprovante"],
  },
  {
    id: "novo-paciente",
    rotulo: "Cadastrar um paciente",
    rota: "/dashboard/patients/new",
    soLeva: true,
    ditos: ["cadastrar", "novo paciente", "cadastrar paciente", "paciente novo", "incluir paciente"],
  },
  {
    id: "pacientes",
    rotulo: "Abrir um cadastro",
    rota: "/dashboard/patients",
    /**
     * "paciente" sozinho NÃO entra: ele engolia frases que o Divã não deve responder — "o que eu
     * faço com essa paciente" caía aqui como se fosse um pedido de abrir a ficha. O catálogo é a
     * fronteira entre orientar sobre o app e opinar sobre conduta clínica, e ela se defende com o
     * vocabulário, não com um aviso.
     */
    ditos: ["pacientes", "cadastro", "ficha", "prontuario", "abrir paciente", "procurar paciente", "abrir cadastro"],
  },
  {
    id: "evolucao",
    rotulo: "Escrever a evolução de uma sessão",
    rota: "/dashboard/patients",
    dica: "Abra o paciente e vá na guia Registros.",
    soLeva: true,
    ditos: ["evolucao", "escrever evolucao", "registro", "anotar", "anotacao", "transcrever", "transcrever sessao"],
  },
  {
    id: "carteira",
    rotulo: "Ver a carteira e o que entrou",
    rota: "/dashboard/pagamentos",
    ditos: ["carteira", "quanto recebi", "quanto entrou", "faturamento", "receita", "meu dinheiro"],
  },
  {
    id: "ajustes",
    rotulo: "Mudar uma configuração",
    rota: "/dashboard/settings",
    ditos: ["ajustes", "configuracao", "configuracoes", "mudar configuracao", "preferencias", "chave de ia"],
  },
  {
    id: "ajuda",
    rotulo: "Aprender a usar o Le'Divan",
    rota: "/dashboard/ajuda",
    ditos: ["ajuda", "como faz", "como funciona", "nao sei usar", "tutorial", "me ensina", "duvida"],
  },
];

/** Tira acento, caixa e pontuação: a fala transcrita chega acentuada e o vocabulário não é. */
export function normalizar(texto: string): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Que tarefa a fala pede?
 *
 * Vence o dito MAIS LONGO que aparece na frase — "marcar atendimento" ganha de "marcar", e
 * "lançar pagamento" ganha de "pagamento". Casar pelo mais curto faria "quem está devendo" cair em
 * "ver a carteira" só porque a palavra apareceu antes na lista.
 *
 * `null` quando nada casa: aí o Divã mostra o catálogo e pergunta, em vez de escolher por ela.
 */
export function tarefaDaFala(fala: string, tarefas: TarefaDoDiva[] = TAREFAS): TarefaDoDiva | null {
  const texto = normalizar(fala);
  if (!texto) return null;

  let melhor: { tarefa: TarefaDoDiva; tamanho: number } | null = null;
  for (const tarefa of tarefas) {
    for (const dito of tarefa.ditos) {
      const alvo = normalizar(dito);
      if (!alvo || !texto.includes(alvo)) continue;
      if (!melhor || alvo.length > melhor.tamanho) melhor = { tarefa, tamanho: alvo.length };
    }
  }
  return melhor?.tarefa ?? null;
}

/** O que o Divã encontrou esperando pela terapeuta. Números calculados pelos motores, nunca por modelo. */
export type EstadoDoDiva = {
  sessoesHoje: number;
  cobrancasEmAtraso: number;
  valorEmAtraso: number;
  semProximoAgendamento: number;
  reajustesAVencer: number;
};

export type AvisoDoDiva = { id: string; texto: string; rota: string };

/**
 * As frases do "o que te espera hoje".
 *
 * Só entra o que tem número maior que zero: uma lista que repete "0 isto, 0 aquilo" vira ruído e
 * ensina a ignorar o aviso justamente no dia em que ele importa.
 */
export function avisosDoDiva(e: EstadoDoDiva): AvisoDoDiva[] {
  const avisos: AvisoDoDiva[] = [];
  const plural = (n: number, um: string, muitos: string) => (n === 1 ? um : muitos);

  if (e.sessoesHoje > 0) {
    avisos.push({
      id: "sessoes-hoje",
      texto: `${e.sessoesHoje} ${plural(e.sessoesHoje, "atendimento hoje", "atendimentos hoje")}`,
      rota: "/dashboard/agenda",
    });
  }
  if (e.cobrancasEmAtraso > 0) {
    const valor = e.valorEmAtraso.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    avisos.push({
      id: "em-atraso",
      texto: `${e.cobrancasEmAtraso} ${plural(e.cobrancasEmAtraso, "cobrança em atraso", "cobranças em atraso")} · ${valor}`,
      rota: "/dashboard/fechamento",
    });
  }
  if (e.semProximoAgendamento > 0) {
    avisos.push({
      id: "sem-retorno",
      texto: `${e.semProximoAgendamento} ${plural(e.semProximoAgendamento, "paciente sem próximo atendimento", "pacientes sem próximo atendimento")}`,
      rota: "/dashboard/agenda",
    });
  }
  if (e.reajustesAVencer > 0) {
    avisos.push({
      id: "reajustes",
      texto: `${e.reajustesAVencer} ${plural(e.reajustesAVencer, "reajuste a vencer", "reajustes a vencer")}`,
      rota: "/dashboard/patients",
    });
  }
  return avisos;
}

/**
 * A pergunta da abertura aparece?
 *
 * Ela é um PEDÁGIO: quem abre o app vinte vezes por dia para olhar a agenda vai odiar ser
 * interrogado na vigésima. Então ela desiste. Três dispensas seguidas sem escolher nada e o Divã
 * para de abrir sozinho — continua no ícone flutuante, a um toque, para quando ela quiser.
 *
 * Escolher uma tarefa zera a contagem: ali ele provou que serve.
 */
export const DISPENSAS_ATE_CALAR = 3;

export function abreSozinho(dispensasSeguidas: number): boolean {
  return (Number(dispensasSeguidas) || 0) < DISPENSAS_ATE_CALAR;
}

/**
 * O QUE OCUPA CADA SLOT DA AGENDA, e como isso se lê na tela.
 *
 * Olhando uma semana cheia, a terapeuta precisa responder três perguntas sem clicar em nada:
 * *este horário está ocupado?*, *ocupado por quê?* e *tem alguma coisa errada com ele?*.
 *
 * A tela responde as três em canais separados, e a separação é o que faz a leitura funcionar:
 *
 * - **O TIPO de ocupação** é a forma do bloco: paciente, horário bloqueado, ou o espelho de um
 *   quinzenal.
 * - **O QUE ACONTECEU** é a cor de fundo, que segue a legenda de status.
 * - **OS FATOS** sobre aquela sessão são ícones, cada um com um significado só.
 *
 * Misturar os canais é o que apaga a informação: quando a cor diz duas coisas, ela deixa de dizer
 * qualquer uma.
 */

export type TipoDeOcupacao = "paciente" | "bloqueio" | "espelho_quinzenal";

/** Quem é quinzenal, mesmo quando a SESSÃO não guarda isso. */
export type PacienteQuinzenal = {
  id: string;
  /** O formato de pagamento (`quinzenal`) ou a frequência escrita no cadastro. */
  formato?: string | null;
  frequencia?: string | null;
};

/**
 * O paciente é atendido de quinze em quinze dias?
 *
 * A pergunta precisa olhar o CADASTRO, e não só a sessão. A frequência só é gravada na sessão
 * quando o agendamento nasce pela janela de repetição — e a base tem 43 pacientes quinzenais cujas
 * sessões não guardam isso, o que fazia o espelho da semana alternada nunca aparecer. Marca que
 * nunca aparece é marca que não existe.
 */
export function ehQuinzenal(p: PacienteQuinzenal | null | undefined): boolean {
  if (!p) return false;
  if (p.formato === "quinzenal") return true;
  return /quinzen/i.test(p.frequencia ?? "");
}

export type SessaoParaEspelho = {
  id: string;
  data: Date | string;
  duracao: number;
  pacienteId: string;
  /** Quando a própria sessão sabe que é quinzenal. */
  recorrenciaQuinzenal?: boolean;
  /**
   * Doc 36: a sessão foi editada individualmente ("APENAS ESTE") e saiu do compasso da série. Ela
   * continua na sequência (numeração, pacote, financeiro intactos) — isto muda SÓ o espelho: passa
   * a projetar a semana ANTERIOR a ela, nunca a posterior (ela não tem continuação do outro lado).
   */
  soEspelhoAnterior?: boolean;
};

export type Espelho = {
  pacienteId: string;
  hora: number;
  minuto: number;
  duracao: number;
  /**
   * A sessão REAL em que uma exclusão pega (doc 57). O slot em si não existe no banco.
   *
   * É a primeira sessão daquele combinado que cai NO DIA DO SLOT OU DEPOIS — não
   * necessariamente a que fica a sete dias à frente. Excluir "daqui para a frente" a partir
   * dela apaga o que resta do quinzenal e não toca no que vem antes do slot clicado.
   */
  sessaoId: string;
  /** Ela ainda está por vir? Sem isso, excluir alcançaria sessão passada — histórico e dinheiro. */
  sessaoFutura: boolean;
};

const emData = (d: Date | string): Date => (d instanceof Date ? d : new Date(d));
const meioDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/**
 * Os espelhos de um dia: os horários em que um quinzenal NÃO acontece nesta semana.
 *
 * O espelho não é reserva — o horário está livre e outro paciente pode ocupá-lo, que é o pedido.
 * Ele existe para a semana alternada não parecer um buraco qualquer: aquele lugar pertence a um
 * combinado de quinze em quinze dias, e quem marcar ali toda semana empurra o dono para fora.
 */
export function espelhosDoDia(opts: {
  dia: Date;
  /** As sessões da janela inteira, para achar as que estão a sete dias daqui. */
  sessoes: SessaoParaEspelho[];
  /** Quem é quinzenal, por id de paciente. */
  quinzenal: (pacienteId: string) => boolean;
  /** Hoje. Separa o que ainda dá para excluir do que já aconteceu. */
  hoje?: Date;
}): Espelho[] {
  const alvo = meioDia(opts.dia);
  const hoje = meioDia(opts.hoje ?? new Date());
  type Candidata = { espelho: Espelho; quando: number };
  const porChave = new Map<string, Candidata>();

  // Já ocupado neste dia e horário? Então não é espelho: alguém encaixou.
  const ocupados = new Set(
    opts.sessoes
      .map((s) => ({ d: emData(s.data) }))
      .filter((s) => !Number.isNaN(s.d.getTime()) && meioDia(s.d) === alvo)
      .map((s) => `${s.d.getHours()}:${s.d.getMinutes()}`),
  );

  for (const s of opts.sessoes) {
    const d = emData(s.data);
    if (Number.isNaN(d.getTime())) continue;
    if (!(s.recorrenciaQuinzenal || opts.quinzenal(s.pacienteId))) continue;
    // Quantas semanas o alvo está DEPOIS da sessão: +7 = o alvo é a semana anterior à sessão;
    // -7 = a semana posterior. Normal espelha as duas; "APENAS ESTE" (doc 36) só a anterior (+7).
    const delta = Math.round((meioDia(d) - alvo) / 86400000);
    const casa = s.soEspelhoAnterior ? delta === 7 : Math.abs(delta) === 7;
    if (!casa) continue;

    const chave = `${s.pacienteId}-${d.getHours()}:${d.getMinutes()}`;
    if (ocupados.has(`${d.getHours()}:${d.getMinutes()}`)) continue;

    const quando = meioDia(d);
    const candidata: Candidata = {
      quando,
      espelho: {
        pacienteId: s.pacienteId,
        hora: d.getHours(),
        minuto: d.getMinutes(),
        duracao: s.duracao,
        sessaoId: s.id,
        sessaoFutura: false,
      },
    };

    // Duas sessões projetam o mesmo espelho: a de sete dias antes e a de sete dias depois. Para
    // DESENHAR o reflexo tanto faz qual — fica a mais recente. Quem a exclusão alcança é outra
    // pergunta, respondida abaixo por `primeiraPorVir`, que olha a combinação inteira.
    const antes = porChave.get(chave);
    if (!antes || candidata.quando > antes.quando) porChave.set(chave, candidata);
  }

  return [...porChave.values()]
    .map((c) => {
      const alvoDaExclusao = primeiraPorVir({
        sessoes: opts.sessoes,
        pacienteId: c.espelho.pacienteId,
        hora: c.espelho.hora,
        minuto: c.espelho.minuto,
        diaEspelhado: alvo,
        hoje,
      });
      return {
        ...c.espelho,
        sessaoId: alvoDaExclusao?.id ?? c.espelho.sessaoId,
        sessaoFutura: !!alvoDaExclusao,
      };
    })
    /**
     * O REFLEXO DE UMA COMBINAÇÃO QUE ACABOU NÃO SOBREVIVE AO DIA DE HOJE (docs 58 e 59).
     *
     * A sessão passada continua projetando o seu reflexo para sete dias depois dela — e, se a série
     * foi excluída, esse reflexo cai num dia que ainda está por vir e fica lá, sozinho, sem nada
     * no banco que o explique. Era o que a terapeuta via: excluía a série e o primeiro slot ficava,
     * agora sem botão de excluir nenhum, porque não havia mais sessão futura para alcançar.
     *
     * Em dia PASSADO o reflexo continua: ali ele é história, e a semana de trás tem de se parecer
     * com o que ela foi.
     */
    .filter((e) => e.sessaoFutura || alvo < hoje)
    .sort((a, b) => a.hora * 60 + a.minuto - (b.hora * 60 + b.minuto));
}

/**
 * A PRIMEIRA SESSÃO DAQUELA COMBINAÇÃO A PARTIR DO DIA REFLETIDO — a que uma exclusão alcança.
 *
 * Combinação é paciente + dia da semana + horário, que é o mesmo critério de `sessoesAlcancadas`
 * ("os mesmos dias e horários"). Procurar na combinação INTEIRA, e não só nas duas sessões que
 * projetam o reflexo, é o que conserta o caso do doc 59: a vizinha de trás já aconteceu, a de
 * frente foi excluída, e o alvo certo é a próxima que sobrou, mais adiante na série.
 *
 * O PISO SÃO DOIS, e o maior vence (doc 60):
 *
 * - **o dia do slot**, porque "este e os próximos" conta a partir do que está na tela. Procurar
 *   a partir de hoje fazia um clique num slot de dezembro apagar a série desde novembro — a
 *   terapeuta via sumir agendamento ANTERIOR ao que ela clicou, que é perda de agenda sem aviso;
 * - **hoje**, porque sessão passada é histórico e dinheiro.
 *
 * `null` quer dizer que não há nada daquele dia em diante: a tela não oferece exclusão, e o
 * reflexo some do futuro — é o que apaga o próprio slot clicado (docs 58 e 59), já que sem
 * sessão à frente não sobra nada que o projete.
 */
function primeiraPorVir(opts: {
  sessoes: SessaoParaEspelho[];
  pacienteId: string;
  hora: number;
  minuto: number;
  /** O dia que está refletindo, em meio-dia. Serve de régua do "mesmo dia da semana" e de piso. */
  diaEspelhado: number;
  hoje: number;
}): { id: string } | null {
  let melhor: { id: string; quando: number } | null = null;
  const piso = Math.max(opts.hoje, opts.diaEspelhado);

  for (const s of opts.sessoes) {
    if (s.pacienteId !== opts.pacienteId) continue;
    const d = emData(s.data);
    if (Number.isNaN(d.getTime())) continue;
    if (d.getHours() !== opts.hora || d.getMinutes() !== opts.minuto) continue;
    const quando = meioDia(d);
    if (quando < piso) continue;
    // Mesmo dia da semana que o refletido: múltiplo de sete dias de distância. Um encaixe numa
    // sexta não entra no combinado das quartas — é a regra de `sessoesAlcancadas`, repetida aqui.
    if (Math.round((quando - opts.diaEspelhado) / 86400000) % 7 !== 0) continue;
    if (!melhor || quando < melhor.quando) melhor = { id: s.id, quando };
  }

  return melhor ? { id: melhor.id } : null;
}

/**
 * OS SINAIS DA CÉLULA.
 *
 * Cada um diz UMA coisa, e nenhum repete o que a cor já disse. O que não cabe em símbolo curto fica
 * de fora: ícone que precisa ser explicado não informa, decora.
 */
export type SinalDaCelula = {
  chave: string;
  /** O que ele significa, em palavras — vai no título e na legenda. */
  titulo: string;
};

export type FatosDaSessao = {
  online?: boolean | null;
  /**
   * O paciente pediu este horário pelo link público e ninguém confirmou ainda.
   *
   * NÃO é o mesmo que "sessão futura ainda não atendida": toda sessão de uma série nasce assim, e
   * acender um aviso em 83% da agenda futura esvazia o aviso. Só entra aqui o que pede resposta.
   */
  pedidoDoPaciente?: boolean | null;
  pacienteConfirmou?: boolean | null;
  pediuRemarcacao?: boolean | null;
  /** A sessão foi remarcada de outro dia. */
  realocada?: boolean | null;
  /** Reserva cujo dia já passou e ainda está sem desfecho — pede análise da terapeuta. */
  reservaVencida?: boolean | null;
  /** Doc 42: sessão de supervisão clínica (cadastro supervisionado) — marcada com um olho. */
  supervisao?: boolean | null;
};

/**
 * Os sinais que aquela sessão acende, na ordem em que aparecem.
 *
 * A ordem é de urgência: primeiro o que muda a conduta de hoje (o paciente chegou, pediu para
 * remarcar), depois o que é contexto (online, atrasado no pagamento).
 */
export function sinaisDaSessao(f: FatosDaSessao): SinalDaCelula[] {
  const out: SinalDaCelula[] = [];
  // Primeiro de todos: reserva vencida é uma pendência que só a terapeuta resolve, e some da vista
  // fácil (fica no passado). Acende antes do resto para não escapar.
  if (f.reservaVencida) out.push({ chave: "pendente", titulo: "Reserva vencida — analise o que aconteceu" });
  if (f.pediuRemarcacao) out.push({ chave: "remarcar", titulo: "Paciente pediu para remarcar" });
  if (f.realocada) out.push({ chave: "realocada", titulo: "Sessão remarcada de outra data" });
  if (f.pedidoDoPaciente) out.push({ chave: "pedido", titulo: "Pedido pelo link público — falta você confirmar" });
  if (f.pacienteConfirmou) out.push({ chave: "confirmou", titulo: "Paciente confirmou presença" });
  if (f.online) out.push({ chave: "online", titulo: "Atendimento online" });
  // Doc 42: o olho da supervisão vem à direita do ícone de modalidade.
  if (f.supervisao) out.push({ chave: "supervisao", titulo: "Sessão de supervisão" });
  return out;
}

/**
 * EDITAR E EXCLUIR UM AGENDAMENTO: quais sessões a mudança alcança.
 *
 * É a parte do lote que mais custa errar. "Este e os próximos" apaga ou remarca em bloco, e um
 * alcance errado tira da agenda sessões que ninguém mandou tirar — sem aviso, porque a tela só
 * mostra o que sobrou. Por isso o alcance mora aqui, sozinho, e não misturado com a escrita no
 * banco: dá para conferir cada caso sem tocar em dado de verdade.
 *
 * Três regras estruturam tudo:
 *
 * 1. **Só o paciente selecionado.** A exclusão em bloco nunca atravessa para outra pessoa, mesmo
 *    que ela tenha sessão no mesmo horário.
 * 2. **Só daqui para a frente.** O passado é histórico: uma sessão que já aconteceu não deixa de
 *    ter acontecido porque alguém mudou o combinado de hoje em diante.
 * 3. **"Os mesmos dias e horários" quer dizer o combinado**, não a data. Quem marcou às quartas às
 *    8h e criou um encaixe numa sexta espera que mexer no combinado das quartas deixe a sexta em
 *    paz — ela foi marcada à parte, de propósito.
 */

export type SessaoParaAlcance = {
  id: string;
  data: Date | string;
  pacienteId: string;
};

export type AlcanceDaExclusao = "apenas_esta" | "mesmos_dias" | "todas";

const emData = (d: Date | string): Date => (d instanceof Date ? d : new Date(d));

const minutosDoDia = (d: Date) => d.getHours() * 60 + d.getMinutes();

/**
 * Quais sessões a operação alcança, a partir da que foi escolhida.
 *
 * A escolhida SEMPRE entra — é a que a pessoa tem na tela e mandou mexer.
 */
export function sessoesAlcancadas(opts: {
  escolhida: SessaoParaAlcance;
  todas: SessaoParaAlcance[];
  alcance: AlcanceDaExclusao;
}): string[] {
  const { escolhida, alcance } = opts;
  const quando = emData(escolhida.data);
  if (Number.isNaN(quando.getTime())) return [];
  if (alcance === "apenas_esta") return [escolhida.id];

  const seguintes = opts.todas
    .map((s) => ({ ...s, quando: emData(s.data) }))
    .filter((s) => !Number.isNaN(s.quando.getTime()))
    // Mesmo paciente, e daqui para a frente. O passado é histórico.
    .filter((s) => s.pacienteId === escolhida.pacienteId)
    .filter((s) => s.quando.getTime() >= quando.getTime())
    .filter((s) => {
      if (alcance === "todas") return true;
      // "Os mesmos dias e horários": o combinado, não a data. Quem marcou às quartas às 8h e criou
      // um encaixe numa sexta espera que a sexta fique em paz.
      return s.quando.getDay() === quando.getDay() && minutosDoDia(s.quando) === minutosDoDia(quando);
    })
    .sort((a, b) => a.quando.getTime() - b.quando.getTime())
    .map((s) => s.id);

  // A escolhida sempre entra, mesmo que o filtro do combinado a deixasse de fora por algum
  // arredondamento — é a que está na tela, e sumir com ela seria o contrário do pedido.
  return seguintes.includes(escolhida.id) ? seguintes : [escolhida.id, ...seguintes];
}

/**
 * O horário de destino já está ocupado?
 *
 * O lote é explícito: mover para um horário ocupado não é permitido. Ocupar aqui é COINCIDIR o
 * início — é o critério da grade, onde cada célula é um horário. A própria sessão que está sendo
 * movida não conta contra ela mesma.
 */
export function horarioOcupado(opts: {
  destino: Date | string;
  /** As sessões da agenda inteira, de qualquer paciente: o horário é da terapeuta. */
  todas: SessaoParaAlcance[];
  ignorar?: string[];
}): boolean {
  const alvo = emData(opts.destino);
  if (Number.isNaN(alvo.getTime())) return false;
  const ignorar = new Set(opts.ignorar ?? []);
  return opts.todas
    .filter((s) => !ignorar.has(s.id))
    .map((s) => emData(s.data))
    .filter((d) => !Number.isNaN(d.getTime()))
    .some((d) => d.getTime() === alvo.getTime());
}

/**
 * Para onde cada sessão do bloco vai, quando a escolhida muda de data ou hora.
 *
 * A mudança é um DESLOCAMENTO, não uma cópia da nova data: mover a sessão de quarta para quinta
 * mexe todas as seguintes um dia para a frente, mantendo o intervalo entre elas. Copiar a data
 * nova para todas empilharia a série inteira num único dia — que é o jeito de transformar uma
 * edição em perda de agenda.
 */
export function deslocamento(opts: {
  de: Date | string;
  para: Date | string;
  sessoes: SessaoParaAlcance[];
}): { id: string; data: Date }[] {
  const de = emData(opts.de);
  const para = emData(opts.para);
  if (Number.isNaN(de.getTime()) || Number.isNaN(para.getTime())) return [];
  const delta = para.getTime() - de.getTime();
  if (delta === 0) return [];

  return opts.sessoes
    .map((s) => ({ id: s.id, quando: emData(s.data) }))
    .filter((s) => !Number.isNaN(s.quando.getTime()))
    .map((s) => ({ id: s.id, data: new Date(s.quando.getTime() + delta) }));
}

/** Os campos que a janela de edição deixa mexer. O resto fica inativo, como elas pediram. */
export const CAMPOS_EDITAVEIS = ["date", "duration", "modality", "location", "confirmChannel", "confirmLeadHours"] as const;

export function podeEditar(campo: string): boolean {
  return (CAMPOS_EDITAVEIS as readonly string[]).includes(campo);
}

"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, X, Stethoscope, Repeat, Video, AlertTriangle, MapPin, Pencil, CalendarDays, Trash2 , ChevronDown } from "lucide-react";
import { formatBRL, SESSION_STATUS_LABELS, sessionStatusColor, sessionColorClasses, reservaVencida, RISK_LABELS, riskColor, LEGENDA_DA_AGENDA, corDaLegenda, STATUS_OFERECIDOS, STATUS_QUE_PAUSAM, type RiskLevel } from "@/lib/therapy";
import { updateSessionStatus, confirmSession, createSessionFromAgenda, createRecurring, definirValorDaFalta, pagamentoDaSessao, desfazerCobrancaDaSessao, saldoDeCreditoDaSessao } from "../sessions/actions";
import { perguntaDaConversao } from "@/lib/creditoAConfirmar";
import { HolidaySetup } from "@/components/dashboard/HolidaySetup";
import { HOLIDAY_STYLE, type Holiday, type HolidayCity } from "@/lib/holidays-style";
import { geometriaDaFaixa, posicoesDoDia } from "@/lib/agendaLayout";
import { conteudoDaCelula, identificacao } from "@/lib/celulaDaAgenda";
import { textoDoBloqueio } from "@/lib/bloqueioDeHorario";
import { ehQuinzenal, espelhosDoDia, sinaisDaSessao } from "@/lib/ocupacaoDaAgenda";
import { CANAIS_DE_CONFIRMACAO, DIAS_DA_SEMANA, ehSemanal2x, geraRepeticoes, modalidadesDe, pedeHorasAntes, pedeLocal, repeticoesDe } from "@/lib/agendamentoNovo";
import { CAMPOS_EDITAVEIS } from "@/lib/editarAgendamento";
import { contarAlcance, excluirAgendamento, reagendarRecorrencia, salvarEdicao } from "./edicao-actions";
import { BloquearHorario } from "@/components/dashboard/BloquearHorario";
import { FUNDO_DA_JANELA, JANELA } from "@/lib/modal";
import { blocoDoAgendamento, camposDaEscolha, escolhaEfetiva, type EscolhaDoAgendamento } from "@/lib/opcoesDoAgendamento";
import { OPCOES_DA_DEVOLUTIVA, OPCOES_DO_ABATIMENTO, TITULO_DA_DEVOLUTIVA, type AbatimentoDaDevolutiva, type EscolhaDaDevolutiva } from "@/lib/quadroDaDevolutiva";
import { formatoNaData } from "@/lib/vigenciaDoFormato";
import { tipoDaFalta, tipoDaFaltaPeloRotulo, perguntaDaFalta, COMO_REFAZER } from "@/lib/perguntaFalta";
import { useJanela } from "@/lib/useJanela";
import { mascaraMoeda } from "@/lib/mascaraMoeda";
import { MoneyInput } from "@/components/MoneyInput";

type PatientLite = { id: string; name: string; status: string; attendanceMode: string | null; attendanceLocation: string | null;
  /** Doc 42: paciente | supervisionado — supervisionado só agenda sessões do tipo supervisão. */
  cadastroKind?: string | null;
  /** O que a célula escreve no lugar do nome. */
  agendaId?: string | null;
  registrationNumber?: number | null;
  paymentFormat?: string | null;
  pacoteTipo?: string | null;
  sessionFee?: string | null;
  /** Já tem algum agendamento? Vem do histórico INTEIRO (a lista da tela para em 120 dias). */
  temAgendamento?: boolean;
  /** Desmarcadas que ainda esperam reposição (`data` é hora de parede, ISO sem fuso). */
  desmarcadas?: { id: string; data: string }[];
  /** Formato de pagamento no tempo: a pergunta da sessão extra depende do formato NA DATA marcada. */
  vigencias?: { formato: string; pacoteTipo: string | null; desde: string; criadoEm: string }[];
  /** "quinzenal", "semanal"… escrito no cadastro. É daqui que sai o espelho da semana alternada. */
  frequency?: string | null;
};
type LocationLite = { name: string; address: string };

type SessionStatus = "realizada" | "nao_realizada" | "cancelada" | "realocada" | "agendada" | "prof_desmarcou" | "atestado";
/** O botão de entrar na sala — o mesmo em cima (editando) e embaixo (vendo). */
function EntrarNaSala({ sessao }: { sessao: { id: string; meetingUrl: string | null } }) {
  const meet = sessao.meetingUrl?.includes("meet.google.com");
  return (
    <a
      href={meet ? sessao.meetingUrl! : `/dashboard/sala/${sessao.id}`}
      {...(meet ? { target: "_blank", rel: "noreferrer" } : {})}
      className="flex items-center justify-center gap-2 w-full rounded-xl bg-primary text-white py-2.5 text-sm font-bold hover:bg-primary-container transition"
    >
      <Video className="w-4 h-4" /> {meet ? "Entrar no Google Meet" : "Entrar como anfitrião"}
    </a>
  );
}

type AgendaSession = { id: string; date: string; duration: number; status: string; patientName: string; isOnline: boolean; risk: string; meetingUrl: string | null; meetingOpenedAt: string | null; guestJoinedAt: string | null; meetingEndedAt: string | null; pendingConfirmation: boolean; patientConfirmed: boolean; rescheduleRequested: boolean; patientArrived: boolean; location: string | null; recurring: boolean; recurrenceFreq?: string | null; patientId?: string; sessionKind?: string; cortesia?: boolean; extra?: string | null; pkg?: { seq: number; index: number; total: number } | null; pagamentoAtrasado?: boolean; abaterDoPacote?: boolean; codigo?: string | null; espelhoSoAnterior?: boolean; agendaId?: string | null; registro?: number | null };

const blockColor = (s: AgendaSession, vencida: boolean) => sessionColorClasses(s.status, s.pendingConfirmation, s.recurring, vencida);

/**
 * O símbolo de cada sinal.
 *
 * Emoji, e não ícone desenhado, de propósito: num bloco de 10px eles são o que a pessoa reconhece
 * sem legenda, e sobrevivem à impressão da agenda.
 */
const SIMBOLO: Record<string, string> = {
  pendente: "🕓",
  remarcar: "🔁",
  realocada: "↪️",
  pedido: "⏳",
  confirmou: "✓",
  online: "📹",
  supervisao: "👁",
};

/** O que cada símbolo quer dizer, em duas ou três palavras. */
const LEGENDA_DO_SINAL: Record<string, string> = {
  pendente: "reserva vencida, a analisar",
  remarcar: "pediu remarcação",
  realocada: "remarcada de outra data",
  pedido: "pedido pelo link, a confirmar",
  confirmou: "confirmou presença",
  online: "online",
  supervisao: "supervisão",
};

const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const START_HOUR = 6;
const END_HOUR = 22; // exibe as linhas de 6h até 21h (o dono pediu 6h–21h)
// Doc 38: linhas mais BAIXAS (era 64) → mais agendamentos na tela sem perder legibilidade. Os
// blocos de sessão e os rótulos de hora acompanham este valor automaticamente.
const HOUR_PX = 60; // doc 50: linha mais alta — os dados estavam sendo cortados (era 48)
const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i);

function startOfWeek(d: Date) {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  out.setDate(out.getDate() - out.getDay());
  return out;
}

type Birthday = { name: string; month: number; day: number };

type BlocoBloqueado = { id: string; date: string; duration: number; note: string | null };

export function AgendaClient({ sessions, patients = [], birthdays = [], locations = [], holidays = {}, holidayCities = [], blocks = [] }: { sessions: AgendaSession[]; patients?: PatientLite[]; birthdays?: Birthday[]; locations?: LocationLite[]; holidays?: Record<string, Holiday[]>; holidayCities?: HolidayCity[]; blocks?: BlocoBloqueado[] }) {
  /** A identificação curta de um paciente, a mesma que a célula usa. */
  const identificaPaciente = (id: string | null | undefined, nome: string) => {
    const p = patients.find((x) => x.id === id);
    return identificacao({ agendaId: p?.agendaId, registro: p?.registrationNumber, nome });
  };

  /** O que a célula escreve para aquela sessão. A regra mora em `celulaDaAgenda`, longe da tela. */
  const celula = (s: AgendaSession) => {
    const p = patients.find((x) => x.id === s.patientId);
    return conteudoDaCelula({
      // Doc 38: prefere o agendaId/registro que vêm NA sessão (join do paciente, inclui inativo);
      // a lista `patients` exclui inativo e deixaria a célula cair no 1º nome.
      agendaId: s.agendaId ?? p?.agendaId,
      registro: s.registro ?? p?.registrationNumber,
      nome: s.patientName,
      formato: p?.paymentFormat,
      tipo: s.sessionKind,
      abateDoPacote: s.abaterDoPacote,
      posicao: s.pkg ? { index: s.pkg.index, total: s.pkg.total } : null,
      // O servidor já resolveu o rótulo pelo formato do DIA da sessão; a célula só exibe.
      codigo: s.codigo,
      online: s.isOnline,
      repeticao: s.recurring ? s.recurrenceFreq : null,
      recorrente: s.recurring,
    });
  };
  /**
   * O Divã leva até aqui com a janela JÁ ABERTA (`?novo=1`).
   *
   * É o que separa "levar à tela certa" de "levar à tela". Sem isto, o catálogo do Divã ofereceria
   * "marcar um atendimento" e entregaria a grade da semana, deixando o próximo passo por conta de
   * quem acabou de pedir ajuda. Roda uma vez, e o parâmetro sai da URL para não reabrir a janela a
   * cada voltar do navegador.
   */
  const paramsDaUrl = useSearchParams();
  const jaAbriuPeloDiva = useRef(false);
  useEffect(() => {
    if (jaAbriuPeloDiva.current || paramsDaUrl.get("novo") !== "1") return;
    jaAbriuPeloDiva.current = true;

    /**
     * O Divã pode mandar o paciente e o quando junto (`&paciente=&quando=`): foi uma reserva
     * ditada, já conferida por ela na prévia. A janela abre PREENCHIDA e ela aperta Agendar.
     *
     * Reservar não é gravado por voz de propósito: as perguntas desta janela — sequência do
     * pacote, modalidade, devolutiva — têm consequência em dinheiro, e pulá-las por atalho
     * desfaria o que os docs 67 e 68 acabaram de desenhar.
     */
    const quandoDito = paramsDaUrl.get("quando");
    const data = quandoDito ? new Date(quandoDito) : null;
    openNew(data && !Number.isNaN(data.getTime()) ? data : undefined, data && !Number.isNaN(data.getTime()) ? data.getHours() : undefined, data?.getMinutes() ?? 0);
    const pacienteDito = paramsDaUrl.get("paciente");
    if (pacienteDito && patients.some((p) => p.id === pacienteDito)) {
      setNewPatient(pacienteDito);
      const alvo = patients.find((p) => p.id === pacienteDito);
      setNewKind(alvo?.cadastroKind === "supervisionado" ? "supervisao" : "consulta");
    }
    window.history.replaceState(null, "", "/dashboard/agenda");
    // openNew é estável o bastante para este disparo único de montagem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsDaUrl]);

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  // "Escolher data": o input de data é sr-only; clicar o rótulo nem sempre abre o calendário nativo
  // (sobretudo no mobile). showPicker() abre direto, sob o gesto do clique. Fallback: foco no input.
  const dateRef = useRef<HTMLInputElement>(null);
  const [selected, setSelected] = useState<AgendaSession | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // Novo atendimento
  const [showNew, setShowNew] = useState(false);
  const [newDate, setNewDate] = useState("");
  const [newPatient, setNewPatient] = useState("");
  const [newModalidade, setNewModalidade] = useState("presencial");
  const [newAbater, setNewAbater] = useState(false);
  const [newCanal, setNewCanal] = useState("nenhum");
  /**
   * O slot "Q" que a pessoa clicou, esperando a resposta.
   *
   * Clicar num horário intercalado não abre o agendamento direto de propósito: aquele lugar é o
   * espelho do quinzenal de outra pessoa, e quem clica ali pode estar só querendo entender por que
   * o horário aparece marcado. A pergunta nomeia o paciente que intercala — sem isso, "deseja
   * intercalar?" não diz com quem.
   */
  const [perguntaQ, setPerguntaQ] = useState<{ day: Date; hour: number; minute: number; quem: string } | null>(null);
  /** Agendamento nascido de um slot Q: a repetição semanal não entra na lista. */
  const [deSlotQ, setDeSlotQ] = useState(false);
  const [newFreq, setNewFreq] = useState("pontual");
  // Só semanal e quinzenal geram as sessões seguintes. Mensal marca uma só, e o paciente entra
  // na lista de "Lembrar agendamento" no fim do mês.
  const newRecorrente = geraRepeticoes(newFreq);
  const [newSegundoDia, setNewSegundoDia] = useState("");
  const [newSegundoHorario, setNewSegundoHorario] = useState("");
  // O dia da semana do agendamento que está sendo criado. Ele CONTINUA na lista: as duas sessões
  // podem cair no mesmo dia, em horários diferentes (dona, 18/09). Só a opção ganha um lembrete.
  const diaDaPrimeira = newDate ? new Date(newDate).getDay() : -1;
  const [newKind, setNewKind] = useState("consulta");
  const [newCharge, setNewCharge] = useState(true);
  const [newError, setNewError] = useState<string | null>(null);
  // Doc 66: o que se escolhe ao marcar — seguir normal, ficar fora da sequência, ou ser cortesia.
  const [newEscolha, setNewEscolha] = useState<EscolhaDoAgendamento>("normal");
  const [newCobrada, setNewCobrada] = useState("");
  // Doc 68: as duas perguntas da devolutiva. `null` = ainda não escolheu; o servidor recusa assim.
  const [newDevolutiva, setNewDevolutiva] = useState<EscolhaDaDevolutiva>(null);
  const [newAbatimento, setNewAbatimento] = useState<AbatimentoDaDevolutiva>(null);
  // Doc 9, item 6 — "abater do pacote": a sessão inserida PREENCHE uma desmarcada do mês em vez de
  // criar uma vaga nova. Ocupa a posição que ficou aberta, de modo que nada atravessa para o mês
  // seguinte e o total do pacote não muda. "" = não preenche nenhuma (entra como sessão a mais).

  function pad(n: number) { return String(n).padStart(2, "0"); }
  function toLocalInput(d: Date) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  function openNew(day?: Date, hour?: number, minute = 0, slotQ = false) {
    setDeSlotQ(slotQ);
    const d = day ? new Date(day) : new Date();
    if (hour != null) d.setHours(hour, minute, 0, 0);
    setNewDate(toLocalInput(d));
    setNewPatient("");
    setNewModalidade("presencial");
    setNewAbater(false);
    setNewCanal("nenhum");
    setNewKind("consulta");
    setNewFreq("pontual");
    setNewEscolha("normal");
    setNewDevolutiva(null);
    setNewAbatimento(null);
    setNewCobrada("");
    setNewError(null);
    setShowNew(true);
  }
  /**
   * Já existe algum agendamento nesse horário? (doc 9, item 15 — antes prints 6.pdf item 21.) O dono
   * pediu o aviso para QUALQUER choque, não só de outro paciente: marcar duas vezes o mesmo horário
   * costuma ser engano, mesmo sendo o mesmo paciente. Não barra: avisa, e o profissional decide.
   * `exceptId` tira a própria sessão (ao mover/editar). Status que pausam (desmarcou/atestado/prof.
   * desm.) liberam o horário.
   */
  function colisaoDeHorario(iniMs: number, durMin: number, exceptId?: string): AgendaSession | null {
    if (Number.isNaN(iniMs)) return null;
    const fim = iniMs + (durMin || 50) * 60000;
    return sessions.find((s) => {
      if (exceptId && s.id === exceptId) return false;
      if (STATUS_QUE_PAUSAM.has(s.status)) return false;
      const sIni = new Date(s.date).getTime();
      if (Number.isNaN(sIni)) return false;
      const sFim = sIni + (s.duration || 50) * 60000;
      return sIni < fim && iniMs < sFim;
    }) ?? null;
  }

  function avisaColisao(c: AgendaSession | null): boolean {
    if (!c) return true;
    // OK = Sim (agenda mesmo assim); Cancelar = Não (volta para a configuração e troca o horário).
    return window.confirm("Já existe um agendamento nesse horário, deseja continuar?");
  }

  function submitNew(formData: FormData) {
    setNewError(null);
    const ini = newDate ? new Date(newDate).getTime() : NaN;
    if (!avisaColisao(colisaoDeHorario(ini, 50))) return;
    startTransition(async () => {
      const res = newRecorrente ? await createRecurring(formData) : await createSessionFromAgenda(formData);
      if (res.ok) { setShowNew(false); setNewFreq("pontual"); router.refresh(); }
      else setNewError(res.error || "Falha ao agendar.");
    });
  }
  const selectedPatient = patients.find((p) => p.id === newPatient);
  // Doc 42: cadastro supervisionado só tem sessões de supervisão; o campo Tipo mostra só "Supervisão".
  const supervisionando = selectedPatient?.cadastroKind === "supervisionado";
  const suggestLoc = selectedPatient?.attendanceLocation || "";
  const formatoNaDataNova = selectedPatient
    ? formatoNaData(
        (selectedPatient.vigencias ?? []).map((v) => ({ ...v, desde: new Date(v.desde), criadoEm: new Date(v.criadoEm) })),
        newDate ? new Date(newDate) : new Date(),
        { formato: selectedPatient.paymentFormat ?? "sessao", pacoteTipo: selectedPatient.pacoteTipo ?? null },
      ).formato
    : null;
  /**
   * O paciente já tem outro agendamento? É o gate do documento de 17/09 ("a área aparece quando o
   * paciente já tem outros agendamentos"): no primeiro agendamento não há sequência para entrar.
   *
   * Vem pronto do servidor. Antes a conta era feita aqui, procurando `s.pkg` nas sessões da tela, e
   * errava duas vezes: `pkg` só existe para sessão criada com `packageId`, que a agenda nunca grava
   * — então a pergunta não aparecia para ninguém — e a lista da tela começa 120 dias atrás.
   */
  const jaTemSequencia = !!selectedPatient?.temAgendamento;
  // Série (semanal/quinzenal) é o próprio ritmo do pacote; a pergunta é para a sessão inserida.
  // A pergunta "entra na sequência do pacote?" vale também na RECORRÊNCIA (doc 9, item 4): é como a
  // 2ª série do paciente escolhe ser Avulso/Gratuito, independente do pacote já existente. Antes só
  // o agendamento único perguntava (`!newRecorrente`), e por isso a recorrência caía sempre no pacote.

  /**
   * Doc 66: o bloco de escolhas do Novo atendimento. A regra de QUAIS opções mora em
   * `blocoDoAgendamento`; aqui só se desenha o que ela devolve.
   */
  const blocoNovo = blocoDoAgendamento({ formato: formatoNaDataNova, sessionKind: newKind, jaTemSequencia });
  /** A escolha marcada pode ter deixado de existir (trocar a repetição muda o bloco). */
  const escolhaNova = escolhaEfetiva(blocoNovo, newEscolha);
  const campoEscolha = camposDaEscolha(escolhaNova);
  // Doc 22: ao ADICIONAR à sequência do pacote, a sessão SEMPRE preenche uma desmarcada — nunca
  // acrescenta uma a mais. Então a escolha "é uma sessão a mais" saiu, e a primeira desmarcada já
  // vem marcada por padrão (o profissional ainda pode escolher outra da lista).
  // Doc 36: "Adicionar à sequência do pacote" não pergunta mais QUAL desmarcada preenche — a
  // sessão específica não importa, só que ela participa da sequência. Preenche sempre a primeira
  // desmarcada em aberto (ocupa a posição; nada atravessa para o mês seguinte, total não muda).
  const repoeEfetivo = selectedPatient?.desmarcadas?.[0]?.id ?? "";

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const days = Array.from({ length: 7 }, (_, i) => {
    const day = new Date(weekStart);
    day.setDate(day.getDate() + i);
    return day;
  });

  const blocksByDay = (day: Date) =>
    blocks.filter((b) => {
      const d = new Date(b.date);
      return d.getFullYear() === day.getFullYear() && d.getMonth() === day.getMonth() && d.getDate() === day.getDate();
    });

  const sessionsByDay = (day: Date) =>
    sessions.filter((s) => {
      const sd = new Date(s.date);
      return sd.getFullYear() === day.getFullYear() && sd.getMonth() === day.getMonth() && sd.getDate() === day.getDate();
    });

  // "Vago Quinzenal": nas semanas ALTERNADAS de um paciente quinzenal, o slot fica livre.
  // Detecta olhando 7 dias antes/depois: se há sessão quinzenal no mesmo horário a ±7 dias
  // e nada ocupando o slot neste dia, mostra um ghost clicável (encaixe pontual / outro quinzenal).
  /**
   * O espelho da semana alternada de um quinzenal.
   *
   * Antes ele saía SÓ da sessão (`recurrenceFreq === "quinzenal"`), e por isso nunca aparecia: a
   * frequência só é gravada na sessão quando o agendamento nasce pela janela de repetição, e a
   * base tem 43 pacientes quinzenais cujas sessões não guardam isso. Zero espelhos em toda a
   * agenda — marca que nunca aparece é marca que não existe. Agora a pergunta vai ao CADASTRO.
   */
  const pacienteEhQuinzenal = (id: string) => {
    const p = patients.find((x) => x.id === id);
    return ehQuinzenal({ id, formato: p?.paymentFormat, frequencia: p?.frequency });
  };
  type Ghost = { hour: number; minute: number; duration: number; patientName: string; patientId?: string };
  const ghostsForDay = (day: Date): Ghost[] =>
    espelhosDoDia({
      dia: day,
      sessoes: sessions.map((s) => ({
        id: s.id,
        data: new Date(s.date),
        duracao: s.duration,
        pacienteId: s.patientId ?? "",
        recorrenciaQuinzenal: s.recurring && s.recurrenceFreq === "quinzenal",
        soEspelhoAnterior: s.espelhoSoAnterior === true,
      })),
      quinzenal: pacienteEhQuinzenal,
    }).map((e) => ({
      hour: e.hora,
      minute: e.minuto,
      duration: e.duracao,
      patientName: patients.find((x) => x.id === e.pacienteId)?.name ?? "—",
      patientId: e.pacienteId,
    }));

  const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const holidaysForDay = (d: Date): Holiday[] => holidays[dayKey(d)] ?? [];
  const birthdaysForDay = (d: Date): Birthday[] => birthdays.filter((b) => b.month === d.getMonth() + 1 && b.day === d.getDate());
  const shift = (delta: number) => {
    const next = new Date(weekStart);
    next.setDate(next.getDate() + delta * 7);
    setWeekStart(next);
  };

  const [editing, setEditing] = useState(false);
  const [editModalidade, setEditModalidade] = useState("presencial");
  const [editCanal, setEditCanal] = useState("nenhum");
  const [editErro, setEditErro] = useState<string | null>(null);
  // Doc 43: alterar a recorrência a partir desta sessão (só futuro).
  const [recFreq, setRecFreq] = useState("semanal");
  const [recUntil, setRecUntil] = useState("");
  const [recSegDia, setRecSegDia] = useState<string>("");
  const [recSegHora, setRecSegHora] = useState("");
  /**
   * Doc 67: o STATUS entra no mesmo Salvar.
   *
   * Em edição, clicar num status apenas o SELECIONA; quem grava é o botão Salvar, junto de data,
   * duração, modalidade e lembrete. Antes era preciso salvar os campos, voltar e só então mexer no
   * status — duas idas para uma decisão só.
   */
  const [editStatus, setEditStatus] = useState<SessionStatus | null>(null);
  /** Doc 67: a área de recorrência nasce FECHADA e só abre a pedido. */
  const [recAberta, setRecAberta] = useState(false);
  /** A edição preenchida, esperando a pessoa dizer o alcance. */
  const [perguntaAlcance, setPerguntaAlcance] = useState<Record<string, string> | null>(null);
  /** A exclusão, esperando o alcance. `null` quando ninguém pediu para excluir. */
  const [perguntaExcluir, setPerguntaExcluir] = useState<{ id: string; passo: "inicio" | "proximos" } | null>(null);
  const [quantos, setQuantos] = useState<{ mesmosDias: number; todas: number } | null>(null);

  /**
   * Salvar não grava direto: junta o que foi preenchido e PERGUNTA o alcance.
   *
   * É o pedido delas, e faz sentido — quem edita um agendamento de uma série não tem como a tela
   * adivinhar se quer mexer só naquele dia ou no combinado inteiro, e escolher por ela erra
   * metade das vezes, em silêncio.
   */
  function submitEdit(formData: FormData) {
    if (!selected) return;
    setEditErro(null);
    const campos: Record<string, string> = {};
    for (const c of CAMPOS_EDITAVEIS) {
      const v = formData.get(c);
      if (v !== null) campos[c] = String(v);
    }
    // Mudou o horário para cima de outro paciente? Avisa (não barra) — item 21.
    if (campos.date) {
      const ini = new Date(campos.date).getTime();
      const dur = campos.duration ? Number(campos.duration) : selected.duration;
      if (!avisaColisao(colisaoDeHorario(ini, dur, selected.id))) return;
    }
    /**
     * Doc 73: a janela "Alterar quais?" só aparece quando HÁ próximas sessões.
     *
     * Sem elas a pergunta não tem duas respostas — "apenas este" e "este e os próximos" fazem a
     * mesma coisa, e a terapeuta leva um clique a mais para escolher entre o mesmo e o mesmo.
     * `contarAlcance` devolve quantas sessões dali para a frente o alcance pega, incluindo esta:
     * 1 (ou 0, se algo falhar na leitura) significa que não há próximas.
     */
    void contarAlcance(selected.id)
      .then((n) => {
        if ((n?.todas ?? 0) <= 1) aplicarEdicao("apenas_esta", campos);
        else setPerguntaAlcance(campos);
      })
      // Falhou a contagem? Pergunta, como sempre perguntou. Errar para o lado de perguntar é o
      // lado seguro: o outro mexe em sessões que ninguém mandou mexer.
      .catch(() => setPerguntaAlcance(campos));
  }

  function aplicarEdicao(alcance: string, campos?: Record<string, string>) {
    const dados = campos ?? perguntaAlcance;
    if (!selected || !dados) return;
    startTransition(async () => {
      const r = await salvarEdicao({
        sessionId: selected.id,
        alcance,
        date: dados.date,
        duration: dados.duration ? Number(dados.duration) : undefined,
        modality: dados.modality,
        location: dados.location,
        confirmChannel: dados.confirmChannel,
        confirmLeadHours: dados.confirmLeadHours,
      });
      setPerguntaAlcance(null);
      if (!r.ok) return setEditErro(r.error ?? "Não consegui salvar.");

      /**
       * Doc 67: UM Salvar grava tudo — campos, recorrência e status.
       *
       * A ordem é deliberada. Os campos primeiro, porque a recorrência recria as sessões seguintes
       * a partir desta data e precisa da data já corrigida. O status por último, porque "Faltou"
       * abre uma janela própria (cobrar ou não) e ela tem de aparecer sobre um agendamento que já
       * está salvo — perguntar antes deixaria a resposta pendurada num estado que ainda pode falhar.
       */
      if (recAberta && recUntil) {
        const rr = await reagendarRecorrencia(selected.id, {
          freq: recFreq, until: recUntil,
          segundoDia: recSegDia === "" ? null : Number(recSegDia),
          segundoHorario: recSegHora || null,
        });
        if (!rr.ok) return setEditErro(rr.error ?? "Não consegui alterar a recorrência.");
      }

      setEditing(false);
      if (editStatus && editStatus !== selected.status) {
        // `pickStatus` guarda os fluxos da falta e do crédito; aqui só se escolhe o momento.
        pickStatus(selected.id, editStatus);
        router.refresh();
        return;
      }
      setSelected(null);
      router.refresh();
    });
  }

  function abrirExclusao(id: string) {
    setPerguntaExcluir({ id, passo: "inicio" });
    void contarAlcance(id).then(setQuantos);
  }

  function aplicarExclusao(alcance: string) {
    const alvo = perguntaExcluir?.id;
    if (!alvo) return;
    startTransition(async () => {
      const r = await excluirAgendamento(alvo, alcance);
      setPerguntaExcluir(null);
      setQuantos(null);
      if (!r.ok) return setEditErro(r.error ?? "Não consegui excluir.");
      setSelected(null);
      router.refresh();
    });
  }

  const changeStatus = (id: string, status: SessionStatus, chargeable?: boolean, faltouConta?: boolean, depois?: () => void) => {
    startTransition(async () => {
      await updateSessionStatus(id, status, undefined, chargeable, faltouConta);
      setSelected(null);
      setPerguntaFaltou(null);
      if (depois) depois();
      router.refresh();
    });
  };

  /**
   * "Sim" na falta: no GRATUITO abre a janela do valor; nos demais, grava e pronto.
   *
   * A ordem importa — o valor só pode ser gravado depois de a sessão estar em "Faltou" com a
   * resposta "Sim", que é o estado que o servidor exige para aceitá-lo.
   */
  const responderSim = (id: string, tipo: ReturnType<typeof tipoDaFalta>) => {
    if (tipo !== "gratuito") return changeStatus(id, "nao_realizada", undefined, true);
    setValorDaFalta("");
    setErroDoValor(null);
    setUsarCredito(null);
    /**
     * Doc 61: havendo SALDO DE CRÉDITO no cadastro, a conversão pergunta antes se ele deve ser
     * usado agora. A pergunta vem primeiro porque é ela que decide o que acontece com o dinheiro
     * assim que o valor da sessão existir: respondido "Sim", o saldo abate a cobrança que está
     * nascendo; respondido "Não", ele fica inteiro e parado, esperando um lançamento futuro.
     *
     * Sem saldo não há pergunta nenhuma — é o caminho de sempre, e a maioria dos casos.
     */
    changeStatus(id, "nao_realizada", undefined, true, () => {
      void saldoDeCreditoDaSessao(id).then((r) => {
        if (r.ok && (r.saldo ?? 0) > 0.005) return setPerguntaCredito({ id, saldo: r.saldo as number });
        setPedeValor({ id });
      });
    });
  };

  /** A resposta da janela do crédito: segue para o valor, guardando o que ela escolheu. */
  const responderCredito = (usar: boolean) => {
    if (!perguntaCredito) return;
    setUsarCredito(usar);
    setPedeValor({ id: perguntaCredito.id });
    setPerguntaCredito(null);
  };

  /**
   * "Não" na falta: antes de desfazer, confere se há dinheiro preso àquela sessão.
   *
   * Sem pagamento, segue direto — é o que o documento manda ("caso não exista pagamento, executar
   * diretamente o comportamento já definido"). Com pagamento, a janela pergunta o destino: sumir
   * com a cobrança sem dizer para onde foi o valor recebido é a pior saída numa tela de dinheiro.
   *
   * Fora do gratuito e do avulso não há cobrança própria da sessão para desfazer, então a pergunta
   * não se aplica e o caminho é o de sempre.
   */
  const responderNao = (id: string, tipo: ReturnType<typeof tipoDaFalta>) => {
    if (tipo === "pacote") return changeStatus(id, "nao_realizada", undefined, false);
    setErroDoDestino(null);
    startTransition(async () => {
      const r = await pagamentoDaSessao(id);
      if (r.ok && r.valor != null && r.valor > 0) {
        setPerguntaFaltou(null);
        setPedeDestino({ id, valor: r.valor });
        return;
      }
      await desfazerCobrancaDaSessao(id, null);
      await updateSessionStatus(id, "nao_realizada", undefined, undefined, false);
      setSelected(null);
      setPerguntaFaltou(null);
      router.refresh();
    });
  };

  const escolherDestino = (escolha: "estornar" | "transferir") => {
    if (!pedeDestino) return;
    setErroDoDestino(null);
    startTransition(async () => {
      await updateSessionStatus(pedeDestino.id, "nao_realizada", undefined, undefined, false);
      const r = await desfazerCobrancaDaSessao(pedeDestino.id, escolha);
      if (!r.ok) return setErroDoDestino(r.error ?? "Não consegui concluir.");
      setPedeDestino(null);
      setSelected(null);
      router.refresh();
    });
  };

  const salvarValorDaFalta = () => {
    if (!pedeValor) return;
    setErroDoValor(null);
    startTransition(async () => {
      const r = await definirValorDaFalta(pedeValor.id, valorDaFalta, usarCredito);
      if (!r.ok) return setErroDoValor(r.error ?? "Não consegui lançar o valor.");
      setPedeValor(null);
      router.refresh();
    });
  };

  // Doc 45: ao marcar "Faltou", pergunta "Considerar sessão realizada?" (Sim cobra/abate; Não não).
  // Os demais desfechos vão direto — cobrança é assunto do financeiro (dono, 16/09/2026).
  // Doc 52: a pergunta agora é a do TIPO do agendamento (gratuito / avulso / pacote), porque a
  // consequência de "Sim" é diferente em cada um. O texto mora em `@/lib/perguntaFalta`.
  const [perguntaFaltou, setPerguntaFaltou] = useState<{ id: string; tipo: ReturnType<typeof tipoDaFalta> } | null>(null);
  /**
   * Doc 55: respondido "Sim" num paciente GRATUITO, a sessão vira avulsa e precisa de valor.
   * A janela pergunta na hora, em vez de deixar a linha em R$ 0,00 esperando que alguém lembre
   * de voltar na guia Geral para lançar.
   */
  const [pedeValor, setPedeValor] = useState<{ id: string } | null>(null);
  /** Doc 55: o "Não" numa sessão que JÁ tem pagamento lançado — estornar ou transferir. */
  const [pedeDestino, setPedeDestino] = useState<{ id: string; valor: number } | null>(null);
  const [erroDoDestino, setErroDoDestino] = useState<string | null>(null);
  const [valorDaFalta, setValorDaFalta] = useState("");
  const [erroDoValor, setErroDoValor] = useState<string | null>(null);
  /** Doc 61: a janela do crédito na conversão GRAT→AVUL, e a resposta que segue para o valor. */
  const [perguntaCredito, setPerguntaCredito] = useState<{ id: string; saldo: number } | null>(null);
  const [usarCredito, setUsarCredito] = useState<boolean | null>(null);

  /**
   * Escape fecha qualquer uma destas janelas (achado do SuperQA de 22/10). A da falta era a pior:
   * ela só oferece Sim e Não, as duas com consequência em dinheiro, e não tinha saída pelo teclado.
   */
  const janelaSessao = useJanela(!!selected, () => setSelected(null));
  const janelaAlcance = useJanela(!!perguntaAlcance, () => setPerguntaAlcance(null));
  const janelaFalta = useJanela(!!perguntaFaltou, () => setPerguntaFaltou(null));
  const janelaValor = useJanela(!!pedeValor, () => setPedeValor(null));
  const janelaCredito = useJanela(!!perguntaCredito, () => setPerguntaCredito(null));
  const janelaDestino = useJanela(!!pedeDestino, () => setPedeDestino(null));
  const janelaExcluir = useJanela(!!perguntaExcluir, () => { setPerguntaExcluir(null); setQuantos(null); });
  const janelaQ = useJanela(!!perguntaQ, () => setPerguntaQ(null));
  // O painel do novo agendamento é um <form>, não um <div> — daí o tipo explícito.
  const janelaNova = useJanela<HTMLFormElement>(showNew, () => setShowNew(false));
  const pickStatus = (id: string, status: SessionStatus) => {
    if (status === "nao_realizada") {
      // O formato muda no tempo: vale o que estava vigente NA DATA DA SESSÃO, não o de hoje.
      // Perguntar pelo formato atual erraria o paciente que trocou de plano depois da falta.
      const sess = sessions.find((x) => x.id === id);
      const pac = patients.find((x) => x.id === sess?.patientId);
      const formato = pac
        ? formatoNaData(
            (pac.vigencias ?? []).map((v) => ({ ...v, desde: new Date(v.desde), criadoEm: new Date(v.criadoEm) })),
            sess?.date ? new Date(sess.date as unknown as string) : new Date(),
            { formato: pac.paymentFormat ?? "sessao", pacoteTipo: pac.pacoteTipo ?? null },
          ).formato
        : null;
      /**
       * Doc 57: a janela é a do que a sessão É AGORA — o rótulo da célula —, não a do formato do
       * cadastro. Quem já converteu uma vez (gratuito que virou AVUL) precisa, na segunda, da
       * pergunta do AVUL; pelo cadastro a janela ofereceria converter o que já está convertido.
       */
      setPerguntaFaltou({ id, tipo: tipoDaFaltaPeloRotulo(sess?.codigo, formato) });
    } else changeStatus(id, status);
  };

  const confirm = (id: string) => {
    startTransition(async () => {
      await confirmSession(id);
      setSelected(null);
      router.refresh();
    });
  };

  const label = `${weekStart.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} – ${new Date(weekEnd.getTime() - 1).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`;

  const blockGeom = (s: AgendaSession) => {
    const d = new Date(s.date);
    const minutes = (d.getHours() - START_HOUR) * 60 + d.getMinutes();
    const top = Math.max(0, (minutes / 60) * HOUR_PX);
    const height = Math.max(34, (s.duration / 60) * HOUR_PX - 2);
    return { top, height };
  };

  return (
    <div className="space-y-4">
      <HolidaySetup cities={holidayCities} />

      {/* Nav: a semana em cima; os botões numa LINHA ABAIXO, para arejar (dono, 16/09/2026). */}
      <div className="glass-card rounded-2xl px-4 py-3 space-y-3">
        <div className="flex items-center justify-between">
          <button onClick={() => shift(-1)} className="p-2 rounded-xl hover:bg-white/60 transition"><ChevronLeft className="w-5 h-5" /></button>
          <span className="font-display font-bold text-primary text-center">{label}</span>
          <button onClick={() => shift(1)} className="p-2 rounded-xl hover:bg-white/60 transition"><ChevronRight className="w-5 h-5" /></button>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button onClick={() => setWeekStart(startOfWeek(new Date()))} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition">Hoje</button>
          <label
            onClick={() => { try { dateRef.current?.showPicker?.(); } catch { dateRef.current?.focus(); } }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition cursor-pointer">
            <CalendarDays className="w-3.5 h-3.5" aria-hidden="true" />
            Escolher data
            <input
              ref={dateRef}
              type="date"
              aria-label="Ir para a semana de uma data"
              className="sr-only"
              onChange={(e) => {
                // A data vem como texto (aaaa-mm-dd); montar com new Date(texto) joga para UTC e
                // pode cair no dia anterior. Por isso o split.
                const [a, m, d] = e.target.value.split("-").map(Number);
                if (a && m && d) setWeekStart(startOfWeek(new Date(a, m - 1, d)));
              }}
            />
          </label>
          <BloquearHorario />
        </div>
      </div>

      {/* Legenda de cores */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-[11px] text-foreground/50">
        {LEGENDA_DA_AGENDA.map((st) => {
          const { fundo, borda } = corDaLegenda(st);
          return (
            <span key={st} className="inline-flex items-center gap-1">
              <span className="w-3 h-3 rounded" style={{ background: fundo, border: `1px solid ${borda}` }} />
              {SESSION_STATUS_LABELS[st]}
            </span>
          );
        })}
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded border border-dashed border-border" /> Sem status</span>
        <span className="w-px h-3 bg-border mx-1" />
        {/* O TIPO de ocupação: a forma do bloco, não a cor. */}
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-neutral-900" /> Bloqueado</span>
        <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded border border-dashed border-amber-400 bg-amber-400/20" /> Q — semana alternada de um quinzenal</span>
        {holidayCities.length > 0 && (
          <>
            <span className="w-px h-3 bg-border mx-1" />
            {(["NACIONAL", "ESTADUAL", "MUNICIPAL", "FACULTATIVO"] as const).map((t) => (
              <span key={t} className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded" style={{ background: HOLIDAY_STYLE[t].bg, border: `1px solid ${HOLIDAY_STYLE[t].border}` }} /> {HOLIDAY_STYLE[t].label}
              </span>
            ))}
          </>
        )}
      </div>

      {/* Os SINAIS, explicados. Símbolo sem legenda é adivinhação — e adivinhar numa agenda cheia
          é o começo de marcar em cima de alguém. (Doc 9: a pedido do dono, saíram da LEGENDA os sinais
          de reserva vencida / pediu remarcação / remarcada / pedido pelo link / confirmou presença — o
          símbolo ainda aparece NO card quando o status ocorre; só não ocupa mais a legenda.) */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-[11px] text-foreground/50">
        {Object.entries(SIMBOLO)
          .filter(([chave]) => !["pendente", "remarcar", "realocada", "pedido", "confirmou"].includes(chave))
          .map(([chave, simbolo]) => (
          <span key={chave} className="inline-flex items-center gap-1">
            <span aria-hidden="true">{simbolo}</span>
            {LEGENDA_DO_SINAL[chave]}
          </span>
        ))}
      </div>

      {/* Devolutivas próximas (lembrete) */}
      {(() => {
        // futuras. Congelar num estado não resolve: no render do servidor o valor seria a hora do
        // servidor e mudaria na hidratação do mesmo jeito. A correção real é só renderizar este
        // bloco depois de montar, o que muda o comportamento visual e precisa de conferência no
        // navegador — fica para quando houver essa checagem.
        // Lê o relógio para listar as devolutivas futuras. Congelar num estado não resolve: no
        // render do servidor o valor seria a hora do servidor e mudaria na hidratação do mesmo
        // jeito. A correção real é só renderizar este bloco depois de montar, o que muda o
        // comportamento visual e precisa de conferência no navegador.
        // eslint-disable-next-line react-hooks/purity
        const now = Date.now();
        const devs = sessions.filter((s) => s.sessionKind === "devolutiva" && new Date(s.date).getTime() >= now)
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 6);
        if (!devs.length) return null;
        return (
          <div className="glass-card rounded-2xl p-4 border-l-4 border-primary/50">
            <p className="text-xs font-bold uppercase tracking-wide text-primary/70 mb-2">📋 Devolutivas próximas</p>
            <div className="flex flex-wrap gap-2">
              {devs.map((d) => (
                <button key={d.id} onClick={() => { setSelected(d); }} className="text-xs bg-primary/5 hover:bg-primary/10 rounded-full px-3 py-1.5 transition">
                  {d.patientName} · {new Date(d.date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Grade */}
      <div className="glass-card rounded-[24px] overflow-hidden">
        {/* Scroller dos DOIS eixos: a coluna de hora já congela à esquerda por ser sticky dentro
            deste wrapper; dar a ele uma altura máxima + overflow nos dois eixos faz a linha da data
            congelar no topo pela mesma mecânica (doc 9, item 9). Antes era só overflow-x, e o
            sticky-top ficava preso ao card (overflow-hidden) sem congelar na rolagem. */}
        <div className="overflow-auto max-h-[75vh]">
          <div className="min-w-[900px]">
            {/* Cabeçalho dos dias — fixo no topo ao rolar (doc 9, item 9): a linha da data congela
                como a coluna da hora já congela à esquerda. */}
            <div className="flex border-b border-border bg-white/80 backdrop-blur-sm sticky top-0 z-30">
              <div className="w-14 shrink-0 sticky left-0 z-20 bg-white/80 backdrop-blur-sm" />
              {days.map((day) => {
                const isToday = day.toDateString() === new Date().toDateString();
                const hs = holidaysForDay(day);
                const top = hs[0];
                return (
                  <div key={day.toISOString()} className="flex-1 min-w-0 text-center py-3 border-l border-border" style={top ? { background: HOLIDAY_STYLE[top.tipo].bg } : undefined}>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-foreground/40">{DAY_NAMES[day.getDay()]}</p>
                    <p
                      className={`text-sm font-display font-bold mt-0.5 inline-block px-2 py-0.5 rounded-full tabular-nums ${isToday ? "bg-primary text-white" : top ? "" : "text-primary"}`}
                      style={!isToday && top ? { color: HOLIDAY_STYLE[top.tipo].fg } : undefined}
                    >
                      {day.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" })}
                    </p>
                    {hs.length > 0 && (
                      <div className="mt-0.5 px-1">
                        {hs.slice(0, 2).map((h, i) => (
                          <p key={i} className="text-[9px] leading-tight font-semibold truncate" title={`${h.nome}${h.cityName ? ` — ${h.cityName}` : ""} · ${HOLIDAY_STYLE[h.tipo].label}`} style={{ color: HOLIDAY_STYLE[h.tipo].fg }}>
                            {h.nome}
                          </p>
                        ))}
                        {hs.length > 2 && <p className="text-[9px] text-foreground/40">+{hs.length - 2} feriado(s)</p>}
                      </div>
                    )}
                    {birthdaysForDay(day).length > 0 && (
                      <div className="mt-1 px-1 space-y-0.5">
                        {birthdaysForDay(day).slice(0, 2).map((b, i) => (
                          <p key={i} className="text-[9px] leading-tight font-semibold truncate flex items-center gap-0.5 justify-center text-pink-600" title={`Aniversário: ${b.name}`}>
                            🎂 <span className="truncate">{b.name.split(" ")[0]}</span>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Corpo: gutter de horas + 7 colunas */}
            <div className="flex" style={{ height: (END_HOUR - START_HOUR) * HOUR_PX }}>
              {/* Gutter — fixo à esquerda: ao rolar a agenda para o lado, o horário continua visível
                  (prints 6.pdf, item 9, especialmente no celular). */}
              <div className="w-14 shrink-0 relative border-r border-border sticky left-0 z-20 bg-white/80 backdrop-blur-sm">
                {hours.map((h) => (
                  <div key={h} className="absolute inset-x-0 border-t border-border/60 pt-1 pr-2 text-right text-[10px] font-semibold tabular-nums text-foreground/50" style={{ top: (h - START_HOUR) * HOUR_PX, height: HOUR_PX }}>
                    {pad(h)}:00
                  </div>
                ))}
              </div>

              {/* Colunas dos dias */}
              {days.map((day) => {
                const isToday = day.toDateString() === new Date().toDateString();
                return (
                  <div key={day.toISOString()} className={`flex-1 min-w-0 relative border-l border-border ${isToday ? "bg-accent/[0.04]" : ""}`}>
                    {/* linhas de hora */}
                    {hours.map((h) => (
                      <div key={h} className="absolute w-full border-t border-border/60" style={{ top: (h - START_HOUR) * HOUR_PX }} />
                    ))}
                    {/* Slots clicáveis, de meia em meia hora: a sessão das 8h30 é tão comum quanto a
                        das 8h, e antes ela obrigava a abrir às 8h e corrigir o horário na janela.
                        Ficam atrás dos blocos de sessão. */}
                    {hours.flatMap((h) =>
                      [0, 30].map((min) => (
                        <button
                          key={`slot-${h}-${min}`}
                          onClick={() => openNew(day, h, min)}
                          title={`Agendar ${pad(h)}:${pad(min)}`}
                          className="absolute left-0 right-0 hover:bg-accent/10 transition-colors"
                          style={{ top: (h - START_HOUR) * HOUR_PX + (min / 60) * HOUR_PX, height: HOUR_PX / 2 }}
                        />
                      )),
                    )}
                    {/* Horários bloqueados: fundo preto e texto branco, como elas pediram. Ficam
                        atrás das sessões — se alguém bloquear em cima de um paciente por outro
                        caminho, quem tem que aparecer é o paciente. */}
                    {blocksByDay(day).map((b) => {
                      const d = new Date(b.date);
                      const minutos = (d.getHours() - START_HOUR) * 60 + d.getMinutes();
                      const top = Math.max(0, (minutos / 60) * HOUR_PX);
                      const height = Math.max(30, (b.duration / 60) * HOUR_PX - 2);
                      const texto = textoDoBloqueio(b.note);
                      return (
                        <div
                          key={b.id}
                          title={`${texto} · ${pad(d.getHours())}:${pad(d.getMinutes())}`}
                          style={{ top: top + 1, height }}
                          className="absolute left-1 right-1 rounded-lg bg-neutral-900 px-2 py-1 text-left overflow-hidden"
                        >
                          <p className="text-[10px] font-bold leading-tight tabular-nums text-white/70">{pad(d.getHours())}:{pad(d.getMinutes())}</p>
                          <p className="text-[10px] font-bold uppercase tracking-wide leading-tight text-white break-words" title={texto}>{texto}</p>
                        </div>
                      );
                    })}
                    {/* O slot "Q": a semana em que o quinzenal de alguém NÃO acontece. O horário fica
                        livre para outra pessoa, e a letra é o que avisa que ele é intercalado — quem
                        marcar ali toda semana tira o lugar do quinzenal original. */}
                    {ghostsForDay(day).map((g, gi) => {
                      const top = Math.max(0, (((g.hour - START_HOUR) * 60 + g.minute) / 60) * HOUR_PX);
                      const height = Math.max(26, (g.duration / 60) * HOUR_PX - 2);
                      const hh = `${pad(g.hour)}:${pad(g.minute)}`;
                      const quem = identificaPaciente(g.patientId, g.patientName);
                      return (
                        <button
                          key={`ghost-${gi}`}
                          onClick={() => setPerguntaQ({ day, hour: g.hour, minute: g.minute, quem })}
                          title={`Horário intercalado — quinzenal de ${g.patientName}. Clique para encaixar alguém.`}
                          style={{ top: top + 1, height }}
                          className="absolute left-1 right-1 rounded-lg px-2 py-1 text-left overflow-hidden border-l-[3px] border-dashed border-amber-400 bg-amber-400/10 hover:bg-amber-400/20 transition"
                        >
                          <p className="text-[10px] font-bold leading-tight text-amber-700">{hh}</p>
                          {/* Só o Q: o slot espelho diz que o horário intercala, não de quem ele é (dono, 18/09). O
                              nome segue no `title` e na janela de encaixe, onde ele importa para decidir. */}
                          <p className="text-[11px] font-black leading-tight truncate text-amber-700">Q</p>
                        </button>
                      );
                    })}
                    {/* Blocos de sessão. Duas no mesmo horário dividem a largura da coluna em vez
                        de uma cobrir a outra — com o fundo transparente, empilhar sobrepunha os
                        dois textos, e sessão invisível na agenda é sessão que alguém perde. */}
                    {(() => {
                      const doDia = sessionsByDay(day);
                      const faixas = posicoesDoDia(
                        doDia.map((s) => {
                          const d = new Date(s.date);
                          return { id: s.id, inicio: d.getHours() * 60 + d.getMinutes(), duracao: s.duration };
                        }),
                      );
                      return doDia.map((s) => {
                      const { top, height } = blockGeom(s);
                      const faixa = geometriaDaFaixa(faixas.get(s.id));
                      const time = new Date(s.date).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                      const vencida = reservaVencida(s.status, s.date, new Date());
                      return (
                        <button
                          key={s.id}
                          title={`${s.patientName}${s.location ? ` · ${s.location}` : ""}`}
                          onClick={() => { setEditing(false); setSelected(s); }}
                          style={{ top: top + 1, height, left: `calc(${faixa.left} + 4px)`, width: `calc(${faixa.width} - 8px)` }}
                          className={`absolute rounded-lg px-2 py-1 text-left overflow-hidden border border-l-[3px] hover:shadow-md hover:z-10 transition ${blockColor(s, vencida)}`}
                        >
                          {/* Os SINAIS, em ordem de urgência: primeiro o que muda a conduta de hoje,
                              depois o contexto. Cada um diz uma coisa só e nenhum repete a cor. */}
                          <p className="text-[10px] font-bold leading-tight flex items-center gap-0.5">
                            <span className="shrink-0 tabular-nums mr-0.5">{time}</span>
                            {sinaisDaSessao({
                              online: s.isOnline,
                              pedidoDoPaciente: s.pendingConfirmation && !s.recurring,
                              pacienteConfirmou: s.patientConfirmed && !s.rescheduleRequested,
                              pediuRemarcacao: s.rescheduleRequested,
                              realocada: s.status === "realocada",
                              reservaVencida: vencida,
                              supervisao: s.sessionKind === "supervisao",
                            }).map((sinal) => (
                              <span key={sinal.chave} title={sinal.titulo} className="shrink-0 leading-none">
                                {SIMBOLO[sinal.chave]}
                              </span>
                            ))}
                          </p>
                          {/* A identificação no lugar do nome: numa coluna de um sétimo da tela cabem
                              duas linhas curtas, e quem olha a semana precisa saber DE QUEM é o
                              horário e O QUE é a sessão, não ler o nome inteiro de cada um. O nome
                              continua no título do bloco, para quem passar o mouse. */}
                          <p className="text-[11px] font-semibold leading-tight truncate" title={celula(s).identificacao}>
                            {celula(s).identificacao}
                            {celula(s).repeticao && <span className="opacity-60"> ({celula(s).repeticao})</span>}
                          </p>
                          {/* doc 36: o símbolo ⇄ de recorrência saiu dos agendamentos — poluía a célula
                              e o ritmo já se lê pelo rótulo/posição. */}
                          <p className="text-[10px] font-bold uppercase tracking-wide truncate opacity-80">
                            <span className="truncate">{celula(s).codigo}</span>
                          </p>

                        </button>
                      );
                      });
                    })()}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Painel da sessão selecionada */}
      {selected && (
        <div className={FUNDO_DA_JANELA} onClick={() => setSelected(null)}>
          <div ref={janelaSessao} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Detalhes do agendamento" className={`${JANELA} max-w-sm outline-none`} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-lg font-display font-bold text-primary">{selected.patientName}</p>
                <p className="text-sm text-foreground/50">
                  {new Date(selected.date).toLocaleString("pt-BR", { weekday: "long", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} · {selected.duration}min
                </p>
                {(selected.risk === "alto" || selected.risk === "medio") && (
                  <span className={`inline-flex items-center gap-1 mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full ${riskColor(selected.risk as RiskLevel)}`}>
                    <AlertTriangle className="w-3 h-3" /> {RISK_LABELS[selected.risk as RiskLevel]} de falta
                  </span>
                )}
              </div>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg hover:bg-surface transition"><X className="w-4 h-4" /></button>
            </div>

            {!selected.pendingConfirmation && new Date(selected.date).setHours(0, 0, 0, 0) >= new Date().setHours(0, 0, 0, 0) && (
              <a href={`/atender/${selected.id}`} className="flex items-center justify-center gap-2 w-full rounded-xl bg-primary text-white py-2.5 text-sm font-bold hover:bg-primary-container transition">
                <Stethoscope className="w-4 h-4" /> Vamos atender?
              </a>
            )}

            {selected.pendingConfirmation && (
              <div className="rounded-xl bg-[#fffbeb] border border-[#fde68a] p-3 space-y-2">
                <p className="text-xs font-semibold text-[#92400e]">⏳ Agendamento solicitado pelo link público — aguardando sua confirmação.</p>
                <button disabled={pending} onClick={() => confirm(selected.id)} className="w-full rounded-xl bg-primary text-white py-2 text-sm font-bold disabled:opacity-60">
                  Confirmar agendamento
                </button>
              </div>
            )}

            <p className="text-sm text-foreground/60 flex items-center gap-1.5">
              {selected.isOnline ? <><Video className="w-4 h-4 text-primary" /> Online</> : <><MapPin className="w-4 h-4 text-primary" /> Presencial{selected.location ? ` · ${selected.location}` : ""}</>}
            </p>

            {/* Editar sessão (data / modalidade) */}
            {!editing ? (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setEditing(true); setEditErro(null); setEditModalidade(selected.isOnline ? "online" : "presencial"); setEditCanal("nenhum"); setRecFreq(selected.recurrenceFreq === "quinzenal" ? "quinzenal" : "semanal"); setRecUntil(""); setRecSegDia(""); setRecSegHora(""); setRecAberta(false); setEditStatus(selected.status as SessionStatus); }}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                >
                  <Pencil className="w-4 h-4" /> Editar agendamento
                </button>
                <button onClick={() => abrirExclusao(selected.id)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-600 hover:underline">
                  <Trash2 className="w-4 h-4" /> Excluir
                </button>
              </div>
            ) : (
              /* Só data/hora, duração, modalidade e lembrete são editáveis. Paciente, tipo e
                 repetição ficam de fora de propósito: trocar isso não é editar o agendamento, é
                 outro agendamento — e o lote pediu que ficassem inativos. */
              <form id="form-edicao-agendamento" action={submitEdit} className="rounded-xl bg-surface/60 border border-border p-3 space-y-2">
                {/* Doc 66: "Este atendimento será uma cortesia" saiu daqui. A cortesia passou a
                    ser decidida ao CRIAR o agendamento — ver `blocoDoAgendamento`. As sessões já
                    marcadas continuam cortesia: o que saiu foi o controle, não o dado. */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs font-semibold text-foreground/60">Data e horário</label>
                    <input name="date" type="datetime-local" defaultValue={toLocalInput(new Date(selected.date))} className="w-full px-3 py-2 rounded-xl bg-white border border-border outline-none text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground/60">Duração (min)</label>
                    <input name="duration" type="number" min={5} defaultValue={selected.duration} className="w-full px-3 py-2 rounded-xl bg-white border border-border outline-none text-sm" />
                  </div>
                </div>

                {/* Doc 67: acima da modalidade da sessão, como ele pediu. */}
                {selected.isOnline && <EntrarNaSala sessao={selected} />}

                <div>
                  <label className="text-xs font-semibold text-foreground/60">Modalidade</label>
                  <div className="grid grid-cols-3 gap-2 mt-1">
                    {modalidadesDe(selected.sessionKind).map((m) => (
                      <button
                        key={m.valor}
                        type="button"
                        onClick={() => setEditModalidade(m.valor)}
                        className={`py-1.5 rounded-lg text-xs font-bold transition ${editModalidade === m.valor ? "bg-primary text-white" : "bg-white text-foreground/60 hover:bg-surface"}`}
                      >
                        {m.rotulo}
                      </button>
                    ))}
                  </div>
                  <input type="hidden" name="modality" value={editModalidade} />
                </div>

                {pedeLocal(editModalidade) && (
                  <input name="location" defaultValue={selected.location ?? ""} placeholder="Local (presencial)" className="w-full px-3 py-2 rounded-xl bg-white border border-border outline-none text-sm" />
                )}

                <div>
                  <label className="text-xs font-semibold text-foreground/60">Lembrar sessão</label>
                  <select name="confirmChannel" value={editCanal} onChange={(e) => setEditCanal(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-white border border-border outline-none text-sm">
                    {CANAIS_DE_CONFIRMACAO.map((c) => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}
                  </select>
                  {pedeHorasAntes(editCanal) && (
                    <input name="confirmLeadHours" type="number" min={1} max={168} defaultValue={24} placeholder="horas antes" className="mt-2 w-full px-3 py-2 rounded-xl bg-white border border-border outline-none text-sm" />
                  )}
                </div>

                {editErro && <p className="text-sm text-red-600">{editErro}</p>}
                {/* Doc 67: Salvar e Cancelar saíram daqui e foram para BAIXO do status — um clique
                    grava data, horário, duração, modalidade, lembrete, recorrência e status. O
                    botão continua sendo o submit DESTE form, por `form={ID_DO_FORM_DA_EDICAO}`. */}
              </form>
            )}

            {/* Doc 43: alterar a RECORRÊNCIA a partir desta sessão. Só para sessões recorrentes; muda só o
                futuro (as realizadas, faltas, canceladas, pagas e encaixes avulsos ficam intactos). */}
            {editing && selected.recurring && (
              <div className="rounded-xl bg-[#eef2ff] border border-[#c7d2fe] p-3 space-y-2">
                {/* Doc 67: nasce FECHADA. Mudar a recorrência é raro e recria as sessões seguintes;
                    deixar o painel aberto em toda edição de horário convidava ao engano. */}
                <button
                  type="button"
                  onClick={() => setRecAberta((v) => !v)}
                  aria-expanded={recAberta}
                  className="flex w-full items-center justify-between gap-2 text-left"
                >
                  <span className="text-xs font-bold text-[#4338ca] uppercase tracking-wide">Alterar recorrência</span>
                  <ChevronDown className={`w-4 h-4 text-[#4338ca] transition ${recAberta ? "rotate-180" : ""}`} />
                </button>
                {recAberta && (<>
                <p className="text-[11px] text-foreground/60">Recria as próximas sessões desta série a partir desta data. Não mexe no passado, nas realizadas, nas pagas nem nos encaixes avulsos. Diferença de valor por frequência é ajustada no Financeiro.</p>
                {/* `items-end` alinha os campos pela base: "Frequência do atendimento" quebra em
                    duas linhas e empurrava o "Repetir até" para cima (doc 67). */}
                <div className="grid grid-cols-2 gap-2 items-end">
                  <div>
                    <label className="text-xs font-semibold text-foreground/60">Frequência do atendimento</label>
                    <select value={recFreq} onChange={(e) => setRecFreq(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-white border border-border outline-none text-sm">
                      <option value="semanal">Semanal (1x na semana)</option>
                      <option value="semanal2x">Semanal (2x na semana)</option>
                      <option value="quinzenal">Quinzenal</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-foreground/60">Repetir até</label>
                    <input type="date" value={recUntil} onChange={(e) => setRecUntil(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-white border border-border outline-none text-sm" />
                  </div>
                </div>
                {recFreq === "semanal2x" && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-semibold text-foreground/60">2º dia</label>
                      <select value={recSegDia} onChange={(e) => setRecSegDia(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-white border border-border outline-none text-sm">
                        <option value="">Selecione…</option>
                        {DIAS_DA_SEMANA.map((nome, i) => <option key={i} value={i}>{nome}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-foreground/60">2º horário</label>
                      <input type="time" value={recSegHora} onChange={(e) => setRecSegHora(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-white border border-border outline-none text-sm" />
                    </div>
                  </div>
                )}
                {/* Doc 67: o "Aplicar nova recorrência" saiu — quem aplica é o Salvar lá embaixo. */}
                </>)}
              </div>
            )}

            {/* Doc 67: no modo de EDIÇÃO este botão sobe para cima da modalidade (fica logo abaixo
                dos campos, dentro do form). Fora da edição ele continua aqui. */}
            {!editing && selected.isOnline && <EntrarNaSala sessao={selected} />}
            {/* Registro da reunião */}
            {(selected.meetingOpenedAt || selected.guestJoinedAt || selected.meetingEndedAt) && (
              <div className="rounded-xl bg-surface/60 border border-border p-3 text-xs text-foreground/60 space-y-1">
                <p className="font-bold text-foreground/40 uppercase tracking-widest text-[10px]">Reunião</p>
                {selected.meetingOpenedAt && <p>Abriu: {new Date(selected.meetingOpenedAt).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}</p>}
                {selected.guestJoinedAt && <p>Convidado entrou: {new Date(selected.guestJoinedAt).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>}
                {selected.meetingEndedAt && <p>Encerrou: {new Date(selected.meetingEndedAt).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>}
              </div>
            )}
            {reservaVencida(selected.status, selected.date, new Date()) && (
              <div className="rounded-xl bg-[#ffedd5] border border-[#fb923c] p-3">
                <p className="text-xs font-semibold text-[#9a3412]">🕓 Esta reserva já passou e está <strong>pendente de análise</strong>. Escolha abaixo o que aconteceu.</p>
              </div>
            )}
            <div>
              <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-2">Status</p>
              {/* Doc 67: EDITANDO, o status apenas se SELECIONA — quem grava é o Salvar abaixo,
                  junto do resto. Fora da edição ele continua agindo no clique, que é o caminho
                  rápido do dia a dia ("a paciente faltou", um toque). */}
              <div className="grid grid-cols-2 gap-2">
                {(STATUS_OFERECIDOS as readonly SessionStatus[]).map((st) => {
                  const marcado = editing ? editStatus === st : selected.status === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      disabled={pending}
                      onClick={() => (editing ? setEditStatus(st) : pickStatus(selected.id, st))}
                      className={`py-2 rounded-xl text-xs font-bold transition ${
                        marcado ? `${sessionStatusColor(st)} ring-2 ring-primary/30` : "bg-surface text-foreground/60 hover:bg-surface-container"
                      }`}
                    >
                      {SESSION_STATUS_LABELS[st]}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Doc 67: o rodapé da edição — um Salvar para data, horário, duração, modalidade,
                lembrete, recorrência e status. Os botões ficam FORA do form e o alcançam por
                `form=`, que é o que permite desenhá-los aqui embaixo sem quebrar o submit. */}
            {editing && (
              <div className="flex gap-2">
                <button form="form-edicao-agendamento" disabled={pending} className="flex-1 bg-primary text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-60">
                  Salvar
                </button>
                <button type="button" onClick={() => { setEditing(false); setEditErro(null); }} className="px-4 py-2.5 rounded-xl text-sm text-foreground/50">
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* O alcance da EDIÇÃO. Mudar a data de uma sessão de uma série sem perguntar erraria
          metade das vezes, e em silêncio. */}
      {perguntaAlcance && (
        <div className={FUNDO_DA_JANELA} onClick={() => setPerguntaAlcance(null)}>
          <div ref={janelaAlcance} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Alterar quais agendamentos" className={`${JANELA} max-w-sm outline-none`} onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-display font-bold text-primary">Alterar quais?</p>
            <p className="text-sm text-foreground/70">Deseja alterar apenas este agendamento ou este e também os próximos?</p>
            {/* Doc 68: o alcance vale para data, horário e companhia — o STATUS é sempre só desta
                sessão. Sem dizer isso aqui, "este e os próximos" parece prometer marcar presença
                no bloco inteiro. */}
            <p className="text-xs text-foreground/50">Lembrando que o status definido será aplicado apenas neste.</p>
            <div className="space-y-2">
              <button disabled={pending} onClick={() => aplicarEdicao("apenas_esta")} className="w-full bg-primary text-white py-2.5 rounded-xl font-bold disabled:opacity-60">
                Apenas este
              </button>
              {/* Doc 65: a escolha "sequência do pacote" SAIU daqui — a janela pergunta o alcance
                  da edição e só isso. Quem decide se a sessão entra na sequência é o agendamento,
                  no momento de criá-la; a mesma pergunta num lugar que fala de data e horário
                  fazia a decisão de dinheiro pegar carona numa troca de horário. */}
              <button disabled={pending} onClick={() => aplicarEdicao("mesmos_dias")} className="w-full bg-surface text-foreground/70 py-2.5 rounded-xl font-bold hover:bg-surface-container disabled:opacity-60">
                Este e os próximos
              </button>
              <button onClick={() => setPerguntaAlcance(null)} className="w-full py-2 text-sm text-foreground/40">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* O alcance da EXCLUSÃO, em dois passos: primeiro se é só este, depois, se são os próximos,
          se o bloco respeita o combinado de dia e hora ou pega tudo. Os números vêm do servidor —
          apagar em bloco sem dizer quantos é pedir confirmação no escuro. */}
      {perguntaFaltou && (
        <div className={FUNDO_DA_JANELA} onClick={() => setPerguntaFaltou(null)}>
          <div ref={janelaFalta} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Resposta sobre a sessão que faltou" className={`${JANELA} max-w-sm outline-none`} onClick={(e) => e.stopPropagation()}>
            {/* Doc 52: a pergunta é a do tipo do agendamento. A genérica "Considerar sessão
                realizada?" obrigava o usuário a traduzir sozinho o que "realizada" significa
                no contrato daquele paciente — e a consequência é outra em cada caso. */}
            <p className="text-lg font-display font-bold text-primary">{perguntaDaFalta(perguntaFaltou.tipo).titulo}</p>
            <p className="text-sm text-foreground/60 mt-1">
              <strong>Sim:</strong> {perguntaDaFalta(perguntaFaltou.tipo).explicaSim}
            </p>
            <p className="text-sm text-foreground/60 mt-1">
              <strong>Não:</strong> {perguntaDaFalta(perguntaFaltou.tipo).explicaNao}
            </p>
            {/* Doc 54: a saída. Sem isto a escolha parece definitiva, e não é. */}
            <p className="text-xs text-foreground/50 mt-2">{COMO_REFAZER}</p>
            <div className="flex gap-2 mt-4">
              <button disabled={pending} onClick={() => responderSim(perguntaFaltou.id, perguntaFaltou.tipo)} className="flex-1 bg-primary text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-60">Sim</button>
              <button disabled={pending} onClick={() => responderNao(perguntaFaltou.id, perguntaFaltou.tipo)} className="flex-1 bg-surface text-foreground/70 py-2.5 rounded-xl text-sm font-bold disabled:opacity-60">Não</button>
            </div>
          </div>
        </div>
      )}

      {/* Doc 55: o "Não" numa sessão que JÁ tem pagamento lançado. Sumir com a cobrança sem dizer
          para onde foi o dinheiro recebido é a pior saída numa tela de dinheiro — então o sistema
          pergunta, e as duas saídas preservam o valor: uma devolve, a outra adia. */}
      {pedeDestino && (
        <div className={FUNDO_DA_JANELA} onClick={() => setPedeDestino(null)}>
          <div ref={janelaDestino} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Destino do pagamento" className={`${JANELA} max-w-sm outline-none`} onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-display font-bold text-primary">Esta sessão já possui um pagamento registrado</p>
            <p className="text-sm text-foreground/70 mt-1">O que deseja fazer com esse pagamento de <strong>{formatBRL(pedeDestino.valor)}</strong>?</p>
            <div className="space-y-2 mt-4">
              <button disabled={pending} onClick={() => escolherDestino("estornar")} className="w-full bg-primary text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-60">
                Estornar o valor
              </button>
              <button disabled={pending} onClick={() => escolherDestino("transferir")} className="w-full bg-surface text-foreground/70 py-2.5 rounded-xl text-sm font-bold hover:bg-surface-container disabled:opacity-60">
                Transferir para a próxima sessão
              </button>
            </div>
            {erroDoDestino && <p className="text-sm text-red-600 mt-2">{erroDoDestino}</p>}
            <button onClick={() => setPedeDestino(null)} className="w-full py-2 mt-1 text-sm text-foreground/40">Cancelar</button>
          </div>
        </div>
      )}

      {/* Doc 61: o cadastro tem crédito e a sessão está virando AVUL — usar agora ou guardar? */}
      {perguntaCredito && (
        <div className={FUNDO_DA_JANELA} onClick={() => setPerguntaCredito(null)}>
          <div ref={janelaCredito} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Crédito do cadastro" className={`${JANELA} max-w-sm outline-none`} onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-display font-bold text-primary">{perguntaDaConversao(perguntaCredito.saldo)}</p>
            <p className="text-sm text-foreground/60 mt-1">
              Respondendo <b>Não</b>, o saldo fica guardado — a cada pagamento o sistema pergunta se ele deve ser abatido.
            </p>
            <div className="flex gap-2 mt-4">
              <button disabled={pending} onClick={() => responderCredito(true)} className="flex-1 bg-primary text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-60">Sim</button>
              <button disabled={pending} onClick={() => responderCredito(false)} className="flex-1 bg-surface text-foreground/70 py-2.5 rounded-xl text-sm font-bold hover:bg-surface-container disabled:opacity-60">Não</button>
            </div>
          </div>
        </div>
      )}

      {/* Doc 55: o valor da sessão que era gratuita e virou paga, perguntado na hora. Antes a linha
          nascia em R$ 0,00 e um aviso na guia Geral pedia para voltar lá e lançar — dois passos,
          em telas diferentes, para uma decisão que acabou de ser tomada aqui. */}
      {pedeValor && (
        <div className={FUNDO_DA_JANELA} onClick={() => setPedeValor(null)}>
          <div ref={janelaValor} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Valor da sessão" className={`${JANELA} max-w-sm outline-none`} onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-display font-bold text-primary">Qual o valor desta sessão?</p>
            <p className="text-sm text-foreground/60 mt-1">Ela será lançada como Avulso com este valor.</p>
            <input
              autoFocus
              inputMode="numeric"
              value={valorDaFalta}
              /* Doc 57: o campo se escreve sozinho — digitou 20000, aparece R$ 200,00. Sem a
                 máscara, "200" podia ser duzentos ou dois reais, e quem decidia era um parser que
                 quem digita não vê. */
              onChange={(e) => setValorDaFalta(mascaraMoeda(e.target.value))}
              onKeyDown={(e) => { if (e.key === "Enter") salvarValorDaFalta(); }}
              placeholder="R$ 0,00"
              aria-label="Valor da sessão"
              className="w-full mt-3 px-3 py-2 rounded-xl bg-white border border-border outline-none text-sm tabular-nums"
            />
            {erroDoValor && <p className="text-sm text-red-600 mt-2">{erroDoValor}</p>}
            <div className="flex gap-2 mt-4">
              <button disabled={pending} onClick={salvarValorDaFalta} className="flex-1 bg-primary text-white py-2.5 rounded-xl text-sm font-bold disabled:opacity-60">OK</button>
              <button disabled={pending} onClick={() => setPedeValor(null)} className="px-3 py-2.5 rounded-xl text-sm text-foreground/50">Depois</button>
            </div>
          </div>
        </div>
      )}

      {perguntaExcluir && (
        <div className={FUNDO_DA_JANELA} onClick={() => { setPerguntaExcluir(null); setQuantos(null); }}>
          <div ref={janelaExcluir} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Excluir agendamento" className={`${JANELA} max-w-sm outline-none`} onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-display font-bold text-red-600">Excluir agendamento</p>
            {perguntaExcluir.passo === "inicio" ? (
              <>
                <p className="text-sm text-foreground/70">Excluir apenas este agendamento, ou este e os próximos?</p>
                <div className="space-y-2">
                  <button disabled={pending} onClick={() => aplicarExclusao("apenas_esta")} className="w-full bg-red-600 text-white py-2.5 rounded-xl font-bold disabled:opacity-60">
                    Apenas este
                  </button>
                  <button onClick={() => setPerguntaExcluir({ ...perguntaExcluir, passo: "proximos" })} className="w-full bg-surface text-foreground/70 py-2.5 rounded-xl font-bold hover:bg-surface-container">
                    Este e os próximos…
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-foreground/70">Quais dos próximos?</p>
                <div className="space-y-2">
                  <button disabled={pending} onClick={() => aplicarExclusao("mesmos_dias")} className="w-full bg-red-600 text-white py-2.5 rounded-xl font-bold disabled:opacity-60">
                    Apenas os mesmos dias e horários{quantos ? ` (${quantos.mesmosDias})` : ""}
                  </button>
                  <button disabled={pending} onClick={() => aplicarExclusao("todas")} className="w-full bg-red-600/90 text-white py-2.5 rounded-xl font-bold disabled:opacity-60">
                    Todos, em qualquer dia e hora{quantos ? ` (${quantos.todas})` : ""}
                  </button>
                </div>
              </>
            )}
            <button onClick={() => { setPerguntaExcluir(null); setQuantos(null); }} className="w-full py-2 text-sm text-foreground/40">Cancelar</button>
          </div>
        </div>
      )}

      {/* A pergunta do slot Q. Nomeia quem intercala: "deseja intercalar?" sem dizer com quem
          não é pergunta que dê para responder. */}
      {perguntaQ && (
        <div className={FUNDO_DA_JANELA} onClick={() => setPerguntaQ(null)}>
          <div ref={janelaQ} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Sessão da quinzena" className={`${JANELA} max-w-sm outline-none`} onClick={(e) => e.stopPropagation()}>
            <p className="text-lg font-display font-bold text-primary">Horário intercalado</p>
            <p className="text-sm text-foreground/70">
              Este horário intercala com o paciente <strong>{perguntaQ.quem}</strong>. Deseja intercalar um novo
              agendamento com este?
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setPerguntaQ(null)}
                className="flex-1 py-2.5 rounded-xl font-semibold text-foreground/60 hover:bg-surface transition"
              >
                Não
              </button>
              <button
                type="button"
                onClick={() => {
                  const q = perguntaQ;
                  setPerguntaQ(null);
                  openNew(q.day, q.hour, q.minute, true);
                }}
                className="flex-1 bg-primary text-white py-2.5 rounded-xl font-bold"
              >
                Sim
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: novo atendimento */}
      {showNew && (
        <div className={FUNDO_DA_JANELA} onClick={() => setShowNew(false)}>
          <form
            action={submitNew}
            onClick={(e) => e.stopPropagation()}
            ref={janelaNova} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Novo agendamento" className={`${JANELA} max-w-sm outline-none`}
          >
            <div className="flex items-center justify-between">
              <p className="text-lg font-display font-bold text-primary">Novo atendimento</p>
              <button type="button" onClick={() => setShowNew(false)} className="p-1.5 rounded-lg hover:bg-surface transition"><X className="w-4 h-4" /></button>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground/60">Nome</label>
              <select name="patientId" required value={newPatient} onChange={(e) => {
                  setNewPatient(e.target.value);
                  // Doc 42: ao escolher um supervisionado, o tipo vira Supervisão; ao voltar p/ paciente, Consulta.
                  const alvo = patients.find((p) => p.id === e.target.value);
                  setNewKind(alvo?.cadastroKind === "supervisionado" ? "supervisao" : "consulta");
                }} className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border outline-none text-sm">
                <option value="">Selecione…</option>
                {/* Novo atendimento lista SÓ pacientes ATIVOS (doc 19/10): prospectado fica só na
                    Prospecção e inativo não agenda; ao converter p/ Ativo, passa a aparecer. A lista
                    completa (não-inativos) segue vindo do servidor para resolver o nome de sessões já
                    marcadas — por isso o filtro é aqui, no seletor, não na consulta. */}
                {/* Doc 34: a lista exibe o paciente pela IDENTIFICAÇÃO NA AGENDA (id da agenda), como
                    nas células da agenda — agendaId, senão o nº de registro, senão o 1º nome. */}
                {patients.filter((p) => p.status === "ativo").map((p) => (
                  <option key={p.id} value={p.id}>{identificacao({ agendaId: p.agendaId, registro: p.registrationNumber, nome: p.name })}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-foreground/60">Data/hora</label>
                <input name="date" type="datetime-local" required value={newDate} onChange={(e) => setNewDate(e.target.value)} className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border outline-none text-sm" />
              </div>
              <div>
                <label className="text-xs font-semibold text-foreground/60">Duração (min)</label>
                <input name="duration" type="number" defaultValue={50} className="w-full px-3 py-2.5 rounded-xl bg-surface border border-border outline-none text-sm" />
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground/60">Tipo</label>
              <select name="sessionKind" value={newKind} onChange={(e) => setNewKind(e.target.value)} className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border outline-none text-sm">
                {supervisionando ? (
                  <option value="supervisao">Supervisão</option>
                ) : (
                  <>
                    <option value="consulta">Consulta</option>
                    <option value="devolutiva">Devolutiva (aos responsáveis)</option>
                  </>
                )}
              </select>
            </div>

            {/* Doc 68: a devolutiva ganha o MESMO quadro da sequência, com as perguntas dela.
                Eram duas caixinhas soltas ("Cobrar esta devolutiva" / "Abater do pacote") cuja
                combinação ninguém sabia descrever — marcar as duas, ou nenhuma, produzia estados
                sem nome. Agora é uma escolha de cada vez. A regra mora em `lib/devolutiva`. */}
            {newKind === "devolutiva" && (
              <div className="rounded-xl bg-[#f3e8ff] px-3 py-2.5 space-y-2" data-testid="quadro-devolutiva">
                <p className="text-xs font-semibold text-[#6b21a8]">{TITULO_DA_DEVOLUTIVA}</p>
                <div className="grid grid-cols-2 gap-2">
                  {OPCOES_DA_DEVOLUTIVA.map((o) => (
                    <button key={o.valor} type="button" onClick={() => { setNewDevolutiva(o.valor); setNewAbatimento(null); }}
                      className={`py-2 px-2 rounded-xl text-xs font-bold transition ${newDevolutiva === o.valor ? "bg-[#6b21a8] text-white" : "bg-white text-foreground/70 hover:bg-surface-container"}`}>
                      {o.rotulo}
                    </button>
                  ))}
                </div>

                {newDevolutiva === "cobrar" && (
                  <div>
                    <label className="text-[11px] font-semibold text-[#6b21a8]/80">Valor da devolutiva (R$)</label>
                    <MoneyInput name="valorDevolutiva" required defaultValue={selectedPatient?.sessionFee ?? null}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#e9d5ff] outline-none text-sm" />
                    <p className="text-[11px] text-[#6b21a8]/70 mt-1">Vence no dia e horário deste atendimento.</p>
                  </div>
                )}

                {/* Doc 70: no GRATUITO a pergunta da sequência não aparece — "agendamentos com
                    financeiro gratuito não seguem uma sequência". Nos demais formatos, segue igual. */}
                {newDevolutiva === "nao_cobrar" && formatoNaDataNova !== "gratuito" && (
                  <>
                    <p className="text-xs font-semibold text-[#6b21a8]">E quanto à sequência do pacote?</p>
                    <div className="grid grid-cols-2 gap-2">
                      {OPCOES_DO_ABATIMENTO.map((o) => (
                        <button key={o.valor} type="button" onClick={() => setNewAbatimento(o.valor)}
                          className={`py-2 px-2 rounded-xl text-xs font-bold transition ${newAbatimento === o.valor ? "bg-[#6b21a8] text-white" : "bg-white text-foreground/70 hover:bg-surface-container"}`}>
                          {o.rotulo}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-[#6b21a8]/70">
                      {newAbatimento === "abater"
                        ? "Ocupa uma posição: a sequência avança."
                        : "Não ocupa posição: a sequência não avança, como numa desmarcada."}
                    </p>
                  </>
                )}

                <input type="hidden" name="devolutivaEscolha" value={newDevolutiva ?? ""} />
                <input type="hidden" name="devolutivaAbatimento" value={newAbatimento ?? ""} />
              </div>
            )}

            {/* Regra do dono (15/09/2026): sessão inserida entre as do pacote pode ficar FORA da
                sequência. Fora, não muda numeração, contagem nem valor do pacote.
                Doc 67: a cortesia saiu daqui — "já temos a opção GRAT no botão não adicionar". E no
                PRIMEIRO agendamento o verbo muda para "Iniciar": não há sequência para adicionar a. */}
            {blocoNovo && (
              <div className="rounded-xl bg-[#fef3c7] px-3 py-2.5 space-y-2" data-testid="pergunta-sequencia">
                {blocoNovo.titulo && <p className="text-xs font-semibold text-[#92400e]">{blocoNovo.titulo}</p>}
                <div className="grid grid-cols-2 gap-2">
                  {blocoNovo.opcoes.map((o) => (
                    <button key={o.valor} type="button" onClick={() => setNewEscolha(o.valor)}
                      className={`py-2 px-2 rounded-xl text-xs font-bold transition ${escolhaNova === o.valor ? "bg-[#92400e] text-white" : "bg-white text-foreground/70 hover:bg-surface-container"}`}>
                      {o.rotulo}
                    </button>
                  ))}
                </div>
                <input type="hidden" name="naSequencia" value={campoEscolha.naSequencia} />
                {/* Doc 71: no financeiro a cada sessão o quadro pergunta a cortesia, e é por aqui
                    que a resposta chega ao servidor. Nos demais formatos vai "nao" — a cortesia não
                    é oferecida ali (o "Não (GRAT)" faz o mesmo papel, doc 67). */}
                <input type="hidden" name="cortesia" value={campoEscolha.cortesia} />
                {/* Doc 36: "abater do pacote" segue acontecendo (a sessão preenche uma desmarcada
                    em aberto, ocupando a posição — nada atravessa para o mês seguinte e o total não
                    muda), MAS não se pergunta mais QUAL desmarcada: a sessão específica não importa,
                    só que ela participa da sequência. Preenche a primeira em aberto, sem UI. Só no
                    agendamento único — uma série é o próprio ritmo, não uma reposição. */}
                {escolhaNova === "normal" && !newRecorrente && (selectedPatient?.desmarcadas?.length ?? 0) > 0 && (
                  <input type="hidden" name="repoeSessaoId" value={repoeEfetivo} />
                )}
                {escolhaNova === "fora" && (
                  <>
                    <p className="text-xs font-semibold text-[#92400e]">Esta sessão será cobrada?</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[{ v: "sim", r: "Sim (AVUL)" }, { v: "nao", r: "Não (GRAT)" }].map((o) => (
                        <button key={o.v} type="button" onClick={() => setNewCobrada(o.v)}
                          className={`py-2 rounded-xl text-xs font-bold transition ${newCobrada === o.v ? "bg-[#92400e] text-white" : "bg-white text-foreground/70 hover:bg-surface-container"}`}>
                          {o.r}
                        </button>
                      ))}
                    </div>
                    <input type="hidden" name="cobrada" value={newCobrada} />
                    {newCobrada === "sim" && (
                      <div>
                        <label className="text-[11px] font-semibold text-[#92400e]/80">Valor da sessão avulsa (R$)</label>
                        <MoneyInput name="valorExtra" required defaultValue={selectedPatient?.sessionFee ?? null}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-[#fde68a] outline-none text-sm" />
                      </div>
                    )}
                    {/* Doc 73: o texto passa a dizer o que ACONTECE, e não o que não acontece.
                        "Fica fora do pacote: não muda a numeração, a contagem nem o valor" era a
                        mesma frase nas duas respostas — e elas produzem coisas diferentes. */}
                    <p className="text-[11px] text-[#92400e]/70">
                      {newCobrada === "sim"
                        ? "Acrescenta uma sessão avulsa ao pacote, cobrada separadamente."
                        : "Acrescenta uma sessão extra gratuita."}
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Três opções em vez de uma caixa "é online?": misto é um combinado de verdade —
                uma semana na sala, outra na chamada — e não cabia num sim ou não. A devolutiva
                não oferece misto: é um encontro único com os responsáveis. */}
            <div>
              <label className="text-xs font-semibold text-foreground/60">Modalidade</label>
              <div className="grid grid-cols-3 gap-2 mt-1">
                {modalidadesDe(newKind).map((m) => (
                  <button
                    key={m.valor}
                    type="button"
                    onClick={() => setNewModalidade(m.valor)}
                    className={`py-2 rounded-xl text-xs font-bold transition ${newModalidade === m.valor ? "bg-primary text-white" : "bg-surface text-foreground/60 hover:bg-surface-container"}`}
                  >
                    {m.rotulo}
                  </button>
                ))}
              </div>
              <input type="hidden" name="modality" value={newModalidade} />
            </div>

            {pedeLocal(newModalidade) && (
              <div>
                <label className="text-xs font-semibold text-foreground/60">Local (presencial)</label>
                {locations.length ? (
                  <select name="location" className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border outline-none text-sm" defaultValue={suggestLoc}>
                    <option value="">—</option>
                    {locations.map((l, i) => { const v = l.name ? `${l.name} — ${l.address}` : l.address; return <option key={i} value={v}>{v}</option>; })}
                  </select>
                ) : (
                  <input name="location" defaultValue={suggestLoc} placeholder="Endereço" className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border outline-none text-sm" />
                )}
                {suggestLoc && <p className="text-[11px] text-[#92400e] mt-1">⚠️ Confirme o endereço — sugerido: {suggestLoc}</p>}
              </div>
            )}

            <div className="rounded-xl bg-[#dbeafe] px-3 py-2.5 space-y-2">
              <label className="flex items-center gap-2 text-sm font-semibold text-[#1e40af]">
                <Repeat className="w-4 h-4" /> Frequência
              </label>
              <select name="freq" value={newFreq} onChange={(e) => setNewFreq(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-white border border-[#bfdbfe] outline-none text-sm">
                {repeticoesDe({ tipo: newKind, slotIntercalado: deSlotQ }).map((r) => <option key={r.valor} value={r.valor}>{r.rotulo}</option>)}
              </select>
              {newRecorrente && (
                <div>
                  <label className="text-[11px] font-semibold text-[#1e40af]/80">Repetir agendamento até</label>
                  <input name="until" type="date" required className="w-full px-3 py-2 rounded-xl bg-white border border-[#bfdbfe] outline-none text-sm" />
                </div>
              )}
              {/* Doc 36 (item 3): no horário intercalado a repetição semanal AGORA é permitida — ela
                  pula sozinha a semana que o quinzenal ocupa. Explica isso ao escolher "Toda semana". */}
              {deSlotQ && newFreq === "semanal" && (
                <p className="text-[11px] text-[#1e40af]/70">
                  Este horário já possui um agendamento na próxima semana. A repetição semanal será iniciada
                  normalmente, pulando apenas essa semana ocupada. Caso queira, realize o agendamento da próxima
                  semana em outra data, escolhendo a opção “Adicionar à sequência do pacote”.
                </p>
              )}
              {(newFreq === "mensal" || newFreq === "mes") && (
                <p className="text-[11px] text-[#1e40af]/70">
                  O mensal marca só esta data. No fim do mês o paciente aparece em “Lembrar agendamento”, no Dashboard.
                </p>
              )}
              {ehSemanal2x(newFreq) && (
                <div className="rounded-xl bg-white/70 border border-[#bfdbfe] px-3 py-2.5 space-y-2" data-testid="segundo-dia">
                  {/* O primeiro dia e horário já vieram do próprio agendamento; aqui só falta o segundo. */}
                  <p className="text-[11px] font-semibold text-[#1e40af]">Segundo atendimento da semana</p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-[11px] font-semibold text-[#1e40af]/70">Dia da semana</span>
                      <select name="segundoDia" value={newSegundoDia} onChange={(e) => setNewSegundoDia(e.target.value)} required
                        className="w-full px-3 py-2 rounded-xl bg-white border border-[#bfdbfe] outline-none text-sm">
                        <option value="">Escolha…</option>
                        {DIAS_DA_SEMANA.map((d, i) => <option key={d} value={i}>{d}{i === diaDaPrimeira ? " (mesmo dia, outro horário)" : ""}</option>)}
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-semibold text-[#1e40af]/70">Horário</span>
                      <input name="segundoHorario" type="time" required value={newSegundoHorario} onChange={(e) => setNewSegundoHorario(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-white border border-[#bfdbfe] outline-none text-sm" />
                    </label>
                  </div>
                  <p className="text-[11px] text-[#1e40af]/70">Neste caso o pacote será considerado com <strong>8 sessões</strong>.</p>
                </div>
              )}
            </div>

            <input type="hidden" name="reserva" value="false" />
            {/* Esta janela so AGENDA. A baixa da sessao — Presente, Faltou, Desmarcou — acontece na
                janela que abre ao clicar num agendamento ja feito; oferecer o status aqui convidava
                a dar baixa num atendimento que ainda nem aconteceu. */}
            <input type="hidden" name="status" value="agendada" />

            <div className="rounded-xl bg-surface/60 border border-border px-3 py-2.5 space-y-2">
              <label className="text-xs font-semibold text-foreground/60">Confirmar sessão</label>
              <select name="confirmChannel" value={newCanal} onChange={(e) => setNewCanal(e.target.value)} className="w-full px-3 py-2 rounded-xl bg-white border border-border outline-none text-sm">
                {CANAIS_DE_CONFIRMACAO.map((c) => <option key={c.valor} value={c.valor}>{c.rotulo}</option>)}
              </select>
              {pedeHorasAntes(newCanal) && (
                <label className="block">
                  <span className="text-[11px] font-semibold text-foreground/50">Quantas horas antes</span>
                  <input name="confirmLeadHours" type="number" min={1} max={168} defaultValue={24} className="w-full px-3 py-2 rounded-xl bg-white border border-border outline-none text-sm" />
                </label>
              )}
            </div>

            {newError && <p className="text-sm text-red-600">{newError}</p>}

            <button disabled={pending} className="w-full bg-primary text-white py-2.5 rounded-xl font-bold disabled:opacity-60">
              {pending ? "Salvando…" : "Agendar"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

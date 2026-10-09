"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { queixaGroup } from "@/lib/queixas";
import { MessagePatient } from "./MessagePatient";
import { ModalPacientes } from "./ModalPacientes";
import { salvarMensagemAgendamento, salvarMensagemAniversario } from "@/app/dashboard/actions";
import { mensagemPara, MODELO_PADRAO_DO_LEMBRETE } from "@/lib/lembrarAgendamento";
import { horaDeParede } from "@/lib/horaLocal";
import { InfoTip } from "@/components/InfoTip";
import { numeroDoWhatsapp } from "@/lib/telefoneWhatsapp";

export type PanelPatient = {
  id: string; name: string; status: string;
  gender: string | null; birthDate: string | null; address: string | null;
  phone: string | null; guardianPhone: string | null; email: string | null;
  queixaPrincipal: string | null; paymentStatus: string | null;
  prospectDate: string | null; prospectFechou: string | null; startedAt: string | null;
};
export type PanelPresence = { patientId: string; presente: boolean; date: string };

const inRange = (iso: string | null, from: string, to: string): boolean => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (from && t < new Date(from + "T00:00:00").getTime()) return false;
  if (to && t > new Date(to + "T23:59:59").getTime()) return false;
  return true;
};

const card = "glass-card rounded-[24px] p-5 space-y-4";
const inp = "px-3 py-2 rounded-xl bg-surface border border-border outline-none text-sm";
const lbl = "text-[11px] font-semibold uppercase tracking-wide text-foreground/40";

function Stat({ n, label, tone = "primary", onAbrir }: { n: number | string; label: string; tone?: string; onAbrir?: () => void }) {
  const c = tone === "green" ? "text-emerald-600" : tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : "text-primary";
  const dentro = (<><p className={`text-2xl font-display font-bold ${c}`}>{n}</p><p className="text-[11px] text-foreground/50">{label}</p></>);
  // Com `onAbrir` o número VIRA o botão que abre a lista — é o padrão que substituiu o link
  // "abrir" no canto do cartão. Sem ele, segue sendo texto.
  if (!onAbrir) return <div className="text-center">{dentro}</div>;
  return (
    <button type="button" onClick={onAbrir} className="text-center rounded-xl px-1 py-1 hover:bg-surface/70 transition cursor-pointer">
      {dentro}
      <span className="block text-[10px] font-semibold text-primary/60">ver lista</span>
    </button>
  );
}

export type ParaLembrar = {
  id: string;
  nome: string;
  diasSemSessao: number | null;
  phone: string | null;
  email: string | null;
};

export function DashboardPanels({
  patients, presence, mensagemAniversario, corteSemana, hoje,
  aLembrar = [], mensagemAgendamento = "", mostrarLembrar = false,
}: {
  patients: PanelPatient[];
  presence: PanelPresence[];
  mensagemAniversario: string;
  /** Início da janela de 7 dias, em ISO, calculado no servidor. Ver AtivosInativos. */
  corteSemana: string;
  /** Hoje em YYYY-MM-DD, do servidor. Ver Aniversariantes. */
  hoje: string;
  /** Mensais sem data no mês que vem. Ver LembrarAgendamento. */
  aLembrar?: ParaLembrar[];
  mensagemAgendamento?: string;
  /** Se hoje está nos últimos dias do mês. Vem do servidor: o relógio do navegador pode divergir. */
  mostrarLembrar?: boolean;
}) {
  return (
    <section className="space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/40">Painéis</h3>
      {/* items-start: sem isto o grid esticava cada cartão até a altura do vizinho da linha, e
          um painel curto ao lado de uma lista longa virava meia tela de espaço vazio. */}
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <Prospeccao patients={patients} />
        <Relatorios patients={patients} presence={presence} corte={corteSemana} />
        <Aniversariantes patients={patients} modeloSalvo={mensagemAniversario} hoje={hoje} />
        {mostrarLembrar && <LembrarAgendamento lista={aLembrar} modeloSalvo={mensagemAgendamento} />}
        <QueixaBloco patients={patients} />
        <Pagamentos patients={patients} />
      </div>
    </section>
  );
}

// 1. PROSPECÇÃO — sem filtro de data (quem quer recortar por período usa a tela de prospects).
// "Não fechou" NÃO é uma coluna própria: enquanto o prospect não fechou, ele conta como em
// aberto — é assim que o consultório lê o número.
function Prospeccao({ patients }: { patients: PanelPatient[] }) {
  const base = patients.filter((p) => p.prospectDate);
  const fechados = base.filter((p) => p.status !== "prospect" || p.prospectFechou === "Fechou").length;
  const emAberto = base.length - fechados;
  const taxa = base.length ? Math.round((fechados / base.length) * 100) : 0;
  return (
    <div className={card}>
      <h4 className="font-display font-bold text-primary inline-flex items-center">
        Prospecção
        <InfoTip text="Aqui você acompanha a quantidade de pacientes prospectados. Para cadastrar novos prospectados, acesse Menu → Prospecção." />
      </h4>
      <div className="grid grid-cols-4 gap-2">
        <Stat n={base.length} label="Prospectados" />
        <Stat n={fechados} label="Fechados" tone="green" />
        <Stat n={emAberto} label="Em aberto" tone="amber" />
        <Stat n={`${taxa}%`} label="Tx conversão" />
      </div>
    </div>
  );
}

// 2. RELATÓRIOS — o painel virou porta de entrada, não a ferramenta. Os filtros e as colunas
// vivem em /dashboard/relatorio-pacientes: caixa de seleção de coluna não cabe num cartão de
// dashboard, e o resultado é uma tabela larga. Aqui ficam só os números que orientam o clique.
function Relatorios({ patients, presence, corte }: { patients: PanelPatient[]; presence: PanelPresence[]; corte: string }) {
  const [lista, setLista] = useState<{ titulo: string; itens: PanelPatient[] } | null>(null);
  const ativos = patients.filter((p) => p.status === "ativo");
  const inativos = patients.filter((p) => p.status === "inativo");
  // "Não vieram na semana": ativo sem sessão realizada nos últimos 7 dias. `corte` vem do servidor.
  const semana = useMemo(() => {
    const limite = new Date(corte).getTime();
    const vieram = new Set(presence.filter((r) => r.presente && new Date(r.date).getTime() >= limite).map((r) => r.patientId));
    return ativos.filter((p) => !vieram.has(p.id));
  }, [ativos, presence, corte]);
  return (
    <div className={card}>
      <h4 className="font-display font-bold text-primary inline-flex items-center">
        Relatórios
        <InfoTip text="A opção Ver lista exibe a lista de pacientes deste determinado grupo. Clique em Montar relatório para visualizar ou imprimir os campos do relatório." />
      </h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Stat n={ativos.length + inativos.length} label="No cadastro" />
        <Stat n={ativos.length} label="Ativos" tone="green" onAbrir={() => setLista({ titulo: "Pacientes ativos", itens: ativos })} />
        <Stat n={inativos.length} label="Inativos" onAbrir={() => setLista({ titulo: "Pacientes inativos", itens: inativos })} />
        <Stat n={semana.length} label="Não vieram na semana" tone="amber" onAbrir={() => setLista({ titulo: "Ativos sem sessão realizada nos últimos 7 dias", itens: semana })} />
      </div>
      <Link href="/dashboard/relatorio-pacientes" className="inline-block text-xs font-bold px-3 py-1.5 rounded-lg bg-primary text-white">Montar relatório</Link>
      {lista && <ModalPacientes titulo={lista.titulo} pacientes={lista.itens} onFechar={() => setLista(null)} />}
    </div>
  );
}

// 3. ANIVERSARIANTES — recorte por DIA/MÊS, não por ano: o filtro compara só a virada do
// calendário, senão ninguém apareceria (a data de nascimento é sempre de anos atrás). Sem idade
// na lista, de propósito. O modelo da mensagem fica salvo no perfil do terapeuta.
const MODELO_PADRAO = "Feliz aniversário, {nome}! Que seu novo ciclo venha leve. 🎂";

/**
 * LEMBRAR AGENDAMENTO: quem atende uma vez por mês e ainda não marcou o mês que vem.
 *
 * O agendamento mensal deixou de gerar as sessões seguintes — quem atende uma vez por mês combina
 * a data na própria sessão, e uma agenda cheia de datas presumidas atrapalha. Mas sem gerar nada o
 * paciente sumiria da vista até alguém lembrar dele, que é o que acontece na prática com paciente
 * de baixa frequência. Esta lista é o contrapeso.
 *
 * Ela só aparece nos últimos dias do mês, e **se esvazia sozinha**: assim que a data do mês que vem
 * é marcada, a pessoa sai. Não há nada para concluir, e por isso não há nada que alguém possa
 * esquecer de concluir — lista que exige ser marcada como feita é lista que fica desatualizada.
 */
function LembrarAgendamento({ lista, modeloSalvo }: { lista: ParaLembrar[]; modeloSalvo: string }) {
  const [modelo, setModelo] = useState(modeloSalvo || MODELO_PADRAO_DO_LEMBRETE);
  const [salvo, setSalvo] = useState<boolean | null>(null);

  async function salvar() {
    setSalvo(null);
    const r = await salvarMensagemAgendamento(modelo);
    setSalvo(r.ok);
  }

  return (
    <div className={card}>
      <div className="flex items-center justify-between">
        <h4 className="font-display font-bold text-primary">Lembrar agendamento</h4>
        <span className="text-xs text-foreground/40">{lista.length} sem data</span>
      </div>
      <p className="text-xs text-foreground/50">
        Atendem uma vez por mês e ainda não marcaram o mês que vem. Saem daqui sozinhos quando a data for marcada.
      </p>

      {lista.length === 0 ? (
        <p className="text-sm text-foreground/40">Todo mundo já tem data para o mês que vem. 🌿</p>
      ) : (
        <div className="space-y-1.5 max-h-56 overflow-y-auto">
          {lista.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-xl bg-surface/60 px-3 py-2">
              <span className="flex-1 text-sm font-medium truncate">{p.nome}</span>
              {p.diasSemSessao !== null && (
                <span className="text-[11px] text-foreground/40 shrink-0 tabular-nums">{p.diasSemSessao}d</span>
              )}
              <MessagePatient
                patient={{ id: p.id, name: p.nome, phone: p.phone, email: p.email }}
                compact
                rotulo="Lembrar"
                textoInicial={mensagemPara(modelo, p.nome)}
              />
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5 border-t border-border pt-3">
        <span className={lbl}>Mensagem · <code>{"{nome}"}</code> vira o primeiro nome</span>
        <textarea value={modelo} onChange={(e) => { setModelo(e.target.value); setSalvo(null); }} rows={2} className={`${inp} w-full resize-none`} />
        <div className="flex items-center gap-2">
          <button onClick={salvar} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-primary text-white">Salvar modelo</button>
          {salvo === true && <span className="text-xs text-emerald-600">salvo</span>}
          {salvo === false && <span className="text-xs text-red-600">não deu para salvar</span>}
        </div>
      </div>
    </div>
  );
}
/**
 * Dia e mês do aniversário, sem passar por fuso.
 *
 * A data de nascimento é data de CALENDÁRIO: 21/09 é 21/09 em qualquer lugar do mundo. Ela nasce
 * meia-noite sem fuso no banco e, lida como UTC num fuso negativo, recuava um dia — 21/09 aparecia
 * como 20/09 na lista de aniversariantes, que foi o que o dono fotografou (18/09). Pior: o servidor
 * roda em UTC e o navegador não, então os dois desenhavam dias diferentes.
 */
const ddmm = (iso: string) => {
  const d = new Date(horaDeParede(iso));
  return { dia: d.getDate(), mes: d.getMonth() + 1 };
};
/** Dia do ano (1..366) ignorando o ano, para poder comparar intervalos que não viram o ano. */
const ordinal = (mes: number, dia: number) => mes * 100 + dia;

// `hoje` vem do servidor: chamar new Date() aqui daria valor diferente na renderização do
// servidor e na do cliente, e o React reclamaria da divergência nos campos de data.
function Aniversariantes({ patients, modeloSalvo, hoje }: { patients: PanelPatient[]; modeloSalvo: string; hoje: string }) {
  const [ano, mes] = hoje.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const [de, setDe] = useState(`${hoje.slice(0, 8)}01`);
  const [ate, setAte] = useState(`${hoje.slice(0, 8)}${String(ultimoDia).padStart(2, "0")}`);
  const [modelo, setModelo] = useState(modeloSalvo || MODELO_PADRAO);
  const [salvo, setSalvo] = useState<boolean | null>(null);
  const [avisoAniv, setAvisoAniv] = useState<string | null>(null);

  // Doc 21: Parabenizar ABRE o WhatsApp (como Lembrar/Contatar), não o envio interno. Vai no
  // WhatsApp do paciente; sem telefone do paciente, cai no do responsável. {nome} = primeiro nome.
  function parabenizar(p: PanelPatient) {
    const num = numeroDoWhatsapp(p.phone) ?? numeroDoWhatsapp(p.guardianPhone);
    if (!num) { setAvisoAniv(`${p.name} está sem telefone (paciente ou responsável) para o WhatsApp.`); return; }
    setAvisoAniv(null);
    const texto = modelo.replace(/\{nome\}/g, p.name.split(" ")[0]);
    window.open(texto.trim() ? `https://wa.me/${num}?text=${encodeURIComponent(texto)}` : `https://wa.me/${num}`, "_blank", "noopener");
  }

  const lista = useMemo(() => {
    const limites = (v: string) => {
      const [, m, d] = v.split("-").map(Number);
      return ordinal(m, d);
    };
    const a = de ? limites(de) : null;
    const b = ate ? limites(ate) : null;
    return patients
      .filter((p) => p.status !== "prospect" && p.birthDate)
      .map((p) => ({ ...p, ...ddmm(p.birthDate as string) }))
      .filter((p) => {
        const o = ordinal(p.mes, p.dia);
        if (a !== null && b !== null) return a <= b ? o >= a && o <= b : o >= a || o <= b; // intervalo pode virar o ano
        if (a !== null) return o >= a;
        if (b !== null) return o <= b;
        return true;
      })
      .sort((x, y) => ordinal(x.mes, x.dia) - ordinal(y.mes, y.dia));
  }, [patients, de, ate]);

  async function salvar() {
    setSalvo(null);
    const r = await salvarMensagemAniversario(modelo);
    setSalvo(r.ok);
  }

  return (
    <div className={card}>
      <div className="flex items-center justify-between">
        <h4 className="font-display font-bold text-primary">Aniversariantes</h4>
        <span className="text-xs text-foreground/40">{lista.length} no período</span>
      </div>
      <div className="flex gap-2 flex-wrap items-end">
        <div><span className={lbl}>Data de</span><input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={inp} /></div>
        <div><span className={lbl}>até</span><input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={inp} /></div>
      </div>

      {lista.length === 0 ? (
        <p className="text-sm text-foreground/40">Nenhum aniversário no período.</p>
      ) : (
        <div className="space-y-1.5 max-h-56 overflow-y-auto">
          {lista.map((p) => (
            <div key={p.id} className="flex items-center gap-2 rounded-xl bg-surface/60 px-3 py-2">
              <span className="font-mono text-xs font-bold text-primary shrink-0 w-12">{String(p.dia).padStart(2, "0")}/{String(p.mes).padStart(2, "0")}</span>
              <span className="flex-1 text-sm font-medium truncate">{p.name}</span>
              <button type="button" onClick={() => parabenizar(p)}
                className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/15 transition">
                Parabenizar
              </button>
            </div>
          ))}
        </div>
      )}
      {avisoAniv && <p className="text-xs font-semibold text-[#b45309]">{avisoAniv}</p>}

      <div className="space-y-1.5 border-t border-border pt-3">
        <span className={`${lbl} inline-flex items-center`}>
          Mensagem
          <InfoTip text="Digite a mensagem que será enviada para parabenizar o paciente e clique em Parabenizar. A mensagem vai pelo WhatsApp do paciente. Para personalizar com o nome, utilize {nome} — o sistema substitui pelo primeiro nome. Se estiver em branco, ao clicar em Parabenizar o WhatsApp abre com o campo vazio." />
        </span>
        <textarea value={modelo} onChange={(e) => { setModelo(e.target.value); setSalvo(null); }} rows={2} className={`${inp} w-full resize-none`} />
        <div className="flex items-center gap-2">
          <button onClick={salvar} className="text-xs font-bold px-3 py-1.5 rounded-lg bg-primary text-white">Salvar modelo</button>
          {salvo === true && <span className="text-xs text-emerald-600">salvo</span>}
          {salvo === false && <span className="text-xs text-red-600">não deu para salvar</span>}
        </div>
      </div>
    </div>
  );
}

// 5. QUEIXA PRINCIPAL — mostra as 3 principais e abre o resto sob demanda
function QueixaBloco({ patients }: { patients: PanelPatient[] }) {
  const [from, setFrom] = useState(""), [to, setTo] = useState(""), [tipo, setTipo] = useState(""), [tudo, setTudo] = useState(false);
  const [aberta, setAberta] = useState<string | null>(null);
  const base = patients.filter((p) => p.status !== "prospect" && ((from || to) ? inRange(p.startedAt, from, to) : true));
  // Agrupa GUARDANDO os pacientes, não só a contagem: é a lista que o botão "abrir" mostra.
  const groups = useMemo(() => {
    const m = new Map<string, PanelPatient[]>();
    for (const p of base) {
      const g = queixaGroup(p.queixaPrincipal);
      if (g === "—") continue;
      const atual = m.get(g);
      if (atual) atual.push(p); else m.set(g, [p]);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [base]);
  const filtrados = tipo ? groups.filter((g) => g[0] === tipo) : groups;
  const shown = tipo || tudo ? filtrados : filtrados.slice(0, 3);
  const escondidos = filtrados.length - shown.length;
  const maior = Math.max(1, ...groups.map((x) => x[1].length));
  return (
    <div className={card}>
      <h4 className="font-display font-bold text-primary inline-flex items-center">
        Queixa principal
        <InfoTip text="Filtre pelas queixas cadastradas e clique em Abrir para visualizar os pacientes que se enquadram em cada queixa." />
      </h4>
      <div className="flex gap-2 flex-wrap items-end">
        <div><span className={lbl}>De</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inp} /></div>
        <div><span className={lbl}>Até</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inp} /></div>
        <div><span className={lbl}>Tipo</span><select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inp}><option value="">todos</option>{groups.map((g) => <option key={g[0]} value={g[0]}>{g[0]}</option>)}</select></div>
      </div>
      {shown.length === 0 ? <p className="text-sm text-foreground/40">Sem dados.</p> : (
        <>
          <div className="space-y-1.5">
            {shown.map(([nome, lista]) => (
              <div key={nome} className="flex items-center gap-2">
                <span className="text-sm text-foreground/70 w-40 truncate" title={nome}>{nome}</span>
                <div className="flex-1 h-2 rounded-full bg-primary/10 overflow-hidden"><div className="h-2 bg-primary" style={{ width: `${(lista.length / maior) * 100}%` }} /></div>
                <span className="text-sm font-bold text-primary w-8 text-right">{lista.length}</span>
                <button type="button" onClick={() => setAberta(nome)} className="text-xs font-bold text-primary hover:underline shrink-0">abrir</button>
              </div>
            ))}
          </div>
          {escondidos > 0 && <button onClick={() => setTudo(true)} className="text-xs font-semibold text-primary hover:underline">abrir as outras {escondidos} →</button>}
          {tudo && !tipo && <button onClick={() => setTudo(false)} className="text-xs font-semibold text-foreground/50 hover:underline">mostrar só as 3 principais</button>}
        </>
      )}
      {aberta && (
        <ModalPacientes
          titulo={aberta}
          pacientes={(groups.find((g) => g[0] === aberta)?.[1] ?? []).map((p) => ({ id: p.id, name: p.name }))}
          onFechar={() => setAberta(null)}
        />
      )}
    </div>
  );
}

// 6. PAGAMENTOS — atraso/em dia (+ link previsão)
function Pagamentos({ patients }: { patients: PanelPatient[] }) {
  const ativos = patients.filter((p) => p.status !== "prospect");
  const atraso = ativos.filter((p) => p.paymentStatus === "overdue").length;
  const emDia = ativos.filter((p) => p.paymentStatus !== "overdue").length;
  return (
    <div className={card}>
      <div className="flex items-center justify-between"><h4 className="font-display font-bold text-primary">Pagamentos</h4><Link href="/dashboard/previsao" className="text-xs text-primary hover:underline">previsão futura →</Link></div>
      <div className="grid grid-cols-2 gap-2"><Stat n={atraso} label="Em atraso" tone="red" /><Stat n={emDia} label="Em dia" tone="green" /></div>
      <div className="flex gap-2 flex-wrap"><Link href="/dashboard/fechamento" className="text-xs text-primary hover:underline font-semibold">fechar o mês →</Link><Link href="/dashboard/pagamentos" className="text-xs text-primary hover:underline">pagamentos →</Link><Link href="/dashboard/financeiro" className="text-xs text-primary hover:underline">financeiro →</Link><Link href="/dashboard/visao-financeira" className="text-xs text-primary hover:underline">saldos por paciente →</Link><Link href="/dashboard/conciliacao" className="text-xs text-primary hover:underline">conciliação →</Link></div>
    </div>
  );
}


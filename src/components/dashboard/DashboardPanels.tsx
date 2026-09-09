"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { queixaGroup } from "@/lib/queixas";
import { MessagePatient } from "./MessagePatient";
import { salvarMensagemAniversario } from "@/app/dashboard/actions";

export type PanelPatient = {
  id: string; name: string; status: string;
  gender: string | null; birthDate: string | null; address: string | null;
  phone: string | null; email: string | null;
  queixaPrincipal: string | null; paymentStatus: string | null;
  prospectDate: string | null; prospectFechou: string | null; startedAt: string | null;
};
export type PanelPresence = { patientId: string; presente: boolean; date: string };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const ageOf = (birth: string | null): number | null => {
  if (!birth) return null;
  const b = new Date(birth), n = new Date();
  let a = n.getFullYear() - b.getFullYear();
  if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--;
  return a >= 0 && a < 130 ? a : null;
};
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

function Stat({ n, label, tone = "primary" }: { n: number | string; label: string; tone?: string }) {
  const c = tone === "green" ? "text-emerald-600" : tone === "red" ? "text-red-600" : tone === "amber" ? "text-amber-600" : "text-primary";
  return <div className="text-center"><p className={`text-2xl font-display font-bold ${c}`}>{n}</p><p className="text-[11px] text-foreground/50">{label}</p></div>;
}

export function DashboardPanels({
  patients, presence, mensagemAniversario, corteSemana, hoje,
}: {
  patients: PanelPatient[];
  presence: PanelPresence[];
  mensagemAniversario: string;
  /** Início da janela de 7 dias, em ISO, calculado no servidor. Ver AtivosInativos. */
  corteSemana: string;
  /** Hoje em YYYY-MM-DD, do servidor. Ver Aniversariantes. */
  hoje: string;
}) {
  return (
    <section className="space-y-4">
      <h3 className="text-xs font-bold uppercase tracking-widest text-foreground/40">Painéis</h3>
      {/* items-start: sem isto o grid esticava cada cartão até a altura do vizinho da linha, e
          um painel curto ao lado de uma lista longa virava meia tela de espaço vazio. */}
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        <Prospeccao patients={patients} />
        <PacientesAtuais patients={patients} />
        <Aniversariantes patients={patients} modeloSalvo={mensagemAniversario} hoje={hoje} />
        <AtivosInativos patients={patients} presence={presence} corte={corteSemana} />
        <QueixaBloco patients={patients} />
        <Pagamentos patients={patients} />
        <Presenca patients={patients} presence={presence} />
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
      <div className="flex items-center justify-between"><h4 className="font-display font-bold text-primary">Prospecção</h4><Link href="/dashboard/prospects" className="text-xs text-primary hover:underline">abrir →</Link></div>
      <div className="grid grid-cols-4 gap-2">
        <Stat n={base.length} label="Prospectados" />
        <Stat n={fechados} label="Fechados" tone="green" />
        <Stat n={emAberto} label="Em aberto" tone="amber" />
        <Stat n={`${taxa}%`} label="Tx conversão" />
      </div>
    </div>
  );
}

// 2. PACIENTES ATUAIS — filtro início + gênero + idade + cidade(endereço)
function PacientesAtuais({ patients }: { patients: PanelPatient[] }) {
  const [from, setFrom] = useState(""), [to, setTo] = useState(""), [gender, setGender] = useState(""), [minA, setMinA] = useState(""), [maxA, setMaxA] = useState(""), [city, setCity] = useState("");
  const ativos = patients.filter((p) => p.status === "ativo");
  const filtered = ativos.filter((p) => {
    if ((from || to) && !inRange(p.startedAt, from, to)) return false;
    if (gender && (p.gender || "") !== gender) return false;
    const a = ageOf(p.birthDate);
    if (minA && (a === null || a < Number(minA))) return false;
    if (maxA && (a === null || a > Number(maxA))) return false;
    if (city && !norm(p.address || "").includes(norm(city))) return false;
    return true;
  });
  return (
    <div className={card}>
      <h4 className="font-display font-bold text-primary">Pacientes atuais</h4>
      <div className="flex gap-2 flex-wrap items-end">
        <div><span className={lbl}>Início de</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inp} /></div>
        <div><span className={lbl}>até</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inp} /></div>
        <div><span className={lbl}>Gênero</span><select value={gender} onChange={(e) => setGender(e.target.value)} className={inp}><option value="">todos</option><option value="feminino">Feminino</option><option value="masculino">Masculino</option><option value="nao-binario">Não-binário</option></select></div>
        <div><span className={lbl}>Idade</span><div className="flex gap-1"><input type="number" min={0} placeholder="mín" value={minA} onChange={(e) => setMinA(e.target.value)} className={`${inp} w-16`} /><input type="number" min={0} placeholder="máx" value={maxA} onChange={(e) => setMaxA(e.target.value)} className={`${inp} w-16`} /></div></div>
        <div><span className={lbl}>Cidade</span><input value={city} onChange={(e) => setCity(e.target.value)} placeholder="no endereço" className={`${inp} w-28`} /></div>
      </div>
      <Stat n={filtered.length} label="pacientes ativos no filtro" />
    </div>
  );
}

// 3. ANIVERSARIANTES — recorte por DIA/MÊS, não por ano: o filtro compara só a virada do
// calendário, senão ninguém apareceria (a data de nascimento é sempre de anos atrás). Sem idade
// na lista, de propósito. O modelo da mensagem fica salvo no perfil do terapeuta.
const MODELO_PADRAO = "Feliz aniversário, {nome}! Que seu novo ciclo venha leve. 🎂";
const ddmm = (iso: string) => {
  const d = new Date(iso);
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
              <MessagePatient
                patient={{ id: p.id, name: p.name, phone: p.phone, email: p.email }}
                compact
                rotulo="Parabenizar"
                textoInicial={modelo.replace(/\{nome\}/g, p.name.split(" ")[0])}
              />
              <Link href={`/dashboard/patients/${p.id}`} className="text-xs font-semibold text-primary hover:underline shrink-0">abrir →</Link>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-1.5 border-t border-border pt-3">
        <span className={lbl}>Mensagem automática · <code>{"{nome}"}</code> vira o primeiro nome</span>
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

// 4. ATIVOS x INATIVOS — e, dentro dos ativos, quem NÃO passou na semana. É a pergunta que o
// consultório faz de verdade: paciente ativo que sumiu não aparece em nenhuma contagem de falta,
// porque falta pressupõe sessão marcada; aqui basta não ter sessão realizada nos últimos 7 dias.
// `corte` vem do SERVIDOR de propósito. Chamar Date.now() aqui dentro seria impuro: o memo
// nunca recomputaria com a passagem do tempo, e cliente e servidor discordariam na hidratação.
function AtivosInativos({ patients, presence, corte }: { patients: PanelPatient[]; presence: PanelPresence[]; corte: string }) {
  const ativos = patients.filter((p) => p.status === "ativo");
  const inativos = patients.filter((p) => p.status === "inativo");
  const semana = useMemo(() => {
    const limite = new Date(corte).getTime();
    const vieram = new Set(presence.filter((r) => r.presente && new Date(r.date).getTime() >= limite).map((r) => r.patientId));
    return ativos.filter((p) => !vieram.has(p.id));
  }, [ativos, presence, corte]);
  return (
    <div className={card}>
      <div className="flex items-center justify-between"><h4 className="font-display font-bold text-primary">Ativos e inativos</h4><Link href="/dashboard/patients" className="text-xs text-primary hover:underline">abrir →</Link></div>
      <div className="grid grid-cols-3 gap-2">
        <Stat n={ativos.length} label="Ativos" tone="green" />
        <Stat n={inativos.length} label="Inativos" />
        <Stat n={semana.length} label="Não vieram na semana" tone="amber" />
      </div>
      {semana.length > 0 && (
        <div className="space-y-1 max-h-40 overflow-y-auto border-t border-border pt-3">
          <span className={lbl}>Ativos sem sessão realizada nos últimos 7 dias</span>
          {semana.map((p) => (
            <Link key={p.id} href={`/dashboard/patients/${p.id}`} className="flex items-center justify-between rounded-xl bg-surface/60 px-3 py-1.5 hover:bg-surface transition">
              <span className="text-sm truncate">{p.name}</span>
              <span className="text-xs text-primary font-semibold shrink-0">abrir →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// 5. QUEIXA PRINCIPAL — mostra as 3 principais e abre o resto sob demanda
function QueixaBloco({ patients }: { patients: PanelPatient[] }) {
  const [from, setFrom] = useState(""), [to, setTo] = useState(""), [tipo, setTipo] = useState(""), [tudo, setTudo] = useState(false);
  const base = patients.filter((p) => p.status !== "prospect" && ((from || to) ? inRange(p.startedAt, from, to) : true));
  const groups = useMemo(() => {
    const m = new Map<string, number>();
    for (const p of base) { const g = queixaGroup(p.queixaPrincipal); if (g === "—") continue; m.set(g, (m.get(g) ?? 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [base]);
  const filtrados = tipo ? groups.filter((g) => g[0] === tipo) : groups;
  const shown = tipo || tudo ? filtrados : filtrados.slice(0, 3);
  const escondidos = filtrados.length - shown.length;
  return (
    <div className={card}>
      <h4 className="font-display font-bold text-primary">Queixa principal</h4>
      <div className="flex gap-2 flex-wrap items-end">
        <div><span className={lbl}>De</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inp} /></div>
        <div><span className={lbl}>Até</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inp} /></div>
        <div><span className={lbl}>Tipo</span><select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inp}><option value="">todos</option>{groups.map((g) => <option key={g[0]} value={g[0]}>{g[0]}</option>)}</select></div>
      </div>
      {shown.length === 0 ? <p className="text-sm text-foreground/40">Sem dados.</p> : (
        <>
          <div className="space-y-1.5">{shown.map((g) => (<div key={g[0]} className="flex items-center gap-2"><span className="text-sm text-foreground/70 w-40 truncate">{g[0]}</span><div className="flex-1 h-2 rounded-full bg-primary/10 overflow-hidden"><div className="h-2 bg-primary" style={{ width: `${(g[1] / Math.max(...groups.map((x) => x[1]))) * 100}%` }} /></div><span className="text-sm font-bold text-primary w-8 text-right">{g[1]}</span></div>))}</div>
          {escondidos > 0 && <button onClick={() => setTudo(true)} className="text-xs font-semibold text-primary hover:underline">abrir as outras {escondidos} →</button>}
          {tudo && !tipo && <button onClick={() => setTudo(false)} className="text-xs font-semibold text-foreground/50 hover:underline">mostrar só as 3 principais</button>}
        </>
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
      <div className="flex gap-2 flex-wrap"><Link href="/dashboard/pagamentos" className="text-xs text-primary hover:underline">pagamentos →</Link><Link href="/dashboard/financeiro" className="text-xs text-primary hover:underline">financeiro →</Link><Link href="/dashboard/visao-financeira" className="text-xs text-primary hover:underline">saldos por paciente →</Link><Link href="/dashboard/conciliacao" className="text-xs text-primary hover:underline">conciliação →</Link></div>
    </div>
  );
}

// 7. PRESENÇA — faltas/presenças, filtro data + idade
function Presenca({ patients, presence }: { patients: PanelPatient[]; presence: PanelPresence[] }) {
  const [from, setFrom] = useState(""), [to, setTo] = useState(""), [minA, setMinA] = useState(""), [maxA, setMaxA] = useState("");
  const ageById = useMemo(() => new Map(patients.map((p) => [p.id, ageOf(p.birthDate)])), [patients]);
  const rows = presence.filter((r) => {
    if ((from || to) && !inRange(r.date, from, to)) return false;
    const a = ageById.get(r.patientId) ?? null;
    if (minA && (a === null || a < Number(minA))) return false;
    if (maxA && (a === null || a > Number(maxA))) return false;
    return true;
  });
  const presencas = rows.filter((r) => r.presente).length;
  const faltas = rows.length - presencas;
  const taxa = rows.length ? Math.round((presencas / rows.length) * 100) : 0;
  return (
    <div className={card}>
      <h4 className="font-display font-bold text-primary">Presença</h4>
      <div className="flex gap-2 flex-wrap items-end">
        <div><span className={lbl}>De</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inp} /></div>
        <div><span className={lbl}>Até</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inp} /></div>
        <div><span className={lbl}>Idade</span><div className="flex gap-1"><input type="number" min={0} placeholder="mín" value={minA} onChange={(e) => setMinA(e.target.value)} className={`${inp} w-16`} /><input type="number" min={0} placeholder="máx" value={maxA} onChange={(e) => setMaxA(e.target.value)} className={`${inp} w-16`} /></div></div>
      </div>
      <div className="grid grid-cols-3 gap-2"><Stat n={presencas} label="Presenças" tone="green" /><Stat n={faltas} label="Faltas" tone="red" /><Stat n={`${taxa}%`} label="Comparecimento" /></div>
    </div>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { InfoTip } from "@/components/InfoTip";
import { SubmitButton } from "@/components/SubmitButton";
import { MessageCircle } from "lucide-react";
import { QUEIXAS } from "@/lib/queixas";
import { idadeEmPalavras } from "@/lib/idade";
import { historicoDeReajuste, usaPacote } from "@/lib/reajuste";
import { horaDeParede } from "@/lib/horaLocal";
import { MoneyInput as MoneyInputBase } from "@/components/MoneyInput";

const inputCls = "w-full px-4 py-3 rounded-2xl bg-white/70 border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition";
const labelCls = "block text-sm font-semibold text-foreground/70 mb-1.5";

// Rótulo dos status legados que ainda podem estar gravados (prospect/pausado), só para preservar.
const ROTULO_STATUS: Record<string, string> = { prospect: "Prospectado", pausado: "Pausado" };

export type PatientFormData = {
  registrationNumber?: number | null; agendaId?: string | null; dueDateType?: string | null; dueDate?: string | null; queixaPrincipal?: string | null;
  name?: string; phone?: string | null; email?: string | null; patientStatus?: string;
  startedAt?: string | null; birthDate?: string | null; category?: string | null; isCouple?: boolean | null;
  guardianRelationship?: string | null; devolutivaMeses?: number | null; gender?: string | null; cpf?: string | null; address?: string | null;
  schoolName?: string | null; schoolContact?: string | null;
  guardianName?: string | null; guardianCpf?: string | null; guardianPhone?: string | null; guardianEmail?: string | null;
  spouseName?: string | null; spousePhone?: string | null; spouseEmail?: string | null; spouseCpf?: string | null;
  spouseBirthDate?: string | null; spouseQueixaPrincipal?: string | null; spouseGender?: string | null; spouseAddress?: string | null;
  emergencyName?: string | null; emergencyPhone?: string | null; emergencyEmail?: string | null; emergencyRelationship?: string | null;
  attendanceMode?: string | null; attendanceLocation?: string | null; attendanceDay?: string | null; attendanceTime?: string | null;
  sessionFee?: string | null; frequency?: string | null; timesPerPeriod?: number | null; paymentFormat?: string | null; sessionsInPacket?: number | null; paymentDay?: number | null; priceReviewDate?: string | null;
  horasAntesPagamento?: number | null; validadePrecoMeses?: number | null; pacoteTipo?: string | null; semanasNoMes?: number | null; paymentDay2?: number | null;
  priceHistory?: { valor: string; dataEfetiva: string }[];
  formatHistory?: { formato: string; dataEfetiva: string }[];
  reminderEnabled?: boolean; reminderChannel?: string | null; reminderLeadMinutes?: number | null;
  statusReminderDays?: number | null;
  photo3x4?: string | null; photoExtra1?: string | null; photoExtra2?: string | null; photoExtra3?: string | null;
};

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="glass-card rounded-[24px] p-5 lg:p-6 space-y-4">
      <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest">{title}</p>
      {children}
    </div>
  );
}

// Campo de telefone com botão de WhatsApp (abre wa.me com o número digitado).
function PhoneInput({ name, defaultValue, label = "Telefone" }: { name: string; defaultValue?: string | null; label?: string }) {
  const [val, setVal] = useState(defaultValue ?? "");
  const open = () => {
    let d = val.replace(/\D/g, "");
    if (!d) return;
    if (d.length <= 11) d = "55" + d; // assume Brasil se sem DDI
    window.open(`https://wa.me/${d}`, "_blank");
  };
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex gap-2">
        <input name={name} value={val} onChange={(e) => setVal(e.target.value)} className={inputCls} placeholder="(00) 00000-0000" />
        <button type="button" onClick={open} title="Enviar mensagem no WhatsApp" className="shrink-0 px-3 rounded-2xl bg-[#25D366]/10 text-[#128C7E] hover:bg-[#25D366]/20 transition">
          <MessageCircle className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

// A aba "Atendimento" acabou: modo de atendimento e recorrência são escolhidos no momento do
// AGENDAMENTO, não no cadastro. O que restava dela — a devolutiva — virou área própria em Dados.
const TABS = [
  { k: "dados", label: "Dados" },
  { k: "financeiro", label: "Financeiro" },
];

const GENDERS = ["feminino", "masculino", "nao-binario"];

/** Gênero: lista curada, com campo livre quando é "outro". Serve ao paciente e ao cônjuge. */
function GenderSelect({ name, defaultValue }: { name: string; defaultValue?: string | null }) {
  const inicial = defaultValue ? (GENDERS.includes(defaultValue) ? defaultValue : "outro") : "";
  const [g, setG] = useState(inicial);
  return (
    <>
      <div>
        <label className={labelCls}>Gênero</label>
        <select name={g === "outro" ? undefined : name} value={g} onChange={(e) => setG(e.target.value)} className={inputCls}>
          <option value="">—</option>
          <option value="feminino">Feminino</option>
          <option value="masculino">Masculino</option>
          <option value="nao-binario">Não-binário</option>
          <option value="outro">Outro</option>
        </select>
      </div>
      {g === "outro" && (
        <div>
          <label className={labelCls}>Qual gênero?</label>
          <input name={name} defaultValue={GENDERS.includes(defaultValue || "") ? "" : (defaultValue ?? "")} className={inputCls} placeholder="Descreva" />
        </div>
      )}
    </>
  );
}

/** Queixa principal: lista curada + "Outro", que abre o campo livre. */
function QueixaSelect({ name, defaultValue }: { name: string; defaultValue?: string | null }) {
  const inicial = defaultValue ? ((QUEIXAS as readonly string[]).includes(defaultValue) ? defaultValue : "Outro") : "";
  const [q, setQ] = useState(inicial);
  return (
    <>
      <div>
        <label className={labelCls}>Queixa principal</label>
        <select value={q} onChange={(e) => setQ(e.target.value)} name={q === "Outro" ? undefined : name} className={inputCls}>
          <option value="">—</option>
          {QUEIXAS.map((x) => <option key={x} value={x}>{x}</option>)}
          <option value="Outro">Outro</option>
        </select>
      </div>
      {q === "Outro" && (
        <div>
          <label className={labelCls}>Qual queixa?</label>
          <input name={name} defaultValue={inicial === "Outro" ? (defaultValue ?? "") : ""} className={inputCls} placeholder="Descreva a queixa" />
        </div>
      )}
    </>
  );
}

/** Data de nascimento + a idade que sai dela. A idade é calculada: digitada, fica velha amanhã. */
function NascimentoEIdade({ name, defaultValue }: { name: string; defaultValue?: string | null }) {
  const [data, setData] = useState(defaultValue ? new Date(defaultValue).toISOString().slice(0, 10) : "");
  return (
    <>
      <div>
        <label className={labelCls}>Data de nascimento</label>
        <input name={name} type="date" value={data} onChange={(e) => setData(e.target.value)} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Idade</label>
        <input value={idadeEmPalavras(data || null) || "—"} readOnly disabled className={`${inputCls} bg-black/5 text-foreground/50`} />
      </div>
    </>
  );
}

// MoneyInput agora é compartilhado (cadastro + prospecção, doc 19) — ver src/components/MoneyInput.
// Aqui ele herda o `inputCls` desta tela.
function MoneyInput(props: { name: string; defaultValue?: string | number | null; placeholder?: string }) {
  return <MoneyInputBase {...props} className={inputCls} />;
}

/** Campo numérico com uma palavra depois da caixa ("meses", "horas antes"). */
function NumeroCom({ name, label, dica, unidade, defaultValue, placeholder, min = 1, max = 60 }: {
  name: string; label: string; dica?: string; unidade: string; defaultValue?: number | null; placeholder?: string; min?: number; max?: number;
}) {
  return (
    <div>
      <label className={labelCls}>{label}{dica ? <InfoTip text={dica} /> : null}</label>
      <div className="flex items-center gap-2">
        <input name={name} type="number" min={min} max={max} defaultValue={defaultValue ?? ""} className={inputCls} placeholder={placeholder} />
        <span className="text-sm text-foreground/60 whitespace-nowrap">{unidade}</span>
      </div>
    </div>
  );
}

type SaveAction = (formData: FormData) => void | Promise<void>;

/**
 * Cada guia (Dados/Financeiro) num CONTÊINER próprio. Na EDIÇÃO (`save` presente) o contêiner é um
 * `<form>` INDEPENDENTE com seu próprio botão "Salvar alterações": como o form só envia os campos
 * que estão DENTRO dele, salvar uma guia não persiste o que ficou pendente na outra, e o
 * `updatePatient` mantém as colunas ausentes no valor atual (campo ausente → `existing`). No CADASTRO
 * (`save` ausente) vira `<div>` e o form único do pai envolve tudo, com um botão só.
 */
function Secao({ show, save, children }: { show: string; save?: SaveAction; children: ReactNode }) {
  if (!save) return <div className={show}>{children}</div>;
  return (
    <form action={save} className={show}>
      {children}
      <div className="pt-1">
        <SubmitButton pendingLabel="Salvando…" className="inline-flex items-center justify-center gap-2 bg-primary text-white py-3 px-6 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-[1.01] transition">
          Salvar alterações
        </SubmitButton>
      </div>
    </form>
  );
}

export function PatientFormFields({ p, save, tabInicial, contrato }: { p?: PatientFormData; save?: SaveAction; tabInicial?: string; contrato?: ReactNode }) {
  const [tab, setTab] = useState(tabInicial || "dados");
  // Doc 22: no Editar paciente, uma aba "Contrato" ao lado de "Financeiro" mostra o mesmo contrato
  // do menu Contratos (montado no servidor e passado pronto). Só aparece quando há contrato (edição).
  const tabs = contrato ? [...TABS, { k: "contrato", label: "Contrato" }] : TABS;
  // Formato antigo "avulso" e o "a cada sessao" do dono; "pacote" virou mensal com pacote.
  // primeira/última do pacote deixaram de ser modalidades próprias (prints 6.pdf, item 20): viram
  // OPÇÕES de "quando cobrar" dentro do Mensal pacote completo. No radio elas aparecem como "mensal".
  const ehTimingDePacote = (f?: string | null) => f === "primeira_pacote" || f === "ultima_pacote";
  const formatoInicial = p?.paymentFormat === "avulso" ? "sessao"
    : p?.paymentFormat === "pacote" ? "mensal"
    : ehTimingDePacote(p?.paymentFormat) ? "mensal"
    : (p?.paymentFormat || "sessao");
  const [format, setFormat] = useState(formatoInicial);
  // Quando cobrar o pacote completo: no vencimento mensal (padrão) ou na 1ª/última sessão do pacote.
  const [quandoCobra, setQuandoCobra] = useState(ehTimingDePacote(p?.paymentFormat) ? p!.paymentFormat! : "mensal");
  // Salvar Dados ≠ Salvar Financeiro (doc 17): no 1º cadastro, se o usuário não mexer no Financeiro,
  // nada financeiro é criado. Em paciente já existente (p) o financeiro já existe, então vale true.
  const [financeiroTocado, setFinanceiroTocado] = useState(!!p);
  // Doc 21: "Vale a partir de" deve aparecer quando QUALQUER campo do Financeiro muda (valor da
  // sessão, quantidade de sessões, pacote, vencimento, reajuste), não só quando o formato muda.
  // Começa SEMPRE falso (diferente de `financeiroTocado`, que nasce true para paciente já salvo):
  // aqui o que importa é se o usuário MEXEU em algo nesta edição.
  const [financeiroAlterado, setFinanceiroAlterado] = useState(false);
  // Hoje no fuso de quem preenche, no formato do <input type="date">.
  const hojeISO = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; })();
  const [pacote, setPacote] = useState(p?.pacoteTipo || "completo");
  // A classificação saiu: a idade é CALCULADA da data de nascimento, e "casal" virou item próprio.
  const [casal, setCasal] = useState(!!p?.isCouple || p?.category === "casal");
  const dateVal = (d?: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");
  const show = (k: string) => (tab === k ? "space-y-4" : "hidden");

  /**
   * Pacote (completo ou fragmentado): aparece em todo formato que fecha por pacote.
   *
   * Virou caixa de lista a pedido da dona (18/09) — os dois cartoes lado a lado ocupavam meia tela
   * no celular. A explicacao de cada opcao NAO se perde: ela vai junto no texto da opcao e, de novo,
   * abaixo da caixa, para quem ja escolheu continuar lendo o que escolheu.
   */
  // Opção = só o nome; a explicação vai na legenda abaixo (doc 18). Acabou o "Completo — N sessões":
  // a quantidade é a que o usuário informa no campo próprio, não um número fixo.
  const TIPOS_DE_PACOTE = [
    { valor: "completo", nome: "Completo", ajuda: "O padrão: Considera a quantidade de sessões definida pelo usuário." },
    { valor: "fragmentado", nome: "Fragmentado", ajuda: "Considera apenas as sessões realizadas dentro do mês." },
  ];
  const blocoPacote = (
    <div>
      <label htmlFor="pacoteTipo" className={labelCls}>Pacote</label>
      <select id="pacoteTipo" name="pacoteTipo" value={pacote} onChange={(e) => setPacote(e.target.value)} className={inputCls}>
        {TIPOS_DE_PACOTE.map((t) => (
          <option key={t.valor} value={t.valor}>{t.nome}</option>
        ))}
      </select>
      <p className="text-[10px] text-foreground/50 mt-1">
        {(() => { const t = TIPOS_DE_PACOTE.find((x) => x.valor === pacote); return t ? `${t.nome} — ${t.ajuda}` : null; })()}
      </p>
    </div>
  );

  const valorDaSessao = (
    <div><label className={labelCls}>Valor da sessão</label><MoneyInput name="sessionFee" defaultValue={p?.sessionFee} placeholder="R$ 0,00" /></div>
  );

  const proximoReajuste = (
    <NumeroCom
      name="validadePrecoMeses" label="Próximo reajuste em" unidade="meses" max={60}
      dica="Daqui a quantos meses deseja ser lembrado de realizar o reajuste? O sistema exibirá o lembrete no dashboard um mês antes da data prevista para o reajuste."
      defaultValue={p?.validadePrecoMeses} placeholder="ex: 12"
    />
  );

  // O paymentFormat que de fato vai para o banco: no Mensal pacote completo, "quando cobrar" decide
  // se é mensal (vencimento), primeira_pacote ou ultima_pacote. O motor já entende os três.
  // "Quando cobrar o pacote" vale para o Mensal tanto no Completo quanto no Fragmentado (doc 19/10).
  // No Fragmentado só existem duas opções (No dia do vencimento, Na 1ª sessão) — "última" não se
  // aplica —, então o valor é clampado: um estado "ultima_pacote" herdado vira "mensal" no fragmentado.
  const quandoCobraEfetivo = pacote === "fragmentado" && quandoCobra === "ultima_pacote" ? "mensal" : quandoCobra;
  const formatoEfetivo = format === "mensal" ? quandoCobraEfetivo : format;

  // Os VALORES seguem iguais (mensal/primeira_pacote/ultima_pacote — o motor depende deles); a 1ª/última
  // ganharam legenda de qual data vira o vencimento.
  const legendaQuandoCobra: Record<string, string> = {
    primeira_pacote: "A data de vencimento será considerada a data da primeira sessão do pacote.",
    ultima_pacote: "A data de vencimento será considerada a data da última sessão do pacote.",
  };
  const blocoQuandoCobra = (
    <div>
      <label htmlFor="quandoCobra" className={labelCls}>Quando cobrar o pacote</label>
      <select id="quandoCobra" value={quandoCobraEfetivo} onChange={(e) => setQuandoCobra(e.target.value)} className={inputCls}>
        <option value="mensal">No dia do vencimento</option>
        <option value="primeira_pacote">Na 1ª sessão do pacote</option>
        {/* "Na última sessão" só no Completo — não faz sentido no Fragmentado (doc 19/10). */}
        {pacote !== "fragmentado" && <option value="ultima_pacote">Na última sessão do pacote</option>}
      </select>
      {legendaQuandoCobra[quandoCobraEfetivo] && (
        <p className="text-[10px] text-foreground/50 mt-1">{legendaQuandoCobra[quandoCobraEfetivo]}</p>
      )}
    </div>
  );

  // "Vale a partir de" passou a morar DENTRO da modalidade (doc 16): aparece só quando a troca de
  // formato de um paciente já cadastrado muda o que vale (edição), em cada modalidade (incl. Gratuito).
  const formatoSalvoReal = ehTimingDePacote(p?.paymentFormat) ? p!.paymentFormat! : formatoInicial;
  const mostraVigencia = !!p && (formatoEfetivo !== formatoSalvoReal || financeiroAlterado);
  const blocoValeAPartir = mostraVigencia ? (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 px-4 py-3 space-y-2">
      <label className={labelCls} htmlFor="formatoDesde">Vale a partir de</label>
      <input id="formatoDesde" name="formatoDesde" type="date" defaultValue={hojeISO} className={`${inputCls} sm:max-w-xs`} />
      <p className="text-[10px] text-foreground/60">
        Os atendimentos <strong>antes</strong> desta data continuam com o formato anterior — nada do que
        já foi cobrado, ou deixou de ser, é alterado.
      </p>
    </div>
  ) : null;

  // Quantidade de sessões do pacote (doc 16): acabou o padrão 4/8, o usuário define. Vale para o
  // Completo; no Fracionado quem diz é a agenda (o mês).
  const qtdSessoesPacote = (
    <div>
      <label htmlFor="sessionsInPacket" className={labelCls}>Quantidade de sessões do pacote</label>
      {/* Obrigatório (doc 18): o total do pacote vem daqui, não mais de um número fixo. onInvalid
          pula p/ a aba Financeiro, senão um required escondido numa aba inativa aborta o submit calado. */}
      <input id="sessionsInPacket" name="sessionsInPacket" type="number" min={1} max={60} required
        onInvalid={() => setTab("financeiro")}
        defaultValue={p?.sessionsInPacket ?? ""} className={inputCls} placeholder="ex: 4" />
      <p className="text-[10px] text-foreground/50 mt-1">Quantas sessões compõem o pacote (usado no Completo).</p>
    </div>
  );

  // O que cada formato abre, logo abaixo do próprio item — e na ordem que o dono pediu.
  const camposDoFormato: Record<string, ReactNode> = {
    // Gratuito: sem valor; "Vale a partir de" aparece aqui quando a troca é PARA gratuito.
    gratuito: (
      <div className="space-y-4">
        <p className="text-[10px] text-foreground/60 rounded-2xl bg-surface/70 border border-border px-4 py-3">
          Atendimento <strong>gratuito</strong>: sem valor, sem dia de pagamento e sem cobrança.
        </p>
        {blocoValeAPartir}
      </div>
    ),
    // Avulso: Valor da sessão · Pagar até · Vale a partir de (quando necessário) · Próximo reajuste.
    sessao: (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          {valorDaSessao}
          <NumeroCom
            name="horasAntesPagamento" label="Pagar até" unidade="horas antes" max={168}
            dica="Informe com quantas horas de antecedência o pagamento deverá ser realizado para não ser considerado em atraso."
            defaultValue={p?.horasAntesPagamento} placeholder="ex: 24"
          />
        </div>
        {blocoValeAPartir}
        <div className="sm:max-w-sm">{proximoReajuste}</div>
      </div>
    ),
    // Mensal: Valor · Qtd do pacote · Pacote · Dia de pagamento (+ 1ª/última) · Vale a partir de · Reajuste.
    mensal: (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          {valorDaSessao}
          {qtdSessoesPacote}
        </div>
        {blocoPacote}
        {/* "Quando cobrar o pacote" vem ANTES do "Dia do vencimento" (doc 18): é ele que decide se o
            dia é perguntado — na 1ª/última sessão o vencimento é o da própria sessão. Aparece no
            Completo E no Fragmentado (doc 19/10; no Fragmentado só 2 opções). */}
        {blocoQuandoCobra}
        {/* Dia do vencimento só quando a cobrança é no vencimento do mês. */}
        {quandoCobraEfetivo === "mensal" && (
          <div className="sm:max-w-sm">
            <label className={labelCls}>Dia do vencimento</label>
            <input name="paymentDay" type="number" min={1} max={31} defaultValue={p?.paymentDay ?? ""} className={inputCls} placeholder="ex: 5" />
          </div>
        )}
        {blocoValeAPartir}
        <div className="sm:max-w-sm">{proximoReajuste}</div>
      </div>
    ),
    // Quinzenal: Valor · Qtd do pacote · Pacote · Dias de pagamento (1ª/2ª) · Vale a partir de · Reajuste.
    quinzenal: (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          {valorDaSessao}
          {qtdSessoesPacote}
        </div>
        {blocoPacote}
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Dia do vencimento — 1ª quinzena</label>
            <input name="paymentDay" type="number" min={1} max={31} defaultValue={p?.paymentDay ?? ""} className={inputCls} placeholder="ex: 5" />
          </div>
          <div>
            <label className={labelCls}>Dia do vencimento — 2ª quinzena</label>
            <input name="paymentDay2" type="number" min={1} max={31} defaultValue={p?.paymentDay2 ?? ""} className={inputCls} placeholder="ex: 20" />
          </div>
        </div>
        {blocoValeAPartir}
        <div className="sm:max-w-sm">{proximoReajuste}</div>
      </div>
    ),
  };

  const FORMATOS = [
    { v: "gratuito", t: "Gratuito", d: "Sem cobrança." },
    { v: "sessao", t: "Avulso", d: "Paga a cada atendimento (aparece como AVUL na agenda)." },
    { v: "mensal", t: "Mensal", d: "Um pagamento por mês. No pacote completo dá para cobrar na 1ª ou na última sessão." },
    { v: "quinzenal", t: "Quinzenal", d: "Dois pagamentos por mês." },
  ];

  return (
    <div className="space-y-5">
      {/* Submenu horizontal */}
      <div className="flex gap-2 bg-white/50 p-1.5 rounded-2xl w-fit overflow-x-auto no-scrollbar">
        {tabs.map((t) => (
          <button key={t.k} type="button" onClick={() => setTab(t.k)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition ${tab === t.k ? "bg-primary text-white shadow" : "text-foreground/60 hover:bg-white"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* DADOS: pessoais → cônjuge → responsável/emergência → devolutiva → escola */}
      <Secao show={show("dados")} save={save}>
        <Card title="Dados pessoais">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Número do cadastro</label>
              <input
                value={p?.registrationNumber != null ? String(p.registrationNumber).padStart(4, "0") : "Gerado automaticamente"}
                readOnly disabled
                className={`${inputCls} bg-black/5 text-foreground/50`}
              />
            </div>
            <div><label className={labelCls}>ID Agenda</label><input name="agendaId" defaultValue={p?.agendaId ?? ""} className={inputCls} placeholder="Identificação na agenda" /></div>
          </div>
          {/* Status vem ANTES do nome, na tela de Dados, a pedido do dono: é o primeiro filtro
              mental de quem abre a ficha ("esta pessoa ainda está em atendimento?"). */}
          <div className="sm:max-w-xs">
            <label className={labelCls}>Status</label>
            {/* Só Ativo/Inativo (dono, 16/09/2026). Prospect/Pausado saíram da lista — mas, se o
                paciente JÁ está num deles (veio da prospecção), a opção é mantida para não virar Ativo
                sozinho ao salvar. Prospect segue sendo definido no fluxo de prospecção, não aqui. */}
            <select name="patientStatus" className={inputCls} defaultValue={p?.patientStatus || "ativo"}>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
              {p?.patientStatus && !["ativo", "inativo"].includes(p.patientStatus) && (
                <option value={p.patientStatus}>{ROTULO_STATUS[p.patientStatus] ?? p.patientStatus}</option>
              )}
            </select>
          </div>
          <div>
            <label className={labelCls}>Nome *</label>
            {/* onInvalid pula p/ a aba "Dados". As abas ficam todas montadas e a inativa só
                recebe `hidden` (display:none); um campo required escondido NÃO é focável, então
                o Chrome abortava o submit em silêncio — botão "Cadastrar" parecia morto. */}
            <input name="name" required onInvalid={() => setTab("dados")} defaultValue={p?.name ?? ""} className={inputCls} placeholder="Nome completo" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <PhoneInput name="phone" defaultValue={p?.phone} />
            <div><label className={labelCls}>E-mail</label><input name="email" type="email" defaultValue={p?.email ?? ""} className={inputCls} placeholder="email@exemplo.com" /></div>
            <NascimentoEIdade name="birthDate" defaultValue={p?.birthDate} />
            <QueixaSelect name="queixaPrincipal" defaultValue={p?.queixaPrincipal} />
            <GenderSelect name="gender" defaultValue={p?.gender} />
            <div><label className={labelCls}>CPF</label><input name="cpf" defaultValue={p?.cpf ?? ""} className={inputCls} placeholder="000.000.000-00" /></div>
            <div><label className={labelCls}>Início</label><input name="startedAt" type="date" defaultValue={dateVal(p?.startedAt)} className={inputCls} /></div>
          </div>
          <div><label className={labelCls}>Endereço</label><input name="address" defaultValue={p?.address ?? ""} className={inputCls} placeholder="Endereço residencial" /></div>
          {/* O casal fica logo abaixo do endereço, a pedido do dono: é a última coisa que ele
              decide sobre a pessoa antes de abrir a ficha do cônjuge. */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
              <input type="checkbox" name="isCouple" value="1" checked={casal} onChange={(e) => setCasal(e.target.checked)} className="accent-primary w-4 h-4" />
              Atendimento de casal
            </label>
            <p className="text-xs text-foreground/50 mt-1">Abre os dados do cônjuge, logo abaixo.</p>
          </div>
        </Card>

        {casal && (
          <Card title="Dados do cônjuge">
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className={labelCls}>Nome do cônjuge</label><input name="spouseName" defaultValue={p?.spouseName ?? ""} className={inputCls} placeholder="Nome completo" /></div>
              <div><label className={labelCls}>CPF do cônjuge</label><input name="spouseCpf" defaultValue={p?.spouseCpf ?? ""} className={inputCls} placeholder="000.000.000-00" /></div>
              <PhoneInput name="spousePhone" defaultValue={p?.spousePhone} label="Telefone do cônjuge" />
              <div><label className={labelCls}>E-mail do cônjuge</label><input name="spouseEmail" type="email" defaultValue={p?.spouseEmail ?? ""} className={inputCls} placeholder="email@exemplo.com" /></div>
              <NascimentoEIdade name="spouseBirthDate" defaultValue={p?.spouseBirthDate} />
              <QueixaSelect name="spouseQueixaPrincipal" defaultValue={p?.spouseQueixaPrincipal} />
              <GenderSelect name="spouseGender" defaultValue={p?.spouseGender} />
            </div>
            <div><label className={labelCls}>Endereço do cônjuge</label><input name="spouseAddress" defaultValue={p?.spouseAddress ?? ""} className={inputCls} placeholder="Endereço residencial" /></div>
          </Card>
        )}

        {/* No atendimento de casal os dois são adultos que se respondem: responsável e contato de
            emergência não fazem sentido, e o dono pediu que sumam da tela. */}
        {!casal && (
          <>
            <Card title="Dados do responsável">
              <p className="text-xs text-foreground/50 -mt-1">Para menores de idade, pacientes sob responsabilidade de terceiros ou como responsável financeiro.</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label className={labelCls}>Nome do responsável</label><input name="guardianName" defaultValue={p?.guardianName ?? ""} className={inputCls} placeholder="Nome completo" /></div>
                <div><label className={labelCls}>CPF do responsável</label><input name="guardianCpf" defaultValue={p?.guardianCpf ?? ""} className={inputCls} placeholder="000.000.000-00" /></div>
                <div><label className={labelCls}>Grau de parentesco</label><input name="guardianRelationship" defaultValue={p?.guardianRelationship ?? ""} className={inputCls} placeholder="Mãe, pai, avó, tutor…" /></div>
                <PhoneInput name="guardianPhone" defaultValue={p?.guardianPhone} label="Telefone do responsável" />
                <div><label className={labelCls}>E-mail do responsável</label><input name="guardianEmail" type="email" defaultValue={p?.guardianEmail ?? ""} className={inputCls} placeholder="email@exemplo.com" /></div>
              </div>
            </Card>

            <Card title="Contato de emergência">
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label className={labelCls}>Nome</label><input name="emergencyName" defaultValue={p?.emergencyName ?? ""} className={inputCls} /></div>
                <div><label className={labelCls}>Parentesco</label><input name="emergencyRelationship" defaultValue={p?.emergencyRelationship ?? ""} className={inputCls} /></div>
                <PhoneInput name="emergencyPhone" defaultValue={p?.emergencyPhone} />
                <div><label className={labelCls}>E-mail</label><input name="emergencyEmail" type="email" defaultValue={p?.emergencyEmail ?? ""} className={inputCls} placeholder="email@exemplo.com" /></div>
              </div>
            </Card>
          </>
        )}

        {/* Era o único campo que sobrava da aba Atendimento. Virou área própria. */}
        <Card title="Devolutiva">
          <div className="sm:max-w-sm">
            <NumeroCom
              name="devolutivaMeses" label="Devolutiva a cada" unidade="meses" max={24}
              dica="Defina a quantidade de meses para o lembrete da devolutiva. Se não preenchido, nenhum lembrete será gerado. O primeiro prazo será contado a partir do primeiro agendamento e, depois, a partir da data da última devolutiva."
              defaultValue={p?.devolutivaMeses} placeholder="ex: 6"
            />
          </div>
        </Card>

        <Card title="Escola">
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className={labelCls}>Escola</label><input name="schoolName" defaultValue={p?.schoolName ?? ""} className={inputCls} placeholder="Nome da escola" /></div>
            <div><label className={labelCls}>Contato da escola</label><input name="schoolContact" defaultValue={p?.schoolContact ?? ""} className={inputCls} placeholder="Telefone, e-mail ou coordenação" /></div>
          </div>
        </Card>
      </Secao>

      {/* FINANCEIRO — o formato vem primeiro, e é ele que decide o que se pergunta depois. Os
          campos abrem LOGO ABAIXO do formato escolhido, e não no fim da lista: assim se lê o que
          foi marcado junto com o que ele pede. */}
      <Secao show={show("financeiro")} save={save}>
        {/* Qualquer mexida aqui marca o Financeiro como "tocado" (doc 17): no 1º cadastro, sem isso,
            nada financeiro é criado ao salvar só os Dados. */}
        <div onChange={() => { if (!financeiroTocado) setFinanceiroTocado(true); if (!financeiroAlterado) setFinanceiroAlterado(true); }}>
        <input type="hidden" name="financeiroTocado" value={financeiroTocado ? "1" : "0"} />
        <Card title="Financeiro">
          <div>
            <label className={labelCls}>Formato de pagamento</label>
            <div className="space-y-2">
              {FORMATOS.map((o) => (
                <div key={o.v} className="space-y-3">
                  <label className={`flex items-start gap-2 rounded-2xl border px-4 py-3 cursor-pointer transition ${format === o.v ? "border-primary bg-primary/5" : "border-border bg-surface/60"}`}>
                    {/* Seleção ÚNICA: o formato de pagamento é um só. */}
                    {/* O radio controla só o estado visual; o paymentFormat enviado é o `formatoEfetivo`
                        (hidden abaixo), que no Mensal completo vira primeira_pacote/ultima_pacote. */}
                    <input type="radio" value={o.v} checked={format === o.v} onChange={() => setFormat(o.v)} className="accent-primary mt-0.5" />
                    <span>
                      <span className="block text-sm font-bold">{o.t}</span>
                      <span className="block text-[10px] text-foreground/50">{o.d}</span>
                    </span>
                  </label>
                  {format === o.v && <div className="pl-1 pb-2">{camposDoFormato[o.v]}</div>}
                </div>
              ))}
            </div>
            {/* O valor REAL do formato (um só campo no POST). */}
            <input type="hidden" name="paymentFormat" value={formatoEfetivo} />
          </div>

          {/* "Vale a partir de" agora mora DENTRO da modalidade selecionada (doc 16) — ver blocoValeAPartir. */}

          {usaPacote(format) && (
            <p className="text-[10px] text-foreground/50">
              A contagem das sessões do pacote (1/3, 2/3…) aparece na agenda: no pacote completo é a
              quantidade informada acima; no fragmentado, quantas caírem dentro do mês.
            </p>
          )}

          {(() => {
            // Histórico no formato do dono (doc 16): uma linha por mudança, combinando modalidade e valor.
            const linhas = historicoDeReajuste(p?.priceHistory ?? [], p?.formatHistory ?? []);
            if (!linhas.length) return null;
            return (
              <div className="pt-2 border-t border-border">
                <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-2 mt-3">Histórico de reajuste</p>
                <ul className="space-y-1">
                  {linhas.slice().reverse().map((e, i) => (
                    <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm rounded-xl bg-surface/60 px-3 py-2">
                      {/* Duas datas, e as duas importam (documento de 17/09): quando a mudança foi
                          PEDIDA, com hora, e a partir de quando ela VALE. */}
                      <span className="font-mono text-xs font-bold text-primary">
                        {/* A vigência é uma DATA (sem hora): formata pela parede (UTC), senão o fuso
                            negativo mostra o dia anterior — inclusive em linhas antigas (doc 25). */}
                        vigência {horaDeParede(e.data).slice(0, 10).split("-").reverse().join("/")}
                      </span>
                      {e.solicitadoEm && (
                        <span className="font-mono text-[11px] text-foreground/40">
                          pedido em {e.solicitadoEm.toLocaleDateString("pt-BR")} às{" "}
                          {e.solicitadoEm.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                      <span className="text-foreground/70 font-medium">{e.texto}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })()}
        </Card>
        </div>
      </Secao>

      {/* Doc 22: a aba Contrato — o contrato do paciente, igual ao do menu Contratos. Fica FORA de
          <form>: é para ler/editar na tela e imprimir, não para enviar junto com o cadastro. */}
      {contrato && <div className={show("contrato")}>{contrato}</div>}

    </div>
  );
}

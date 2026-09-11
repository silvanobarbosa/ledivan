"use client";

import { useState, type ReactNode } from "react";
import { InfoTip } from "@/components/InfoTip";
import { MessageCircle } from "lucide-react";
import { QUEIXAS } from "@/lib/queixas";
import { idadeEmPalavras } from "@/lib/idade";
import { linhasDeReajuste, usaPacote } from "@/lib/reajuste";

const inputCls = "w-full px-4 py-3 rounded-2xl bg-white/70 border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition";
const labelCls = "block text-sm font-semibold text-foreground/70 mb-1.5";
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
        <label className={labelCls}>Queixa principal<InfoTip text="Demanda/queixa principal. Usada nos filtros do painel. Se não estiver na lista, escolha 'Outro'." /></label>
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

export function PatientFormFields({ p }: { p?: PatientFormData }) {
  const [tab, setTab] = useState("dados");
  // Formato antigo "avulso" e o "a cada sessao" do dono; "pacote" virou mensal com pacote.
  const formatoInicial = p?.paymentFormat === "avulso" ? "sessao" : p?.paymentFormat === "pacote" ? "mensal" : (p?.paymentFormat || "sessao");
  const [format, setFormat] = useState(formatoInicial);
  const [pacote, setPacote] = useState(p?.pacoteTipo || "completo");
  // A classificação saiu: a idade é CALCULADA da data de nascimento, e "casal" virou item próprio.
  const [casal, setCasal] = useState(!!p?.isCouple || p?.category === "casal");
  const dateVal = (d?: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");
  const show = (k: string) => (tab === k ? "space-y-4" : "hidden");

  // Pacote (completo ou fragmentado): aparece em todo formato que fecha por pacote.
  const blocoPacote = (
    <div>
      <label className={labelCls}>Pacote</label>
      <div className="grid sm:grid-cols-2 gap-2">
        <label className={`flex items-start gap-2 rounded-2xl border px-4 py-3 cursor-pointer ${pacote === "completo" ? "border-primary bg-primary/5" : "border-border bg-surface/60"}`}>
          <input type="radio" name="pacoteTipo" value="completo" checked={pacote === "completo"} onChange={() => setPacote("completo")} className="accent-primary mt-0.5" />
          <span>
            <span className="block text-sm font-bold">Completo — 4 sessões</span>
            <span className="block text-xs text-foreground/50">O padrão.</span>
          </span>
        </label>
        <label className={`flex items-start gap-2 rounded-2xl border px-4 py-3 cursor-pointer ${pacote === "fragmentado" ? "border-primary bg-primary/5" : "border-border bg-surface/60"}`}>
          <input type="radio" name="pacoteTipo" value="fragmentado" checked={pacote === "fragmentado"} onChange={() => setPacote("fragmentado")} className="accent-primary mt-0.5" />
          <span>
            <span className="block text-sm font-bold">Fragmentado</span>
            {/* Não se informa mais quantas semanas: quem diz é a agenda. Setembro com três
                quartas cobra três sessões; outubro com quatro cobra quatro. */}
            <span className="block text-xs text-foreground/50">O sistema considera as sessões dentro do mês.</span>
          </span>
        </label>
      </div>
    </div>
  );

  const valorDaSessao = (
    <div><label className={labelCls}>Valor da sessão (R$)</label><input name="sessionFee" inputMode="decimal" defaultValue={p?.sessionFee ?? ""} className={inputCls} placeholder="ex: 200,00" /></div>
  );

  const proximoReajuste = (
    <NumeroCom
      name="validadePrecoMeses" label="Próximo reajuste em" unidade="meses" max={60}
      dica="A cada quantos meses o valor deve ser revisto. A conta começa no início do tratamento — ou na data do RETORNO, se o paciente parou e voltou."
      defaultValue={p?.validadePrecoMeses} placeholder="ex: 12"
    />
  );

  // O que cada formato abre, logo abaixo do próprio item — e na ordem que o dono pediu.
  const camposDoFormato: Record<string, ReactNode> = {
    gratuito: (
      <p className="text-sm text-foreground/60 rounded-2xl bg-surface/70 border border-border px-4 py-3">
        Atendimento <strong>gratuito</strong>: sem valor, sem dia de pagamento e sem cobrança.
      </p>
    ),
    sessao: (
      <div className="grid sm:grid-cols-2 gap-4">
        {valorDaSessao}
        <NumeroCom
          name="horasAntesPagamento" label="Pagar até" unidade="horas antes" max={168}
          dica="Quantas horas ANTES do atendimento o pagamento deve estar feito. É o gatilho do aviso ao paciente."
          defaultValue={p?.horasAntesPagamento} placeholder="ex: 24"
        />
        {proximoReajuste}
      </div>
    ),
    mensal: (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          {valorDaSessao}
          <div>
            <label className={labelCls}>Dia de pagamento</label>
            <input name="paymentDay" type="number" min={1} max={31} defaultValue={p?.paymentDay ?? ""} className={inputCls} placeholder="ex: 5" />
          </div>
        </div>
        {blocoPacote}
        <div className="sm:max-w-sm">{proximoReajuste}</div>
      </div>
    ),
    quinzenal: (
      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          {valorDaSessao}
          <div className="hidden sm:block" />
          <div>
            <label className={labelCls}>Dia de pagamento — 1ª quinzena</label>
            <input name="paymentDay" type="number" min={1} max={31} defaultValue={p?.paymentDay ?? ""} className={inputCls} placeholder="ex: 5" />
          </div>
          <div>
            <label className={labelCls}>Dia de pagamento — 2ª quinzena</label>
            <input name="paymentDay2" type="number" min={1} max={31} defaultValue={p?.paymentDay2 ?? ""} className={inputCls} placeholder="ex: 20" />
          </div>
        </div>
        {blocoPacote}
        <div className="sm:max-w-sm">{proximoReajuste}</div>
      </div>
    ),
    // Pagar o pacote inteiro de uma vez: o dia do pagamento é o dia da sessão, então não se
    // pergunta dia nenhum.
    primeira_pacote: (
      <div className="space-y-4">
        <div className="sm:max-w-sm">{valorDaSessao}</div>
        {blocoPacote}
        <div className="sm:max-w-sm">{proximoReajuste}</div>
      </div>
    ),
    ultima_pacote: (
      <div className="space-y-4">
        <div className="sm:max-w-sm">{valorDaSessao}</div>
        {blocoPacote}
        <div className="sm:max-w-sm">{proximoReajuste}</div>
      </div>
    ),
  };

  const FORMATOS = [
    { v: "gratuito", t: "Gratuito", d: "Sem cobrança." },
    { v: "sessao", t: "A cada sessão", d: "Paga a cada atendimento." },
    { v: "mensal", t: "Mensal", d: "Um pagamento por mês." },
    { v: "quinzenal", t: "Quinzenal", d: "Dois pagamentos por mês." },
    { v: "primeira_pacote", t: "Na primeira sessão do pacote", d: "Paga o pacote inteiro ao começar." },
    { v: "ultima_pacote", t: "Na última sessão do pacote", d: "Paga o pacote inteiro ao terminar." },
  ];

  return (
    <div className="space-y-5">
      {/* Submenu horizontal */}
      <div className="flex gap-2 bg-white/50 p-1.5 rounded-2xl w-fit overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button key={t.k} type="button" onClick={() => setTab(t.k)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition ${tab === t.k ? "bg-primary text-white shadow" : "text-foreground/60 hover:bg-white"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* DADOS: pessoais → cônjuge → responsável/emergência → devolutiva → escola */}
      <div className={show("dados")}>
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
            <select name="patientStatus" className={inputCls} defaultValue={p?.patientStatus || "ativo"}>
              <option value="ativo">Ativo</option>
              <option value="prospect">Prospect</option>
              <option value="pausado">Pausado</option>
              <option value="inativo">Inativo</option>
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
              <p className="text-xs text-foreground/50 -mt-1">Para menores ou pacientes sob responsabilidade de terceiro.</p>
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
              dica="A cada quantos meses fazer a devolutiva, contados da PRIMEIRA sessão. Em branco = não combinada."
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
      </div>

      {/* FINANCEIRO — o formato vem primeiro, e é ele que decide o que se pergunta depois. Os
          campos abrem LOGO ABAIXO do formato escolhido, e não no fim da lista: assim se lê o que
          foi marcado junto com o que ele pede. */}
      <div className={show("financeiro")}>
        <Card title="Financeiro">
          <div>
            <label className={labelCls}>Formato de pagamento</label>
            <div className="space-y-2">
              {FORMATOS.map((o) => (
                <div key={o.v} className="space-y-3">
                  <label className={`flex items-start gap-2 rounded-2xl border px-4 py-3 cursor-pointer transition ${format === o.v ? "border-primary bg-primary/5" : "border-border bg-surface/60"}`}>
                    {/* Seleção ÚNICA: o formato de pagamento é um só. */}
                    <input type="radio" name="paymentFormat" value={o.v} checked={format === o.v} onChange={() => setFormat(o.v)} className="accent-primary mt-0.5" />
                    <span>
                      <span className="block text-sm font-bold">{o.t}</span>
                      <span className="block text-xs text-foreground/50">{o.d}</span>
                    </span>
                  </label>
                  {format === o.v && <div className="pl-1 pb-2">{camposDoFormato[o.v]}</div>}
                </div>
              ))}
            </div>
          </div>

          {usaPacote(format) && (
            <p className="text-xs text-foreground/50">
              A contagem das sessões do pacote (1/3, 2/3…) sai da agenda: no pacote completo são
              sempre quatro; no fragmentado, quantas caírem dentro do mês.
            </p>
          )}

          {(p?.priceHistory?.length ?? 0) > 0 && (
            <div className="pt-2 border-t border-border">
              <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest mb-2 mt-3">Histórico de reajuste</p>
              <ul className="space-y-1">
                {linhasDeReajuste(p!.priceHistory!).reverse().map((l, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm rounded-xl bg-surface/60 px-3 py-2">
                    <span className="font-mono text-xs font-bold text-primary">{l.data.toLocaleDateString("pt-BR")}</span>
                    <span className="text-foreground/60">
                      {l.anterior === null
                        ? <>preço inicial <strong>{brl(l.novo)}</strong></>
                        : <>de {brl(l.anterior)} para <strong>{brl(l.novo)}</strong></>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      </div>

      <p className="text-xs text-foreground/50 px-1">💡 Etiquetas e observações ficam no <strong>Prontuário</strong> do paciente.</p>
    </div>
  );
}

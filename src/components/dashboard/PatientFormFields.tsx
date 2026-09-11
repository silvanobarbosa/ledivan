"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { InfoTip } from "@/components/InfoTip";
import { MessageCircle } from "lucide-react";
import { AttendanceFields } from "@/components/dashboard/AttendanceFields";
import { PhotoSlots } from "@/components/dashboard/PhotoSlots";
import { REMINDER_LEAD_OPTIONS } from "@/lib/reminderLead";
import { QUEIXAS } from "@/lib/queixas";
import { idadeEmPalavras } from "@/lib/idade";
import { linhasDeReajuste } from "@/lib/reajuste";

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

const TABS = [
  { k: "dados", label: "Dados" },
  { k: "atendimento", label: "Atendimento" },
  { k: "financeiro", label: "Financeiro" },
];

export function PatientFormFields({ p, locations }: { p?: PatientFormData; locations: { name: string; address: string }[] }) {
  const [tab, setTab] = useState("dados");
  // Formato antigo "avulso" e o "a cada sessao" do dono; "pacote" virou mensal com pacote.
  const formatoInicial = p?.paymentFormat === "avulso" ? "sessao" : p?.paymentFormat === "pacote" ? "mensal" : (p?.paymentFormat || "sessao");
  const [format, setFormat] = useState(formatoInicial);
  const [pacote, setPacote] = useState(p?.pacoteTipo || "completo");
  const [dueType, setDueType] = useState(p?.dueDateType || "");
  const GENDERS = ["feminino", "masculino", "nao-binario"];
  const initialGender = p?.gender ? (GENDERS.includes(p.gender) ? p.gender : "outro") : "";
  const [gender, setGender] = useState(initialGender);
  // A classificação saiu: a idade é CALCULADA da data de nascimento, e "casal" virou item próprio.
  // Rótulo de faixa etária envelhece sozinho — a criança cadastrada em 2019 continuava "criança"
  // no sistema até alguém lembrar de editar. E o relatório já filtra por data de nascimento.
  const [nascimento, setNascimento] = useState(p?.birthDate ? new Date(p.birthDate).toISOString().slice(0, 10) : "");
  const [casal, setCasal] = useState(!!p?.isCouple || p?.category === "casal");
  const initialQueixa = p?.queixaPrincipal ? ((QUEIXAS as readonly string[]).includes(p.queixaPrincipal) ? p.queixaPrincipal : "Outro") : "";
  const [queixa, setQueixa] = useState(initialQueixa);
  const initialRec = (p?.frequency === "semanal" && (p?.timesPerPeriod ?? 1) >= 2) ? "2x_semana" : (p?.frequency || "semanal");
  const dateVal = (d?: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");
  const show = (k: string) => (tab === k ? "space-y-4" : "hidden");

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

      {/* DADOS: pessoais + responsável + emergência */}
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
              mental de quem abre a ficha ("esta pessoa ainda está em atendimento?"). Ele morava na
              aba Atendimento, onde quase ninguém ia. */}
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
                o Chrome abortava o submit em silêncio — botão "Cadastrar" parecia morto. Trazer
                a aba de volta torna o campo visível e o balão de validação aparece. */}
            <input name="name" required onInvalid={() => setTab("dados")} defaultValue={p?.name ?? ""} className={inputCls} placeholder="Nome completo" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <PhoneInput name="phone" defaultValue={p?.phone} />
            <div><label className={labelCls}>E-mail</label><input name="email" type="email" defaultValue={p?.email ?? ""} className={inputCls} placeholder="email@exemplo.com" /></div>
            <div>
              <label className={labelCls}>Data de nascimento</label>
              <input name="birthDate" type="date" value={nascimento} onChange={(e) => setNascimento(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Idade</label>
              {/* Calculada, não digitada: idade que se digita fica velha no dia seguinte. Em branco
                  enquanto não houver data de nascimento — melhor vazio do que um número inventado. */}
              <input
                value={idadeEmPalavras(nascimento || null) || "—"}
                readOnly disabled
                className={`${inputCls} bg-black/5 text-foreground/50`}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input type="checkbox" name="isCouple" value="1" checked={casal} onChange={(e) => setCasal(e.target.checked)} className="accent-primary w-4 h-4" />
                Atendimento de casal
              </label>
              <p className="text-xs text-foreground/50 mt-1">Abre os dados do cônjuge, logo abaixo.</p>
            </div>
            <div>
              <label className={labelCls}>Queixa principal<InfoTip text="Demanda/queixa principal do paciente. Usada nos filtros do painel. Se não estiver na lista, escolha 'Outro'." /></label>
              <select value={queixa} onChange={(e) => setQueixa(e.target.value)} name={queixa === "Outro" ? undefined : "queixaPrincipal"} className={inputCls}>
                <option value="">—</option>
                {QUEIXAS.map((q) => <option key={q} value={q}>{q}</option>)}
                <option value="Outro">Outro</option>
              </select>
            </div>
            {queixa === "Outro" && (
              <div><label className={labelCls}>Qual queixa?</label><input name="queixaPrincipal" defaultValue={initialQueixa === "Outro" ? (p?.queixaPrincipal ?? "") : ""} className={inputCls} placeholder="Descreva a queixa" /></div>
            )}
            <div>
              <label className={labelCls}>Gênero</label>
              <select name="gender" value={gender} onChange={(e) => setGender(e.target.value)} className={inputCls}>
                <option value="">—</option>
                <option value="feminino">Feminino</option>
                <option value="masculino">Masculino</option>
                <option value="nao-binario">Não-binário</option>
                <option value="outro">Outro</option>
              </select>
            </div>
            {gender === "outro" && (
              <div><label className={labelCls}>Qual gênero?</label><input name="genderOther" defaultValue={GENDERS.includes(p?.gender || "") ? "" : (p?.gender ?? "")} className={inputCls} placeholder="Descreva" /></div>
            )}
            <div><label className={labelCls}>CPF</label><input name="cpf" defaultValue={p?.cpf ?? ""} className={inputCls} placeholder="000.000.000-00" /></div>
            <div><label className={labelCls}>Início</label><input name="startedAt" type="date" defaultValue={dateVal(p?.startedAt)} className={inputCls} /></div>
          </div>
          <div><label className={labelCls}>Endereço</label><input name="address" defaultValue={p?.address ?? ""} className={inputCls} placeholder="Endereço residencial" /></div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              {/* A foto 3x4 fica: é ela que identifica a pessoa na lista e na ficha. As outras
                  três, soltas, viraram ANEXOS do prontuário — o que chega na mão do terapeuta é
                  laudo, relatório da escola, encaminhamento, e quase nunca foto. */}
              <label className={labelCls}>Foto do paciente</label>
              <PhotoSlots initial={{ photo3x4: p?.photo3x4 ?? null }} apenas3x4 />
            </div>
            <div className="hidden sm:block" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className={labelCls}>Escola</label><input name="schoolName" defaultValue={p?.schoolName ?? ""} className={inputCls} placeholder="Nome da escola" /></div>
            <div><label className={labelCls}>Contato da escola</label><input name="schoolContact" defaultValue={p?.schoolContact ?? ""} className={inputCls} placeholder="Telefone, e-mail ou coordenação" /></div>
          </div>
        </Card>

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

        {casal && (
          <Card title="Dados do cônjuge">
            <div className="grid sm:grid-cols-2 gap-4">
              <div><label className={labelCls}>Nome do cônjuge</label><input name="spouseName" defaultValue={p?.spouseName ?? ""} className={inputCls} placeholder="Nome completo" /></div>
              <div><label className={labelCls}>CPF do cônjuge</label><input name="spouseCpf" defaultValue={p?.spouseCpf ?? ""} className={inputCls} placeholder="000.000.000-00" /></div>
              <PhoneInput name="spousePhone" defaultValue={p?.spousePhone} label="Telefone do cônjuge" />
              <div><label className={labelCls}>E-mail do cônjuge</label><input name="spouseEmail" type="email" defaultValue={p?.spouseEmail ?? ""} className={inputCls} placeholder="email@exemplo.com" /></div>
            </div>
          </Card>
        )}

        <Card title="Contato de emergência">
          <div className="grid sm:grid-cols-2 gap-4">
            <div><label className={labelCls}>Nome</label><input name="emergencyName" defaultValue={p?.emergencyName ?? ""} className={inputCls} /></div>
            <div><label className={labelCls}>Parentesco</label><input name="emergencyRelationship" defaultValue={p?.emergencyRelationship ?? ""} className={inputCls} /></div>
            <PhoneInput name="emergencyPhone" defaultValue={p?.emergencyPhone} />
            <div><label className={labelCls}>E-mail</label><input name="emergencyEmail" type="email" defaultValue={p?.emergencyEmail ?? ""} className={inputCls} placeholder="email@exemplo.com" /></div>
          </div>
        </Card>
      </div>

      {/* ATENDIMENTO: modo + endereço + status + dia/hora + travar agenda + lembrete */}
      <div className={show("atendimento")}>
        <Card title="Atendimento">
          <AttendanceFields locations={locations} defaultMode={p?.attendanceMode ?? "presencial"} defaultLocation={p?.attendanceLocation ?? null} />
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Devolutiva a cada<InfoTip text="A cada quantos meses fazer a devolutiva, contados da PRIMEIRA sessão. Em branco = não combinada." /></label>
              <div className="flex items-center gap-2">
                <input name="devolutivaMeses" type="number" min={1} max={24} defaultValue={p?.devolutivaMeses ?? ""} className={inputCls} placeholder="ex: 6" />
                <span className="text-sm text-foreground/60 whitespace-nowrap">meses</span>
              </div>
            </div>
            <div>
              <label className={labelCls}>Recorrência de atendimento<InfoTip text="Quantas vezes e em que período o paciente é atendido. É a referência usada também no financeiro." /></label>
              <select name="recorrencia" className={inputCls} defaultValue={initialRec}>
                <option value="semanal">Semanal</option>
                <option value="quinzenal">Quinzenal</option>
                <option value="mensal">Mensal</option>
                <option value="2x_semana">2x por semana</option>
              </select>
            </div>
            <div className="sm:col-span-2 rounded-2xl bg-surface/70 border border-border px-4 py-3">
              {/* Dia e hora saíram do cadastro a pedido do dono: quem manda neles é a AGENDA.
                  Campo digitado aqui virava mentira — mudava o horário na agenda e a ficha
                  continuava dizendo o antigo. A lista de pacientes agora mostra o dia e a hora da
                  PRÓXIMA sessão marcada. */}
              <p className="text-sm font-semibold">Dia e horário ficam na agenda</p>
              <p className="text-xs text-foreground/60 mt-1">
                Marque as sessões pela <Link href="/dashboard/agenda" className="text-primary font-semibold underline">Agenda</Link>,
                onde dá para repetir semanal, quinzenal ou mensalmente até uma data. A ficha e a
                lista passam a mostrar o horário da próxima sessão marcada.
              </p>
            </div>
          </div>

        </Card>
      </div>

      {/* FINANCEIRO — o formato vem primeiro, e é ele que decide o que se pergunta depois.
          Era o contrário: pedia-se valor, dia e vencimento para todo mundo, inclusive para quem
          é atendido de graça. */}
      <div className={show("financeiro")}>
        <Card title="Financeiro">
          <div>
            <label className={labelCls}>Formato de pagamento</label>
            <div className="grid sm:grid-cols-2 gap-2">
              {[
                { v: "gratuito", t: "Gratuito", d: "Atendimento social. Aparece assim na agenda." },
                { v: "sessao", t: "A cada sessão", d: "Paga a cada atendimento." },
                { v: "mensal", t: "Mensal", d: "Um pagamento por mês." },
                { v: "quinzenal", t: "Quinzenal", d: "Dois pagamentos por mês." },
              ].map((o) => (
                <label key={o.v} className={`flex items-start gap-2 rounded-2xl border px-4 py-3 cursor-pointer transition ${format === o.v ? "border-primary bg-primary/5" : "border-border bg-surface/60"}`}>
                  {/* Seleção ÚNICA: o formato de pagamento é um só. O desenho pedia caixas de
                      marcar, mas marcar duas não significaria nada para o financeiro. */}
                  <input type="radio" name="paymentFormat" value={o.v} checked={format === o.v} onChange={() => setFormat(o.v)} className="accent-primary mt-0.5" />
                  <span>
                    <span className="block text-sm font-bold">{o.t}</span>
                    <span className="block text-xs text-foreground/50">{o.d}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {format === "gratuito" ? (
            <p className="text-sm text-foreground/60 rounded-2xl bg-surface/70 border border-border px-4 py-3">
              Atendimento <strong>social</strong>: sem valor, sem dia de pagamento e sem cobrança.
              A agenda mostra a sessão marcada como social.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div><label className={labelCls}>Valor da sessão (R$)</label><input name="sessionFee" inputMode="decimal" defaultValue={p?.sessionFee ?? ""} className={inputCls} placeholder="ex: 200,00" /></div>
                <div>
                  <label className={labelCls}>Validade do preço<InfoTip text="A cada quantos meses o valor deve ser revisto. A conta começa no início do tratamento — ou na data do RETORNO, se o paciente parou e voltou." /></label>
                  <div className="flex items-center gap-2">
                    <input name="validadePrecoMeses" type="number" min={1} max={60} defaultValue={p?.validadePrecoMeses ?? ""} className={inputCls} placeholder="ex: 12" />
                    <span className="text-sm text-foreground/60 whitespace-nowrap">meses</span>
                  </div>
                </div>
              </div>

              {format === "sessao" && (
                <div className="sm:max-w-sm">
                  <label className={labelCls}>Pagar até<InfoTip text="Quantas horas ANTES do atendimento o pagamento deve estar feito. É o gatilho do aviso automático ao paciente, que ainda será ligado." /></label>
                  <div className="flex items-center gap-2">
                    <input name="horasAntesPagamento" type="number" min={1} max={168} defaultValue={p?.horasAntesPagamento ?? ""} className={inputCls} placeholder="ex: 24" />
                    <span className="text-sm text-foreground/60 whitespace-nowrap">horas antes</span>
                  </div>
                </div>
              )}

              {(format === "mensal" || format === "quinzenal") && (
                <>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelCls}>{format === "quinzenal" ? "Dia de pagamento — 1ª quinzena" : "Dia de pagamento"}</label>
                      <input name="paymentDay" type="number" min={1} max={31} defaultValue={p?.paymentDay ?? ""} className={inputCls} placeholder="ex: 5" />
                    </div>
                    {format === "quinzenal" && (
                      <div>
                        <label className={labelCls}>Dia de pagamento — 2ª quinzena</label>
                        <input name="paymentDay2" type="number" min={1} max={31} defaultValue={p?.paymentDay2 ?? ""} className={inputCls} placeholder="ex: 20" />
                      </div>
                    )}
                  </div>

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
                          <span className="block text-xs text-foreground/50">Você informa as semanas; o sistema conta as sessões.</span>
                        </span>
                      </label>
                    </div>
                  </div>

                  {pacote === "fragmentado" && (
                    <div className="sm:max-w-sm">
                      <label className={labelCls}>Semanas de atendimento no mês<InfoTip text="O sistema multiplica pelas vezes por semana da recorrência (aba Atendimento) para chegar às sessões do mês." /></label>
                      <input name="semanasNoMes" type="number" min={1} max={5} defaultValue={p?.semanasNoMes ?? ""} className={inputCls} placeholder="ex: 3" />
                    </div>
                  )}
                </>
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
            </div>
          )}
        </Card>
      </div>

      <p className="text-xs text-foreground/50 px-1">💡 Etiquetas e observações ficam no <strong>Prontuário</strong> do paciente.</p>
    </div>
  );
}

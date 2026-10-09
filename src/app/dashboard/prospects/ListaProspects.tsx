"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, ArrowRight, Trash2, Save, ChevronDown, ChevronRight, Plus, MessageCircle } from "lucide-react";
import { formatDate } from "@/lib/therapy";
import { idadeEmAnos } from "@/lib/idade";
import { numeroDoWhatsapp } from "@/lib/telefoneWhatsapp";
import { MoneyInput } from "@/components/MoneyInput";
import { SubmitButton } from "@/components/SubmitButton";
import { InfoTip } from "@/components/InfoTip";
import {
  createProspect, updateProspect, deleteProspect, convertProspect,
  addProspectContact, deleteProspectContact, registrarEnvioMensagem,
} from "./actions";

export type ProspectLinha = {
  id: string; name: string; phone: string | null; email: string | null;
  gender: string | null; birthDate: string | null;
  prospectDate: string | null; prospectFechou: string | null; sessionFee: string;
};
export type ContatoLinha = { id: string; patientId: string; date: string; observacao: string | null };

const inputCls = "w-full px-3 py-2 rounded-xl bg-white/70 border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm";
const lbl = "text-[11px] font-semibold uppercase tracking-wide text-foreground/40";

// A conta da idade e uma so, em lib/idade: copiada aqui, ela errava o dia por causa do fuso.
const idadeDe = (nasc: string | null): number | null => idadeEmAnos(nasc);
/** YYYY-MM-DD para o input date. */
const paraInput = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");
/** Horário HH:MM do contato (doc 20: o histórico mostra data E horário do envio). */
const horaDe = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};

export function ListaProspects({ prospects, contatos }: { prospects: ProspectLinha[]; contatos: ContatoLinha[] }) {
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [idadeMin, setIdadeMin] = useState("");
  const [idadeMax, setIdadeMax] = useState("");
  const [sexo, setSexo] = useState("");
  const [telefone, setTelefone] = useState("");
  // `aberto` = o card expandido (doc 19: a lista mostra só data+nome e abre as infos completas ao
  // clicar). `verContatos` = dentro do card aberto, o histórico de contatos expandido.
  const [aberto, setAberto] = useState<string | null>(null);
  const [verContatos, setVerContatos] = useState<Set<string>>(new Set());
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  // Envio de mensagens (doc 20): a mensagem é definida UMA vez abaixo da lista; cada prospectado tem
  // seu botão "Contatar" que envia SÓ para ele (pelo WhatsApp dele) e registra o contato só dele.
  const [mensagem, setMensagem] = useState("");
  const [contatando, iniciarContato] = useTransition();
  const [contatoId, setContatoId] = useState<string | null>(null);
  const [envioMsg, setEnvioMsg] = useState<string | null>(null);
  const router = useRouter();

  function contatar(p: ProspectLinha) {
    setEnvioMsg(null);
    const num = numeroDoWhatsapp(p.phone);
    // Campo VAZIO (doc 9, item 12): não manda nada automático — só abre a conversa (sem texto) para
    // a pessoa digitar no próprio WhatsApp, e registra que o contato foi feito por fora do sistema.
    // Campo preenchido: segue como antes — {nome} vira o primeiro nome, abre o wa.me com o texto.
    const vazio = !mensagem.trim();
    const texto = vazio ? "Contato feito externamente sem a utilização do sistema" : mensagem.replace(/\{nome\}/g, p.name.split(" ")[0]);
    if (num) {
      const url = vazio ? `https://wa.me/${num}` : `https://wa.me/${num}?text=${encodeURIComponent(texto)}`;
      window.open(url, "_blank", "noopener");
    }
    setContatoId(p.id);
    iniciarContato(async () => {
      const r = await registrarEnvioMensagem({ envios: [{ id: p.id, mensagem: texto }] });
      setContatoId(null);
      if (r.ok) {
        setEnvioMsg(`Contato registrado para ${p.name}${num ? "" : " (sem telefone — WhatsApp não aberto)"}.`);
        router.refresh();
      } else setEnvioMsg(r.erro ?? "Não deu para registrar.");
    });
  }

  const porProspect = useMemo(() => {
    const m = new Map<string, ContatoLinha[]>();
    for (const c of contatos) {
      const atual = m.get(c.patientId);
      if (atual) atual.push(c); else m.set(c.patientId, [c]);
    }
    return m;
  }, [contatos]);

  const filtrados = useMemo(() => prospects.filter((p) => {
    if (de || ate) {
      if (!p.prospectDate) return false;
      const t = new Date(p.prospectDate).getTime();
      if (de && t < new Date(de + "T00:00:00").getTime()) return false;
      if (ate && t > new Date(ate + "T23:59:59").getTime()) return false;
    }
    const a = idadeDe(p.birthDate);
    if (idadeMin && (a === null || a < Number(idadeMin))) return false;
    if (idadeMax && (a === null || a > Number(idadeMax))) return false;
    if (sexo && (p.gender || "") !== sexo) return false;
    // Busca por telefone (doc 19/10): compara só os dígitos, casando por trecho — o usuário pode
    // digitar com ou sem DDD/pontuação e a lista filtra ao vivo.
    const tel = telefone.replace(/\D/g, "");
    if (tel && !(p.phone || "").replace(/\D/g, "").includes(tel)) return false;
    return true;
  }), [prospects, de, ate, idadeMin, idadeMax, sexo, telefone]);

  function excluir(p: ProspectLinha) {
    if (!confirm(`Excluir o prospectado ${p.name}? O histórico de contatos dele vai junto.`)) return;
    setErro(null);
    iniciar(async () => {
      const r = await deleteProspect(p.id);
      if (!r.ok) setErro(r.erro ?? "Não deu para excluir.");
      // Excluir devolve um resultado (para mostrar o motivo), então não pode redirecionar como as
      // outras ações. Sem este refresh, a linha apagada continuava na tela até recarregar.
      else router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Novo prospectado */}
      <form action={createProspect} className="glass-card rounded-[24px] p-5 space-y-3">
        <div className="flex items-center gap-2 text-primary font-semibold text-sm">
          <UserPlus className="w-4 h-4" /> Novo prospectado
          <InfoTip text="Aqui você cadastra as pessoas que entraram em contato com você. Este recurso também funciona pelo celular." />
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div><span className={lbl}>Data do contato</span><input name="prospectDate" type="date" className={inputCls} /></div>
          <div className="sm:col-span-2"><span className={lbl}>Nome *</span><input name="name" required placeholder="Nome completo" className={inputCls} /></div>
          <div><span className={lbl}>Telefone</span><input name="phone" className={inputCls} /></div>
          <div><span className={lbl}>E-mail</span><input name="email" type="email" className={inputCls} /></div>
          <div><span className={lbl}>Valor previsto</span><MoneyInput name="sessionFee" placeholder="R$ 0,00" className={inputCls} /></div>
          <div><span className={lbl}>Data de nascimento</span><input name="birthDate" type="date" className={inputCls} /></div>
          <div>
            <span className={lbl}>Sexo</span>
            <select name="gender" className={inputCls} defaultValue="">
              <option value="">—</option>
              <option value="feminino">Feminino</option>
              <option value="masculino">Masculino</option>
              <option value="nao-binario">Não-binário</option>
            </select>
          </div>
          <div><span className={lbl}>Observação do contato</span><input name="prospectObservacoes" placeholder="O que foi conversado" className={inputCls} /></div>
        </div>
        {/* Trava no 1º clique (doc 19/10): SubmitButton desabilita enquanto a action roda — sem
            cadastro duplicado por clique dobrado. */}
        <SubmitButton pendingLabel="Adicionando…" className="w-full sm:w-auto bg-primary text-white px-6 py-2.5 rounded-xl font-bold inline-flex items-center justify-center gap-2">
          Adicionar prospectado
        </SubmitButton>
      </form>

      {/* Filtros — ficam logo abaixo do botão de adicionar, conforme pedido */}
      <div className="glass-card rounded-[24px] p-5 flex gap-3 flex-wrap items-end">
        <div className="w-full inline-flex items-center text-xs font-bold text-foreground/50 uppercase tracking-wide">
          Filtrar
          <InfoTip text="Filtre a lista abaixo por período de procura, idade, sexo ou telefone. Este recurso também funciona pelo celular." />
        </div>
        <div><span className={lbl}>Contato de</span><input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={inputCls} /></div>
        <div><span className={lbl}>até</span><input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={inputCls} /></div>
        <div>
          <span className={lbl}>Idade</span>
          <div className="flex gap-1">
            <input type="number" min={0} placeholder="mín" value={idadeMin} onChange={(e) => setIdadeMin(e.target.value)} className={`${inputCls} w-20`} />
            <input type="number" min={0} placeholder="máx" value={idadeMax} onChange={(e) => setIdadeMax(e.target.value)} className={`${inputCls} w-20`} />
          </div>
        </div>
        <div>
          <span className={lbl}>Sexo</span>
          <select value={sexo} onChange={(e) => setSexo(e.target.value)} className={inputCls}>
            <option value="">todos</option>
            <option value="feminino">Feminino</option>
            <option value="masculino">Masculino</option>
            <option value="nao-binario">Não-binário</option>
          </select>
        </div>
        <div>
          <span className={lbl}>Telefone</span>
          <input inputMode="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="buscar nº" className={`${inputCls} w-36`} />
        </div>
        <p className="text-sm text-foreground/50 ml-auto">{filtrados.length} de {prospects.length}</p>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {filtrados.length === 0 ? (
        <p className="glass-card rounded-[24px] p-10 text-center text-foreground/40">
          {prospects.length === 0 ? "Nenhum prospectado no momento." : "Nenhum prospectado nesse filtro."}
        </p>
      ) : (
        <div className="space-y-3">
          <div className="inline-flex items-center text-xs font-bold text-foreground/50 uppercase tracking-wide">
            Prospectados
            <InfoTip text="Clique no ícone › para ver os detalhes da prospecção e atualizar os contatos, ou em Contatar para enviar uma mensagem. Para enviar uma única mensagem a todos, use o campo Mensagem abaixo. Este recurso também funciona pelo celular." />
          </div>
          {filtrados.map((p) => {
            const lista = porProspect.get(p.id) ?? [];
            const expandido = aberto === p.id;
            const contatosAbertos = verContatos.has(p.id);
            const a = idadeDe(p.birthDate);
            // Data do PRIMEIRO contato (doc 19): a mais antiga entre a data do cadastro e os contatos.
            const datas = [p.prospectDate, ...lista.map((c) => c.date)].filter(Boolean) as string[];
            const dataPrimeiro = datas.length
              ? datas.reduce((a, b) => (new Date(a).getTime() <= new Date(b).getTime() ? a : b))
              : null;
            const alternarContatos = () =>
              setVerContatos((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; });
            return (
              // `data-prospect` dá um endereço estável para cada linha. Sem ele, o percurso de
              // escrita precisava contar posições para achar a pessoa certa, e a contagem
              // escorregava a cada prospect novo — o teste passava a clicar na linha do vizinho.
              <div key={p.id} data-prospect={p.id} className="glass-card rounded-[24px] p-4 sm:p-5">
                {/* Doc 19: a lista mostra só a data do 1º contato e o nome; clicar abre as infos
                    completas. À DIREITA, o botão "Contatar" (doc 20) envia a mensagem definida abaixo
                    SÓ para este prospectado — fora do botão de abrir, para um não disparar o outro. */}
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setAberto(expandido ? null : p.id)}
                    aria-expanded={expandido} className="flex-1 min-w-0 flex items-center gap-3 text-left">
                    {expandido ? <ChevronDown className="w-4 h-4 text-primary shrink-0" /> : <ChevronRight className="w-4 h-4 text-primary shrink-0" />}
                    <span className="font-mono text-xs font-bold text-primary shrink-0 tabular-nums">{dataPrimeiro ? formatDate(dataPrimeiro) : "—"}</span>
                    <span className="flex-1 font-semibold text-sm truncate">{p.name}</span>
                  </button>
                  <button type="button" onClick={() => contatar(p)} disabled={contatando && contatoId === p.id}
                    title="Enviar a mensagem definida abaixo para este prospectado (WhatsApp)"
                    className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold text-[#047857] border border-[#a7f3d0] bg-[#ecfdf5] rounded-full px-3 py-1 hover:bg-[#d1fae5] disabled:opacity-60 whitespace-nowrap">
                    <MessageCircle className="w-3 h-3" aria-hidden /> {contatando && contatoId === p.id ? "..." : "Contatar"}
                  </button>
                </div>

                {expandido && (
                <div className="space-y-3 mt-3 border-t border-border pt-3">
                {/* Uma caixa por pessoa: os campos são editáveis aqui mesmo e o botão atualiza. */}
                <form action={updateProspect} className="space-y-3">
                  <input type="hidden" name="id" value={p.id} />
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div><span className={lbl}>Data do contato</span><input name="prospectDate" type="date" defaultValue={paraInput(p.prospectDate)} className={inputCls} /></div>
                    <div className="sm:col-span-2"><span className={lbl}>Nome</span><input name="name" defaultValue={p.name} className={inputCls} /></div>
                    <div><span className={lbl}>Telefone</span><input name="phone" defaultValue={p.phone ?? ""} className={inputCls} /></div>
                    <div><span className={lbl}>E-mail</span><input name="email" type="email" defaultValue={p.email ?? ""} className={inputCls} /></div>
                    <div><span className={lbl}>Valor previsto</span><MoneyInput name="sessionFee" defaultValue={p.sessionFee} placeholder="R$ 0,00" className={inputCls} /></div>
                    <div><span className={lbl}>Nascimento{a !== null ? ` · ${a} anos` : ""}</span><input name="birthDate" type="date" defaultValue={paraInput(p.birthDate)} className={inputCls} /></div>
                    <div>
                      <span className={lbl}>Sexo</span>
                      <select name="gender" defaultValue={p.gender ?? ""} className={inputCls}>
                        <option value="">—</option>
                        <option value="feminino">Feminino</option>
                        <option value="masculino">Masculino</option>
                        <option value="nao-binario">Não-binário</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap items-center">
                    <button className="inline-flex items-center gap-1.5 bg-primary text-white text-sm px-4 py-2 rounded-xl font-semibold"><Save className="w-4 h-4" /> Atualizar</button>
                  </div>
                </form>

                <div className="flex gap-2 flex-wrap border-t border-border pt-3 items-center">
                  <button type="button" onClick={alternarContatos} className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                    {contatosAbertos ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    {lista.length} contato(s)
                  </button>
                  <InfoTip text="Clique em › Contato(s) para registrar novos contatos e em Converter para retirar o prospectado da lista e adicioná-lo à lista de pacientes. Este recurso também funciona pelo celular." />
                  <div className="ml-auto flex gap-2">
                    <form action={async () => { await convertProspect(p.id); }}>
                      <button className="inline-flex items-center gap-1.5 bg-primary text-white text-sm px-4 py-2 rounded-xl font-semibold">Converter <ArrowRight className="w-4 h-4" /></button>
                    </form>
                    <button type="button" onClick={() => excluir(p)} disabled={pendente} title="Excluir prospectado" aria-label={`Excluir prospectado ${p.name}`} className="inline-flex items-center justify-center p-2 rounded-xl border border-border text-red-600 hover:bg-red-50 transition disabled:opacity-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {contatosAbertos && (
                  <div className="space-y-2 border-t border-border pt-3">
                    <form action={addProspectContact} className="flex gap-2 flex-wrap items-end">
                      <input type="hidden" name="patientId" value={p.id} />
                      <div><span className={lbl}>Data contato</span><input name="date" type="date" className={inputCls} /></div>
                      <div className="flex-1 min-w-[200px]"><span className={lbl}>Observação</span><input name="observacao" placeholder="O que foi conversado" className={inputCls} /></div>
                      <button className="inline-flex items-center gap-1 bg-surface border border-border text-primary text-sm px-3 py-2 rounded-xl font-semibold"><Plus className="w-4 h-4" /> Registrar contato</button>
                    </form>
                    {lista.length === 0 ? (
                      <p className="text-sm text-foreground/40">Nenhum contato registrado.</p>
                    ) : (
                      <div className="space-y-1">
                        {lista.map((c) => (
                          <div key={c.id} className="flex items-start gap-2 rounded-xl bg-surface/60 px-3 py-2">
                            <span className="font-mono text-xs font-bold text-primary shrink-0 pt-0.5 whitespace-nowrap">{formatDate(c.date)}{horaDe(c.date) ? ` ${horaDe(c.date)}` : ""}</span>
                            <span className="flex-1 text-sm">{c.observacao || "—"}</span>
                            <form action={async () => { await deleteProspectContact(c.id, p.id); }}>
                              <button title="Excluir contato" aria-label="Excluir contato" className="text-red-600 hover:bg-red-50 rounded-lg p-1 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                            </form>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Mensagem (doc 20): definida UMA vez aqui; o botão "Contatar" de cada prospectado na lista
          envia só para ele. <code>{"{nome}"}</code> vira o primeiro nome. */}
      {prospects.length > 0 && (
        <div className="glass-card rounded-[24px] p-5 space-y-3">
          <h3 className="font-semibold text-sm text-primary inline-flex items-center">
            Mensagem
            <InfoTip text="Digite a mensagem e clique em Contatar ao lado do prospectado. A mensagem vai pelo WhatsApp do prospectado e fica registrada no histórico de contatos. Para personalizar com o nome, utilize {nome} — o sistema substitui pelo primeiro nome. Se a mensagem estiver em branco, ao clicar em Contatar o WhatsApp abre com o campo vazio. Este recurso também funciona pelo celular." />
          </h3>
          <p className="text-[11px] text-foreground/50">
            Digite a mensagem que será enviada ao clicar no botão <b>Contatar</b>. Use <code>{"{nome}"}</code> para
            inserir automaticamente o primeiro nome do prospectado.
          </p>
          <textarea value={mensagem} onChange={(e) => { setMensagem(e.target.value); setEnvioMsg(null); }}
            rows={3} placeholder="Olá, {nome}! ..." className={`${inputCls} resize-none`} />
          {envioMsg && <span className="text-xs text-foreground/60">{envioMsg}</span>}
        </div>
      )}
    </div>
  );
}

"use client";

import { useMemo, useState, useTransition } from "react";
import { UserPlus, ArrowRight, Trash2, Save, ChevronDown, ChevronRight, Plus } from "lucide-react";
import { formatDate } from "@/lib/therapy";
import { valorParaCampoBR } from "@/lib/dataForm";
import {
  createProspect, updateProspect, deleteProspect, convertProspect,
  addProspectContact, deleteProspectContact,
} from "./actions";

export type ProspectLinha = {
  id: string; name: string; phone: string | null; email: string | null;
  gender: string | null; birthDate: string | null;
  prospectDate: string | null; prospectFechou: string | null; sessionFee: string;
};
export type ContatoLinha = { id: string; patientId: string; date: string; observacao: string | null };

const inputCls = "w-full px-3 py-2 rounded-xl bg-white/70 border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm";
const lbl = "text-[11px] font-semibold uppercase tracking-wide text-foreground/40";

const idadeDe = (nasc: string | null): number | null => {
  if (!nasc) return null;
  const b = new Date(nasc), h = new Date();
  let a = h.getFullYear() - b.getFullYear();
  if (h.getMonth() < b.getMonth() || (h.getMonth() === b.getMonth() && h.getDate() < b.getDate())) a--;
  return a >= 0 && a < 130 ? a : null;
};
/** YYYY-MM-DD para o input date. */
const paraInput = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 10) : "");

export function ListaProspects({ prospects, contatos }: { prospects: ProspectLinha[]; contatos: ContatoLinha[] }) {
  const [de, setDe] = useState("");
  const [ate, setAte] = useState("");
  const [idadeMin, setIdadeMin] = useState("");
  const [idadeMax, setIdadeMax] = useState("");
  const [sexo, setSexo] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

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
    return true;
  }), [prospects, de, ate, idadeMin, idadeMax, sexo]);

  function excluir(p: ProspectLinha) {
    if (!confirm(`Excluir o prospect ${p.name}? O histórico de contatos dele vai junto.`)) return;
    setErro(null);
    iniciar(async () => {
      const r = await deleteProspect(p.id);
      if (!r.ok) setErro(r.erro ?? "Não deu para excluir.");
    });
  }

  return (
    <div className="space-y-6">
      {/* Novo prospect */}
      <form action={createProspect} className="glass-card rounded-[24px] p-5 space-y-3">
        <div className="flex items-center gap-2 text-primary font-semibold text-sm">
          <UserPlus className="w-4 h-4" /> Novo prospect
        </div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div><span className={lbl}>Data do contato</span><input name="prospectDate" type="date" className={inputCls} /></div>
          <div className="sm:col-span-2"><span className={lbl}>Nome *</span><input name="name" required placeholder="Nome completo" className={inputCls} /></div>
          <div><span className={lbl}>Telefone</span><input name="phone" className={inputCls} /></div>
          <div><span className={lbl}>E-mail</span><input name="email" type="email" className={inputCls} /></div>
          <div><span className={lbl}>Valor previsto</span><input name="sessionFee" inputMode="decimal" placeholder="R$" className={inputCls} /></div>
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
        <button className="w-full sm:w-auto bg-primary text-white px-6 py-2.5 rounded-xl font-bold">Adicionar prospect</button>
      </form>

      {/* Filtros — ficam logo abaixo do botão de adicionar, conforme pedido */}
      <div className="glass-card rounded-[24px] p-5 flex gap-3 flex-wrap items-end">
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
        <p className="text-sm text-foreground/50 ml-auto">{filtrados.length} de {prospects.length}</p>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {filtrados.length === 0 ? (
        <p className="glass-card rounded-[24px] p-10 text-center text-foreground/40">
          {prospects.length === 0 ? "Nenhum prospect no momento." : "Nenhum prospect nesse filtro."}
        </p>
      ) : (
        <div className="space-y-3">
          {filtrados.map((p) => {
            const lista = porProspect.get(p.id) ?? [];
            const expandido = aberto === p.id;
            const a = idadeDe(p.birthDate);
            return (
              <div key={p.id} className="glass-card rounded-[24px] p-5 space-y-3">
                {/* Uma caixa por pessoa: os campos são editáveis aqui mesmo e o botão atualiza. */}
                <form action={updateProspect} className="space-y-3">
                  <input type="hidden" name="id" value={p.id} />
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div><span className={lbl}>Data do contato</span><input name="prospectDate" type="date" defaultValue={paraInput(p.prospectDate)} className={inputCls} /></div>
                    <div className="sm:col-span-2"><span className={lbl}>Nome</span><input name="name" defaultValue={p.name} className={inputCls} /></div>
                    <div><span className={lbl}>Telefone</span><input name="phone" defaultValue={p.phone ?? ""} className={inputCls} /></div>
                    <div><span className={lbl}>E-mail</span><input name="email" type="email" defaultValue={p.email ?? ""} className={inputCls} /></div>
                    <div><span className={lbl}>Valor previsto</span><input name="sessionFee" inputMode="decimal" defaultValue={valorParaCampoBR(p.sessionFee)} className={inputCls} /></div>
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

                <div className="flex gap-2 flex-wrap border-t border-border pt-3">
                  <button type="button" onClick={() => setAberto(expandido ? null : p.id)} className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                    {expandido ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    {lista.length} contato(s)
                  </button>
                  <div className="ml-auto flex gap-2">
                    <form action={async () => { await convertProspect(p.id); }}>
                      <button className="inline-flex items-center gap-1.5 bg-primary text-white text-sm px-4 py-2 rounded-xl font-semibold">Converter <ArrowRight className="w-4 h-4" /></button>
                    </form>
                    <button type="button" onClick={() => excluir(p)} disabled={pendente} title="Excluir prospect" aria-label={`Excluir prospect ${p.name}`} className="inline-flex items-center justify-center p-2 rounded-xl border border-border text-red-600 hover:bg-red-50 transition disabled:opacity-50">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {expandido && (
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
                            <span className="font-mono text-xs font-bold text-primary shrink-0 pt-0.5">{formatDate(c.date)}</span>
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
            );
          })}
        </div>
      )}
    </div>
  );
}

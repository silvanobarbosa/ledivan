"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, X, Check } from "lucide-react";
import { formatDateTime } from "@/lib/therapy";
import { createActivity, editActivity, deleteActivity } from "../actions";

const inputCls = "w-full px-4 py-2.5 rounded-xl bg-white/70 border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm";

export type Atividade = { id: string; title: string; description: string; updatedAt: string };

/**
 * +Atividades (doc 33): atividades e ferramentas realizadas COM o paciente. Lista do mais recente
 * para o mais antigo, logo abaixo do botão. Cada item: 1ª linha título + data/hora + editar/excluir;
 * 2ª linha a descrição. Editar atualiza a data/hora.
 */
function AtividadeItem({ a }: { a: Atividade }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [titulo, setTitulo] = useState(a.title);
  const [descricao, setDescricao] = useState(a.description);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function salvar() {
    setErro(null);
    start(async () => {
      const r = await editActivity(a.id, titulo, descricao);
      if (r.ok) { setEditando(false); router.refresh(); }
      else setErro(r.error ?? "Não deu para salvar.");
    });
  }
  function excluir() {
    start(async () => { const r = await deleteActivity(a.id); if (r.ok) router.refresh(); else setErro(r.error ?? "Não deu para excluir."); });
  }

  return (
    <div className="glass-card rounded-2xl p-4 space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        {editando ? (
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={inputCls} placeholder="Título" autoFocus />
        ) : (
          <p className="text-sm font-bold text-primary">{a.title}</p>
        )}
        <div className="flex items-center gap-2 shrink-0">
          {!editando && <span className="text-[11px] text-foreground/40">{formatDateTime(a.updatedAt)}</span>}
          {!editando && (
            <>
              <button type="button" onClick={() => setEditando(true)} title="Editar" aria-label="Editar atividade" className="text-foreground/40 hover:text-primary transition cursor-pointer"><Pencil className="w-4 h-4" /></button>
              <button type="button" onClick={excluir} disabled={pending} title="Excluir" aria-label="Excluir atividade" className="text-foreground/40 hover:text-red-600 transition cursor-pointer disabled:opacity-50"><Trash2 className="w-4 h-4" /></button>
            </>
          )}
        </div>
      </div>
      {editando ? (
        <div className="space-y-2">
          <textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} className={inputCls} placeholder="Descrição" />
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex items-center gap-2">
            <button type="button" onClick={salvar} disabled={pending} className="inline-flex items-center gap-1 bg-primary text-white px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-60 cursor-pointer"><Check className="w-3.5 h-3.5" /> {pending ? "Salvando…" : "Salvar"}</button>
            <button type="button" onClick={() => { setEditando(false); setTitulo(a.title); setDescricao(a.description); setErro(null); }} className="text-foreground/50 text-sm px-2 inline-flex items-center gap-1 cursor-pointer"><X className="w-3.5 h-3.5" /> Cancelar</button>
          </div>
        </div>
      ) : (
        a.description && <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{a.description}</p>
      )}
    </div>
  );
}

export function ActivitiesSection({ patientId, activities }: { patientId: string; activities: Atividade[] }) {
  const router = useRouter();
  const [adicionando, setAdicionando] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function adicionar() {
    setErro(null);
    if (!titulo.trim()) { setErro("Informe o título da atividade."); return; }
    start(async () => {
      const r = await createActivity(patientId, titulo, descricao);
      if (r.ok) { setTitulo(""); setDescricao(""); setAdicionando(false); router.refresh(); }
      else setErro(r.error ?? "Não deu para adicionar.");
    });
  }

  return (
    <div className="space-y-3">
      {adicionando ? (
        <div className="glass-card rounded-2xl p-4 space-y-2">
          <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título — nome da atividade ou ferramenta" className={inputCls} autoFocus />
          <textarea rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição — detalhamento da atividade realizada com o paciente" className={inputCls} />
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex items-center gap-2">
            <button type="button" onClick={adicionar} disabled={pending} className="bg-primary text-white px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-60 cursor-pointer">{pending ? "Salvando…" : "Salvar"}</button>
            <button type="button" onClick={() => { setAdicionando(false); setTitulo(""); setDescricao(""); setErro(null); }} className="text-foreground/50 text-sm px-2 cursor-pointer">Cancelar</button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setAdicionando(true)} className="flex items-center gap-2 text-primary font-semibold text-sm hover:underline cursor-pointer">
          <Plus className="w-4 h-4" /> Atividades
        </button>
      )}
      <p className="text-xs text-foreground/50">Registre as atividades e ferramentas realizadas com o paciente.</p>

      {activities.map((a) => <AtividadeItem key={a.id} a={a} />)}
    </div>
  );
}

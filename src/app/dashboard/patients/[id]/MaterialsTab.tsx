"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { FileText, Link2, Trash2, Plus } from "lucide-react";
import { shareMaterial, listMaterials, deleteMaterial } from "./materials-actions";

type Material = { id: string; title: string; kind: string; content: string; at: string };

export function MaterialsTab({ patientId }: { patientId: string }) {
  const [items, setItems] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"text" | "link">("text");
  const [content, setContent] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const load = useCallback(async () => { setItems(await listMaterials(patientId)); setLoading(false); }, [patientId]);
  useEffect(() => { load(); }, [load]);

  const submit = () => {
    setErr(null);
    start(async () => {
      const r = await shareMaterial(patientId, title, kind, content);
      if (r.ok) { setTitle(""); setContent(""); setShow(false); await load(); }
      else setErr(r.error ?? "Falha.");
    });
  };
  const remove = (id: string) => start(async () => { await deleteMaterial(id); await load(); });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-foreground/50">Materiais e orientações que o paciente vê no app.</p>
        {!show && <button onClick={() => setShow(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary"><Plus className="w-4 h-4" /> Compartilhar</button>}
      </div>

      {show && (
        <div className="glass-card rounded-2xl p-4 space-y-3">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título" className="w-full px-3 py-2 rounded-xl bg-surface border border-border outline-none text-sm" />
          <div className="flex gap-2">
            <button onClick={() => setKind("text")} className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${kind === "text" ? "bg-primary text-white" : "bg-surface text-foreground/60"}`}><FileText className="w-4 h-4 inline mr-1" />Texto</button>
            <button onClick={() => setKind("link")} className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${kind === "link" ? "bg-primary text-white" : "bg-surface text-foreground/60"}`}><Link2 className="w-4 h-4 inline mr-1" />Link</button>
          </div>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={kind === "link" ? "https://…" : "Escreva a orientação/material…"} rows={kind === "link" ? 1 : 4} className="w-full px-3 py-2 rounded-xl bg-surface border border-border outline-none text-sm" />
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-2">
            <button onClick={() => setShow(false)} className="px-3 py-2 text-sm text-foreground/50">Cancelar</button>
            <button onClick={submit} disabled={pending} className="flex-1 bg-primary text-white py-2 rounded-xl text-sm font-bold disabled:opacity-60">{pending ? "Enviando…" : "Compartilhar com o paciente"}</button>
          </div>
        </div>
      )}

      {loading ? <p className="text-sm text-foreground/40">Carregando…</p> : items.length === 0 ? (
        <p className="text-sm text-foreground/40 text-center py-8">Nenhum material compartilhado ainda.</p>
      ) : (
        <div className="space-y-2">
          {items.map((m) => (
            <div key={m.id} className="glass-card rounded-2xl p-3 flex items-start gap-3">
              {m.kind === "link" ? <Link2 className="w-4 h-4 text-primary mt-0.5 shrink-0" /> : <FileText className="w-4 h-4 text-primary mt-0.5 shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm text-primary">{m.title}</p>
                <p className="text-xs text-foreground/50 truncate">{m.content}</p>
              </div>
              <button onClick={() => remove(m.id)} className="text-foreground/30 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

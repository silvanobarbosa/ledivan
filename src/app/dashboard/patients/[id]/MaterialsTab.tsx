"use client";

import { useEffect, useState, useTransition, useCallback } from "react";
import { FileText, Link2, Trash2, Plus, Paperclip, Download } from "lucide-react";
import { shareMaterial, listMaterials, deleteMaterial, uploadMaterialFile } from "./materials-actions";

type Material = { id: string; title: string; kind: string; content: string; at: string };

export function MaterialsTab({ patientId }: { patientId: string }) {
  const [items, setItems] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"text" | "link" | "file">("text");
  const [content, setContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const load = useCallback(async () => { setItems(await listMaterials(patientId)); setLoading(false); }, [patientId]);
  useEffect(() => { load(); }, [load]);

  const submit = () => {
    setErr(null);
    start(async () => {
      let r: { ok: boolean; error?: string };
      if (kind === "file") {
        if (!file) { setErr("Escolha um arquivo."); return; }
        const fd = new FormData();
        fd.set("patientId", patientId); fd.set("title", title); fd.set("file", file);
        r = await uploadMaterialFile(fd);
      } else {
        r = await shareMaterial(patientId, title, kind, content);
      }
      if (r.ok) { setTitle(""); setContent(""); setFile(null); setShow(false); await load(); }
      else setErr(r.error ?? "Falha.");
    });
  };
  const remove = (id: string) => start(async () => { await deleteMaterial(id); await load(); });

  // Arquivo privado: pede uma URL assinada (5 min) e abre.
  const openFile = async (id: string) => {
    try {
      const res = await fetch(`/api/files/${id}`);
      const d = await res.json();
      if (d.ok && d.url) window.open(d.url, "_blank");
      else alert(d.error || "Não foi possível abrir o arquivo.");
    } catch { alert("Não foi possível abrir o arquivo."); }
  };

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
            <button onClick={() => setKind("file")} className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${kind === "file" ? "bg-primary text-white" : "bg-surface text-foreground/60"}`}><Paperclip className="w-4 h-4 inline mr-1" />Arquivo</button>
          </div>
          {kind === "file" ? (
            <div>
              <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp,image/gif,image/heic" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="w-full text-sm file:mr-3 file:px-3 file:py-1.5 file:rounded-xl file:border-0 file:bg-primary/10 file:text-primary file:font-semibold" />
              <p className="text-[11px] text-foreground/40 mt-1">PDF ou imagem, até 15MB. O arquivo fica privado — só você e o paciente acessam.</p>
            </div>
          ) : (
            <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={kind === "link" ? "https://…" : "Escreva a orientação/material…"} rows={kind === "link" ? 1 : 4} className="w-full px-3 py-2 rounded-xl bg-surface border border-border outline-none text-sm" />
          )}
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
              {m.kind === "link" ? <Link2 className="w-4 h-4 text-primary mt-0.5 shrink-0" /> : m.kind === "file" ? <Paperclip className="w-4 h-4 text-primary mt-0.5 shrink-0" /> : <FileText className="w-4 h-4 text-primary mt-0.5 shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm text-primary">{m.title}</p>
                <p className="text-xs text-foreground/50 truncate">{m.kind === "file" ? "Arquivo anexado" : m.content}</p>
              </div>
              {m.kind === "file" && <button onClick={() => openFile(m.id)} title="Abrir arquivo" className="text-foreground/40 hover:text-primary"><Download className="w-4 h-4" /></button>}
              <button onClick={() => remove(m.id)} className="text-foreground/30 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

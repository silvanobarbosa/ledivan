"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { formatDateTime } from "@/lib/therapy";
import { AnexosDoRegistro } from "./AnexosDoRegistro";
import { deleteRecord, editRecord } from "../actions";

/**
 * Um registro do histórico, com os ícones de editar e excluir (doc 33).
 *
 * - Lixeira: exclui o registro.
 * - Lápis: edita o título e a descrição. Ao salvar, a data/hora passa a ser o momento da edição
 *   (quem cuida disso é `editRecord`).
 */
const RECORD_TYPE_LABELS: Record<string, string> = { evolucao: "Evolução", anamnese: "Anamnese", nota: "Nota", registro: "Registro" };
const inputCls = "w-full px-4 py-2.5 rounded-xl bg-white/70 border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm";

type Registro = { id: string; type: string; title: string | null; content: string; createdAt: Date | string };

export function RegistroItem({ patientId, r }: { patientId: string; r: Registro }) {
  const [editando, setEditando] = useState(false);
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function salvar(fd: FormData) {
    setErro(null);
    start(async () => {
      try { await editRecord(r.id, fd); setEditando(false); }
      catch (e) { setErro(e instanceof Error ? e.message : "Não deu para salvar."); }
    });
  }

  return (
    <div className="glass-card rounded-2xl p-5 group">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-[#f3e8ff] text-primary">{RECORD_TYPE_LABELS[r.type] || r.type}</span>
          {r.title && !editando && <span className="text-sm font-semibold">{r.title}</span>}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground/40">{formatDateTime(r.createdAt)}</span>
          {!editando && (
            <button type="button" onClick={() => setEditando(true)} title="Editar registro" aria-label="Editar registro" className="opacity-0 group-hover:opacity-100 text-foreground/30 hover:text-primary transition cursor-pointer">
              <Pencil className="w-4 h-4" />
            </button>
          )}
          <form action={deleteRecord.bind(null, r.id)}>
            <button className="opacity-0 group-hover:opacity-100 text-foreground/30 hover:text-red-600 transition cursor-pointer" title="Excluir registro" aria-label="Excluir registro">
              <Trash2 className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>

      {editando ? (
        <form action={salvar} className="space-y-2">
          <input name="title" defaultValue={r.title ?? ""} className={inputCls} placeholder="Título (opcional)" />
          <textarea name="content" defaultValue={r.content} rows={5} required className={inputCls} />
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex items-center gap-2">
            <button type="submit" disabled={pending} className="bg-primary text-white px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-60 cursor-pointer">
              {pending ? "Salvando…" : "Salvar alterações"}
            </button>
            <button type="button" onClick={() => { setEditando(false); setErro(null); }} className="text-foreground/50 text-sm px-2 cursor-pointer inline-flex items-center gap-1">
              <X className="w-3.5 h-3.5" /> Cancelar
            </button>
          </div>
        </form>
      ) : (
        <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{r.content}</p>
      )}

      <AnexosDoRegistro patientId={patientId} recordId={r.id} />
    </div>
  );
}

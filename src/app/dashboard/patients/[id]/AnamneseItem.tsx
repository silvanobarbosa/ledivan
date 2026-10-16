"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, X, Check } from "lucide-react";
import { formatDateTime } from "@/lib/therapy";
import { createAnamnese, updateAnamnese, deleteAnamnese } from "../actions";

const inputCls = "w-full px-4 py-2.5 rounded-xl bg-white/70 border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm";

export type CampoAnamnese = {
  id: string | null; // null = campo padrão ainda não salvo
  title: string;
  content: string;
  custom: boolean;
  updatedAt: string | null;
};

/**
 * Um campo da anamnese, com Salvar e Editar PRÓPRIOS (doc 33).
 *
 * - Campo nunca salvo (id null): já abre editável, com Salvar.
 * - Campo salvo: mostra o conteúdo + a data/hora da última alteração + Editar.
 * - Campo personalizado: ganha também a lixeira.
 */
export function AnamneseItem({ patientId, campo }: { patientId: string; campo: CampoAnamnese }) {
  const router = useRouter();
  const [editando, setEditando] = useState(campo.id === null);
  const [valor, setValor] = useState(campo.content);
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function salvar() {
    setErro(null);
    start(async () => {
      const r = campo.id === null
        ? await createAnamnese(patientId, campo.title, valor, campo.custom)
        : await updateAnamnese(campo.id, valor);
      if (r.ok) { setEditando(false); router.refresh(); }
      else setErro(r.error ?? "Não deu para salvar.");
    });
  }

  function excluir() {
    if (!campo.id) return;
    if (!confirm("Excluir este campo da anamnese? Esta ação não pode ser desfeita.")) return;
    start(async () => {
      const r = await deleteAnamnese(campo.id!);
      if (r.ok) router.refresh();
      else setErro(r.error ?? "Não deu para excluir.");
    });
  }

  return (
    <div className="glass-card rounded-2xl p-4 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-primary">{campo.title}</p>
        <div className="flex items-center gap-2 shrink-0">
          {campo.updatedAt && !editando && <span className="text-[11px] text-foreground/40">{formatDateTime(campo.updatedAt)}</span>}
          {!editando && (
            <button type="button" onClick={() => setEditando(true)} title="Editar" aria-label="Editar campo" className="text-foreground/40 hover:text-primary transition cursor-pointer">
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {campo.custom && campo.id && !editando && (
            <button type="button" onClick={excluir} disabled={pending} title="Excluir campo" aria-label="Excluir campo" className="text-foreground/40 hover:text-red-600 transition cursor-pointer disabled:opacity-50">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {editando ? (
        <div className="space-y-2">
          {/* Sem autoFocus (doc 36): os campos padrão não salvos já abrem editáveis, então vários
              textareas disputavam o foco e o navegador rolava até o ÚLTIMO ao abrir a guia Anamnese
              ("jogada pro último campo"). Quem clica no lápis já está olhando o campo certo. */}
          <textarea rows={3} value={valor} onChange={(e) => setValor(e.target.value)} className={inputCls} placeholder="Escreva aqui…" />
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex items-center gap-2">
            <button type="button" onClick={salvar} disabled={pending} className="inline-flex items-center gap-1 bg-primary text-white px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-60 cursor-pointer">
              <Check className="w-3.5 h-3.5" /> {pending ? "Salvando…" : "Salvar"}
            </button>
            {campo.id && (
              <button type="button" onClick={() => { setEditando(false); setValor(campo.content); setErro(null); }} className="text-foreground/50 text-sm px-2 inline-flex items-center gap-1 cursor-pointer">
                <X className="w-3.5 h-3.5" /> Cancelar
              </button>
            )}
          </div>
        </div>
      ) : (
        <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{campo.content || <span className="text-foreground/30">—</span>}</p>
      )}
    </div>
  );
}

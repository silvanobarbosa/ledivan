"use client";

import { useState } from "react";
import { Plus, Copy, Check, Trash2, Paperclip, MessageCircle, Smile } from "lucide-react";
import { createAssignment, deleteAssignment, commentAssignment, ensureMoodToken } from "../actions";
import { formatDate } from "@/lib/therapy";
import { MoodChart } from "./MoodChart";

type Mood = { id: string; mood: number; note: string | null; loggedAt: string };

type Assignment = {
  id: string; token: string; title: string; instructions: string | null;
  responseType: string; status: string; dueDate: string | null;
  responseText: string | null; responseFileUrl: string | null; responseFileType: string | null;
  respondedAt: string | null; therapistComment: string | null;
};

const inputCls = "w-full px-4 py-2.5 rounded-xl bg-white/70 border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm";
const TYPE_LABELS: Record<string, string> = { texto: "Texto", foto: "Foto", audio: "Áudio", video: "Vídeo", livre: "Livre (texto + mídia)" };

export function AssignmentsTab({
  patientId, assignments, moodToken, moodLogs,
}: {
  patientId: string; assignments: Assignment[]; moodToken: string | null; moodLogs: Mood[];
}) {
  const [showNew, setShowNew] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [moodCopied, setMoodCopied] = useState(false);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const copyLink = (token: string, id: string) => {
    navigator.clipboard.writeText(`${origin}/p/${token}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="space-y-6">
      {/* Diário de humor */}
      <div className="glass-card rounded-[24px] p-5 space-y-3">
        <p className="font-semibold text-primary flex items-center gap-2"><Smile className="w-4 h-4" /> Diário de humor</p>
        {!moodToken ? (
          <form action={ensureMoodToken.bind(null, patientId)}>
            <button className="bg-primary text-white py-2 px-4 rounded-xl font-bold text-sm">Ativar diário de humor</button>
            <p className="text-xs text-foreground/40 mt-2">Gera um link para o paciente registrar o humor quando quiser.</p>
          </form>
        ) : (
          <>
            <button
              onClick={() => { navigator.clipboard.writeText(`${origin}/humor/${moodToken}`); setMoodCopied(true); setTimeout(() => setMoodCopied(false), 1500); }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              {moodCopied ? <><Check className="w-3.5 h-3.5 text-[#047857]" /> Link copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar link do diário de humor</>}
            </button>
            <MoodChart logs={moodLogs} />
          </>
        )}
      </div>

      {/* Tarefas */}
      <button onClick={() => setShowNew((s) => !s)} className="flex items-center gap-2 text-primary font-semibold text-sm hover:underline">
        <Plus className="w-4 h-4" /> Nova tarefa
      </button>

      {showNew && (
        <form action={createAssignment.bind(null, patientId)} className="glass-card rounded-[24px] p-5 space-y-3">
          <input name="title" required placeholder="Título (ex: Diário da semana)" className={inputCls} />
          <textarea name="instructions" rows={3} placeholder="Instruções para o paciente..." className={inputCls} />
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-foreground/60">Tipo de resposta</label>
              <select name="responseType" className={inputCls} defaultValue="livre">
                <option value="texto">Texto</option>
                <option value="foto">Foto (ex: desenho)</option>
                <option value="audio">Áudio</option>
                <option value="video">Vídeo</option>
                <option value="livre">Livre (texto + mídia)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-foreground/60">Prazo (opcional)</label>
              <input name="dueDate" type="date" className={inputCls} />
            </div>
          </div>
          <button className="bg-primary text-white py-2.5 px-5 rounded-xl font-bold">Criar e gerar link</button>
        </form>
      )}

      {assignments.length === 0 ? (
        <p className="text-sm text-foreground/40 py-4 text-center">Nenhuma tarefa ainda.</p>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => (
            <div key={a.id} className="glass-card rounded-2xl p-5 group space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{a.title}</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-surface text-foreground/50">{TYPE_LABELS[a.responseType] ?? a.responseType}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${a.status === "respondida" ? "bg-[#ecfdf5] text-[#047857]" : "bg-[#fffbeb] text-[#b45309]"}`}>
                    {a.status === "respondida" ? "Respondida" : "Pendente"}
                  </span>
                </div>
                <form action={deleteAssignment.bind(null, a.id)}>
                  <button className="opacity-0 group-hover:opacity-100 text-foreground/30 hover:text-red-600 transition" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                </form>
              </div>

              {a.instructions && <p className="text-sm text-foreground/60">{a.instructions}</p>}
              {a.dueDate && <p className="text-xs text-foreground/40">Prazo: {formatDate(a.dueDate)}</p>}

              {/* Link do paciente */}
              <button onClick={() => copyLink(a.token, a.id)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                {copiedId === a.id ? <><Check className="w-3.5 h-3.5 text-[#047857]" /> Link copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar link do paciente</>}
              </button>

              {/* Resposta */}
              {a.status === "respondida" && (
                <div className="rounded-xl bg-surface/60 border border-border p-3 space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Resposta {a.respondedAt ? `· ${formatDate(a.respondedAt)}` : ""}</p>
                  {a.responseText && <p className="text-sm text-foreground/80 whitespace-pre-wrap">{a.responseText}</p>}
                  {a.responseFileUrl && (
                    <a href={a.responseFileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                      <Paperclip className="w-3.5 h-3.5" /> Ver anexo {a.responseFileType?.startsWith("audio") ? "(áudio)" : a.responseFileType?.startsWith("video") ? "(vídeo)" : a.responseFileType?.startsWith("image") ? "(imagem)" : ""}
                    </a>
                  )}
                  {a.responseFileType?.startsWith("image") && a.responseFileUrl && (
                    <img src={a.responseFileUrl} alt="Anexo do paciente" className="rounded-lg max-h-60 mt-1" />
                  )}
                  {a.responseFileType?.startsWith("audio") && a.responseFileUrl && (
                    <audio controls src={a.responseFileUrl} className="w-full mt-1" />
                  )}

                  {/* Comentário do terapeuta */}
                  <form action={async (fd: FormData) => { await commentAssignment(a.id, fd.get("comment") as string); }} className="flex gap-2 pt-1">
                    <input name="comment" defaultValue={a.therapistComment ?? ""} placeholder="Seu comentário..." className="flex-1 px-3 py-2 rounded-lg bg-white border border-border text-sm outline-none focus:border-accent" />
                    <button className="text-primary" title="Salvar comentário"><MessageCircle className="w-4 h-4" /></button>
                  </form>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Copy, Check, Trash2, Paperclip, MessageCircle, Smile, Pencil, Undo2, X } from "lucide-react";
import { createAssignment, deleteAssignment, commentAssignment, editAssignment, ensureMoodToken, createScale, deleteScale, clearMoodToken, undoLastScale } from "../actions";
import { formatDate } from "@/lib/therapy";
import { MoodChart } from "./MoodChart";
import { ScaleHistory } from "./ScaleHistory";
import { ActivitiesSection, type Atividade } from "./ActivitiesSection";
import { MaterialsTab } from "./MaterialsTab";
import { SCALES, severityColor } from "@/lib/scales";
import { TCC_TEMPLATES } from "@/lib/tccTemplates";

type Mood = { id: string; mood: number; note: string | null; loggedAt: string };
type ScaleApp = { id: string; token: string; scaleType: string; status: string; score: number | null; severity: string | null; appliedAt: string | null };

type Assignment = {
  id: string; token: string; title: string; instructions: string | null;
  responseType: string; status: string; dueDate: string | null;
  responseText: string | null; responseFileUrl: string | null; responseFileType: string | null;
  respondedAt: string | null; therapistComment: string | null;
};

const inputCls = "w-full px-4 py-2.5 rounded-xl bg-white/70 border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm";
const TYPE_LABELS: Record<string, string> = { texto: "Texto", foto: "Foto", audio: "Áudio", video: "Vídeo", livre: "Livre (texto + mídia)" };

/** Botão Desfazer (doc 33): reverte a última ação (ex.: gerar link) sem apagar os dados anteriores. */
function Desfazer({ onUndo, title }: { onUndo: () => Promise<{ ok: boolean; error?: string }>; title: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => start(async () => { const r = await onUndo(); if (r.ok) router.refresh(); else setErro(r.error ?? "Não deu para desfazer."); })}
        disabled={pending}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground/50 hover:text-foreground disabled:opacity-50 cursor-pointer"
        title={title}
      >
        <Undo2 className="w-3.5 h-3.5" /> Desfazer
      </button>
      {erro && <span className="text-[11px] text-red-600">{erro}</span>}
    </span>
  );
}

export function AssignmentsTab({
  patientId, assignments, moodToken, moodLogs, scales, activities,
}: {
  patientId: string; assignments: Assignment[]; moodToken: string | null; moodLogs: Mood[]; scales: ScaleApp[]; activities: Atividade[];
}) {
  const router = useRouter();
  const [showNew, setShowNew] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [moodCopied, setMoodCopied] = useState(false);
  const [scaleCopiedId, setScaleCopiedId] = useState<string | null>(null);
  // form de novo exercício (controlado, p/ modelos TCC preencherem)
  const [tTitle, setTTitle] = useState("");
  const [tInstr, setTInstr] = useState("");
  const [tType, setTType] = useState("livre");
  // edição inline de exercício
  const [editId, setEditId] = useState<string | null>(null);
  const [ePending, eStart] = useTransition();
  const [eErro, setEErro] = useState<string | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const temPendente = scales.some((s) => s.status !== "respondida");

  const copyLink = (token: string, id: string) => {
    navigator.clipboard.writeText(`${origin}/p/${token}`);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  function salvarEdicao(fd: FormData) {
    if (!editId) return;
    setEErro(null);
    eStart(async () => {
      const r = await editAssignment(editId, fd);
      if (r.ok) { setEditId(null); router.refresh(); }
      else setEErro(r.error ?? "Não deu para salvar.");
    });
  }

  return (
    <div className="space-y-6">
      {/* 1. + Atividades (realizadas com o paciente) */}
      <ActivitiesSection patientId={patientId} activities={activities} />

      {/* 2. Diário de humor (com Desfazer) */}
      <div className="glass-card rounded-[24px] p-5 space-y-3">
        <p className="font-semibold text-primary flex items-center gap-2"><Smile className="w-4 h-4" /> Diário de humor</p>
        {!moodToken ? (
          <form action={ensureMoodToken.bind(null, patientId)}>
            <button className="bg-primary text-white py-2 px-4 rounded-xl font-bold text-sm">Ativar diário de humor</button>
            <p className="text-xs text-foreground/40 mt-2">Gera um link para o paciente registrar o humor quando quiser.</p>
          </form>
        ) : (
          <>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => { navigator.clipboard.writeText(`${origin}/humor/${moodToken}`); setMoodCopied(true); setTimeout(() => setMoodCopied(false), 1500); }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
              >
                {moodCopied ? <><Check className="w-3.5 h-3.5 text-[#047857]" /> Link copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar link do diário de humor</>}
              </button>
              {/* Desfazer a ativação (link gerado por engano). Os humores já registrados ficam. */}
              <Desfazer onUndo={() => clearMoodToken(patientId)} title="Desfazer a ativação do diário de humor" />
            </div>
            <MoodChart logs={moodLogs} />
          </>
        )}
      </div>

      {/* 3. Escala do desfecho (com Desfazer) */}
      <div className="glass-card rounded-[24px] p-5 space-y-3">
        <p className="font-semibold text-primary">Escalas de desfecho</p>
        <p className="text-xs text-foreground/40">Aplique escalas validadas e acompanhe a evolução. Não substitui avaliação clínica.</p>
        <div className="flex flex-wrap items-center gap-2">
          <form action={createScale.bind(null, patientId, "phq9")}>
            <button className="bg-primary text-white py-2 px-4 rounded-xl font-bold text-sm">+ PHQ-9 (depressão)</button>
          </form>
          <form action={createScale.bind(null, patientId, "gad7")}>
            <button className="bg-primary text-white py-2 px-4 rounded-xl font-bold text-sm">+ GAD-7 (ansiedade)</button>
          </form>
          {/* Desfazer o último link de escala gerado por engano (remove a escala pendente mais recente). */}
          {temPendente && <Desfazer onUndo={() => undoLastScale(patientId)} title="Desfazer o último link de escala gerado" />}
        </div>

        {scales.some((s) => s.status === "respondida") && <ScaleHistory apps={scales} />}

        {scales.length > 0 && (
          <div className="space-y-2 pt-1">
            {scales.map((s) => {
              const scale = SCALES[s.scaleType as "phq9" | "gad7"];
              return (
                <div key={s.id} className="flex items-center justify-between gap-3 text-sm bg-surface/50 border border-border rounded-xl px-3 py-2 group">
                  <span className="font-semibold">{scale?.short ?? s.scaleType}</span>
                  {s.status === "respondida" ? (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${severityColor(scale.severity(s.score ?? 0).tone)}`}>
                      {s.score}/{scale.max} · {s.severity} · {formatDate(s.appliedAt)}
                    </span>
                  ) : (
                    <button
                      onClick={() => { navigator.clipboard.writeText(`${origin}/escala/${s.token}`); setScaleCopiedId(s.id); setTimeout(() => setScaleCopiedId(null), 1500); }}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                    >
                      {scaleCopiedId === s.id ? <><Check className="w-3.5 h-3.5 text-[#047857]" /> Link copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar link (pendente)</>}
                    </button>
                  )}
                  <form action={deleteScale.bind(null, s.id)}>
                    <button className="opacity-0 group-hover:opacity-100 text-foreground/30 hover:text-red-600 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 4. + Exercícios (ex-Tarefas) */}
      <div className="space-y-3">
        <button onClick={() => setShowNew((s) => !s)} className="flex items-center gap-2 text-primary font-semibold text-sm hover:underline">
          <Plus className="w-4 h-4" /> Exercícios
        </button>
        <p className="text-xs text-foreground/50 -mt-1">Envie exercícios para o paciente.</p>

        {showNew && (
          <form action={createAssignment.bind(null, patientId)} className="glass-card rounded-[24px] p-5 space-y-3">
            <div>
              <p className="text-xs font-semibold text-foreground/60 mb-2">Modelos TCC (clique para preencher)</p>
              <div className="flex flex-wrap gap-2">
                {TCC_TEMPLATES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => { setTTitle(t.title); setTInstr(t.instructions); setTType(t.responseType); }}
                    className="text-xs font-semibold px-3 py-1.5 rounded-full bg-secondary-container/30 text-primary hover:bg-secondary-container/50 transition"
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <input name="title" required value={tTitle} onChange={(e) => setTTitle(e.target.value)} placeholder="Título (ex: Diário da semana)" className={inputCls} />
            <textarea name="instructions" rows={4} value={tInstr} onChange={(e) => setTInstr(e.target.value)} placeholder="Instruções para o paciente..." className={inputCls} />
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-foreground/60">Tipo de resposta</label>
                <select name="responseType" className={inputCls} value={tType} onChange={(e) => setTType(e.target.value)}>
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
          <p className="text-sm text-foreground/40 py-4 text-center">Nenhum exercício ainda.</p>
        ) : (
          <div className="space-y-3">
            {assignments.map((a) => (
              <div key={a.id} className="glass-card rounded-2xl p-5 group space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {editId === a.id ? null : <span className="font-semibold">{a.title}</span>}
                    {editId !== a.id && <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase bg-surface text-foreground/50">{TYPE_LABELS[a.responseType] ?? a.responseType}</span>}
                    {editId !== a.id && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${a.status === "respondida" ? "bg-[#ecfdf5] text-[#047857]" : "bg-[#fffbeb] text-[#b45309]"}`}>
                        {a.status === "respondida" ? "Respondida" : "Pendente"}
                      </span>
                    )}
                  </div>
                  {editId !== a.id && (
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => { setEditId(a.id); setEErro(null); }} className="opacity-0 group-hover:opacity-100 text-foreground/30 hover:text-primary transition cursor-pointer" title="Editar"><Pencil className="w-4 h-4" /></button>
                      <form action={deleteAssignment.bind(null, a.id)}>
                        <button className="opacity-0 group-hover:opacity-100 text-foreground/30 hover:text-red-600 transition" title="Excluir"><Trash2 className="w-4 h-4" /></button>
                      </form>
                    </div>
                  )}
                </div>

                {editId === a.id ? (
                  <form action={salvarEdicao} className="space-y-2">
                    <input name="title" defaultValue={a.title} required className={inputCls} placeholder="Título" />
                    <textarea name="instructions" defaultValue={a.instructions ?? ""} rows={3} className={inputCls} placeholder="Instruções" />
                    {eErro && <p className="text-sm text-red-600">{eErro}</p>}
                    <div className="flex items-center gap-2">
                      <button type="submit" disabled={ePending} className="inline-flex items-center gap-1 bg-primary text-white px-4 py-2 rounded-xl font-bold text-sm disabled:opacity-60 cursor-pointer"><Check className="w-3.5 h-3.5" /> {ePending ? "Salvando…" : "Salvar"}</button>
                      <button type="button" onClick={() => { setEditId(null); setEErro(null); }} className="text-foreground/50 text-sm px-2 inline-flex items-center gap-1 cursor-pointer"><X className="w-3.5 h-3.5" /> Cancelar</button>
                    </div>
                  </form>
                ) : (
                  <>
                    {a.instructions && <p className="text-sm text-foreground/60">{a.instructions}</p>}
                    {a.dueDate && <p className="text-xs text-foreground/40">Prazo: {formatDate(a.dueDate)}</p>}

                    <button onClick={() => copyLink(a.token, a.id)} className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                      {copiedId === a.id ? <><Check className="w-3.5 h-3.5 text-[#047857]" /> Link copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar link do paciente</>}
                    </button>

                    {a.status === "respondida" && (
                      <div className="rounded-xl bg-surface/60 border border-border p-3 space-y-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Resposta {a.respondedAt ? `· ${formatDate(a.respondedAt)}` : ""}</p>
                        {a.responseText && <p className="text-sm text-foreground/80 whitespace-pre-wrap">{a.responseText}</p>}
                        {a.responseFileUrl && (
                          <a href={`/api/attachment/${a.id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
                            <Paperclip className="w-3.5 h-3.5" /> Ver anexo {a.responseFileType?.startsWith("audio") ? "(áudio)" : a.responseFileType?.startsWith("video") ? "(vídeo)" : a.responseFileType?.startsWith("image") ? "(imagem)" : ""}
                          </a>
                        )}
                        {a.responseFileType?.startsWith("image") && a.responseFileUrl && (
                          // eslint-disable-next-line @next/next/no-img-element -- anexo servido pela API, sem dimensão conhecida em tempo de build.
                          <img src={`/api/attachment/${a.id}`} alt="Anexo do paciente" className="rounded-lg max-h-60 mt-1" />
                        )}
                        {a.responseFileType?.startsWith("audio") && a.responseFileUrl && (
                          <audio controls src={`/api/attachment/${a.id}`} className="w-full mt-1" />
                        )}

                        <form action={async (fd: FormData) => { await commentAssignment(a.id, fd.get("comment") as string); }} className="flex gap-2 pt-1">
                          <input name="comment" defaultValue={a.therapistComment ?? ""} placeholder="Seu comentário..." className="flex-1 px-3 py-2 rounded-lg bg-white border border-border text-sm outline-none focus:border-accent" />
                          <button className="text-primary" title="Salvar comentário"><MessageCircle className="w-4 h-4" /></button>
                        </form>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. + Material (conteúdo da antiga guia Materiais + compartilhar) */}
      <div className="space-y-2">
        <p className="font-semibold text-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Material</p>
        <p className="text-xs text-foreground/50 -mt-1">Materiais e orientações que o paciente vê no app.</p>
        <MaterialsTab patientId={patientId} />
      </div>
    </div>
  );
}

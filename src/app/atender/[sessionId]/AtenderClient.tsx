"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Video, MapPin, ArrowLeftRight, ExternalLink, Check, Loader2, X, FileText, Stethoscope } from "lucide-react";
import { JitsiRoom } from "@/components/dashboard/JitsiRoom";
import { MobileSidebar } from "@/components/dashboard/MobileSidebar";
import { createRecord } from "@/app/dashboard/patients/actions";
import { updateSessionStatus, setSessionOnline } from "@/app/dashboard/sessions/actions";

type S = { id: string; patientId: string; patientName: string; date: string; duration: number; isOnline: boolean; location: string | null; status: string };
type Rec = { id: string; type: string; title: string | null; content: string; createdAt: string };
type Meeting = { domain: string; room: string; jwt: string | null };

const REC_LABEL: Record<string, string> = { evolucao: "Evolução", anamnese: "Anamnese", nota: "Nota" };

export function AtenderClient({ session, records, meeting, therapistName }: { session: S; records: Rec[]; meeting: Meeting; therapistName: string }) {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [online, setOnline] = useState(session.isOnline);
  const [note, setNote] = useState("");
  const [recs, setRecs] = useState<Rec[]>(records);
  const [pending, start] = useTransition();
  const [patientOpen, setPatientOpen] = useState(false);

  const dt = new Date(session.date).toLocaleString("pt-BR", { weekday: "long", day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });

  function saveNote() {
    const content = note.trim();
    if (!content) return;
    start(async () => {
      const fd = new FormData();
      fd.set("content", content); fd.set("type", "evolucao");
      await createRecord(session.patientId, fd);
      setRecs((p) => [{ id: Math.random().toString(36), type: "evolucao", title: null, content, createdAt: new Date().toISOString() }, ...p]);
      setNote("");
    });
  }
  function toggleOnline() {
    start(async () => { await setSessionOnline(session.id, !online); setOnline(!online); });
  }
  function finalizar() {
    start(async () => { await updateSessionStatus(session.id, "realizada"); router.push("/dashboard/agenda"); });
  }

  // --- Confirmação: "Vamos atender?" ---
  if (!started) {
    return (
      <div className="min-h-screen bg-ornaments flex items-center justify-center p-4">
        <div className="glass-card-lg w-full max-w-md p-8 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center"><Stethoscope className="w-7 h-7" /></div>
          <h1 className="font-display text-2xl font-bold text-primary">Vamos atender?</h1>
          <p className="text-foreground/70">{session.patientName}</p>
          <p className="text-sm text-foreground/50 capitalize">{dt} · {session.duration}min</p>
          <p className="text-sm inline-flex items-center gap-1.5 justify-center">
            {online ? <><Video className="w-4 h-4 text-primary" /> Atendimento online</> : <><MapPin className="w-4 h-4 text-primary" /> Presencial{session.location ? ` · ${session.location}` : ""}</>}
          </p>
          <div className="flex gap-3 pt-2">
            <Link href="/dashboard/agenda" className="flex-1 py-3 rounded-2xl font-semibold text-foreground/60 hover:bg-white/60 transition">Voltar</Link>
            <button onClick={() => setStarted(true)} className="flex-1 bg-primary text-white py-3 rounded-2xl font-bold shadow-lg shadow-primary/20 active:scale-[0.98] transition">
              Sim, iniciar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Atendimento ---
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Barra superior */}
      <header className="h-16 bg-white/90 backdrop-blur border-b border-border flex items-center gap-3 px-4 shrink-0 z-20">
        <MobileSidebar />
        <button onClick={() => setPatientOpen(true)} className="p-2 rounded-xl hover:bg-surface transition text-foreground/70" title="Cadastro do paciente">
          <FileText className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-primary truncate leading-tight">{session.patientName}</p>
          <p className="text-[11px] text-foreground/40 capitalize truncate">{dt}</p>
        </div>
        <button onClick={toggleOnline} disabled={pending} className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl bg-surface hover:bg-surface-container transition disabled:opacity-60">
          <ArrowLeftRight className="w-4 h-4" /> {online ? "Converter p/ presencial" : "Converter p/ online"}
        </button>
        <button onClick={finalizar} disabled={pending} className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl bg-primary text-white disabled:opacity-60">
          <Check className="w-4 h-4" /> Finalizar
        </button>
      </header>

      {/* Conteúdo */}
      <div className="flex-1 flex flex-col min-h-0">
        {online && (
          <div className="h-[48vh] lg:h-[55vh] shrink-0 border-b border-border">
            <JitsiRoom roomName={meeting.room} displayName={therapistName} sessionId={session.id} domain={meeting.domain} jwt={meeting.jwt} inline onLeaveHref={`/atender/${session.id}`} />
          </div>
        )}

        {/* Prontuário */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          <div className="max-w-3xl mx-auto space-y-4">
            {!online && session.location && (
              <p className="text-sm text-foreground/60 inline-flex items-center gap-1.5"><MapPin className="w-4 h-4" /> {session.location}</p>
            )}
            <div className="glass-card rounded-[24px] p-5 space-y-3">
              <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Evolução da sessão</p>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={6} placeholder="Registre a evolução do atendimento…" className="w-full px-4 py-3 rounded-2xl bg-white/70 border border-border outline-none text-sm focus:border-accent resize-none" />
              <button onClick={saveNote} disabled={pending || !note.trim()} className="inline-flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50">
                {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Salvar evolução
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold text-foreground/40 uppercase tracking-widest">Registros anteriores</p>
              {recs.length === 0 ? <p className="text-sm text-foreground/40">Nenhum registro ainda.</p> : recs.map((r) => (
                <div key={r.id} className="glass-card rounded-2xl p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-foreground/40">{REC_LABEL[r.type] || r.type}{r.title ? ` · ${r.title}` : ""} · {new Date(r.createdAt).toLocaleDateString("pt-BR")}</p>
                  <p className="text-sm mt-1 whitespace-pre-wrap leading-relaxed">{r.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Drawer: cadastro do paciente */}
      {patientOpen && (
        <div className="fixed inset-0 z-[70] flex" onClick={() => setPatientOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <aside className="ml-auto relative w-[88%] max-w-md bg-white h-full shadow-2xl p-6 space-y-3 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-display text-lg font-bold text-primary">{session.patientName}</p>
              <button onClick={() => setPatientOpen(false)} className="p-1.5 rounded-lg hover:bg-surface"><X className="w-4 h-4" /></button>
            </div>
            <p className="text-sm text-foreground/50">Abra o cadastro completo numa nova aba (Dados, Prontuário, Atividades, Sessões, Pagamentos):</p>
            {["Dados", "Prontuário", "Atividades", "Sessões", "Pagamentos", "Linha do tempo", "Histórico"].map((t) => (
              <a key={t} href={`/dashboard/patients/${session.patientId}`} target="_blank" rel="noreferrer" className="flex items-center justify-between rounded-2xl border border-border px-4 py-3 hover:border-primary/30 transition">
                <span className="font-semibold text-sm">{t}</span>
                <ExternalLink className="w-4 h-4 text-foreground/40" />
              </a>
            ))}
          </aside>
        </div>
      )}
    </div>
  );
}

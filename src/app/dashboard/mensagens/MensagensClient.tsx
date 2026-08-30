"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, MessageCircle } from "lucide-react";
import { replyMessage } from "./actions";

export type ThreadMsg = { direction: string; text: string; channel: string; at: string };
export type Thread = { key: string; patientId: string | null; contact: string | null; name: string; messages: ThreadMsg[] };

export function MensagensClient({ threads }: { threads: Thread[] }) {
  const [sel, setSel] = useState<string | null>(threads[0]?.key ?? null);
  const [text, setText] = useState("");
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();
  const active = threads.find((t) => t.key === sel) ?? null;

  const fmt = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

  const send = () => {
    if (!active || !text.trim()) return;
    setErr(null);
    start(async () => {
      const r = await replyMessage({ patientId: active.patientId, contact: active.contact, text });
      if (r.ok) { setText(""); router.refresh(); } else setErr(r.error ?? "Falha.");
    });
  };

  if (!threads.length) {
    return (
      <div className="glass-card rounded-2xl p-10 text-center text-foreground/50">
        <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
        Nenhuma conversa ainda. As mensagens que os pacientes mandam pro seu WhatsApp aparecem aqui.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-4 h-[70vh]">
      <div className="glass-card rounded-2xl overflow-y-auto divide-y divide-border">
        {threads.map((t) => {
          const last = t.messages[t.messages.length - 1];
          return (
            <button key={t.key} onClick={() => setSel(t.key)} className={`w-full text-left p-3 hover:bg-surface transition ${sel === t.key ? "bg-surface" : ""}`}>
              <p className="font-semibold text-primary text-sm truncate">{t.name}</p>
              <p className="text-xs text-foreground/50 truncate">{last?.direction === "out" ? "Você: " : ""}{last?.text}</p>
            </button>
          );
        })}
      </div>

      <div className="glass-card rounded-2xl flex flex-col overflow-hidden">
        {active ? (
          <>
            <div className="border-b border-border p-3">
              <p className="font-bold text-primary">{active.name}</p>
              {active.contact && <p className="text-xs text-foreground/40">{active.contact}</p>}
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {active.messages.map((m, i) => (
                <div key={i} className={`flex ${m.direction === "out" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm whitespace-pre-line ${m.direction === "out" ? "bg-primary text-white" : "bg-surface text-foreground"}`}>
                    {m.text}
                    <span className={`block text-[10px] mt-1 ${m.direction === "out" ? "text-white/60" : "text-foreground/40"}`}>{fmt(m.at)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="border-t border-border p-3">
              {err && <p className="text-xs text-red-600 mb-1">{err}</p>}
              <div className="flex gap-2">
                <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} placeholder="Responder…" className="flex-1 px-3 py-2 rounded-xl bg-surface border border-border outline-none text-sm" />
                <button disabled={pending || !text.trim()} onClick={send} className="px-4 rounded-xl bg-primary text-white disabled:opacity-50"><Send className="w-4 h-4" /></button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-foreground/40">Selecione uma conversa</div>
        )}
      </div>
    </div>
  );
}

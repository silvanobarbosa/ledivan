"use client";

import { useState, useTransition } from "react";
import { MessageCircle, X, Send, Loader2, Phone, Mail } from "lucide-react";
import { sendPatientMessage } from "@/app/dashboard/patients/actions";

const CHANNELS = [
  { key: "whatsapp", label: "WhatsApp", icon: Phone },
  { key: "telegram", label: "Telegram", icon: Send },
  { key: "email", label: "E-mail", icon: Mail },
];

export function MessagePatient({ patient }: { patient: { id: string; name: string; phone: string | null; email: string | null } }) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);
  const [pending, start] = useTransition();

  function close() { setOpen(false); setChannel(null); setText(""); setResult(null); }

  function send() {
    if (!channel) return;
    setResult(null);
    start(async () => {
      const r = await sendPatientMessage(patient.id, channel, text);
      setResult(r);
      if (r.ok) setTimeout(close, 1200);
    });
  }

  return (
    <>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        title="Enviar mensagem"
        className="shrink-0 p-2.5 rounded-2xl bg-white border border-border text-primary hover:border-primary hover:bg-primary/5 transition"
      >
        <MessageCircle className="w-5 h-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/30 p-4" onClick={close}>
          <div className="bg-white rounded-[28px] p-6 w-full max-w-sm space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="font-display text-lg font-bold text-primary">Mensagem · {patient.name}</p>
              <button onClick={close} className="p-1.5 rounded-lg hover:bg-surface transition"><X className="w-4 h-4" /></button>
            </div>

            <div>
              <p className="text-xs font-semibold text-foreground/60 mb-1.5">Canal</p>
              <div className="grid grid-cols-3 gap-2">
                {CHANNELS.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setChannel(c.key)}
                    className={`flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-semibold transition ${channel === c.key ? "bg-primary text-white" : "bg-surface text-foreground/60 hover:bg-surface-container"}`}
                  >
                    <c.icon className="w-4 h-4" /> {c.label}
                  </button>
                ))}
              </div>
              {channel === "whatsapp" && !patient.phone && <p className="text-[11px] text-red-600 mt-1">Paciente sem telefone.</p>}
              {channel === "email" && !patient.email && <p className="text-[11px] text-red-600 mt-1">Paciente sem e-mail.</p>}
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={4}
              placeholder="Escreva a mensagem…"
              className="w-full px-4 py-3 rounded-2xl bg-surface border border-border outline-none text-sm resize-none focus:border-accent"
            />

            {result && (
              <p className={`text-sm ${result.ok ? "text-[#047857]" : "text-red-600"}`}>{result.ok ? "✅ Enviada!" : result.error}</p>
            )}

            <button
              onClick={send}
              disabled={pending || !channel || !text.trim()}
              className="w-full inline-flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-bold disabled:opacity-50"
            >
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Enviar
            </button>
          </div>
        </div>
      )}
    </>
  );
}

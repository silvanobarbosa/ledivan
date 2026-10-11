"use client";

import { useState, useEffect, useRef } from "react";
import { MessageCircle, Check, Loader2, RefreshCw } from "lucide-react";
import { connectWhatsapp, checkWhatsapp, disconnectWhatsapp } from "./actions";

export function WhatsappCard({ connected }: { connected: boolean }) {
  const [isConnected, setIsConnected] = useState(connected);
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (poll.current) clearInterval(poll.current); }, []);

  async function connect() {
    setLoading(true); setError(null); setQr(null);
    const res = await connectWhatsapp();
    setLoading(false);
    if (!res.ok) { setError(res.error || "Falha."); return; }
    if (res.qr) {
      setQr(res.qr);
      // poll estado até conectar
      poll.current = setInterval(async () => {
        const st = await checkWhatsapp();
        if (st.connected) {
          setIsConnected(true); setQr(null);
          if (poll.current) clearInterval(poll.current);
        }
      }, 3000);
    } else {
      // sem QR = já conectado
      const st = await checkWhatsapp();
      setIsConnected(st.connected);
    }
  }

  async function disconnect() {
    await disconnectWhatsapp();
    setIsConnected(false); setQr(null);
  }

  return (
    // Doc 29: mesmo layout dos demais cards do Ajustes (Telegram) — texto em cima, botão embaixo em
    // largura cheia. O botão do WhatsApp usa o verde do logo (#25D366). Ao conectar, vira "Conectado".
    <div className="glass-card rounded-[24px] p-6 space-y-3">
      <div>
        <h3 className="font-display font-bold text-primary">WhatsApp do seu consultório</h3>
        <p className="text-sm text-foreground/50 mt-1 leading-relaxed">
          Conecte seu número para enviar lembretes e mensagens aos pacientes <strong>pelo seu próprio WhatsApp</strong>.
        </p>
      </div>

      {isConnected ? (
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white px-4 py-2 rounded-xl" style={{ backgroundColor: "#25D366" }}>
            <Check className="w-4 h-4" /> Conectado
          </span>
          <button onClick={disconnect} className="text-sm font-semibold text-red-500/70 hover:text-red-600 shrink-0">Desconectar</button>
        </div>
      ) : (
        <button onClick={connect} disabled={loading} className="w-full text-white px-5 py-3 rounded-xl font-bold text-sm disabled:opacity-50 inline-flex items-center justify-center gap-2" style={{ backgroundColor: "#25D366" }}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />} {loading ? "Conectando…" : "Conectar"}
        </button>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {qr && !isConnected && (
        <div className="border-t border-border pt-4 flex flex-col items-center gap-3">
          <p className="text-sm font-semibold text-primary">Escaneie com o WhatsApp do seu celular</p>
          <ol className="text-xs text-foreground/60 space-y-0.5 self-start pl-4 list-decimal">
            <li>Abra o WhatsApp no celular</li>
            <li>Toque em <strong>⋮ → Aparelhos conectados → Conectar aparelho</strong></li>
            <li>Aponte a câmera para o QR abaixo</li>
          </ol>
          {/* eslint-disable-next-line @next/next/no-img-element -- QR em data URL gerado em runtime — next/image não otimiza data URL. */}
          <img src={qr} alt="QR Code WhatsApp" className="w-56 h-56 rounded-2xl border border-border" />
          <p className="text-xs text-foreground/40 flex items-center gap-1.5"><RefreshCw className="w-3 h-3 animate-spin" /> Aguardando conexão...</p>
        </div>
      )}
    </div>
  );
}

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
    <div className="p-8 bg-white rounded-[48px] shadow-sm border border-border space-y-4">
      <div className="flex items-start gap-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shrink-0" style={{ backgroundColor: "#25D366" }}>
          <MessageCircle className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h4 className="font-bold text-primary">WhatsApp do seu consultório</h4>
          <p className="text-sm text-foreground/50 mt-1 leading-relaxed">
            Conecte seu número para enviar lembretes e mensagens aos pacientes <strong>pelo seu próprio WhatsApp</strong>.
          </p>
          {isConnected && (
            <span className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold text-[#047857] bg-[#ecfdf5] px-3 py-1 rounded-full">
              <Check className="w-3.5 h-3.5" /> Conectado
            </span>
          )}
        </div>
        {isConnected ? (
          <button onClick={disconnect} className="text-sm font-semibold text-red-500/70 hover:text-red-600 shrink-0">Desconectar</button>
        ) : (
          <button onClick={connect} disabled={loading} className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm shrink-0 disabled:opacity-50 inline-flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />} Conectar
          </button>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {qr && !isConnected && (
        <div className="border-t border-border pt-4 flex flex-col items-center gap-3">
          <p className="text-sm font-semibold text-primary">Escaneie com o WhatsApp do seu celular</p>
          <ol className="text-xs text-foreground/60 space-y-0.5 self-start pl-4 list-decimal">
            <li>Abra o WhatsApp no celular</li>
            <li>Toque em <strong>⋮ → Aparelhos conectados → Conectar aparelho</strong></li>
            <li>Aponte a câmera para o QR abaixo</li>
          </ol>
          <img src={qr} alt="QR Code WhatsApp" className="w-56 h-56 rounded-2xl border border-border" />
          <p className="text-xs text-foreground/40 flex items-center gap-1.5"><RefreshCw className="w-3 h-3 animate-spin" /> Aguardando conexão...</p>
        </div>
      )}
    </div>
  );
}

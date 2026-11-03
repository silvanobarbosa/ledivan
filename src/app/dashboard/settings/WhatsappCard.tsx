"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { MessageCircle, Check, Loader2, RefreshCw } from "lucide-react";
import { connectWhatsapp, checkWhatsapp, disconnectWhatsapp, setIntegration } from "./actions";

/**
 * Doc 76: o Ajustes tinha DUAS áreas de WhatsApp — esta (conectar o aparelho pelo QR) e um item
 * dentro de "Integrações" (ligar o canal e guardar o número). São metades do mesmo canal: sem a
 * conexão não sai mensagem, e sem o número a mensagem que o paciente RESPONDE não encontra o
 * consultório (`users.whatsappId` é a chave do roteamento, em `lib/whatsapp.ts`). Configurar uma
 * e não a outra deixava o canal pela metade, sem nada na tela dizendo o quê faltava.
 *
 * Agora é um lugar só, na ordem em que se usa: conecta o aparelho, depois informa o número.
 */
export function WhatsappCard({ connected, canal, numero }: { connected: boolean; canal: boolean; numero: string }) {
  const [isConnected, setIsConnected] = useState(connected);
  const [canalLigado, setCanalLigado] = useState(canal);
  const [num, setNum] = useState(numero);
  const [salvando, salvar] = useTransition();
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

      {/* O canal e o número — o que antes vivia em "Integrações". Fica depois da conexão porque é
          essa a ordem de uso: primeiro o aparelho responde, depois o app sabe quem é. */}
      <div className="border-t border-border pt-4 space-y-3">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" checked={canalLigado} className="mt-1 w-4 h-4 accent-[#25D366]"
            onChange={(e) => {
              const ligado = e.target.checked;
              setCanalLigado(ligado);
              salvar(() => { void setIntegration({ whatsapp: ligado, whatsappNumber: num }); });
            }} />
          <span className="text-sm leading-snug">
            <strong className="text-primary">Usar o WhatsApp para falar com os pacientes</strong>
            <span className="block text-foreground/50">Confirmações, lembretes e cobranças saem por aqui.</span>
          </span>
        </label>

        {canalLigado && (
          <div className="space-y-1">
            <input value={num} onChange={(e) => setNum(e.target.value)}
              onBlur={() => salvar(() => { void setIntegration({ whatsapp: canalLigado, whatsappNumber: num }); })}
              placeholder="Número com DDD (ex: 11 90000-0000)"
              className="w-full px-4 py-2.5 rounded-xl bg-surface border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm" />
            <p className="text-xs text-foreground/40">
              É por este número que o Ledivan reconhece as respostas dos pacientes.
              {salvando && " Salvando…"}
            </p>
          </div>
        )}
      </div>

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

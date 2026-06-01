"use client";

import { useState } from "react";
import { generateTelegramCode } from "./actions";
import { Check, RefreshCw, Send } from "lucide-react";

const BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "levitanplusbot";

export function TelegramSync({ currentId }: { currentId?: string | null }) {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await generateTelegramCode();
      setCode(res.code);
    } catch {
      alert("Erro ao gerar código.");
    } finally {
      setLoading(false);
    }
  };

  if (currentId && !code) {
    return (
      <div className="p-6 bg-[#ecfdf5] rounded-3xl border border-[#047857]/20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#047857] rounded-2xl flex items-center justify-center text-white">
            <Check className="w-6 h-6" />
          </div>
          <div>
            <p className="font-bold text-[#047857]">Telegram conectado</p>
            <p className="text-sm text-[#047857]/70">Você já pode lançar por mensagem.</p>
          </div>
        </div>
        <button onClick={handleGenerate} className="text-xs font-bold text-[#047857] hover:underline">Reconectar</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!code ? (
        <button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full py-4 bg-[#229ED9] text-white rounded-2xl font-bold hover:opacity-90 transition flex items-center justify-center gap-2"
        >
          {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Conectar Telegram
        </button>
      ) : (
        <div className="space-y-3">
          <a
            href={`https://t.me/${BOT}?start=${code}`}
            target="_blank"
            rel="noreferrer"
            className="w-full py-4 bg-[#229ED9] text-white rounded-2xl font-bold hover:opacity-90 transition flex items-center justify-center gap-2"
          >
            <Send className="w-5 h-5" /> Abrir no Telegram e conectar
          </a>
          <p className="text-xs text-foreground/50 text-center leading-relaxed">
            Toque no botão acima → o Telegram abre no bot <strong>@{BOT}</strong> → toque em <strong>Iniciar</strong>. Pronto, conecta sozinho.
          </p>
          <p className="text-[11px] text-foreground/40 text-center">
            Não abriu? Procure <strong>@{BOT}</strong> no Telegram e envie <code className="bg-surface px-1.5 py-0.5 rounded">/v {code}</code> (expira em 10 min).
          </p>
        </div>
      )}
    </div>
  );
}

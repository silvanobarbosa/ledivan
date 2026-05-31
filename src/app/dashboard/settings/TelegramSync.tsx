"use client";

import { useState } from "react";
import { generateTelegramCode } from "./actions";
import { Smartphone, Check, Copy, RefreshCw } from "lucide-react";

export function TelegramSync({ currentId }: { currentId?: string | null }) {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await generateTelegramCode();
      setCode(res.code);
    } catch (err) {
      alert("Erro ao gerar código.");
    } finally {
      setLoading(false);
    }
  };

  if (currentId) {
    return (
      <div className="p-6 bg-green-50 rounded-3xl border border-green-100 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center text-white">
            <Check className="w-6 h-6" />
          </div>
          <div>
            <p className="font-bold text-green-800">Telegram Vinculado</p>
            <p className="text-sm text-green-600">ID: {currentId}</p>
          </div>
        </div>
        <button 
          onClick={handleGenerate}
          className="text-xs font-bold text-green-700 hover:underline"
        >
          Trocar Conta
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="p-6 bg-surface rounded-3xl border border-border space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center text-primary">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <p className="font-bold">Vincular CapiBot</p>
            <p className="text-sm text-foreground/40 font-medium">Use o Telegram para anotar gastos rapidamente.</p>
          </div>
        </div>

        {!code ? (
          <button 
            onClick={handleGenerate}
            disabled={loading}
            className="w-full py-4 bg-primary text-white rounded-2xl font-bold shadow-lg shadow-primary/20 hover:opacity-90 transition-all flex items-center justify-center gap-2"
          >
            {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
            Gerar Código de Verificação
          </button>
        ) : (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
            <div className="p-4 bg-white border-2 border-dashed border-primary/30 rounded-2xl text-center">
              <p className="text-xs font-bold text-foreground/30 uppercase tracking-widest mb-1">Seu Código</p>
              <p className="text-4xl font-display font-bold text-primary tracking-[0.2em]">{code}</p>
            </div>
            <div className="bg-primary/5 p-4 rounded-2xl space-y-2">
              <p className="text-sm font-medium text-primary">
                1. Abra o Telegram e procure por <strong>@CapiCashBot</strong>
              </p>
              <p className="text-sm font-medium text-primary">
                2. Envie o comando: <code className="bg-white px-2 py-1 rounded">/v {code}</code>
              </p>
            </div>
          </div>
        )}
      </div>
      <p className="text-[10px] text-foreground/30 font-medium px-2">
        O código expira em 10 minutos. Nunca compartilhe este código com ninguém.
      </p>
    </div>
  );
}

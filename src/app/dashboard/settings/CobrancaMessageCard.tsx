"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveCobrancaMessage } from "./actions";
import { MODELO_PADRAO_COBRANCA } from "@/lib/mensagemCobranca";

/**
 * Modelo da mensagem de COBRANÇA (dono, 16/09/2026). A terapeuta escreve o texto com as variáveis
 * {nome}, {valor} e {vencimento}; o sistema troca pelos dados na hora de cobrar.
 */
export function CobrancaMessageCard({ initial }: { initial: string | null }) {
  const router = useRouter();
  const [texto, setTexto] = useState(initial ?? "");
  const [pending, start] = useTransition();
  const [salvo, setSalvo] = useState(false);

  function salvar() {
    const fd = new FormData();
    fd.set("cobrancaMessage", texto);
    start(async () => { await saveCobrancaMessage(fd); setSalvo(true); router.refresh(); setTimeout(() => setSalvo(false), 2000); });
  }

  return (
    <div className="glass-card rounded-[24px] p-6 space-y-3">
      <div>
        <h3 className="font-display font-bold text-primary">Mensagem de cobrança</h3>
        <p className="text-sm text-foreground/50">O texto que você usa para cobrar. Deixe em branco para o padrão do app.</p>
      </div>
      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        rows={4}
        placeholder={MODELO_PADRAO_COBRANCA}
        className="w-full px-4 py-3 rounded-2xl bg-white/70 border border-border focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none transition text-sm resize-y"
      />
      <p className="text-xs text-foreground/50">
        Variáveis: <code className="bg-black/5 px-1 rounded">{"{nome}"}</code>{" "}
        <code className="bg-black/5 px-1 rounded">{"{valor}"}</code>{" "}
        <code className="bg-black/5 px-1 rounded">{"{vencimento}"}</code>
      </p>
      <div className="flex items-center gap-3">
        <button onClick={salvar} disabled={pending} className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-60">
          {pending ? "Salvando…" : "Salvar"}
        </button>
        {salvo && <span className="text-sm text-[#047857] font-semibold">Salvo ✓</span>}
      </div>
    </div>
  );
}
